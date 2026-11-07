import type { Conversation } from '../data/demoData'
import { supportService, type SupportService } from './supportService'
import { canInWorkspace, type WorkspaceStore } from './workspaceTypes'
import { platformPreview } from './workspaceManagement'

export const transferVersion = (c: Conversation) => JSON.stringify([c.updatedAt, c.assigneeId, c.assignee, c.status, c.handling, c.lifecycle, c.history.length])
export function mayTransfer(store: WorkspaceStore, c: Conversation, actorId: string) {
  const workspace = store.workspaces.find(w => w.id === c.workspaceId && w.status === 'active')
  const actor = actorId === platformPreview.id ? platformPreview : store.users.find(u => u.id === actorId)
  const agent = store.snapshots[c.workspaceId || '']?.agents.find(a => a.userId === actorId)
  return !!workspace && c.status !== 'resolved' && canInWorkspace(actor, workspace, store.memberships, 'reply') &&
    (canInWorkspace(actor, workspace, store.memberships, 'manage-support') || !!agent && (c.assigneeId ? c.assigneeId === agent.id : c.assignee === agent.name))
}
export function getEligibleTransferAgents(store: WorkspaceStore, c: Conversation, actorId: string) {
  if (!mayTransfer(store, c, actorId)) return []
  const workspaceId = c.workspaceId!, workspace = store.workspaces.find(w => w.id === workspaceId)!
  const snapshot = store.snapshots[workspaceId]
  return snapshot.agents.filter(agent => {
    const user = store.users.find(u => u.id === agent.userId)
    const member = store.memberships.find(m => m.workspaceId === workspaceId && m.userId === agent.userId && m.status === 'active')
    return agent.workspaceId === workspaceId && !!member && member.role !== 'viewer' && user?.status === 'active' &&
      canInWorkspace(user, workspace, store.memberships, 'reply') && agent.presence !== 'offline' &&
      (!c.departmentId || agent.departmentIds === undefined || agent.departmentIds.includes(c.departmentId)) &&
      (c.assigneeId ? agent.id !== c.assigneeId : agent.name !== c.assignee)
  }).map(agent => ({ ...agent, workload: snapshot.conversations.filter(item => item.status !== 'resolved' && item.assigneeId === agent.id).length }))
}

/** Browser-local adapter only: no live backend or production-database writes. */
export function createConversationTransfers(service: SupportService) {
  return {
    async transfer(input: { workspaceId: string; conversationId: string; actorId: string; agentId: string; expectedVersion: string; note: string; requestId: string }) {
      const execute = async () => service.updateWorkspace(input.workspaceId, data => {
        const store = service.registry()
        const c = data.conversations.find(item => item.id === input.conversationId && item.workspaceId === input.workspaceId)
        if (!c) throw new Error('Conversation not found in its original workspace.')
        const actingUser = input.actorId === platformPreview.id ? platformPreview : store.users.find(u => u.id === input.actorId)
        if (!canInWorkspace(actingUser, store.workspaces.find(w => w.id === input.workspaceId && w.status === 'active'), store.memberships, 'reply')) throw new Error('Permission denied: active staff workspace access is required.')
        const previous = c.history.find(h => h.transfer?.requestId === input.requestId)
        if (previous) {
          if (previous.transfer?.actorId !== input.actorId || previous.transfer?.toAgentId !== input.agentId) throw new Error('Invalid transfer request.')
          return data
        }
        if (!mayTransfer(store, c, input.actorId)) throw new Error(c.status === 'resolved' ? 'This conversation is closed. Reopen it before transferring.' : 'Permission denied. Only the assigned agent or an authorised manager can transfer this conversation.')
        if (transferVersion(c) !== input.expectedVersion) throw new Error('Transfer conflict: this conversation has changed. Review the latest conversation and try again.')
        const target = getEligibleTransferAgents(store, c, input.actorId).find(a => a.id === input.agentId)
        if (!target) throw new Error('The receiving agent is no longer eligible. Their account, membership, availability or department may have changed.')
        if (input.note.length > 2000) throw new Error('Transfer notes must be 2,000 characters or fewer.')
        if (!input.requestId.trim()) throw new Error('A transfer request ID is required.')
        const actor = input.actorId === platformPreview.id ? platformPreview : store.users.find(u => u.id === input.actorId)!
        const now = new Date().toISOString(), detail = `Conversation transferred from ${c.assignee || 'Unassigned'} to ${target.name}. By ${actor.name}.${input.note.trim() ? ` Note: ${input.note.trim()}` : ''}`
        const handover = c.status === 'waiting' || c.handling === 'ai' || c.handling === 'waiting' ? { handling: 'human' as const, lifecycle: 'human' as const, status: 'open' as const } : {}
        const next = { ...c, ...handover, assignee: target.name, assigneeId: target.id, updatedAt: now, history: [...c.history, { id: crypto.randomUUID(), type: 'conversation-transfer', title: 'Conversation transferred', detail, when: now, transfer: { requestId: input.requestId, workspaceId: input.workspaceId, conversationId: c.id, fromAgentId: c.assigneeId || null, fromAgentName: c.assignee, toAgentId: target.id, toAgentName: target.name, actorId: input.actorId, actorName: actor.name, note: input.note.trim() } }] }
        return { ...data, conversations: data.conversations.map(item => item.id === c.id ? next : item), notifications: [...(data.notifications || []), { id: crypto.randomUUID(), workspaceId: input.workspaceId, recipientUserId: target.userId, title: 'New conversation assigned', detail: 'A conversation has been transferred to you.', time: now, conversationId: c.id }] }
      })
      // Serialize cooperating transfer commands across tabs. Other edits are checked by version.
      if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(`crm-transfer:${input.workspaceId}`, execute)
      return execute()
    },
  }
}
export const conversationTransfers = createConversationTransfers(supportService)
