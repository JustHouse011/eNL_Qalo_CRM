import { test, expect } from '@playwright/test'
import { QueryClient } from '@tanstack/react-query'
import { createMockData } from '../../src/data/mockCatalog'
import { createSupportService } from '../../src/lib/supportService'
import { createWorkspaceStore, loadWorkspaceStore, recoverWorkspaceStore, scopeWorkspaceData, validateWorkspaceStore, LEGACY_STORAGE_KEY, WORKSPACE_BACKUP_KEY, WORKSPACE_STORAGE_KEY, type WorkspaceStorage } from '../../src/lib/workspaceMigration'
import { canInWorkspace, QALO_WORKSPACE_ID, workspaceQueryKey } from '../../src/lib/workspaceTypes'

function localStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const writes: string[] = []
  return { values, writes, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { writes.push(key); values.set(key, value) } }
}
function twoWorkspaces() {
  const store = createWorkspaceStore()
  const fixtureId = 'workspace-isolation-test'
  const data = createMockData()
  data.conversations[0].customer = 'Other workspace customer'
  store.workspaces.push({ ...store.workspaces[0], id: fixtureId, name: 'Isolation test fixture', slug: 'isolation-test' })
  store.snapshots[fixtureId] = scopeWorkspaceData(data, fixtureId)
  store.memberships.push({ ...store.memberships[0], id: 'membership-test', workspaceId: fixtureId })
  validateWorkspaceStore(store)
  return { store, fixtureId }
}

test('clean initialization creates only Qalo with fully scoped records and memberships', () => {
  const storage = localStore()
  const loaded = loadWorkspaceStore(storage)
  expect(loaded.state).toBe('persistent')
  expect(loaded.store.workspaces.map(workspace => workspace.id)).toEqual([QALO_WORKSPACE_ID])
  const snapshot = loaded.store.snapshots[QALO_WORKSPACE_ID]
  expect(snapshot.conversations).toHaveLength(createMockData().conversations.length)
  expect(snapshot.conversations.every(c => c.workspaceId === QALO_WORKSPACE_ID && c.messages.every(m => m.workspaceId === QALO_WORKSPACE_ID && m.conversationId === c.id))).toBe(true)
  expect(snapshot.agents.every(agent => agent.workspaceId === QALO_WORKSPACE_ID)).toBe(true)
  expect(loaded.store.memberships).toHaveLength(3)
  expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
})

for (const modified of [false, true]) {
  test(`legacy migration preserves ${modified ? 'modified' : 'clean'} data and verifies backup before commit`, () => {
    const data = createMockData()
    if (modified) {
      data.contacts[0].name = 'Edited customer name'
      data.conversations[0].messages.push({ id: 'user-message', author: 'User', text: 'Keep my exact wording.', kind: 'note', time: '2026-10-08T08:00:00Z' })
      data.tickets[0].subject = 'Edited ticket subject'
      data.widget = { greeting: 'My saved greeting', colour: '#123456', position: 'left', branding: false }
      data.settings!.notifications.reply = false
      data.articles[0].body = 'My approved article wording'
      data.queues!.push({ name: 'Custom queue', area: 'general' })
    }
    const raw = JSON.stringify({ ...data, customExtension: { keep: 'unknown fields survive' } }, null, 2)
    const storage = localStore({ [LEGACY_STORAGE_KEY]: raw })
    const { store } = loadWorkspaceStore(storage)
    expect(storage.getItem(WORKSPACE_BACKUP_KEY)).toBe(raw)
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw)
    expect(storage.writes).toEqual([WORKSPACE_BACKUP_KEY, WORKSPACE_STORAGE_KEY])
    const snapshot = store.snapshots[QALO_WORKSPACE_ID]
    expect(snapshot.conversations.map(c => c.id)).toEqual(data.conversations.map(c => c.id))
    expect(snapshot.conversations[0].messages.map(m => m.text)).toEqual(data.conversations[0].messages.map(m => m.text))
    expect(snapshot.contacts[0].name).toBe(data.contacts[0].name)
    expect(snapshot.tickets[0].subject).toBe(data.tickets[0].subject)
    expect(snapshot.articles[0].body).toBe(data.articles[0].body)
    expect(snapshot.settings!.notifications.reply).toBe(data.settings!.notifications.reply)
    expect(snapshot).toMatchObject({ customExtension: { keep: 'unknown fields survive' } })
    if (modified) expect(snapshot.widget).toMatchObject(data.widget!)
    const again = loadWorkspaceStore(storage)
    expect(again.store).toEqual(store)
    expect(storage.writes).toHaveLength(2)
  })
}

