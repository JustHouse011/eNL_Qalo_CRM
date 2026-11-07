import { validateRetailState } from './retailData'
import { migrateAdministratorRoles } from './administratorRoles'
import type { DemoData } from '../data/demoData'
import { agents, createMockData } from '../data/mockCatalog'
import { branding } from './branding'
import { migratePresentation } from './presentationCopy'
import { mergeWorkspaceSettings } from './workspaceSettings'
import { QALO_WORKSPACE_ID, type WorkspaceData, type WorkspaceStore } from './workspaceTypes'
import { bankingCaseStates } from './workspaceExperience'

export const LEGACY_STORAGE_KEY = 'qalo-frontend-demo-v1'
export const WORKSPACE_STORAGE_KEY = 'qalo-workspaces-v2'
export const WORKSPACE_BACKUP_KEY = 'qalo-frontend-demo-v1-backup'
function verifiedBackup(storage: WorkspaceStorage, key: string, raw: string): string {
  const existing = storage.getItem(key)
  const target = existing !== null && existing !== raw ? `${key}:${crypto.randomUUID()}` : key
  if (existing !== raw) storage.setItem(target, raw)
  if (storage.getItem(target) !== raw) throw new Error('Backup verification failed')
  return target
}
type JsonRecord = Record<string, unknown>
const record = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value)
function fail(message: string): never { throw new Error(`Workspace data needs recovery: ${message}. Stored data has not been reset.`) }

export function validateDemoData(value: unknown): asserts value is DemoData {
  if (record(value) && value.retail !== undefined) validateRetailState(value.retail)
  if (!record(value)) fail('invalid snapshot')
  function strings(item: JsonRecord, fields: string[], label: string) {
    if (fields.some(field => typeof item[field] !== 'string')) fail(`invalid ${label} fields`)
  }
  for (const field of ['conversations', 'tickets', 'contacts', 'visitors', 'articles']) {
    if (!Array.isArray(value[field])) fail(`missing ${field}`)
  }
  for (const field of ['conversations', 'tickets', 'contacts', 'visitors', 'articles', 'deals', 'tasks', 'rules', 'organisations', 'queues', 'workflows', 'applications', 'savedReplies', 'automationRuns', 'agents', 'departments', 'notifications', 'bankingCases']) {
    const items = value[field]
    if (items !== undefined && !Array.isArray(items)) fail(`invalid ${field} collection`)
    if (!Array.isArray(items)) continue
    const ids = new Set<string>()
    for (const item of items) {
      if (!record(item)) fail(`invalid ${field} record`)
      if (field !== 'queues' && (typeof item.id !== 'string' || !item.id)) fail(`missing ${field} ID`)
      if (typeof item.id === 'string') { if (ids.has(item.id)) fail(`duplicate ${field} ID`); ids.add(item.id) }
      if (field === 'contacts') strings(item, ['name', 'email', 'organisation', 'location', 'tag'], field)
      if (field === 'tickets') strings(item, ['subject', 'customer', 'status', 'priority', 'assignee', 'updated'], field)
      if (field === 'articles') {
        strings(item, ['title', 'category', 'updated'], field)
        if (typeof item.published !== 'boolean' || (item.body !== undefined && typeof item.body !== 'string')) fail('invalid article content')
      }
      if (field === 'queues') strings(item, ['name', 'area'], field)
      if (field === 'bankingCases') {
        strings(item, ['reference', 'customerId', 'product', 'category', 'subject', 'status', 'departmentId', 'createdAt', 'dueAt', 'resolution'], field)
        if (!['account', 'application', 'complaint'].includes(String(item.kind)) || !['normal', 'high', 'urgent'].includes(String(item.priority)) || !Array.isArray(item.history) || item.history.some(event => !record(event) || typeof event.id !== 'string' || typeof event.detail !== 'string' || typeof event.time !== 'string' || !Number.isFinite(Date.parse(event.time)))) fail('invalid banking case metadata')
        const states: readonly string[] = bankingCaseStates[item.kind as keyof typeof bankingCaseStates]
        if (!states.includes(String(item.status))) fail('invalid banking support state')
      }
    }
  }
  for (const conversation of value.conversations as unknown[]) {
    if (!record(conversation) || !Array.isArray(conversation.messages) || !Array.isArray(conversation.history) || !Array.isArray(conversation.tags)) fail('invalid conversation structure')
    strings(conversation, ['customer', 'email', 'initials', 'tone', 'location', 'channel', 'status', 'priority', 'department', 'createdAt', 'updatedAt'], 'conversation')
    if (conversation.lifecycle !== undefined && !['new', 'ai', 'waiting', 'human', 'resolved', 'reopened'].includes(String(conversation.lifecycle))) fail('invalid conversation lifecycle')
    if (conversation.tags.some(tag => typeof tag !== 'string') || typeof conversation.unread !== 'number' || (conversation.assignee !== null && typeof conversation.assignee !== 'string')) fail('invalid conversation metadata')
    const ids = new Set<string>()
    for (const message of conversation.messages) {
      if (!record(message) || typeof message.id !== 'string' || typeof message.text !== 'string' || typeof message.author !== 'string' || typeof message.time !== 'string' || !['customer', 'agent', 'note'].includes(String(message.kind)) || ids.has(message.id)) fail('invalid or duplicate message')
      ids.add(message.id)
      if (message.simulated !== undefined && typeof message.simulated !== 'boolean') fail('invalid simulated message flag')
    }
  }
  for (const field of ['settings', 'widget', 'ai']) if (value[field] !== undefined && !record(value[field])) fail(`invalid ${field} configuration`)
  if (value.assistant !== undefined) {
    const assistant = value.assistant
    if (!record(assistant)) fail('invalid assistant configuration')
    strings(assistant, ['id', 'workspaceId', 'name', 'persona', 'instructions', 'escalationDepartmentId', 'fraudDepartmentId'], 'assistant')
    if (typeof assistant.enabled !== 'boolean' || !Array.isArray(assistant.sourceIds) || assistant.sourceIds.some(id => typeof id !== 'string')) fail('invalid assistant configuration')
  }
  if (record(value.widget)) {
    strings(value.widget, ['greeting', 'colour', 'position'], 'widget')
    if (typeof value.widget.branding !== 'boolean') fail('invalid widget branding')
  }
  if (record(value.ai)) {
    strings(value.ai, ['tone', 'handoff', 'community', 'store'], 'AI guidance')
    if (!Array.isArray(value.ai.sources) || value.ai.sources.some(source => typeof source !== 'string')) fail('invalid knowledge source IDs')
  }
  if (record(value.settings)) {
    for (const field of ['operatingHours', 'notifications', 'integrations']) if (value.settings[field] !== undefined && !record(value.settings[field])) fail(`invalid ${field} settings`)
    const hours = value.settings.operatingHours
    if (record(hours) && hours.days !== undefined && (!Array.isArray(hours.days) || hours.days.some(day => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6))) fail('invalid operating days')
  }
}

