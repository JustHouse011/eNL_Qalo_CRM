import { useLocation } from 'react-router-dom'
import { previewIdentity } from '../lib/administratorRoles'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supportService } from '../lib/supportService'
import { getAccessibleWorkspaces, canInWorkspace, QALO_WORKSPACE_ID, type WorkspaceCapability, type WorkspaceStore } from '../lib/workspaceTypes'

import { useDemoAccess } from './DemoAccess'
import { platformPreview } from '../lib/workspaceManagement'

type WorkspaceContextValue = {
  workspaceId: string
  registry: WorkspaceStore | undefined
  error: string
  actorId: string
  selectWorkspace: (workspaceId: string, userId: string) => void
  can: (userId: string, capability: WorkspaceCapability) => boolean
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { role } = useDemoAccess()
  const { pathname } = useLocation()
  const enabled = role !== 'signed-out' || ['/customer-preview', '/enl-preview', '/chat', '/help', '/live', '/live-chat'].includes(pathname)
  const actorId = previewIdentity(role)?.slice(5) || ''
  const [registry, setRegistry] = useState<WorkspaceStore>()
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    let initialized = false
    function refresh() {
      try {
        if (!initialized) {
          supportService.registry()
          if (supportService.persistenceState() !== 'migration-pending') { supportService.initializeEnl(platformPreview.id); supportService.initializeIdentity() }
          initialized = true
        }
        setRegistry(supportService.registry()); setError('')
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Workspace data could not be loaded') }
    }
    refresh()
    return supportService.subscribe(refresh)
  }, [enabled])
  const user = actorId === platformPreview.id ? platformPreview : registry?.users.find(u => u.id === actorId)
  const available = registry ? getAccessibleWorkspaces(user, registry.workspaces, registry.memberships) : []
  const workspaceId = registry ? (available.find(w => w.id === registry.activeWorkspaceId)?.id || available[0]?.id || '') : QALO_WORKSPACE_ID
  const can = (userId: string, capability: WorkspaceCapability) => canInWorkspace(userId === platformPreview.id ? platformPreview : registry?.users.find(user => user.id === userId), registry?.workspaces.find(workspace => workspace.id === workspaceId), registry?.memberships || [], capability)
  function selectWorkspace(id: string, userId: string) {
    if (!canInWorkspace(userId === platformPreview.id ? platformPreview : registry?.users.find(user => user.id === userId), registry?.workspaces.find(workspace => workspace.id === id), registry?.memberships || [], 'view')) throw new Error('This user is not assigned to the workspace')
    supportService.selectWorkspace(id, userId)
  }
  return <WorkspaceContext.Provider value={{ workspaceId, registry: enabled ? registry : undefined, error, selectWorkspace, can, actorId }}>{children}</WorkspaceContext.Provider>
}
// oxlint-disable-next-line react/only-export-components
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace requires WorkspaceProvider')
  return context
}