test('new store remains authoritative over stale legacy data', async () => {
  const storage = localStore({ [LEGACY_STORAGE_KEY]: JSON.stringify(createMockData()) })
  const service = createSupportService(() => storage)
  await service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, widget: { greeting: 'After migration', colour: '#123456', position: 'left', branding: true } }))
  expect(createSupportService(() => storage).registry().snapshots[QALO_WORKSPACE_ID].widget?.greeting).toBe('After migration')
  expect(JSON.parse(storage.getItem(LEGACY_STORAGE_KEY)!).widget?.greeting).not.toBe('After migration')
})

test('corrupt, unsupported and foreign-owned stores are retained and fail without reset', () => {
  for (const raw of ['{bad json', JSON.stringify({ version: 99 }), JSON.stringify({ ...createWorkspaceStore(), snapshots: { [QALO_WORKSPACE_ID]: { ...createWorkspaceStore().snapshots[QALO_WORKSPACE_ID], workspaceId: 'foreign' } } })]) {
    const storage = localStore({ [WORKSPACE_STORAGE_KEY]: raw, [LEGACY_STORAGE_KEY]: JSON.stringify(createMockData()) })
    expect(() => loadWorkspaceStore(storage)).toThrow(/recovery/)
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw)
    expect(storage.writes).toEqual([])
  }
  const legacy = localStore({ [LEGACY_STORAGE_KEY]: '{broken legacy' })
  expect(() => loadWorkspaceStore(legacy)).toThrow(/recovery/)
  expect(legacy.writes).toEqual([])
})

test('failed backup or migration commit preserves legacy data and blocks edits', async () => {
  for (const failedKey of [WORKSPACE_BACKUP_KEY, WORKSPACE_STORAGE_KEY]) {
    const raw = JSON.stringify(createMockData())
    const base = localStore({ [LEGACY_STORAGE_KEY]: raw })
    const storage: WorkspaceStorage = { getItem: base.getItem, setItem(key, value) { if (key === failedKey) throw new Error('Quota exceeded'); base.setItem(key, value) } }
    const service = createSupportService(() => storage)
    expect((await service.readWorkspace(QALO_WORKSPACE_ID)).conversations).toHaveLength(createMockData().conversations.length)
    expect(service.persistenceState()).toBe('migration-pending')
    await expect(service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, tickets: [] }))).rejects.toThrow(/backup/)
    expect(base.getItem(LEGACY_STORAGE_KEY)).toBe(raw)
    expect(base.getItem(WORKSPACE_STORAGE_KEY)).toBeNull()
    if (failedKey === WORKSPACE_BACKUP_KEY) expect(base.writes).toEqual([])
  }
})

test('memory fallback retains edits when storage is unavailable', async () => {
  const service = createSupportService(() => { throw new Error('Blocked') })
  await service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, tickets: [] }))
  expect((await service.readWorkspace(QALO_WORKSPACE_ID)).tickets).toEqual([])
  expect(service.persistenceState()).toBe('memory')
})

test('explicit recovery archives corrupt current data and retains its source', () => {
  const raw = JSON.stringify(createMockData())
  const storage = localStore({ [WORKSPACE_STORAGE_KEY]: '{corrupt', [WORKSPACE_BACKUP_KEY]: raw })
  const recovered = recoverWorkspaceStore(storage, WORKSPACE_BACKUP_KEY)
  expect(recovered.snapshots[QALO_WORKSPACE_ID].conversations).toHaveLength(createMockData().conversations.length)
  expect(storage.getItem('qalo-workspaces-v2-recovery-backup')).toBe('{corrupt')
  expect(storage.getItem(WORKSPACE_BACKUP_KEY)).toBe(raw)
  expect(loadWorkspaceStore(storage).store).toEqual(recovered)
})

test('recovery cannot replace current data until its archive is verified', () => {
  const base = localStore({ [WORKSPACE_STORAGE_KEY]: '{corrupt', [WORKSPACE_BACKUP_KEY]: JSON.stringify(createMockData()) })
  const storage: WorkspaceStorage = { getItem: base.getItem, setItem(key, value) { if (key.startsWith('qalo-workspaces-v2-recovery-backup')) throw new Error('No archive space'); base.setItem(key, value) } }
  expect(() => recoverWorkspaceStore(storage, WORKSPACE_BACKUP_KEY)).toThrow(/archive space/)
  expect(base.getItem(WORKSPACE_STORAGE_KEY)).toBe('{corrupt')
  expect(base.writes).toEqual([])
})