/** Additive normalization: never rename content, drop records or replace user edits. */
export function scopeWorkspaceData(input: DemoData, workspaceId: string): WorkspaceData {
  validateDemoData(input)
  const data = structuredClone(input) as DemoData & JsonRecord
  function own(value: unknown, path: string): unknown {
    if (Array.isArray(value)) return value.map((item, index) => {
      if (!record(item)) return item
      if (item.workspaceId !== undefined && item.workspaceId !== workspaceId) fail(`foreign record at ${path}`)
      return own({ ...item, id: item.id || `${workspaceId}:${path}:${crypto.randomUUID()}`, workspaceId }, `${path}:${index}`)
    })
    if (record(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, own(item, `${path}:${key}`)]))
    return value
  }
  if (data.workspaceId !== undefined && data.workspaceId !== workspaceId) fail('foreign snapshot')
  const scoped = own(data, 'data') as WorkspaceData
  scoped.workspaceId = workspaceId
  for (const field of ['widget', 'ai'] as const) {
    const config = scoped[field]
    if (config) {
      if (config.workspaceId !== undefined && config.workspaceId !== workspaceId) fail(`foreign ${field} configuration`)
      Object.assign(config, { id: config.id || `${workspaceId}:${field}`, workspaceId })
    }
  }
  scoped.settings = mergeWorkspaceSettings(data.settings)
  scoped.agents = scoped.agents || (workspaceId === QALO_WORKSPACE_ID ? agents.map(agent => ({ ...agent, workspaceId, userId: `user-${agent.id}` })) : [])
  const departments = scoped.departments || []
  // Existing queue editors retain extra persisted fields when copying a draft.
  // Keep the department's identity when those editors rename a queue.
  const renames = new Map<string, { before: string; after: string }>()
  for (const queue of scoped.queues || []) {
    const department = departments.find(item => item.id === queue.departmentId)
    if (department) {
      if (department.name !== queue.name) renames.set(department.id, { before: department.name, after: queue.name })
      department.name = queue.name; department.area = queue.area
    }
  }
  function renamedDepartment<T extends { department?: string; departmentId?: string | null }>(item: T): T {
    const rename = item.departmentId ? renames.get(item.departmentId) : undefined
    return rename && item.department === rename.before ? { ...item, department: rename.after } : item
  }
  scoped.conversations = scoped.conversations.map(renamedDepartment)
  scoped.tickets = scoped.tickets.map(renamedDepartment)
  scoped.rules = scoped.rules?.map(renamedDepartment)
  function ensureDepartment(name: string | undefined, area = 'general') {
    if (name && !departments.some(department => department.name === name && department.area === area)) departments.push({ id: `${workspaceId}:department:${crypto.randomUUID()}`, workspaceId, name, area })
  }
  for (const queue of scoped.queues || []) ensureDepartment(queue.name, queue.area)
  for (const item of [...scoped.conversations, ...scoped.tickets, ...(scoped.rules || [])]) ensureDepartment(item.department, item.businessArea)
  scoped.departments = departments
  const agentId = (name: string | null | undefined) => scoped.agents.find(agent => agent.name === name)?.id || null
  const departmentId = (name: string | undefined, area = 'general') => departments.find(department => department.name === name && department.area === area)?.id || null
  scoped.conversations = scoped.conversations.map(c => ({ ...c, assigneeId: scoped.agents.some(a => a.id === c.assigneeId && a.name === c.assignee) ? c.assigneeId : agentId(c.assignee), departmentId: departmentId(c.department, c.businessArea), messages: c.messages.map(message => ({ ...message, conversationId: c.id })) }))
  scoped.tickets = scoped.tickets.map(t => ({ ...t, assigneeId: scoped.agents.some(a => a.id === t.assigneeId) ? t.assigneeId : agentId(t.assignee), departmentId: departments.some(d => d.id === t.departmentId) ? t.departmentId : departmentId(t.department, t.businessArea) }))
  scoped.queues = scoped.queues?.map(queue => ({ ...queue, departmentId: departmentId(queue.name, queue.area) }))
  scoped.rules = scoped.rules?.map(rule => ({ ...rule, departmentId: departmentId(rule.department, rule.businessArea) }))
  scoped.settings.defaultAssigneeId = agentId(scoped.settings.defaultAssignee)
  return scoped
}

