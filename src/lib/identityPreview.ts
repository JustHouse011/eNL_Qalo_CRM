import type { WorkspaceStore, WorkspaceRole, WorkspaceCapability } from './workspaceTypes'

export const roleLabels: Record<WorkspaceRole, string> = { supervisor: 'Supervisor', agent: 'Support Agent', viewer: 'Viewer / Auditor' }
export const previewUsers = [
  { id: 'user-agent-1', name: 'Bongani Nombamba', title: 'Platform Administrator', email: 'bongani@example.invalid' },
  { id: 'user-agent-2', name: 'Phindile Khumalo', title: 'Customer Support Agent', email: 'phindile@example.invalid' },
  { id: 'user-agent-3', name: 'Tumo Likotsi', title: 'Customer Support Agent', email: 'tumo@example.invalid' },
]
/** One-time local fixture refinement. Customer records and existing custom identities remain intact. */
function refineLegacyIdentityFixtures(input: WorkspaceStore): WorkspaceStore {
  if (input.identityPreviewVersion === 1) return input
  const store = structuredClone(input)
  for (const spec of previewUsers) {
    let user = store.users.find(u => u.id === spec.id)
    if (!user) {
      const ambiguous = store.users.find(u => u.name === spec.name)
      if (ambiguous) { ambiguous.accessReviewRequired = true; continue }
    }
    if (!user) { user = { id: spec.id, name: spec.name, role: 'agent', status: 'active' }; store.users.push(user) }
    user.role = spec.id === 'user-agent-1' ? 'administrator' : 'agent'
    for (const workspace of store.workspaces.filter(w => w.id === 'workspace-qalo' || w.supportMode === 'banking')) {
      const permitted = spec.id !== 'user-agent-3' || workspace.id === 'workspace-qalo'
      const membership = store.memberships.find(m => m.userId === user.id && m.workspaceId === workspace.id)
      const role: WorkspaceRole = spec.id === 'user-agent-1' ? 'supervisor' : 'agent'
      if (membership) Object.assign(membership, { role, status: permitted ? membership.status : 'inactive' })
      else if (permitted) store.memberships.push({ id: `${workspace.id}:identity:${user.id}`, workspaceId: workspace.id, userId: user.id, role, status: 'active' })
      const snapshot = store.snapshots[workspace.id]
      const agent = snapshot.agents.find(a => a.userId === user.id)
      const agentRole = spec.id === 'user-agent-1' ? 'Admin' as const : 'Agent' as const
      if (agent) agent.role = agentRole
      else if (permitted) snapshot.agents.push({ id: `${workspace.id}:identity-agent:${user.id}`, workspaceId: workspace.id, userId: user.id, name: user.name, initials: user.name.split(' ').map(n => n[0]).join(''), role: agentRole, teamId: '', presence: 'away', departmentIds: snapshot.departments.map(d => d.id) })
    }
  }
  store.identityPreviewVersion = 1
  return store
}

/** Add the requested eNL demo memberships once. Keep existing agent IDs and later edits. */
export function refineIdentityFixtures(input: WorkspaceStore): WorkspaceStore {
  const base = refineLegacyIdentityFixtures(input)
  const workspace = base.workspaces.find(w => w.slug === 'enl-mutual-bank' && w.supportMode === 'banking')
  if (!workspace || base.enlTeamVersion === 1) return base
  const store = structuredClone(base)
  const snapshot = store.snapshots[workspace.id]
  const refiloe = store.users.find(u => u.id === 'user-enl-refiloe-demo' || u.name.trim().toLowerCase() === 'refiloe dikotsi')
  if (!refiloe) store.users.push({ id: 'user-enl-refiloe-demo', name: 'Refiloe Dikotsi', role: 'supervisor', status: 'active' })
  const identities = [
    { id: 'user-agent-1', role: 'supervisor', label: 'Admin' },
    { id: 'user-agent-2', role: 'agent', label: 'Agent' },
    { id: 'user-agent-3', role: 'agent', label: 'Agent' },
    { id: refiloe?.id ?? 'user-enl-refiloe-demo', role: 'supervisor', label: 'Supervisor' },
  ] as const
  for (const identity of identities) {
    const user = store.users.find(u => u.id === identity.id)
    if (!user) continue
    const membership = store.memberships.find(m => m.workspaceId === workspace.id && m.userId === user.id)
    if (!membership) store.memberships.push({ id: `${workspace.id}:identity:${user.id}`, workspaceId: workspace.id, userId: user.id, role: identity.role, status: 'active' })
    // The old demo fixture explicitly denied Tumo eNL access.
    else if (user.id === 'user-agent-3' && user.status === 'active') membership.status = 'active'
    if (!snapshot.agents.some(a => a.userId === user.id)) {
      snapshot.agents.push({ id: `${workspace.id}:identity-agent:${user.id}`, workspaceId: workspace.id, userId: user.id, name: user.name, initials: user.name.split(/\s+/).map(n => n[0]).join('').slice(0, 2), role: identity.label, teamId: '', presence: 'away' })
    }
  }
  store.enlTeamVersion = 1
  return store
}

export function routeCapability(path: string): WorkspaceCapability {
  if (path.startsWith('/account/')) return 'view'
  if (['/inbox', '/tickets', '/visitors', '/retail', '/returns', '/pipeline', '/activities', '/feedback', '/knowledge', '/contacts', '/banking-products', '/account-support', '/complaints'].includes(path)) return 'reply'
  if (path.startsWith('/platform')) return 'manage-platform'
  if (['/settings', '/integrations', '/widget', '/ai-assist', '/automations'].includes(path)) return 'manage-workspace'
  if (['/team', '/reports'].includes(path)) return 'manage-support'
  return 'view'
}
