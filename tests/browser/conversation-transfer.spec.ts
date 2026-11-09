import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { createSupportService } from '../../src/lib/supportService'
import { createConversationTransfers, getEligibleTransferAgents, mayTransfer, transferVersion } from '../../src/lib/conversationTransfer'
import { createConversationSupport } from '../../src/lib/conversationLifecycle'
import { QALO_WORKSPACE_ID, type WorkspaceStore } from '../../src/lib/workspaceTypes'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { WORKSPACE_STORAGE_KEY } from '../../src/lib/workspaceMigration'
import { selectWorkspace } from '../helpers/workspaceSelector'

function fixture() {
  const values = new Map<string, string>()
  let fail = false
  const service = createSupportService(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw new Error('Storage unavailable'); values.set(key, value) } }))
  service.initializeEnl(platformPreview.id); service.initializeIdentity()
  function change(edit: (store: WorkspaceStore) => void) { const store = service.registry(); edit(store); values.set(WORKSPACE_STORAGE_KEY, JSON.stringify(store)) }
  change(store => { for (const snapshot of Object.values(store.snapshots)) { for (const a of snapshot.agents) { a.presence = 'online'; a.departmentIds = undefined } } })
  return { service, change, fail: () => { fail = true }, transfer: createConversationTransfers(service) }
}
async function request(f: ReturnType<typeof fixture>, workspaceId = QALO_WORKSPACE_ID, userId = 'user-agent-2') {
  const store = f.service.registry(), c = store.snapshots[workspaceId].conversations.find(c => c.status !== 'resolved')!
  const agent = getEligibleTransferAgents(store, c, 'user-agent-1').find(a => a.userId === userId)!
  expect(agent).toBeTruthy()
  return { workspaceId, conversationId: c.id, actorId: 'user-agent-1', agentId: agent.id, expectedVersion: transferVersion(c), note: 'Please review privately.', requestId: crypto.randomUUID() }
}

for (const workspace of [QALO_WORKSPACE_ID, ENL_WORKSPACE_ID]) test(`transfer persists assignment, history, status and targeted notification: ${workspace}`, async () => {
  const f = fixture(), input = await request(f, workspace), before = await f.service.readWorkspace(workspace), original = before.conversations.find(c => c.id === input.conversationId)!
  let events = 0; const unsubscribe = f.service.subscribe(() => events++, workspace)
  await f.transfer.transfer(input); await f.transfer.transfer(input); unsubscribe()
  const after = await f.service.readWorkspace(workspace), c = after.conversations.find(c => c.id === original.id)!
  expect(after.conversations).toHaveLength(before.conversations.length)
  expect(c).toMatchObject({ workspaceId: workspace, assigneeId: input.agentId, status: original.status === 'waiting' ? 'open' : original.status })
  const handover = original.status === 'waiting' || original.handling === 'ai' || original.handling === 'waiting'
  expect(c.handling).toBe(handover ? 'human' : original.handling); expect(c.lifecycle).toBe(handover ? 'human' : original.lifecycle)
  expect(c.messages).toEqual(original.messages); expect(after.tickets).toEqual(before.tickets)
  expect(c.history.filter(h => h.type === 'conversation-transfer')).toHaveLength(1)
  expect(c.history.at(-1)?.transfer).toMatchObject({ actorId: input.actorId, toAgentId: input.agentId, note: input.note, workspaceId: workspace, conversationId: c.id })
  expect(after.notifications?.filter(n => n.recipientUserId === 'user-agent-2')).toHaveLength(1)
  expect(events).toBeGreaterThanOrEqual(1)
})

test('eligibility uses explicit memberships and excludes foreign, inactive, viewer, current and offline targets', async () => {
  const f = fixture(), input = await request(f), store = f.service.registry(), c = store.snapshots[QALO_WORKSPACE_ID].conversations.find(c => c.id === input.conversationId)!
  expect(getEligibleTransferAgents(store, c, input.actorId).every(a => a.workspaceId === c.workspaceId && a.id !== c.assigneeId)).toBe(true)
  expect(getEligibleTransferAgents(store, { ...c, workspaceId: ENL_WORKSPACE_ID }, input.actorId).some(a => a.workspaceId === QALO_WORKSPACE_ID)).toBe(false)
  for (const mutation of [
    (s: WorkspaceStore) => { s.users.find(u => u.id === 'user-agent-2')!.status = 'suspended' },
    (s: WorkspaceStore) => { s.memberships.find(m => m.workspaceId === QALO_WORKSPACE_ID && m.userId === 'user-agent-2')!.status = 'inactive' },
    (s: WorkspaceStore) => { s.memberships.find(m => m.workspaceId === QALO_WORKSPACE_ID && m.userId === 'user-agent-2')!.role = 'viewer' },
    (s: WorkspaceStore) => { s.snapshots[QALO_WORKSPACE_ID].agents.find(a => a.id === input.agentId)!.presence = 'offline' },
  ]) { const copy = structuredClone(store); mutation(copy); expect(getEligibleTransferAgents(copy, c, input.actorId).some(a => a.id === input.agentId)).toBe(false) }
  const copy = structuredClone(store); copy.memberships = copy.memberships.filter(m => m.userId !== 'user-agent-1')
  const other = { ...c, assigneeId: input.agentId, assignee: 'Phindile Khumalo' }
  expect(getEligibleTransferAgents(copy, other, platformPreview.id).some(a => a.userId === 'user-agent-1')).toBe(false)
})

