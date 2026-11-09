import type { DemoData, DemoTicket } from '../data/demoData'
import { supportService, type SupportService } from './supportService'
import { platformPreview } from './workspaceManagement'
import { activeWorkspaceAgent, canInWorkspace, type WorkspaceAgent, type WorkspaceData } from './workspaceTypes'

export const ticketStates = ['New', 'Open', 'In Progress', 'Pending Customer', 'Escalated', 'Resolved', 'Reopened', 'Closed'] as const
export type TicketState = typeof ticketStates[number]
export const ticketState = (ticket: DemoTicket): TicketState => ticket.status === 'Pending' ? 'Pending Customer' : ticket.status
export const ticketTransitions: Record<TicketState, readonly TicketState[]> = {
  New: ['Open', 'In Progress', 'Escalated', 'Resolved'],
  Open: ['In Progress', 'Pending Customer', 'Escalated', 'Resolved'],
  'In Progress': ['Pending Customer', 'Escalated', 'Resolved'],
  'Pending Customer': ['In Progress', 'Escalated', 'Resolved'],
  Escalated: ['In Progress', 'Pending Customer', 'Resolved'],
  Resolved: ['Reopened', 'Closed'], Reopened: ['In Progress', 'Pending Customer', 'Escalated', 'Resolved'], Closed: ['Reopened'],
}
/** Missing memberships on legacy agents mean unrestricted department eligibility, not invented memberships. */
export function eligibleAgent(agent: WorkspaceAgent, departmentId?: string | null) {
  return agent.presence !== 'offline' && (!departmentId || agent.departmentIds === undefined || agent.departmentIds.includes(departmentId))
}
export function createTicketSupport(service: SupportService) {
  function authorize(workspaceId: string, actorId: string, management = false) {
    const registry = service.registry()
    const workspace = registry.workspaces.find(w => w.id === workspaceId && w.status === 'active')
    const user = actorId === platformPreview.id ? platformPreview : registry.users.find(u => u.id === actorId)
    if (!canInWorkspace(user, workspace, registry.memberships, management ? 'manage-support' : 'reply')) throw new Error('This role cannot perform this action in this workspace.')
    const snapshot = registry.snapshots[workspaceId]
    const agents = snapshot.agents.filter(a => activeWorkspaceAgent(registry, a))
    return { snapshot, agents }
  }
  function links(snapshot: WorkspaceData, agents: WorkspaceAgent[], ticket: DemoTicket, previous?: DemoTicket) {
    const source = ticket.conversationId ? snapshot.conversations.find(c => c.id === ticket.conversationId) : undefined
    if (ticket.conversationId && !source) throw new Error('Conversation not found in this workspace.')
    if (ticket.contactId && !snapshot.contacts.some(c => c.id === ticket.contactId)) throw new Error('Customer not found in this workspace.')
    if (source && (ticket.customer !== source.customer || ticket.contactId !== source.contactId)) throw new Error('Customer must match the linked conversation.')
    const department = ticket.departmentId ? snapshot.departments.find(d => d.id === ticket.departmentId) : undefined
    if (ticket.departmentId && !department) throw new Error('Department not found in this workspace.')
    const changingAssignment = ticket.assigneeId !== previous?.assigneeId || ticket.departmentId !== previous?.departmentId
    const agent = ticket.assigneeId ? (changingAssignment ? agents : snapshot.agents).find(a => a.id === ticket.assigneeId) : undefined
    if (ticket.assigneeId && (!agent || (changingAssignment && !eligibleAgent(agent, ticket.departmentId)))) throw new Error('Agent is unavailable or ineligible for this workspace department.')
    return { ...ticket, department: department?.name || (ticket.departmentId === previous?.departmentId ? ticket.department : '') || '', businessArea: department ? department.area as DemoTicket['businessArea'] : ticket.businessArea, assignee: agent?.name || (ticket.assigneeId === previous?.assigneeId ? ticket.assignee : '') || 'Unassigned' }
  }
  function event(ticket: DemoTicket, workspaceId: string, actorId: string, type: string, metadata: Record<string, string>, now: string) {
    ticket.activity = [...(ticket.activity || []), { id: crypto.randomUUID(), workspaceId, ticketId: ticket.id, actorId, timestamp: now, type, metadata }]
  }
  return {
    async create(workspaceId: string, actorId: string, draft: Partial<DemoTicket>, requestId: string) {
      let result = ''
      await service.updateWorkspace(workspaceId, data => {
        const { snapshot, agents } = authorize(workspaceId, actorId)
        const previous = data.tickets.find(t => t.requestId === requestId)
        if (previous) { result = previous.id; return data }
        if (!requestId || !draft.subject?.trim() || draft.subject.length > 200) throw new Error('Enter a subject of up to 200 characters and a request ID.')
        const source = draft.conversationId ? snapshot.conversations.find(c => c.id === draft.conversationId) : undefined
        const now = new Date().toISOString()
        const input = Object.fromEntries(Object.entries(draft).filter(([key]) => ['subject', 'customer', 'priority', 'businessArea', 'category', 'contactId', 'conversationId', 'departmentId', 'assigneeId', 'description', 'reference', 'dueDate'].includes(key)))
        const banking = service.registry().workspaces.find(w => w.id === workspaceId)?.supportMode === 'banking'
        const ticket = links(snapshot, agents, { ...input, ...(source ? { customer: source.customer, contactId: source.contactId, businessArea: source.businessArea, organisationId: source.organisationId, reference: source.reference, description: draft.description || source.messages.filter(m => m.kind === 'customer').at(-1)?.text } : {}), id: `${banking ? 'ENL-DEMO' : 'T'}-${crypto.randomUUID().slice(0, 8)}`, workspaceId, subject: draft.subject.trim(), customer: source?.customer || draft.customer || '', status: 'New', priority: draft.priority || 'normal', assignee: '', updated: now, createdAt: now, updatedAt: now, requestId, activity: [] })
        if (!ticket.customer.trim()) throw new Error('Select a customer.')
        if (!['low', 'normal', 'high', 'urgent'].includes(ticket.priority)) throw new Error('Invalid priority.')
        event(ticket, workspaceId, actorId, 'created', { subject: ticket.subject }, now)
        if (ticket.assigneeId) event(ticket, workspaceId, actorId, 'assigned', { agentId: ticket.assigneeId }, now)
        result = ticket.id
        return { ...data, tickets: [ticket, ...data.tickets] }
      })
      return result
    },
    async edit(workspaceId: string, actorId: string, id: string, patch: Partial<DemoTicket>) {
      return service.updateWorkspace(workspaceId, data => {
        const { snapshot, agents } = authorize(workspaceId, actorId)
        const old = data.tickets.find(t => t.id === id)
        if (!old) throw new Error('Ticket not found in this workspace.')
        const allowed = ['subject', 'customer', 'contactId', 'description', 'category', 'businessArea', 'reference', 'dueDate', 'priority', 'departmentId', 'assigneeId', 'status', 'resolution']
        const fields = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)))
        const next = links(snapshot, agents, { ...old, ...fields }, old)
        if (!next.subject.trim() || next.subject.length > 200 || !next.customer.trim()) throw new Error('Subject and customer are required.')
        if (!['low', 'normal', 'high', 'urgent'].includes(next.priority)) throw new Error('Invalid priority.')
        const from = ticketState(old), to = ticketState(next)
        if (!ticketTransitions[from] || !ticketTransitions[to] || (from !== to && !ticketTransitions[from].includes(to))) throw new Error(`Cannot transition from ${from} to ${to}.`)
        if (from === 'Closed' && to === 'Closed') throw new Error('Reopen the closed ticket before editing.')
        const now = new Date().toISOString()
        for (const [field, type] of [['assigneeId', old.assigneeId ? 'reassigned' : 'assigned'], ['departmentId', 'department-changed'], ['priority', 'priority-changed']] as const) {
          if (old[field] !== next[field]) event(next, workspaceId, actorId, type, { from: String(old[field] || ''), to: String(next[field] || '') }, now)
        }
        if (from !== to) {
          event(next, workspaceId, actorId, 'status-changed', { from, to }, now)
          const types: Partial<Record<TicketState, string>> = { Escalated: 'escalated', Resolved: 'resolved', Reopened: 'reopened', Closed: 'closed' }
          const type = types[to]
          if (type) event(next, workspaceId, actorId, type, { resolution: next.resolution || '' }, now)
          if (to === 'Resolved') next.resolvedAt = now
          if (to === 'Closed') next.closedAt = now
          if (to === 'Reopened') { next.resolvedAt = undefined; next.closedAt = undefined }
        }
        if (['subject', 'description', 'category', 'businessArea', 'reference', 'dueDate', 'customer', 'contactId', 'resolution'].some(key => old[key as keyof DemoTicket] !== next[key as keyof DemoTicket])) event(next, workspaceId, actorId, 'edited', { detail: 'Support details updated' }, now)
        next.updated = now; next.updatedAt = now
        return { ...data, tickets: data.tickets.map(t => t.id === id ? next : t) }
      })
    },
    async note(workspaceId: string, actorId: string, id: string, text: string, requestId: string, privateNote = true) {
      return service.updateWorkspace(workspaceId, data => {
        authorize(workspaceId, actorId)
        const old = data.tickets.find(t => t.id === id)
        if (!old) throw new Error('Ticket not found in this workspace.')
        if (old.replies?.some(r => r.id === requestId)) return data
        if (!requestId || !text.trim() || text.length > 4000) throw new Error('Enter a note of up to 4000 characters.')
        const now = new Date().toISOString(), next = { ...old, updated: now, updatedAt: now, replies: [...(old.replies || []), { id: requestId, text: text.trim(), private: privateNote, time: now }] }
        event(next, workspaceId, actorId, privateNote ? 'internal-note' : 'reply-saved', { noteId: requestId }, now)
        return { ...data, tickets: data.tickets.map(t => t.id === id ? next : t) }
      })
    },
    async agent(workspaceId: string, actorId: string, id: string, presence: NonNullable<WorkspaceAgent['presence']>, departmentIds: string[]) {
      return service.updateWorkspace(workspaceId, data => {
        const { snapshot } = authorize(workspaceId, actorId)
        const own = snapshot.agents.find(a => a.id === id && a.userId === actorId)
        const currentAgent = snapshot.agents.find(a => a.id === id)
        if (!own || JSON.stringify(departmentIds) !== JSON.stringify(currentAgent?.departmentIds || snapshot.departments.map(d => d.id))) authorize(workspaceId, actorId, true)
        if (!['online', 'away', 'offline'].includes(presence) || departmentIds.some(id => !snapshot.departments.some(d => d.id === id))) throw new Error('Invalid availability or foreign department.')
        const current = data as WorkspaceData
        if (!current.agents.some(a => a.id === id)) throw new Error('Agent not found in this workspace.')
        const time = new Date().toISOString()
        return { ...current, agents: current.agents.map(a => {
          if (a.id !== id) return a
          const changes = []
          if (a.presence !== presence) changes.push('Availability changed to ' + presence)
          if (JSON.stringify(a.departmentIds ?? snapshot.departments.map(d => d.id)) !== JSON.stringify(departmentIds)) changes.push('Department assignments updated')
          if (!changes.length) return a
          return { ...a, presence, departmentIds: changes.includes('Department assignments updated') ? departmentIds : a.departmentIds, activity: [...(a.activity ?? []), { id: crypto.randomUUID(), workspaceId, time, actorId, detail: changes.join(' · ') }] }
        }) } as DemoData
      })
    },
  }
}
export const ticketSupport = createTicketSupport(supportService)
