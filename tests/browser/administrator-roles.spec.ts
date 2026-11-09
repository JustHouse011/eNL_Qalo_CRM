import { test, expect } from '@playwright/test'
import { createWorkspaceStore, loadWorkspaceStore, WORKSPACE_STORAGE_KEY, validateWorkspaceStore } from '../../src/lib/workspaceMigration'
import { migrateAdministratorRoles, previewIdentity } from '../../src/lib/administratorRoles'
import { canInWorkspace, getAccessibleWorkspaces, type WorkspaceStore } from '../../src/lib/workspaceTypes'
import { createSupportService } from '../../src/lib/supportService'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { refineIdentityFixtures } from '../../src/lib/identityPreview'

function fixture() {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const service = createSupportService(() => storage)
  service.initializeEnl(platformPreview.id); service.initializeIdentity()
  return { service, values, storage, store: service.registry() }
}

test('active Administrator automatically accesses current and future workspaces with no memberships', () => {
  const { store, service } = fixture()
  const administrator = store.users.find(u => u.id === 'user-agent-1')!
  const future = { ...store.workspaces[0], id: 'workspace-future', slug: 'future' }
  const workspaces = [...store.workspaces, future]
  expect(administrator).toMatchObject({ role: 'administrator', status: 'active' })
  expect(getAccessibleWorkspaces(administrator, workspaces, [])).toEqual(workspaces)
  for (const workspace of workspaces) for (const capability of ['view', 'reply', 'manage-support', 'manage-workspace', 'manage-members', 'manage-platform'] as const) expect(canInWorkspace(administrator, workspace, [], capability)).toBe(true)
  expect(canInWorkspace(administrator, undefined, [], 'manage-platform')).toBe(true)
  expect(canInWorkspace(administrator, undefined, [], 'view')).toBe(true)
  for (const status of ['inactive', 'suspended'] as const) {
    const blocked = { ...administrator, status }
    expect(getAccessibleWorkspaces(blocked, workspaces, store.memberships, true)).toEqual([])
    expect(canInWorkspace(blocked, undefined, [], 'manage-platform')).toBe(false)
    for (const workspace of workspaces) expect(canInWorkspace(blocked, workspace, store.memberships, 'reply')).toBe(false)
  }
  service.manage(administrator.id, { kind: 'status', workspaceId: store.workspaces[0].id, status: 'inactive' })
  service.manage(administrator.id, { kind: 'status', workspaceId: store.workspaces[1].id, status: 'inactive' })
  const inactiveStore = service.registry()
  expect(getAccessibleWorkspaces(administrator, inactiveStore.workspaces, [])).toEqual([])
  expect(getAccessibleWorkspaces(administrator, inactiveStore.workspaces, [], true)).toHaveLength(2)
})

test('approved agents keep their workspace matrix; supervisors and viewers gain no administrative writes', () => {
  const { store, service } = fixture()
  for (const [id, count] of [['user-agent-2', 2], ['user-agent-3', 2]] as const) {
    const user = store.users.find(u => u.id === id)!
    expect(user.role).toBe('agent')
    expect(getAccessibleWorkspaces(user, store.workspaces, store.memberships)).toHaveLength(count)
    expect(getAccessibleWorkspaces(user, store.workspaces, [])).toHaveLength(0)
    for (const workspace of store.workspaces) expect(canInWorkspace(user, workspace, store.memberships, 'manage-platform')).toBe(false)
    expect(() => service.manage(user.id, { kind: 'member', workspaceId: store.workspaces[0].id, userId: user.id, role: 'supervisor', status: 'active' })).toThrow('permission')
  }
  const user = store.users.find(u => u.id === 'user-agent-2')!
  const workspace = store.workspaces[0]
  for (const role of ['supervisor', 'viewer'] as const) {
    const memberships = [{ ...store.memberships[0], userId: user.id, workspaceId: workspace.id, role }]
    expect(canInWorkspace(user, workspace, memberships, 'view')).toBe(true)
    expect(canInWorkspace(user, workspace, memberships, 'manage-members')).toBe(false)
    expect(canInWorkspace(user, workspace, memberships, 'reply')).toBe(role === 'supervisor')
  }
})

