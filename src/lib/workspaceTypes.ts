import type { DemoData } from '../data/demoData'
import type { WorkspaceSettings } from './workspaceSettings'

export const QALO_WORKSPACE_ID = 'workspace-qalo'
export type WorkspaceOwned = { id: string; workspaceId: string }
export type ApplicationRole = 'administrator' | 'supervisor' | 'agent' | 'viewer'
export type WorkspaceRole = Exclude<ApplicationRole, 'administrator'>
export type WorkspaceMembership = WorkspaceOwned & {
  userId: string
  role: WorkspaceRole
  status: 'active' | 'inactive'
  legacyRole?: string
  accessReviewRequired?: boolean
}
export type WorkspaceUser = { id: string; name: string; role: ApplicationRole; status: 'active' | 'inactive' | 'suspended'; legacyRole?: string; accessReviewRequired?: boolean }
export type Workspace = {
  id: string
  name: string
  slug: string
  type: string
  description: string
  logo: string | null
  primaryColor: string
  secondaryColor: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
  settings: WorkspaceSettings
  supportMode?: 'banking'
  tagline?: string
}
export type WorkspaceAgent = WorkspaceOwned & { userId: string; name: string; initials: string; role: 'Admin' | 'Supervisor' | 'Agent'; teamId: string; presence?: 'online' | 'away' | 'offline'; departmentIds?: string[] }
export type WorkspaceDepartment = WorkspaceOwned & { name: string; area: string }
// UI drafts retain the existing DemoData shape. Persisted records require ownership.
type OwnedRecords<T> = T extends (infer R)[] ? (R extends object ? OwnedRecords<R> & WorkspaceOwned : R)[] : T extends object ? { [K in keyof T]: OwnedRecords<T[K]> } : T
export type WorkspaceData = { [K in keyof DemoData]: OwnedRecords<DemoData[K]> } & {
  workspaceId: string
  agents: WorkspaceAgent[]
  departments: WorkspaceDepartment[]
  widget?: NonNullable<DemoData['widget']> & WorkspaceOwned
  ai?: NonNullable<DemoData['ai']> & WorkspaceOwned
}
export type WorkspaceStore = {
  identityPreviewVersion?: number
  administratorRoleVersion?: number
  version: 2
  activeWorkspaceId: string
  workspaces: Workspace[]
  users: WorkspaceUser[]
  memberships: WorkspaceMembership[]
  snapshots: Record<string, WorkspaceData>
}

export type WorkspaceCapability = 'view' | 'reply' | 'manage-support' | 'manage-workspace' | 'manage-members' | 'manage-platform'
const permissions: Record<WorkspaceRole, readonly WorkspaceCapability[]> = {
  supervisor: ['view', 'reply', 'manage-support'],
  agent: ['view', 'reply'],
  viewer: ['view'],
}
/** UI simulation only. The backend must enforce tenant access and authorization. */
export function canInWorkspace(user: WorkspaceUser | undefined, workspace: Workspace | undefined, memberships: WorkspaceMembership[], capability: WorkspaceCapability): boolean {
  if (!user || user.status !== 'active') return false
  if (isAdministrator(user)) return !!workspace || capability === 'manage-platform' || capability === 'view'
  if (!workspace || capability === 'manage-platform') return false
  if (workspace.status !== 'active') return false
  const membership = memberships.find(item => item.userId === user.id && item.workspaceId === workspace.id && item.status === 'active')
  return !!membership && !!permissions[membership.role]?.includes(capability)
}

export function isAdministrator(user: WorkspaceUser | undefined): boolean {
  return user?.status === 'active' && user.role === 'administrator'
}

/** Inactive workspaces remain visible to administrators for management, but cannot be opened. */
export function getAccessibleWorkspaces(user: WorkspaceUser | undefined, workspaces: Workspace[], memberships: WorkspaceMembership[], includeInactive = false): Workspace[] {
  return workspaces.filter(workspace => (includeInactive || workspace.status === 'active') && canInWorkspace(user, workspace, memberships, 'view'))
}

export const workspaceQueryKey = (workspaceId: string) => ['demo-workspace', workspaceId] as const
