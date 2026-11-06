import { scopeWorkspaceData } from './workspaceMigration'
import { mergeWorkspaceSettings } from './workspaceSettings'
import { isAdministrator, canInWorkspace, type Workspace, type WorkspaceStore, type WorkspaceUser, type WorkspaceMembership } from './workspaceTypes'

export const platformPreview: WorkspaceUser = { id: 'platform-preview', name: 'Administrator preview', role: 'administrator', status: 'active' }
export type WorkspaceDraft = Pick<Workspace, 'name' | 'slug' | 'description' | 'type' | 'logo' | 'primaryColor' | 'secondaryColor'>
export type ManagementCommand =
  | { kind: 'create'; draft: WorkspaceDraft; administratorId: string; workspaceId?: string }
  | { kind: 'edit'; workspaceId: string; draft: WorkspaceDraft; settings?: Workspace['settings'] }
  | { kind: 'status'; workspaceId: string; status: Workspace['status'] }
  | { kind: 'member'; workspaceId: string; userId?: string; name?: string; role: WorkspaceMembership['role']; status: WorkspaceMembership['status'] }
  | { kind: 'remove-member'; workspaceId: string; userId: string }

function validateDraft(draft: WorkspaceDraft, store: WorkspaceStore, id?: string) {
  if (!draft.name.trim() || draft.name.length > 100 || !draft.type.trim()) throw new Error('Name and organisation type are required (name maximum 100 characters).')
  if (draft.slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) throw new Error('Use a lowercase slug with letters, numbers and hyphens.')
  if (store.workspaces.some(w => w.id !== id && w.slug === draft.slug)) throw new Error('This workspace slug is already in use.')
  if (![draft.primaryColor, draft.secondaryColor].every(color => /^#[0-9a-f]{6}$/i.test(color))) throw new Error('Use six-digit hexadecimal branding colours.')
  if (![null, '/qalo-logo.png', '/qalo-website-logo.png'].includes(draft.logo)) throw new Error('Select an approved logo or initials.')
}
export function manageWorkspace(input: WorkspaceStore, actorId: string, command: ManagementCommand): WorkspaceStore {
  const store = structuredClone(input)
  const actor = actorId === platformPreview.id ? platformPreview : store.users.find(u => u.id === actorId)
  const workspace = 'workspaceId' in command ? store.workspaces.find(w => w.id === command.workspaceId) : undefined
  const platform = isAdministrator(actor)
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
