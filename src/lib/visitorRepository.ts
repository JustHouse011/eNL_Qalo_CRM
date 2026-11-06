import { supportService, type SupportService } from './supportService'
import { canInWorkspace } from './workspaceTypes'
import { platformPreview } from './workspaceManagement'
import type { VisitorDataset, VisitorSession } from './visitorAnalytics'

/** Adapter boundary for an authenticated tracking API. No API or provider is inferred from saved configuration. */
export interface VisitorRepository {
  read(workspaceId: string, actorId: string, signal: AbortSignal): Promise<VisitorDataset>
  subscribe(workspaceId: string, changed: () => void): () => void
  setPaused?(workspaceId: string, paused: boolean): void
}
export function assertVisitorAccess(service: SupportService, workspaceId: string, actorId: string) {
  const registry = service.registry()
  const user = actorId === platformPreview.id ? platformPreview : registry.users.find(u => u.id === actorId)
  const workspace = registry.workspaces.find(w => w.id === workspaceId)
  if (!workspace || workspace.status !== 'active' || !canInWorkspace(user, workspace, registry.memberships, 'reply')) throw new Error('Visitor access is unavailable for this workspace.')
}
export function createVisitorRepository(service: SupportService): VisitorRepository {
  return {
    async read(workspaceId, actorId, signal) {
      signal.throwIfAborted()
      assertVisitorAccess(service, workspaceId, actorId)
      const data = await service.readWorkspace(workspaceId)
      signal.throwIfAborted()
      if (data.workspaceId !== workspaceId) throw new Error('Visitor workspace could not be verified.')
      return {
        workspaceId,
        mode: 'workspace',
        agentNames: data.agents.filter(a => a.workspaceId === workspaceId).map(a => a.name),
        sessions: data.visitors.filter(v => v.workspaceId === workspaceId).map(v => ({ ...v, workspaceId }) as VisitorSession),
        conversations: data.conversations.filter(c => c.workspaceId === workspaceId),
        pageViews: [],
        tracking: { state: 'unavailable', presence: false, visitors: false, pageViews: false, inactivityMs: 120000 },
      }
    },
    subscribe(workspaceId, changed) { return service.subscribe(changed, workspaceId) },
  }
}
export const visitorRepository = createVisitorRepository(supportService)
