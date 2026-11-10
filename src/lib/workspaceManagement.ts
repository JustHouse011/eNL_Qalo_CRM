import { scopeWorkspaceData } from './workspaceMigration'
import type { BusinessArea } from './business'
import { previewUsers } from './identityPreview'
import { mergeWorkspaceSettings } from './workspaceSettings'
import { isAdministrator, canInWorkspace, QALO_WORKSPACE_ID, ENL_WORKSPACE_ID, type Workspace, type WorkspaceStore, type WorkspaceUser, type WorkspaceMembership, type WorkspaceAgent } from './workspaceTypes'

export const platformPreview: WorkspaceUser = { id: 'platform-preview', name: 'Administrator preview', role: 'administrator', status: 'active' }
export type WorkspaceDraft = Pick<Workspace, 'name' | 'slug' | 'description' | 'type' | 'logo' | 'primaryColor' | 'secondaryColor'>
export type AgentProfileDraft = { name: string; email: string; phone: string; title: string; role: WorkspaceMembership['role']; status: WorkspaceMembership['status']; accountStatus: WorkspaceUser['status'] }
export type AgentWorkspaceAccess = { workspaceId: string; role: WorkspaceMembership['role']; departmentIds?: string[] }
type TeamCommand =
  | { kind: 'agent-add'; workspaceId: string; userId?: string; name: string; email: string; role: WorkspaceMembership['role'] }
  | { kind: 'agent-profile'; workspaceId: string; agentId: string; draft: AgentProfileDraft }
  | { kind: 'department'; workspaceId: string; departmentId?: string; name: string; area: BusinessArea }
export type ManagementCommand =
  | { kind: 'create'; draft: WorkspaceDraft; administratorId: string; workspaceId?: string }
  | { kind: 'edit'; workspaceId: string; draft: WorkspaceDraft; settings?: Workspace['settings'] }
  | { kind: 'status'; workspaceId: string; status: Workspace['status'] }
  | { kind: 'member'; workspaceId: string; userId?: string; name?: string; role: WorkspaceMembership['role']; status: WorkspaceMembership['status'] }
  | { kind: 'remove-member'; workspaceId: string; userId: string }
  | { kind: 'agent-access'; workspaceId: string; userId?: string; profile?: Omit<AgentProfileDraft, 'role' | 'status'>; access: AgentWorkspaceAccess[] }
  | TeamCommand

export function agentManagementWorkspaces(store: WorkspaceStore, actorId: string, workspaceId: string) {
  const actor = actorId === platformPreview.id ? platformPreview : store.users.find(user => user.id === actorId)
  return store.workspaces.filter(workspace => workspace.status === 'active' &&
    [workspaceId, QALO_WORKSPACE_ID, ENL_WORKSPACE_ID].includes(workspace.id) &&
    canInWorkspace(actor, workspace, store.memberships, 'manage-members'))
}