test('legacy migration preserves snapshots, identity IDs, selection and unrelated personal storage; ambiguous roles require review', () => {
  const { store, storage, values } = fixture()
  const legacy = structuredClone(store) as unknown as Record<string, any>
  delete legacy.administratorRoleVersion
  legacy.users.forEach((u: any) => { delete u.role; delete u.status; u.platformRole = u.id === 'user-agent-1' ? 'platform-super-admin' : null })
  legacy.memberships.forEach((m: any) => { m.role = m.userId === 'user-agent-1' || m.userId === 'user-enl-admin-demo' ? 'workspace-admin' : 'support-agent' })
  legacy.memberships.find((m: any) => m.userId === 'user-agent-2').role = 'workspace-admin'
  legacy.users.push({ id: 'legacy-global', name: 'Retained legacy global', platformRole: 'platform-super-admin', status: 'inactive' })
  legacy.users.push({ id: 'mixed-legacy-global', name: 'Ambiguous mixed roles', platformRole: 'platform-super-admin', role: 'administrator', status: 'active' })
  legacy.memberships.push({ id: 'unknown-membership', workspaceId: store.workspaces[0].id, userId: 'legacy-global', role: 'unknown-role', status: 'active' })
  const raw = JSON.stringify(legacy)
  values.set(WORKSPACE_STORAGE_KEY, raw)
  values.set('qalo-personal:user-agent-1', '{"name":"Saved personal name"}')
  const migrated = loadWorkspaceStore(storage).store
  expect(values.get('qalo-administrator-a1-backup')).toBe(raw)
  expect(migrated.snapshots).toEqual(legacy.snapshots)
  expect(migrated.activeWorkspaceId).toBe(legacy.activeWorkspaceId)
  expect(migrated.users.map(u => u.id)).toEqual(legacy.users.map((u: any) => u.id))
  expect(migrated.users.find(u => u.id === 'user-enl-admin-demo')).toMatchObject({ role: 'supervisor', accessReviewRequired: true })
  expect(migrated.users.find(u => u.id === 'user-agent-2')?.role).toBe('agent')
  expect(migrated.users.find(u => u.id === 'legacy-global')).toMatchObject({ role: 'viewer', status: 'inactive', accessReviewRequired: true })
  expect(migrated.users.find(u => u.id === 'mixed-legacy-global')).toMatchObject({ role: 'viewer', status: 'suspended', accessReviewRequired: true })
  expect(migrated.memberships.find(m => m.id === 'unknown-membership')).toMatchObject({ role: 'viewer', status: 'inactive', legacyRole: 'unknown-role' })
  expect(values.get('qalo-personal:user-agent-1')).toBe('{"name":"Saved personal name"}')
  expect(migrateAdministratorRoles(migrated)).toBe(migrated)
  expect(loadWorkspaceStore(storage).store).toEqual(migrated)
  validateWorkspaceStore(migrated)
})

test('failed compatibility backups retain the original store and block service writes', () => {
  const legacy = createWorkspaceStore() as unknown as Record<string, any>
  legacy.users[0].platformRole = 'platform-super-admin'
  const raw = JSON.stringify(legacy)
  const storage = { getItem: (key: string) => key === WORKSPACE_STORAGE_KEY ? raw : null, setItem: () => { throw new Error('Quota') } }
  const service = createSupportService(() => storage)
  expect(service.registry().users[0].role).toBe('administrator')
  expect(service.persistenceState()).toBe('migration-pending')
  expect(() => service.selectWorkspace(legacy.activeWorkspaceId)).toThrow('backup')
  expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw)
})

test('legacy developer aliases select existing identities without becoming authorization roles', () => {
  expect(previewIdentity('Platform Super Admin')).toBe('user:user-agent-1')
  expect(previewIdentity('Admin')).toBe('user:user-agent-1')
  expect(previewIdentity('user:platform-preview')).toBe('user:user-agent-1')
  expect(previewIdentity('Supervisor')).toBe('user:user-agent-2')
  expect(previewIdentity('unknown')).toBeNull()
  const store = migrateAdministratorRoles(createWorkspaceStore())
  store.users[0].status = 'suspended'
  expect(getAccessibleWorkspaces(store.users[0], store.workspaces, store.memberships)).toEqual([])
  const invalid = structuredClone(store) as WorkspaceStore
  ;(invalid.users[0] as any).role = 'platform-super-admin'
  expect(() => validateWorkspaceStore(invalid)).toThrow('canonical')
  const ambiguous = createWorkspaceStore()
  ambiguous.users[0].id = 'custom-bongani'
  ambiguous.users[0].role = 'viewer'
  ambiguous.memberships.filter(m => m.userId === 'user-agent-1').forEach(m => { m.userId = 'custom-bongani' })
  validateWorkspaceStore(ambiguous)
  const refined = refineIdentityFixtures(ambiguous)
  expect(refined.users.filter(u => u.name === 'Bongani Nombamba')).toHaveLength(1)
  expect(refined.users.find(u => u.id === 'custom-bongani')).toMatchObject({ role: 'viewer', accessReviewRequired: true })
  const inactiveAssignment = createWorkspaceStore()
  inactiveAssignment.memberships.find(m => m.userId === 'user-agent-2')!.status = 'inactive'
  expect(refineIdentityFixtures(inactiveAssignment).memberships.find(m => m.userId === 'user-agent-2')?.status).toBe('inactive')
})

test('browser Administrator keeps both workspaces and guarded administration after membership removal and reload', async ({ page }) => {
  await page.goto('/overview')
  await expect(page.locator('.workspace-select-menu [role=option]')).toHaveCount(2)
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('qalo-workspaces-v2')!)
    store.memberships = store.memberships.filter((m: { userId: string }) => m.userId !== 'user-agent-1')
    localStorage.setItem('qalo-workspaces-v2', JSON.stringify(store))
  })
  await page.reload()
  await expect(page.locator('.workspace-select-menu [role=option]')).toHaveCount(2)
  await page.goto('/platform')
  await expect(page.getByRole('heading', { name: 'Platform Administration', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('qalo-workspaces-v2')!)
    store.users.find((u: { id: string }) => u.id === 'user-agent-1').status = 'suspended'
    localStorage.setItem('qalo-workspaces-v2', JSON.stringify(store))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Access unavailable', exact: true })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('qalo-profile-preview', 'unknown-legacy-role'))
  await page.reload()
  await expect(page).toHaveURL(/signin/)
})