export function createWorkspaceStore(data: DemoData = createMockData()): WorkspaceStore {
  const snapshot = scopeWorkspaceData(migratePresentation(data), QALO_WORKSPACE_ID)
  const timestamp = new Date().toISOString()
  return {
    version: 2, activeWorkspaceId: QALO_WORKSPACE_ID,
    workspaces: [{ id: QALO_WORKSPACE_ID, name: 'Qalo Ya Afrika', slug: 'qalo', type: 'Customer Support', description: 'Qalo customer support workspace.', logo: branding.logo, primaryColor: branding.colour, secondaryColor: '#8CCDAB', status: 'active', createdAt: timestamp, updatedAt: timestamp, settings: snapshot.settings! }],
    users: snapshot.agents.map(agent => ({ id: agent.userId, name: agent.name, role: agent.userId === 'user-agent-1' ? 'administrator' : 'agent', status: 'active' })),
    memberships: snapshot.agents.map(agent => ({ id: `${QALO_WORKSPACE_ID}:membership:${agent.userId}`, workspaceId: QALO_WORKSPACE_ID, userId: agent.userId, role: agent.userId === 'user-agent-1' ? 'supervisor' : 'agent', status: 'active' })),
    snapshots: { [QALO_WORKSPACE_ID]: snapshot },
  }
}