test('command rejects cross-workspace, revocation, closure, concurrency and failed persistence without partial writes', async () => {
  const f = fixture(), input = await request(f)
  const foreign = f.service.registry().snapshots[ENL_WORKSPACE_ID].agents[0]
  await expect(f.transfer.transfer({ ...input, agentId: foreign.id })).rejects.toThrow(/eligible/)
  await expect(f.transfer.transfer({ ...input, actorId: 'user-agent-3' })).rejects.toThrow(/Permission/)
  f.change(store => { store.users.find(u => u.id === 'user-agent-2')!.status = 'inactive' })
  await expect(f.transfer.transfer(input)).rejects.toThrow(/eligible/)
  f.change(store => { store.users.find(u => u.id === 'user-agent-2')!.status = 'active' })
  const competing = { ...input, requestId: crypto.randomUUID() }
  const results = await Promise.allSettled([f.transfer.transfer(input), f.transfer.transfer(competing)])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(String((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason)).toMatch(/conflict/)
  const closed = fixture(), closedInput = await request(closed)
  closed.change(s => { s.snapshots[QALO_WORKSPACE_ID].conversations.find(c => c.id === closedInput.conversationId)!.status = 'resolved' })
  await expect(closed.transfer.transfer(closedInput)).rejects.toThrow(/closed/)
  const broken = fixture(), brokenInput = await request(broken), before = broken.service.registry()
  broken.fail(); await expect(broken.transfer.transfer(brokenInput)).rejects.toThrow(/Storage/)
  expect(broken.service.registry()).toEqual(before)
})

test('ordinary ownership moves to receiver, while managers retain workspace authority', async () => {
  const f = fixture(), input = await request(f)
  await f.transfer.transfer(input)
  const c = (await f.service.readWorkspace(QALO_WORKSPACE_ID)).conversations.find(c => c.id === input.conversationId)!
  expect(mayTransfer(f.service.registry(), c, 'user-agent-3')).toBe(false)
  expect(mayTransfer(f.service.registry(), c, 'user-agent-2')).toBe(true)
  expect(mayTransfer(f.service.registry(), c, 'user-agent-1')).toBe(true)
  const lifecycle = createConversationSupport(f.service)
  await expect(lifecycle.reply(QALO_WORKSPACE_ID, c.id, 'user-agent-3', 'Not my reply')).rejects.toThrow(/another agent/)
  await expect(lifecycle.update(QALO_WORKSPACE_ID, c.id, 'user-agent-3', { assignee: 'Tumo Likotsi' })).rejects.toThrow(/assigned agent/)
})

test('explicit receiving-agent IDs survive duplicate staff display names', async () => {
  const f = fixture(), input = await request(f)
  f.change(store => {
    const agents = store.snapshots[QALO_WORKSPACE_ID].agents
    agents.find(a => a.id !== input.agentId)!.name = agents.find(a => a.id === input.agentId)!.name
  })
  await f.transfer.transfer(input)
  expect((await f.service.readWorkspace(QALO_WORKSPACE_ID)).conversations.find(c => c.id === input.conversationId)?.assigneeId).toBe(input.agentId)
})

test('shared transfer UI supports search, notes, themes, responsive layout and persisted queues', async ({ page }) => {
  test.setTimeout(180000); page.setDefaultNavigationTimeout(90000)
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1000 })
  const f = fixture(), store = f.service.registry()
  await page.addInitScript(store => { if (!localStorage.getItem('qalo-workspaces-v2')) localStorage.setItem('qalo-workspaces-v2', JSON.stringify(store)) }, store)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept())
  mkdirSync('test-results', { recursive: true })
  for (const workspaceId of [QALO_WORKSPACE_ID, ENL_WORKSPACE_ID]) {
    await page.goto('/inbox', { waitUntil: 'domcontentloaded' })
    if (workspaceId === ENL_WORKSPACE_ID) await selectWorkspace(page, workspaceId)
    const selectedId = store.snapshots[workspaceId].conversations.find(c => c.status !== 'resolved')!.id
    await page.goto(`/inbox?conversation=${encodeURIComponent(selectedId)}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Transfer Chat', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Transfer Conversation' })
    await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Transfer Chat', exact: true })).toBeDisabled()
    if (workspaceId === ENL_WORKSPACE_ID) await expect(dialog).toContainText('Tumo Likotsi')
    await dialog.getByRole('textbox', { name: 'Search agents' }).fill('Phindile')
    await dialog.getByRole('radio').check(); await dialog.getByRole('textbox', { name: 'Transfer note' }).fill('Internal handover only')
    for (const mode of ['dark', 'light']) {
      await page.keyboard.press('Escape')
      const toggle = page.getByRole('button', { name: `Switch to ${mode} theme`, exact: true }); if (await toggle.count()) await toggle.click()
      await page.getByRole('button', { name: 'Transfer Chat', exact: true }).click()
      await dialog.getByRole('textbox', { name: 'Search agents' }).fill('Phindile'); await dialog.getByRole('radio').check()
      await dialog.getByRole('textbox', { name: 'Transfer note' }).fill('Internal handover only')
      await page.screenshot({ path: `test-results/transfer-${workspaceId}-${mode}.png`, animations: 'disabled' })
    }
    await dialog.getByRole('button', { name: 'Transfer Chat', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Conversation transferred successfully to Phindile Khumalo.', { exact: true })).toBeVisible()
    await page.reload({ waitUntil: 'domcontentloaded' })
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('qalo-workspaces-v2')!))
    const c = saved.snapshots[workspaceId].conversations.find((c: {id: string}) => c.id === selectedId)
    expect(c.assignee).toBe('Phindile Khumalo'); expect(c.history.at(-1).transfer.note).toBe('Internal handover only')
    expect(c.messages.some((m: {text: string}) => m.text === 'Internal handover only')).toBe(false)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Transfer Chat', exact: true }).click()
  const box = (await page.getByRole('dialog', { name: 'Transfer Conversation' }).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/transfer-mobile.png', animations: 'disabled' })
  await page.keyboard.press('Escape'); expect(errors).toEqual([])
})

test('cross-tab transfer updates both personal queues, recipient badge, reply ownership and stale dialogs', async ({ page, context }) => {
  test.setTimeout(180000); page.setDefaultNavigationTimeout(90000)
  const f = fixture(), input = await request(f)
  f.change(store => {
    const c = store.snapshots[QALO_WORKSPACE_ID].conversations.find(c => c.id === input.conversationId)!
    c.assignee = 'Phindile Khumalo'; c.assigneeId = input.agentId; c.status = 'open'; c.handling = 'human'; c.lifecycle = 'human'
  })
  const store = f.service.registry()
  await context.addInitScript(store => { if (!localStorage.getItem('qalo-workspaces-v2')) localStorage.setItem('qalo-workspaces-v2', JSON.stringify(store)) }, store)
  const receiver = await context.newPage(); receiver.setDefaultNavigationTimeout(90000)
  async function session(target: typeof page, user: string) {
    await target.emulateMedia({ reducedMotion: 'reduce' })
    await target.goto('/dev/session', { waitUntil: 'domcontentloaded' })
    await target.getByRole('combobox', { name: 'Account', exact: true }).selectOption(user)
    await target.getByRole('button', { name: 'Start session', exact: true }).click()
    await target.goto(`/inbox?conversation=${input.conversationId}`, { waitUntil: 'domcontentloaded' })
    await target.getByRole('tab', { name: 'Mine', exact: true }).click()
  }
  await session(page, 'user-agent-2'); await session(receiver, 'user-agent-3')
  const row = `[data-conversation-id="${input.conversationId}"]`
  await expect(page.locator(row)).toHaveCount(1); await expect(receiver.locator(row)).toHaveCount(0)
  await receiver.getByRole('button', { name: /^Notifications/ }).click()
  await receiver.getByRole('button', { name: 'Mark all read', exact: true }).click()
  await receiver.getByRole('button', { name: /^Notifications/ }).click()
  await page.getByRole('button', { name: 'Transfer Chat', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Transfer Conversation' })
  await dialog.getByRole('textbox', { name: 'Search agents' }).fill('Tumo')
  await dialog.getByRole('radio').check()
  await dialog.getByRole('textbox', { name: 'Transfer note' }).fill('Private receiving-agent context')
  await dialog.getByRole('button', { name: 'Transfer Chat', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator(row)).toHaveCount(0); await expect(receiver.locator(row)).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: 'Write a customer reply' })).toBeDisabled()
  await expect(receiver.getByRole('textbox', { name: 'Write a customer reply' })).toBeEnabled()
  await expect(receiver.getByRole('button', { name: /Notifications, .* unread/ })).toBeVisible()
  await receiver.getByRole('button', { name: /^Notifications/ }).click()
  await expect(receiver.getByRole('region', { name: 'Notifications' })).toContainText('A conversation has been transferred to you.')
  await receiver.getByRole('button', { name: /^Notifications/ }).click()
  await receiver.getByRole('button', { name: 'Transfer Chat', exact: true }).click()
  await expect(receiver.getByRole('dialog')).toBeVisible()
  // Another tab closes the record while a transfer is being prepared.
  await page.evaluate(id => {
    const store = JSON.parse(localStorage.getItem('qalo-workspaces-v2')!)
    const c = store.snapshots['workspace-qalo'].conversations.find((item: {id: string}) => item.id === id)
    c.status = 'resolved'; c.updatedAt = new Date().toISOString()
    localStorage.setItem('qalo-workspaces-v2', JSON.stringify(store))
  }, input.conversationId)
  await expect(receiver.getByRole('dialog').getByRole('alert')).toContainText('conversation has changed')
  await expect(receiver.getByRole('dialog').getByRole('button', { name: 'Transfer Chat', exact: true })).toBeDisabled()
  await receiver.keyboard.press('Escape'); await receiver.close()
})
