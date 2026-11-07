import { mayTransfer, getEligibleTransferAgents } from './conversationTransfer'
import { eligibleAgent } from './ticketSupport'
import type { Conversation, DemoData, Message } from '../data/demoData'
import { supportService, type SupportService } from './supportService'
import { isAdministrator, canInWorkspace } from './workspaceTypes'
import { platformPreview } from './workspaceManagement'

export type ConversationState = NonNullable<Conversation['lifecycle']>
export const conversationLabels: Record<ConversationState, string> = { new: 'New', ai: 'AI Handling', waiting: 'Waiting for Agent', human: 'Human Handling', resolved: 'Resolved', reopened: 'Reopened' }
export function conversationState(c: Conversation): ConversationState {
  return c.status === 'resolved' ? 'resolved' : c.lifecycle || c.handling || (c.assignee ? 'human' : 'waiting')
}
export function event(c: Conversation, type: string, title: string, detail: string, now: string, to = conversationState(c)): Conversation {
  return { ...c, updatedAt: now, history: [...c.history, { id: crypto.randomUUID(), type, title, detail, when: now, from: conversationState(c), to }] }
}
export function transition(c: Conversation, to: ConversationState, type: string, title: string, detail: string, now: string): Conversation {
  const handling = to === 'new' || to === 'reopened' ? c.assignee ? 'human' : 'waiting' : to
  const next = event(c, type, title, detail, now, to)
  return { ...next, lifecycle: to, handling, status: handling === 'resolved' ? 'resolved' : handling === 'waiting' ? 'waiting' : 'open',
    ...(handling === 'ai' || handling === 'waiting' ? { assignee: null, assigneeId: null } : {}), typing: false,
    resolvedAt: to === 'resolved' ? now : undefined,
    resolutionEvents: to === 'resolved' ? [...new Set([...(c.resolutionEvents || []), ...(c.resolvedAt ? [c.resolvedAt] : []), now])] : c.resolutionEvents }
}
export function notifyConversation(data: DemoData, workspaceId: string, c: Conversation, title: string, now: string): DemoData {
  return { ...data, notifications: [...(data.notifications || []), { id: crypto.randomUUID(), workspaceId, title, detail: c.customer, time: now, conversationId: c.id }] }
}
export function replaceConversation(data: DemoData, c: Conversation): DemoData { return { ...data, conversations: data.conversations.map(old => old.id === c.id ? c : old) } }
export function beginConversation(data: DemoData, workspaceId: string, c: Conversation, target: 'ai' | 'waiting' | 'human'): DemoData {
  const started = event({ ...c, lifecycle: 'new' }, 'created', 'New conversation', 'Support conversation', c.createdAt, 'new')
  const next = transition(started, target, 'started', conversationLabels[target], 'Support conversation', c.createdAt)
  return notifyConversation({ ...data, conversations: [next, ...data.conversations] }, workspaceId, next, 'New conversation', c.createdAt)
}
export function appendCustomer(data: DemoData, workspaceId: string, id: string, message: Message): DemoData {
  let c = data.conversations.find(c => c.id === id)
  if (!c) throw new Error('Conversation not found in this workspace.')
  if (c.messages.some(m => m.id === message.id)) return data
  const reopening = c.status === 'resolved'
  if (reopening) c = transition(c, 'reopened', 'reopened', 'Conversation reopened', 'Customer sent a new message', message.time)
  c = event(c, 'customer-message', 'Customer reply', 'Customer message recorded locally', message.time)
  c = { ...c, messages: [...c.messages, message], unread: c.unread + 1 }
  const result = notifyConversation(replaceConversation(data, c), workspaceId, c, 'Customer reply', message.time)
  return reopening ? notifyConversation(result, workspaceId, c, 'Conversation reopening', message.time) : result
}
export function qaloReply(data: DemoData, c: Conversation) {
  const guidance = c.businessArea === 'store' ? data.ai?.store : data.ai?.community
  return `assistant: We have recorded your enquiry for the support team. ${guidance || 'I can offer general support guidance; a human can review your request.'} No external action has been performed.`
}
export function appendSimulated(data: DemoData, id: string, messages: Message[]): DemoData {
  const c = data.conversations.find(c => c.id === id)
  if (!c || c.status === 'resolved' || c.handling !== 'ai' || data.assistant?.enabled === false) return data
  const unique = messages.filter(m => !c.messages.some(old => old.id === m.id)).map(m => ({ ...m, simulated: true }))
  if (!unique.length) return data
  return replaceConversation(data, { ...event(c, 'ai-message', 'AI reply', 'Assistant response', unique.at(-1)!.time), messages: [...c.messages, ...unique] })
}