export function validateWorkspaceStore(value: unknown): asserts value is WorkspaceStore {
  if (!record(value) || value.version !== 2 || !Array.isArray(value.workspaces) || !Array.isArray(value.users) || !Array.isArray(value.memberships) || !record(value.snapshots)) fail('unsupported or invalid store')
  if (value.administratorRoleVersion !== undefined && value.administratorRoleVersion !== 1) fail('unsupported role model version')
  const ids = new Set<string>()
  const slugs = new Set<string>()
  for (const workspace of value.workspaces) {
    if (!record(workspace) || typeof workspace.id !== 'string' || !workspace.id || ids.has(workspace.id) || typeof workspace.slug !== 'string' || !workspace.slug || slugs.has(workspace.slug) || typeof workspace.name !== 'string' || !['active', 'inactive'].includes(String(workspace.status)) || !record(workspace.settings)) fail('invalid workspace')
    ids.add(workspace.id)
    slugs.add(workspace.slug)
    const snapshot = value.snapshots[workspace.id]
    validateDemoData(snapshot)
    if ((snapshot as WorkspaceData).workspaceId !== workspace.id) fail('snapshot ownership mismatch')
    if (!Array.isArray((snapshot as WorkspaceData).agents) || !Array.isArray((snapshot as WorkspaceData).departments) || !record((snapshot as WorkspaceData).settings)) fail('missing scoped reference data')
    if (workspace.supportMode === 'banking' && (!(snapshot as WorkspaceData).assistant || !(snapshot as WorkspaceData).widget || !Array.isArray((snapshot as WorkspaceData).notifications))) fail('missing banking configuration')
    function checkOwnership(node: unknown) {
      if (Array.isArray(node)) { for (const item of node) { if (record(item) && (typeof item.id !== 'string' || item.workspaceId !== workspace.id)) fail('record ownership mismatch'); checkOwnership(item) } }
      else if (record(node)) { if (node.workspaceId !== undefined && node.workspaceId !== workspace.id) fail('record ownership mismatch'); for (const item of Object.values(node)) checkOwnership(item) }
    }
    checkOwnership(snapshot)
    const operational = snapshot as WorkspaceData
    for (const item of operational.bankingCases || []) {
      if (!['account', 'application', 'complaint'].includes(item.kind) || !operational.contacts.some(c => c.id === item.customerId) || !operational.departments.some(d => d.id === item.departmentId) || (item.agentId !== null && !operational.agents.some(a => a.id === item.agentId)) || !Array.isArray(item.history) || typeof item.status !== 'string' || typeof item.resolution !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.dueAt))) fail('invalid banking support case or foreign relationship')
    }
    for (const agent of operational.agents) {
      if (agent.presence !== undefined && !['online', 'away', 'offline'].includes(agent.presence)) fail('invalid simulated presence')
      if (agent.departmentIds !== undefined && (!Array.isArray(agent.departmentIds) || agent.departmentIds.some(id => !operational.departments.some(d => d.id === id)))) fail('foreign agent department membership')
    }
    for (const ticket of operational.tickets) {
      if (ticket.activity === undefined) continue
      if (!Array.isArray(ticket.activity)) fail('invalid ticket activity')
      const events = new Set<string>()
      for (const event of ticket.activity) {
        if (!record(event) || typeof event.id !== 'string' || events.has(event.id) || event.workspaceId !== workspace.id || event.ticketId !== ticket.id || typeof event.actorId !== 'string' || !event.actorId || typeof event.type !== 'string' || typeof event.timestamp !== 'string' || !Number.isFinite(Date.parse(event.timestamp)) || !record(event.metadata)) fail('invalid ticket event')
        events.add(event.id)
      }
    }
    const assistant = (snapshot as WorkspaceData).assistant
    if (assistant) {
      const data = snapshot as WorkspaceData
      if (!data.departments.some(d => d.id === assistant.escalationDepartmentId) || !data.departments.some(d => d.id === assistant.fraudDepartmentId)) fail('foreign assistant department reference')
      if (assistant.sourceIds.some(id => !data.articles.some(a => a.id === id))) fail('foreign assistant knowledge reference')
    }
  }
  if (!ids.has(String(value.activeWorkspaceId)) || Object.keys(value.snapshots).some(id => !ids.has(id))) fail('unknown workspace reference')
  const users = new Set<string>()
  for (const user of value.users) {
    if (!record(user) || typeof user.id !== 'string' || !user.id || users.has(user.id) || typeof user.name !== 'string' || (user.platformRole != null && typeof user.platformRole !== 'string') || (user.role !== undefined && typeof user.role !== 'string') || (user.status !== undefined && !['active', 'inactive', 'suspended'].includes(String(user.status)))) fail('invalid user')
    if (value.administratorRoleVersion === 1 && (!['administrator', 'supervisor', 'agent', 'viewer'].includes(String(user.role)) || !['active', 'inactive', 'suspended'].includes(String(user.status)) || user.platformRole != null)) fail('invalid canonical identity')
    users.add(user.id)
  }
  const memberships = new Set<string>()
  const assignments = new Set<string>()
  for (const member of value.memberships) {
    if (!record(member) || typeof member.id !== 'string' || memberships.has(member.id) || !ids.has(String(member.workspaceId)) || typeof member.userId !== 'string' || !users.has(member.userId) || typeof member.role !== 'string' || !['active', 'inactive'].includes(String(member.status))) fail('invalid membership')
    if (value.administratorRoleVersion === 1 && !['supervisor', 'agent', 'viewer'].includes(String(member.role))) fail('invalid canonical membership')
    memberships.add(member.id)
    const assignment = JSON.stringify([member.workspaceId, member.userId])
    if (assignments.has(assignment)) fail('duplicate workspace membership')
    assignments.add(assignment)
  }
}