test('invalid legacy record fields fail validation without overwriting the source', () => {
  const data = createMockData()
  const raw = JSON.stringify({ ...data, contacts: [{ ...data.contacts[0], email: 123 }] })
  const storage = localStore({ [LEGACY_STORAGE_KEY]: raw })
  expect(() => loadWorkspaceStore(storage)).toThrow(/invalid contacts fields/)
  expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw)
  expect(storage.writes).toEqual([])
})

test('previous backups are not overwritten by a later legacy import', () => {
  const original = JSON.stringify(createMockData())
  const changed = createMockData(); changed.contacts[0].name = 'Later edit'
  const raw = JSON.stringify(changed)
  const storage = localStore({ [LEGACY_STORAGE_KEY]: raw, [WORKSPACE_BACKUP_KEY]: original })
  loadWorkspaceStore(storage)
  expect(storage.getItem(WORKSPACE_BACKUP_KEY)).toBe(original)
  expect([...storage.values.entries()].some(([key, value]) => key.startsWith(`${WORKSPACE_BACKUP_KEY}:`) && value === raw)).toBe(true)
})

test('scoped reads, originating delayed writes and subscriptions stay isolated', async () => {
  const { store, fixtureId } = twoWorkspaces()
  const storage = localStore({ [WORKSPACE_STORAGE_KEY]: JSON.stringify(store) })
  const service = createSupportService(() => storage)
  let notifications = 0
  service.subscribe(() => { notifications++ }, fixtureId)
  const origin = QALO_WORKSPACE_ID
  const delayedSave = () => service.updateWorkspace(origin, data => ({ ...data, conversations: data.conversations.map((c, index) => index === 0 ? { ...c, customer: 'Origin edit' } : c) }))
  service.selectWorkspace(fixtureId)
  const before = await service.readWorkspace(fixtureId)
  notifications = 0
  await delayedSave()
  expect((await service.readWorkspace(origin)).conversations[0].customer).toBe('Origin edit')
  expect(await service.readWorkspace(fixtureId)).toEqual(before)
  expect(notifications).toBe(0)
  await expect(service.readWorkspace('missing')).rejects.toThrow(/not found/)
  await expect(service.updateWorkspace('missing', data => data)).rejects.toThrow(/missing/)
  const clone = await service.readWorkspace(origin); clone.tickets.length = 0
  expect((await service.readWorkspace(origin)).tickets.length).toBeGreaterThan(0)
})

test('foreign record writes fail without modifying either snapshot', async () => {
  const { store, fixtureId } = twoWorkspaces()
  const storage = localStore({ [WORKSPACE_STORAGE_KEY]: JSON.stringify(store) })
  const service = createSupportService(() => storage)
  expect(service.registry().snapshots).toEqual(store.snapshots)
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY)
  const foreign = await service.readWorkspace(fixtureId)
  await expect(service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, conversations: [foreign.conversations[0], ...data.conversations.slice(1)] }))).rejects.toThrow(/foreign/)
  expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw)
})

test('stable relationship IDs survive repeated normalization and name-based UI assignment', async () => {
  const service = createSupportService(() => null)
  const before = await service.readWorkspace(QALO_WORKSPACE_ID)
  const after = await service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, conversations: data.conversations.map((c, index) => index === 0 ? { ...c, assignee: 'Tumo Likotsi' } : c) }))
  expect(after.conversations[0].assigneeId).toBe('agent-3')
  expect(after.conversations[0].departmentId).toBe(before.conversations[0].departmentId)
  expect(after.departments.map(department => department.id)).toEqual(before.departments.map(department => department.id))
})