/** Browser-only permission simulation. Every command captures its originating workspace. */
export function createConversationSupport(service: SupportService) {
  function active(workspaceId: string) {
    const registry = service.registry()
    if (!registry.workspaces.some(w => w.id === workspaceId && w.status === 'active')) throw new Error('Workspace unavailable.')
    return registry
  }
  function agentFor(workspaceId: string, actorId: string) {
    const registry = active(workspaceId)
    const actor = actorId === platformPreview.id ? platformPreview : registry.users.find(u => u.id === actorId)
    if (!canInWorkspace(actor, registry.workspaces.find(w => w.id === workspaceId), registry.memberships, 'reply')) throw new Error('Active workspace membership is required.')
    const agents = registry.snapshots[workspaceId].agents.filter(a => registry.memberships.some(m => m.workspaceId === workspaceId && m.userId === a.userId && m.status === 'active'))
    const agent = agents.find(a => a.userId === actorId) || (isAdministrator(actor) ? agents[0] : undefined)
    if (!agent) throw new Error('An active workspace agent is required.')
    return { agent, agents }
  }
  function command(workspaceId: string, id: string, change: (data: DemoData, c: Conversation, now: string) => DemoData) {
    active(workspaceId)
    return service.updateWorkspace(workspaceId, data => {
      const c = data.conversations.find(c => c.id === id)
      if (!c) throw new Error('Conversation not found in this workspace.')
      return change(data, c, new Date().toISOString())
    })
  }
  return {
    async takeover(workspaceId: string, id: string, actorId: string) {
      const { agent } = agentFor(workspaceId, actorId)
      return command(workspaceId, id, (data, c, now) => {
        if (c.status === 'resolved') throw new Error('Reopen the conversation before taking over.')
        if (c.handling === 'human' && c.assigneeId === agent.id) return data
        if (!eligibleAgent(agent, c.departmentId)) throw new Error('Agent is unavailable or ineligible for this department.')
        const next = { ...transition(c, 'human', 'takeover', 'Human takeover', agent.name, now), assignee: agent.name, assigneeId: agent.id }
        return notifyConversation(replaceConversation(data, next), workspaceId, next, 'Conversation assigned (human takeover)', now)
      })
    },
    async requestHuman(workspaceId: string, id: string, departmentId?: string, urgent = false) {
      return command(workspaceId, id, (data, c, now) => {
        if (c.status === 'resolved') throw new Error('Reopen the conversation before requesting an agent.')
        if (c.handling === 'human' || (c.handling === 'waiting' && (!urgent || c.priority === 'urgent'))) return data
        const department = service.registry().snapshots[workspaceId].departments.find(d => d.id === departmentId)
        if (departmentId && !department) throw new Error('Department not found in this workspace.')
        const next = { ...transition(c, 'waiting', 'human-request', 'Human support requested', department?.name || c.department, now), ...(department ? { departmentId: department.id, department: department.name } : {}), priority: urgent ? 'urgent' as const : c.priority,
          messages: [...c.messages, { id: crypto.randomUUID(), author: 'Support team', text: 'Your human support request has been recorded.', kind: 'agent' as const, simulated: true, time: now, delivery: 'sent' as const }] }
        return notifyConversation(replaceConversation(data, next), workspaceId, next, 'Human takeover request', now)
      })
    },
    async returnToAi(workspaceId: string, id: string, actorId: string) {
      agentFor(workspaceId, actorId)
      return command(workspaceId, id, (data, c, now) => {
        if (c.status === 'resolved') throw new Error('Reopen the conversation before returning to AI.')
        if (data.assistant?.enabled === false || /fraud|security/i.test(c.department) || c.priority === 'urgent') throw new Error('This conversation requires human support or the assistant is disabled.')
        if (c.handling === 'ai') return data
        return replaceConversation(data, transition(c, 'ai', 'returned-ai', 'Returned to AI', 'Human assignment cleared; future customer messages may receive replies', now))
      })
    },
    async resolve(workspaceId: string, id: string, actorId: string, reopen = false) {
      agentFor(workspaceId, actorId)
      return command(workspaceId, id, (data, c, now) => {
        if (reopen ? c.status !== 'resolved' : c.status === 'resolved') return data
        const next = transition(c, reopen ? 'reopened' : 'resolved', reopen ? 'reopened' : 'resolved', reopen ? 'Conversation reopened' : 'Conversation resolved', 'Recorded locally by support', now)
        const nextData = replaceConversation(data, next)
        return reopen ? notifyConversation(nextData, workspaceId, next, 'Conversation reopening', now) : nextData
      })
    },
    async update(workspaceId: string, id: string, actorId: string, patch: Partial<Conversation>) {
      const { agents } = agentFor(workspaceId, actorId)
      return command(workspaceId, id, (data, c, now) => {
        let next = c
        if (patch.assignee !== undefined && patch.assignee !== c.assignee) {
          if (c.status === 'resolved') throw new Error('Reopen the conversation before assigning an agent.')
          if (!mayTransfer(service.registry(), c, actorId)) throw new Error('Only the assigned agent or an authorised manager may reassign this conversation.')
          const assigned = getEligibleTransferAgents(service.registry(), c, actorId).find(a => a.name === patch.assignee)
          if (patch.assignee && (!assigned || !eligibleAgent(assigned, c.departmentId))) throw new Error('Active agent not found in this workspace or unavailable for this department.')
          next = { ...transition(next, assigned ? 'human' : 'waiting', 'assignment', 'Conversation assigned', assigned?.name || 'Unassigned; waiting for support', now), assignee: assigned?.name || null, assigneeId: assigned?.id || null }
        }
        if (patch.department !== undefined && patch.department !== c.department) {
          const department = service.registry().snapshots[workspaceId].departments.find(d => d.name === patch.department && (d.area === (patch.businessArea || c.businessArea) || d.area === 'general'))
          if (!department) throw new Error('Department not found in this workspace.')
          const assigned = agents.find(a => a.id === next.assigneeId)
          if (assigned && !eligibleAgent(assigned, department.id)) throw new Error('Unassign this agent before routing to an ineligible department.')
          next = { ...event(next, 'routing', 'Department changed', department.name, now), department: department.name, departmentId: department.id }
        }
        if (patch.priority !== undefined && patch.priority !== c.priority) {
          if (!['low', 'normal', 'high', 'urgent'].includes(patch.priority)) throw new Error('Invalid priority.')
          next = { ...event(next, 'priority', 'Priority changed', patch.priority, now), priority: patch.priority }
        }
        // Context fields remain editable without allowing callers to overwrite lifecycle/messages.
        const { assignee: _assignee, department: _department, priority: _priority, ...context } = patch
        const allowed = ['tags', 'businessArea', 'category', 'participantType', 'initiative', 'reference', 'onboardingStage', 'documents', 'order', 'organisationId']
        const fields = Object.fromEntries(Object.entries(context).filter(([key]) => allowed.includes(key)))
        if (Object.keys(fields).length) next = { ...event(next, 'context', 'Conversation context updated', 'Support details saved locally', now), ...fields }
        const result = replaceConversation(data, next)
        return patch.assignee !== undefined && patch.assignee !== c.assignee ? notifyConversation(result, workspaceId, next, 'Conversation assigned', now) : result
      })
    },
    async reply(workspaceId: string, id: string, actorId: string, text: string, note = false, messageId = crypto.randomUUID()) {
      const { agent } = agentFor(workspaceId, actorId)
      if (!text.trim() || text.length > 4000) throw new Error('Enter a message of up to 4000 characters.')
      return command(workspaceId, id, (data, c, now) => {
        if (c.messages.some(m => m.id === messageId)) return data
        if (c.status === 'resolved' && !note) throw new Error('Reopen the conversation before replying.')
        const registry = service.registry()
        const actor = actorId === platformPreview.id ? platformPreview : registry.users.find(u => u.id === actorId)
        const manager = canInWorkspace(actor, registry.workspaces.find(w => w.id === workspaceId), registry.memberships, 'manage-support')
        if (!note && !manager && (c.assigneeId ? c.assigneeId !== agent.id : c.assignee !== agent.name)) throw new Error('This conversation is assigned to another agent. Take over before replying.')
        if (!note && conversationState(c) !== 'human' && !(c.lifecycle === 'reopened' && c.handling === 'human')) throw new Error('Take over this conversation before replying.')
        const next = { ...event(c, note ? 'note' : 'agent-message', note ? 'Internal note added' : 'Agent reply', agent.name, now), unread: 0, messages: [...c.messages, { id: messageId, author: agent.name, text: text.trim(), kind: note ? 'note' as const : 'agent' as const, time: now, delivery: 'sent' as const }] }
        return replaceConversation(data, next)
      })
    },
    async customerMessage(workspaceId: string, id: string, text: string, messageId = crypto.randomUUID(), reply?: (data: DemoData, c: Conversation) => string) {
      if (!text.trim() || text.length > 4000) throw new Error('Enter a message of up to 4000 characters.')
      return command(workspaceId, id, (data, c, now) => {
        if (c.messages.some(m => m.id === messageId)) return data
        let nextData = appendCustomer(data, workspaceId, id, { id: messageId, author: c.customer, text: text.trim(), kind: 'customer', time: now })
        const current = nextData.conversations.find(c => c.id === id)!
        if (current.handling === 'ai' && data.assistant?.enabled !== false && reply) nextData = replaceConversation(nextData, { ...event(current, 'ai-message', 'AI reply', 'Assistant response', now), messages: [...current.messages, { id: `${messageId}:ai`, author: data.assistant?.name || 'Qalo Virtual Assistant', text: reply(data, current), kind: 'agent', simulated: true, time: now, delivery: 'sent' }] })
        return nextData
      })
    },
  }
}
export const conversationSupport = createConversationSupport(supportService)