function validateDraft(draft: WorkspaceDraft, store: WorkspaceStore, id?: string) {
  if (!draft.name.trim() || draft.name.length > 100 || !draft.type.trim()) throw new Error('Name and organisation type are required (name maximum 100 characters).')
  if (draft.slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) throw new Error('Use a lowercase slug with letters, numbers and hyphens.')
  if (store.workspaces.some(w => w.id !== id && w.slug === draft.slug)) throw new Error('This workspace slug is already in use.')
  if (![draft.primaryColor, draft.secondaryColor].every(color => /^#[0-9a-f]{6}$/i.test(color))) throw new Error('Use six-digit hexadecimal branding colours.')
  if (![null, '/qalo-logo.png', '/qalo-website-logo.png'].includes(draft.logo)) throw new Error('Select an approved logo or initials.')
}
export function manageWorkspace(input: WorkspaceStore, actorId: string, command: ManagementCommand): WorkspaceStore {
  if (command.kind === 'agent-access') return saveAgentAccess(input, actorId, command)
  const store = structuredClone(input)
  const actor = actorId === platformPreview.id ? platformPreview : store.users.find(u => u.id === actorId)
  const workspace = 'workspaceId' in command ? store.workspaces.find(w => w.id === command.workspaceId) : undefined
  const platform = isAdministrator(actor)
  if (command.kind === 'agent-add' || command.kind === 'agent-profile' || command.kind === 'department') {
    if (workspace?.status !== 'active') throw new Error('Choose an active workspace.')
    return manageTeam(store, actorId, workspace, command, actor)
  }
  if (command.kind === 'create' || command.kind === 'status') {
    if (!platform) throw new Error('Platform administrator permission is required.')
  } else if (!canInWorkspace(actor, workspace, store.memberships, command.kind === 'edit' ? 'manage-workspace' : 'manage-members')) throw new Error('Workspace administrator permission is required.')
  const now = new Date().toISOString()
  if (command.kind === 'create') {
    validateDraft(command.draft, store)
    const admin = store.users.find(u => u.id === command.administratorId)
    if (!admin) throw new Error('Select an initial administrator.')
    const id = command.workspaceId || `workspace-${crypto.randomUUID()}`
    if (!/^workspace-[a-zA-Z0-9-]+$/.test(id) || store.workspaces.some(w => w.id === id)) throw new Error('Invalid or duplicate workspace ID.')
    const settings = structuredClone(mergeWorkspaceSettings())
    store.workspaces.push({ ...command.draft, name: command.draft.name.trim(), id, status: 'active', createdAt: now, updatedAt: now, settings })
    store.snapshots[id] = scopeWorkspaceData({ conversations: [], tickets: [], contacts: [], visitors: [], articles: [], deals: [], tasks: [], rules: [], organisations: [], queues: [], workflows: [], applications: [], savedReplies: [], automationRuns: [], settings, widget: { greeting: `Welcome to ${command.draft.name}. How can we help?`, colour: command.draft.primaryColor, position: 'right', branding: true }, ai: { sources: [], tone: 'Friendly', handoff: '', community: '', store: '' } }, id)
    store.memberships.push({ id: crypto.randomUUID(), workspaceId: id, userId: admin.id, role: 'supervisor', status: 'active' })
    store.snapshots[id].agents.push({ id: crypto.randomUUID(), workspaceId: id, userId: admin.id, name: admin.name, initials: initials(admin.name), role: 'Admin', teamId: '' })
    return store
  }
  if (!workspace) throw new Error('Workspace was not found.')
  if (command.kind === 'edit') {
    validateDraft(command.draft, store, workspace.id)
    for (const field of ['name', 'slug', 'description', 'type', 'logo', 'primaryColor', 'secondaryColor'] as const) Object.assign(workspace, { [field]: command.draft[field] })
    workspace.updatedAt = now
    if (command.settings) {
      const hours = command.settings.operatingHours
      try { new Intl.DateTimeFormat('en', { timeZone: hours.timezone }) } catch { throw new Error('Invalid timezone.') }
      if (![hours.opensAt, hours.closesAt].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || hours.opensAt >= hours.closesAt) throw new Error('Closing time must follow opening time.')
      if (hours.days.some(day => !Number.isInteger(day) || day < 0 || day > 6) || !['manual', 'round-robin'].includes(command.settings.assignmentMode) || Object.values(command.settings.notifications).some(value => typeof value !== 'boolean')) throw new Error('Invalid workspace settings.')
      workspace.settings = structuredClone(command.settings)
      store.snapshots[workspace.id].settings = structuredClone(command.settings)
    }
  } else if (command.kind === 'status') { if (!['active', 'inactive'].includes(command.status)) throw new Error('Invalid workspace status.'); workspace.status = command.status; workspace.updatedAt = now }
  else {
    let user = store.users.find(u => u.id === command.userId)
    if (command.kind === 'member' && !command.userId) {
      if (!command.name?.trim()) throw new Error('Member name is required.')
      user = { id: `user-${crypto.randomUUID()}`, name: command.name.trim(), role: command.role, status: 'active' }; store.users.push(user)
    }
    if (!user) throw new Error('Member was not found.')
    const existing = store.memberships.find(m => m.workspaceId === workspace.id && m.userId === user.id)
    if (command.kind === 'remove-member') store.memberships = store.memberships.filter(m => m !== existing)
    else {
      if (!['supervisor', 'agent', 'viewer'].includes(command.role) || !['active', 'inactive'].includes(command.status)) throw new Error('Invalid membership role or status.')
      if (existing) Object.assign(existing, { role: command.role, status: command.status })
      else store.memberships.push({ id: crypto.randomUUID(), workspaceId: workspace.id, userId: user.id, role: command.role, status: command.status })
      const agents = store.snapshots[workspace.id].agents
      const role = command.role === 'supervisor' ? 'Supervisor' : 'Agent'
      const agent = agents.find(a => a.userId === user.id)
      if (agent) agent.role = role
      else agents.push({ id: crypto.randomUUID(), workspaceId: workspace.id, userId: user.id, name: user.name, initials: initials(user.name), role, teamId: '' })
    }
    workspace.updatedAt = now
  }
  return store
}
function initials(name: string) { return name.split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() }

function saveAgentAccess(input: WorkspaceStore, actorId: string, command: Extract<ManagementCommand, { kind: 'agent-access' }>) {
  const workspaces = agentManagementWorkspaces(input, actorId, command.workspaceId)
  const selections = new Map(command.access.map(access => [access.workspaceId, access]))
  if (!selections.size) throw new Error('Select at least one workspace.')
  if (!workspaces.some(workspace => workspace.id === command.workspaceId) || selections.size !== command.access.length ||
    command.access.some(access => !workspaces.some(workspace => workspace.id === access.workspaceId))) throw new Error('You cannot manage the selected workspace access.')
  const account = input.users.find(user => user.id === command.userId)
  if (command.userId && !account) throw new Error('Agent account was not found.')
  if (account?.role === 'administrator') throw new Error('Platform administrator access is managed separately.')
  if (!account && !command.profile) throw new Error('Enter the new agent profile.')
  for (const access of command.access) {
    if (!['supervisor', 'agent', 'viewer'].includes(access.role)) throw new Error('Select a valid workspace role.')
    const departments = input.snapshots[access.workspaceId].departments
    if (access.departmentIds?.some(id => !departments.some(department => department.id === id))) throw new Error('Select departments in the assigned workspace.')
  }

  // Persist the result once after all workspace changes succeed.
  let store = structuredClone(input)
  let userId = account?.id
  const workspaceIds = [...selections.keys(), ...workspaces.map(workspace => workspace.id).filter(id => !selections.has(id))]
  for (const workspaceId of workspaceIds) {
    const access = selections.get(workspaceId)
    let membership = store.memberships.find(item => item.userId === userId && item.workspaceId === workspaceId)
    const profile = !account || workspaceId === command.workspaceId ? command.profile : undefined
    if (!access && membership?.status !== 'active' && !(membership && profile)) continue
    if (access && !membership) {
      store = manageWorkspace(store, actorId, { kind: 'agent-add', workspaceId, userId, name: command.profile?.name ?? '', email: command.profile?.email ?? '', role: access.role })
      userId ??= store.users.at(-1)!.id
      membership = store.memberships.find(item => item.userId === userId && item.workspaceId === workspaceId)
    }
    const agent = store.snapshots[workspaceId].agents.find(item => item.userId === userId)
    if (!agent || !membership) throw new Error('Agent not found in this workspace.')
    const status = access ? 'active' : 'inactive'
    const role = access?.role ?? membership.role
    if (profile || status !== membership.status || role !== membership.role) {
      const draft: AgentProfileDraft = {
        name: agent.name, email: agent.email ?? '', phone: agent.phone ?? '', title: agent.title ?? '',
        ...profile, accountStatus: profile?.accountStatus ?? store.users.find(user => user.id === userId)!.status, role, status,
      }
      store = manageWorkspace(store, actorId, { kind: 'agent-profile', workspaceId, agentId: agent.id, draft })
    }
    if (access?.departmentIds !== undefined) {
      const updated = store.snapshots[workspaceId].agents.find(item => item.id === agent.id)!
      const ids = [...new Set(access.departmentIds)]
      if (ids.length !== updated.departmentIds?.length || ids.some(id => !updated.departmentIds?.includes(id))) {
        updated.departmentIds = ids
        updated.activity = [...(updated.activity ?? []), { id: crypto.randomUUID(), workspaceId, time: new Date().toISOString(), actorId, detail: 'Department assignments updated.' }]
      }
    }
  }
  return store
}

function manageTeam(store: WorkspaceStore, actorId: string, workspace: Workspace, command: TeamCommand, actor?: WorkspaceUser): WorkspaceStore {
  const capability = command.kind === 'department' ? 'manage-support' : 'manage-members'
  if (!canInWorkspace(actor, workspace, store.memberships, capability)) throw new Error('Your role cannot manage these workspace records.')
  const snapshot = store.snapshots[workspace.id]
  const now = new Date().toISOString()
  const addActivity = (agent: WorkspaceAgent, detail: string) => {
    agent.activity = [...(agent.activity ?? []), { id: crypto.randomUUID(), workspaceId: workspace.id, time: now, actorId, detail }]
  }
  if (command.kind === 'department') {
    const name = command.name.trim()
    if (!name || name.length > 100 || !['general', 'community', 'store'].includes(command.area) || (workspace.supportMode === 'banking' && command.area !== 'general')) throw new Error('Enter a valid department name and business area.')
    const existing = snapshot.departments.find(d => d.id === command.departmentId)
    if (command.departmentId && !existing) throw new Error('Department not found in this workspace.')
    if (snapshot.departments.some(d => d.id !== existing?.id && d.name.toLowerCase() === name.toLowerCase() && d.area === (existing?.area ?? command.area))) throw new Error('That department name is already in use for this business area.')
    const id = existing?.id ?? crypto.randomUUID()
    const area = (existing?.area ?? command.area) as BusinessArea
    const queues = snapshot.queues ?? []
    const nextQueues = queues.some(q => q.departmentId === id) ? queues.map(q => q.departmentId === id ? { ...q, name } : q) : [...queues, { name, area, departmentId: id }]
    const next = { ...snapshot, queues: nextQueues, departments: existing ? snapshot.departments : [...snapshot.departments, { id, workspaceId: workspace.id, name, area }] }
    store.snapshots[workspace.id] = scopeWorkspaceData(next, workspace.id)
    workspace.updatedAt = now
    return store
  }
  if (command.kind === 'agent-add') {
    const name = command.name.trim(), email = command.email.trim().toLowerCase()
    if (!command.userId && (!name || name.length > 100)) throw new Error('Enter a name of up to 100 characters.')
    validateEmail(email)
    if (!command.userId && (store.users.some(u => u.name.toLowerCase() === name.toLowerCase()) || emailInUse(store, email))) throw new Error('An existing identity matches this name or email. Select that account instead.')
    if (command.userId && store.memberships.some(m => m.workspaceId === workspace.id && m.userId === command.userId && m.status === 'active')) throw new Error('This account already has workspace access.')
    const next = manageWorkspace(store, actorId, { kind: 'member', workspaceId: workspace.id, userId: command.userId, name, role: command.role, status: 'active' })
    const userId = command.userId ?? next.users.at(-1)!.id
    const agent = next.snapshots[workspace.id].agents.find(a => a.userId === userId)!
    if (!command.userId && email) agent.email = email
    addActivity(agent, command.userId ? 'Workspace access granted.' : 'Agent account added to the workspace.')
    return next
  }
  const agent = snapshot.agents.find(a => a.id === command.agentId)
  const user = agent && store.users.find(u => u.id === agent.userId)
  const member = user && store.memberships.find(m => m.workspaceId === workspace.id && m.userId === user.id)
  if (!agent || !user || !member) throw new Error('Agent not found in this workspace.')
  const draft = command.draft
  const name = draft.name.trim(), email = draft.email.trim().toLowerCase()
  if (!name || name.length > 100 || draft.phone.length > 40 || draft.title.length > 100) throw new Error('Enter a valid name, phone number and job title.')
  validateEmail(email)
  if (emailInUse(store, email, user.id)) throw new Error('That email address belongs to another account.')
  if (snapshot.agents.some(a => a.id !== agent.id && a.name.toLowerCase() === name.toLowerCase())) throw new Error('That display name is already in use in this workspace.')
  if (!['supervisor', 'agent', 'viewer'].includes(draft.role) || !['active', 'inactive'].includes(draft.status) || !['active', 'inactive', 'suspended'].includes(draft.accountStatus)) throw new Error('Select a valid role and account status.')
  if (user.role === 'administrator' && (draft.role !== member.role || draft.status !== member.status || draft.accountStatus !== user.status)) throw new Error('Platform administrator access is managed separately.')
  const changes: string[] = []
  if (draft.accountStatus !== user.status) { user.status = draft.accountStatus; changes.push('Account status changed to ' + draft.accountStatus) }
  if (draft.role !== member.role) changes.push('Workspace role changed to ' + draft.role)
  if (draft.status !== member.status) changes.push(draft.status === 'active' ? 'Workspace access restored' : 'Workspace access paused')
  if (agent.name !== name) {
    const previous = agent.name
    const sameName = snapshot.agents.filter(a => a.name === previous).length === 1
    const assigned = (item: { assigneeId?: string | null; assignee?: string | null }) => item.assigneeId === agent.id || (!item.assigneeId && sameName && item.assignee === previous)
    snapshot.conversations = snapshot.conversations.map(c => assigned(c) ? { ...c, assignee: name, assigneeId: agent.id } : c)
    snapshot.tickets = snapshot.tickets.map(t => assigned(t) ? { ...t, assignee: name, assigneeId: agent.id } : t)
    if (snapshot.settings && (snapshot.settings.defaultAssigneeId === agent.id || (sameName && snapshot.settings.defaultAssignee === previous))) {
      snapshot.settings.defaultAssignee = name
      workspace.settings = structuredClone(snapshot.settings)
    }
  }
  if (agent.name !== name || (agent.email ?? '') !== email || (agent.phone ?? '') !== draft.phone.trim() || (agent.title ?? '') !== draft.title.trim()) changes.push('Agent profile updated')
  Object.assign(agent, { name, initials: initials(name), email, phone: draft.phone.trim(), title: draft.title.trim(), role: user.role === 'administrator' ? 'Admin' : draft.role === 'supervisor' ? 'Supervisor' : 'Agent' })
  Object.assign(member, { role: draft.role, status: draft.status })
  if (changes.length) addActivity(agent, changes.join(' · '))
  workspace.updatedAt = now
  return store
}

function validateEmail(email: string) {
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid email address.')
}

function emailInUse(store: WorkspaceStore, email: string, except?: string) {
  if (!email) return false
  return previewUsers.some(spec => spec.id !== except && spec.email === email && store.users.some(user => user.id === spec.id)) ||
    Object.values(store.snapshots).some(snapshot => snapshot.agents.some(agent => agent.userId !== except && agent.email?.toLowerCase() === email))
}
