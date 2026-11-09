import type { WorkspaceStore } from './workspaceTypes'

const canonical = ['administrator', 'supervisor', 'agent', 'viewer']
/** Additive local compatibility migration. Never touches snapshots, personal storage or selection. */
export function migrateAdministratorRoles(input: WorkspaceStore): WorkspaceStore {
  if (input.administratorRoleVersion === 1) return input
  const store = structuredClone(input)
  for (const user of store.users) {
    const raw = user as unknown as Record<string, unknown>
    const oldRole = raw.platformRole || raw.role
    const approved = user.id === 'user-agent-1'
    if (oldRole && !canonical.includes(String(oldRole))) user.legacyRole = String(oldRole)
    if (approved) user.role = 'administrator'
    else if (user.id === 'user-agent-2' || user.id === 'user-agent-3') user.role = 'agent'
    else if (raw.platformRole) {
      user.role = 'viewer'; user.accessReviewRequired = true
      if (!user.status || user.status === 'active') user.status = 'suspended'
    }
    else if (raw.role === 'support-agent') user.role = 'agent'
    else if (raw.role === 'workspace-admin') { user.role = 'supervisor'; user.accessReviewRequired = true }
    else if (!canonical.includes(String(raw.role))) {
      const roles = store.memberships.filter(m => m.userId === user.id).map(m => String(m.role))
      user.role = oldRole ? 'viewer' : roles.some(role => ['supervisor', 'workspace-admin'].includes(role)) ? 'supervisor' : roles.some(role => ['agent', 'support-agent'].includes(role)) ? 'agent' : 'viewer'
      if (oldRole) { user.accessReviewRequired = true; if (!user.status || user.status === 'active') user.status = 'suspended' }
    }
    user.status ??= 'active'
    delete raw.platformRole
  }
  for (const member of store.memberships) {
    const oldRole = String(member.role)
    if (oldRole === 'support-agent') member.role = 'agent'
    else if (oldRole === 'workspace-admin') {
      member.role = 'supervisor'; member.legacyRole = oldRole
      if (member.userId !== 'user-agent-1') {
        member.accessReviewRequired = true
        const user = store.users.find(u => u.id === member.userId)
        if (user) {
          user.accessReviewRequired = true
          user.legacyRole ??= oldRole
          if (!['user-agent-2', 'user-agent-3'].includes(user.id) && user.status === 'active' && user.role === 'agent') user.role = 'supervisor'
        }
      }
    } else if (!['supervisor', 'agent', 'viewer'].includes(oldRole)) {
      member.role = 'viewer'; member.legacyRole = oldRole; member.status = 'inactive'; member.accessReviewRequired = true
    }
    if (member.userId === 'user-agent-2' || member.userId === 'user-agent-3') member.role = 'agent'
  }
  store.administratorRoleVersion = 1
  return store
}

/** Saved developer aliases identify fixtures; they never confer a permission themselves. */
export function previewIdentity(value: string | null): `user:${string}` | null {
  if (value === 'user:platform-preview') return 'user:user-agent-1'
  if (value?.startsWith('user:')) return value as `user:${string}`
  const aliases: Record<string, string> = { Admin: 'user-agent-1', 'Platform Super Admin': 'user-agent-1', Supervisor: 'user-agent-2', Agent: 'user-agent-3' }
  return value && Object.hasOwn(aliases, value) ? `user:${aliases[value]}` : null
}