export type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem'>
export type PersistenceState = 'persistent' | 'memory' | 'migration-pending'
export function loadWorkspaceStore(storage: WorkspaceStorage | null): { store: WorkspaceStore; state: PersistenceState } {
  if (!storage) return { store: migrateAdministratorRoles(createWorkspaceStore()), state: 'memory' }
  let raw: string | null
  let legacy: string | null
  try { raw = storage.getItem(WORKSPACE_STORAGE_KEY); legacy = storage.getItem(LEGACY_STORAGE_KEY) } catch { return { store: migrateAdministratorRoles(createWorkspaceStore()), state: 'memory' } }
  if (raw !== null) {
    let store: unknown
    try { store = JSON.parse(raw) } catch { return fail('new store is unreadable; recover from the retained legacy key or backup') }
    validateWorkspaceStore(store)
    const migrated = migrateAdministratorRoles(store)
    if (migrated !== store) {
      try {
        verifiedBackup(storage, 'qalo-administrator-a1-backup', raw)
        validateWorkspaceStore(migrated)
        const serialized = JSON.stringify(migrated)
        storage.setItem(WORKSPACE_STORAGE_KEY, serialized)
        if (storage.getItem(WORKSPACE_STORAGE_KEY) !== serialized) throw new Error('Role migration verification failed')
      }
      catch { return { store: migrated, state: 'migration-pending' } }
    }
    return { store: migrated, state: 'persistent' }
  }
  let data: DemoData | undefined
  if (legacy !== null) {
    try { data = JSON.parse(legacy) } catch { return fail('legacy data is unreadable') }
    validateDemoData(data)
  }
  const store = migrateAdministratorRoles(createWorkspaceStore(data))
  validateWorkspaceStore(store)
  try {
    // The exact original string is retained, including unknown fields and user edits.
    if (legacy !== null) {
      verifiedBackup(storage, WORKSPACE_BACKUP_KEY, legacy)
    }
    const serialized = JSON.stringify(store)
    storage.setItem(WORKSPACE_STORAGE_KEY, serialized)
    const persisted = storage.getItem(WORKSPACE_STORAGE_KEY)
    if (persisted !== serialized) throw new Error('Migration verification failed')
    validateWorkspaceStore(JSON.parse(persisted))
    return { store, state: 'persistent' }
  } catch {
    // Keep migrated user data available, but prevent writes until backup/commit can succeed.
    return { store, state: legacy !== null ? 'migration-pending' : 'memory' }
  }
}

/** Explicit recovery only: caller reviews/selects a source; current data is archived first. */
export function recoverWorkspaceStore(storage: WorkspaceStorage, sourceKey: string): WorkspaceStore {
  if (sourceKey === WORKSPACE_STORAGE_KEY) throw new Error('Select a retained legacy key or backup as the recovery source')
  const raw = storage.getItem(sourceKey)
  if (raw === null) throw new Error('Recovery source was not found')
  let value: unknown
  try { value = JSON.parse(raw) } catch { return fail('recovery source is unreadable') }
  let store: WorkspaceStore
  if (record(value) && value.version === 2) { validateWorkspaceStore(value); store = value }
  else { validateDemoData(value); store = createWorkspaceStore(value) }
  store = migrateAdministratorRoles(store)
  validateWorkspaceStore(store)
  const current = storage.getItem(WORKSPACE_STORAGE_KEY)
  if (current !== null) verifiedBackup(storage, 'qalo-workspaces-v2-recovery-backup', current)
  verifiedBackup(storage, WORKSPACE_BACKUP_KEY, raw)
  const serialized = JSON.stringify(store)
  storage.setItem(WORKSPACE_STORAGE_KEY, serialized)
  if (storage.getItem(WORKSPACE_STORAGE_KEY) !== serialized) throw new Error('Recovery could not be verified; retained source and backups remain available')
  return structuredClone(store)
}