test('queue additions after deletion have unique IDs and renames retain department identity', async () => {
  const service = createSupportService(() => null)
  const before = await service.readWorkspace(QALO_WORKSPACE_ID)
  const queue = before.queues![0]
  await service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, tickets: data.tickets.map((ticket, index) => index === 0 ? { ...ticket, department: queue.name, businessArea: queue.area } : ticket) }))
  const renamed = await service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data,
    queues: data.queues!.map((item, index) => index === 0 ? { ...item, name: 'Renamed queue' } : item),
    conversations: data.conversations.map(c => c.department === queue.name ? { ...c, department: 'Renamed queue' } : c),
  }))
  expect(renamed.queues![0].departmentId).toBe(queue.departmentId)
  expect(renamed.departments.find(item => item.id === queue.departmentId)?.name).toBe('Renamed queue')
  expect(renamed.tickets[0].departmentId).toBe(queue.departmentId)
  expect(renamed.tickets[0].department).toBe('Renamed queue')
  const added = await service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, queues: [...data.queues!.slice(1), { name: 'New queue after deletion', area: 'general' }] }))
  const ids = added.queues!.map(item => item.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('temporary storage failures and deleted current stores cannot reset loaded user edits', async () => {
  const storage = localStore()
  let blocked = false
  const service = createSupportService(() => { if (blocked) throw new Error('Blocked'); return storage })
  await service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, widget: { greeting: 'Retain this edit', colour: '#123456', position: 'left', branding: false } }))
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY)!
  blocked = true
  await expect(service.readWorkspace(QALO_WORKSPACE_ID)).rejects.toThrow(/retained/)
  await expect(service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, tickets: [] }))).rejects.toThrow(/retained/)
  blocked = false
  expect((await service.readWorkspace(QALO_WORKSPACE_ID)).widget?.greeting).toBe('Retain this edit')
  storage.values.delete(WORKSPACE_STORAGE_KEY)
  await expect(service.readWorkspace(QALO_WORKSPACE_ID)).rejects.toThrow(/recovery/)
  expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull()
  storage.values.set(WORKSPACE_STORAGE_KEY, raw)
  expect((await service.readWorkspace(QALO_WORKSPACE_ID)).widget?.greeting).toBe('Retain this edit')
})

test('failed regular saves leave the previous persisted workspace unchanged', async () => {
  const base = localStore()
  let failWrites = false
  const storage: WorkspaceStorage = { getItem: base.getItem, setItem(key, value) { if (failWrites) throw new Error('Quota exceeded'); base.setItem(key, value) } }
  const service = createSupportService(() => storage)
  await service.readWorkspace(QALO_WORKSPACE_ID)
  const raw = base.getItem(WORKSPACE_STORAGE_KEY)
  failWrites = true
  await expect(service.updateWorkspace(QALO_WORKSPACE_ID, data => ({ ...data, contacts: [] }))).rejects.toThrow(/Quota/)
  expect(base.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw)
  expect((await service.readWorkspace(QALO_WORKSPACE_ID)).contacts.length).toBeGreaterThan(0)
})

test('query cache writes and exact invalidation are workspace-specific', async () => {
  const client = new QueryClient()
  const qalo = workspaceQueryKey(QALO_WORKSPACE_ID)
  const other = workspaceQueryKey('workspace-isolation-test')
  client.setQueryData(qalo, { value: 'Qalo' })
  client.setQueryData(other, { value: 'Other' })
  client.setQueryData(qalo, { value: 'Saved in Qalo' })
  await client.invalidateQueries({ queryKey: qalo, exact: true })
  expect(client.getQueryData(other)).toEqual({ value: 'Other' })
  expect(client.getQueryState(other)?.isInvalidated).toBe(false)
  expect(client.getQueryState(qalo)?.isInvalidated).toBe(true)
  client.clear()
})

test('capability helpers respect memberships, roles, inactive workspaces and platform admins', () => {
  const store = createWorkspaceStore()
  const workspace = store.workspaces[0]
  const admin = store.users[0], supervisor = store.users[1], agent = store.users[2]
  expect(canInWorkspace(admin, workspace, store.memberships, 'manage-members')).toBe(true)
  expect(canInWorkspace(supervisor, workspace, store.memberships, 'manage-support')).toBe(false)
  expect(canInWorkspace(supervisor, workspace, store.memberships, 'manage-workspace')).toBe(false)
  expect(canInWorkspace(agent, workspace, store.memberships, 'reply')).toBe(true)
  expect(canInWorkspace(agent, workspace, [], 'view')).toBe(false)
  expect(canInWorkspace(agent, workspace, store.memberships.map(m => ({ ...m, status: 'inactive' })), 'view')).toBe(false)
  expect(canInWorkspace({ ...agent, role: 'administrator' }, workspace, [], 'manage-platform')).toBe(true)
  expect(canInWorkspace(agent, { ...workspace, status: 'inactive' }, store.memberships, 'view')).toBe(false)
  expect(canInWorkspace(admin, { ...workspace, status: 'inactive' }, [], 'manage-workspace')).toBe(true)
})

test('browser migrates modified legacy records and keeps them accessible after reload', async ({ page }) => {
  const data = createMockData()
  data.conversations.find(c => c.id === 'conv-1')!.messages.push({ id: 'migration-note', author: 'Bongani Nombamba', text: 'Preserved legacy note', kind: 'note', time: '2026-10-08T08:00:00Z' })
  data.tickets[0].subject = 'Preserved legacy ticket'
  const raw = JSON.stringify(data)
  await page.addInitScript(({ raw, legacyKey }) => { if (!localStorage.getItem('migration-fixture-loaded')) { localStorage.setItem(legacyKey, raw); localStorage.setItem('migration-fixture-loaded', 'true') } }, { raw, legacyKey: LEGACY_STORAGE_KEY })
  await page.goto('/inbox?conversation=conv-1')
  await expect(page.locator('.note-message').getByText('Preserved legacy note')).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), WORKSPACE_BACKUP_KEY)).toBe(raw)
  await page.getByLabel('Write a customer reply').fill('New reply after migration')
  await page.getByRole('button', { name: 'Send reply', exact: true }).click()
  await expect(page.locator('.message-bubble').getByText('New reply after migration')).toBeVisible()
  await page.reload()
  await expect(page.locator('.note-message').getByText('Preserved legacy note')).toBeVisible()
  await expect(page.locator('.message-bubble').getByText('New reply after migration')).toBeVisible()
  await page.goto('/tickets')
  await expect(page.getByRole('button', { name: /Preserved legacy ticket/ })).toBeVisible()
})

test('real React hook keeps delayed saves, cache results and errors in their originating workspace', async ({ page }) => {
  test.skip(process.env.QALO_PREVIEW === '1', 'Hook harness imports source modules from the development server')
  const { store, fixtureId } = twoWorkspaces()
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: WORKSPACE_STORAGE_KEY, raw: JSON.stringify(store) })
  await page.goto('/signin')
  await page.evaluate(async () => {
    const path = '/tests/helpers/workspaceHookHarness.tsx'
    const harness = await import(path)
    ;(window as any).__workspaceHookTest = harness.mountWorkspaceHookHarness()
  })
  await page.waitForFunction(() => (window as any).__workspaceHookTest.current?.data?.workspaceId === 'workspace-qalo')
  await page.evaluate(id => {
    const state = (window as any).__workspaceHookTest
    state.originalUpdate = state.service.updateWorkspace
    state.service.updateWorkspace = (origin: string, change: any) => new Promise((resolve, reject) => { state.release = () => state.originalUpdate(origin, change).then(resolve, reject) })
    state.pendingSave = state.current.setData((data: any) => ({ ...data, conversations: data.conversations.map((c: any, index: number) => index === 0 ? { ...c, customer: 'Delayed Qalo edit' } : c) }))
    state.service.selectWorkspace(id)
  }, fixtureId)
  await page.waitForFunction(id => (window as any).__workspaceHookTest.current?.data?.workspaceId === id, fixtureId)
  expect(await page.evaluate(() => (window as any).__workspaceHookTest.current.saving)).toBe(false)
  await page.evaluate(async () => { const state = (window as any).__workspaceHookTest; state.release(); await state.pendingSave; state.service.updateWorkspace = state.originalUpdate })
  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__workspaceHookTest
    return state.client.getQueryData(state.key('workspace-qalo'))?.conversations[0].customer
  })).toBe('Delayed Qalo edit')
  expect(await page.evaluate(id => {
    const state = (window as any).__workspaceHookTest
    return { current: state.current.data.conversations[0].customer, cached: state.client.getQueryData(state.key(id)).conversations[0].customer, error: state.current.saveError }
  }, fixtureId)).toEqual({ current: 'Other workspace customer', cached: 'Other workspace customer', error: '' })
  await page.evaluate(() => (window as any).__workspaceHookTest.service.selectWorkspace('workspace-qalo'))
  await page.waitForFunction(() => (window as any).__workspaceHookTest.current.workspaceId === 'workspace-qalo')
  await page.evaluate(id => {
    const state = (window as any).__workspaceHookTest
    state.service.updateWorkspace = () => new Promise((_resolve, reject) => { state.release = () => reject(new Error('Origin-only save failure')) })
    state.pendingSave = state.current.setData((data: any) => data)
    state.service.selectWorkspace(id)
  }, fixtureId)
  await page.waitForFunction(id => (window as any).__workspaceHookTest.current.workspaceId === id, fixtureId)
  await page.evaluate(async () => { const state = (window as any).__workspaceHookTest; state.release(); await state.pendingSave; state.service.updateWorkspace = state.originalUpdate })
  expect(await page.evaluate(() => (window as any).__workspaceHookTest.current.saveError)).toBe('')
  await page.evaluate(() => (window as any).__workspaceHookTest.service.selectWorkspace('workspace-qalo'))
  await page.waitForFunction(() => (window as any).__workspaceHookTest.current.saveError === 'Origin-only save failure')
  await page.evaluate(() => { const state = (window as any).__workspaceHookTest; state.root.unmount(); state.client.clear(); delete (window as any).__workspaceHookTest })
})
