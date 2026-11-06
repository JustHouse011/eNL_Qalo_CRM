import type { Conversation, DemoData } from '../data/demoData'
import { supportService, type SupportService } from './supportService'
import { beginConversation, createConversationSupport, transition } from './conversationLifecycle'

export const handlingLabels = { ai: 'AI Handling', waiting: 'Waiting for Agent', human: 'Human Handling', resolved: 'Resolved' }
export function applyBankingAssistant(data: DemoData, assistant: NonNullable<DemoData['assistant']>): DemoData {
  const now = new Date().toISOString()
  return { ...data, assistant: { ...assistant, sourceIds: assistant.sourceIds.filter(id => data.articles.some(a => a.id === id && a.published && a.review === 'Approved for use')) }, conversations: assistant.enabled ? data.conversations : data.conversations.map(c => c.handling === 'ai' ? transition(c, 'waiting', 'assistant-disabled', 'Assistant disabled', 'Waiting locally for human support; no live transfer.', now) : c) }
}
export function validateBankingMessage(text: string) {
  if (!text.trim() || text.length > 2000) throw new Error('Enter a general support question (maximum 2000 characters).')
  if (/\b(pin|password|otp|cvv)\b\s*(?:is|:|=)\s*\S+|\b(pin|password|otp|cvv)\b\s*\d+|\b\d[\d -]{11,}\d\b/i.test(text)) throw new Error('Remove credentials, card numbers and other sensitive banking information. Enter a general support question.')
}
/** Deterministic local guidance, with non-overridable safety boundaries. No provider or bank access. */
export function bankingReply(text: string, data: DemoData) {
  const assistant = data.assistant
  if (!assistant?.enabled) return 'The assistant is disabled. You can record a local request for human support; no live transfer occurs.'
  if (/fraud|stolen|scam|unauthori[sz]ed/i.test(text)) return 'For suspected fraud, use independently verified official bank channels promptly. Never share PINs, passwords, OTPs, CVVs or full card numbers.'
  if (/balance|transaction|transfer|payment|withdraw|deposit/i.test(text)) return 'I cannot access balances or transactions or perform banking actions. Use independently verified official banking channels. I can help record a local support request.'
  if (/fee|interest|rate|limit|eligib|becha|nala|temo|pusha|owner|policy/i.test(text)) return 'Official product features, fees, rates, limits, eligibility and policies require approved source material and review. Request human support for further assistance.'
  if (/summary|summari[sz]/i.test(text)) return 'A general banking support question was recorded.'
  if (/app|mobile|navigation/i.test(text)) return 'For general navigation, look for the help or support area in your verified banking app. Exact screens require official review. Do not share login details here; a local support request can be recorded if needed.'
  if (/human|agent|ticket/i.test(text)) return 'Use Request human agent to record a request, or the offline support form to create a ticket.'
  const sources = data.articles.filter(a => a.published && a.review === 'Approved for use' && assistant.sourceIds.includes(a.id))
  return `I can offer general guidance and record a human support request. Never share credentials or card details.${sources.length ? ` Reviewed source titles available: ${sources.map(a => a.title).join(', ')}. Source selection does not authorize banking actions.` : ' No approved knowledge sources are currently selected.'}`
}
function mustBeBanking(service: SupportService, workspaceId: string) {
  const registry = service.registry()
  const workspace = registry.workspaces.find(w => w.id === workspaceId)
  if (workspace?.supportMode !== 'banking' || workspace.status !== 'active') throw new Error('This banking workspace is unavailable.')
  return registry
}
export function createBankingSupport(service: SupportService) {
  const lifecycle = createConversationSupport(service)
  return {
    async start(workspaceId: string, name: string, email: string, question: string, offline = false) {
      mustBeBanking(service, workspaceId); validateBankingMessage(question)
      if (!name.trim() || name.length > 100 || !/^[^\s@]+@[^\s@]+\.invalid$/.test(email)) throw new Error('Enter a name and email address.')
      const id = `${workspaceId}:conversation:${crypto.randomUUID()}`
      const contactId = `${workspaceId}:customer:${crypto.randomUUID()}`
      await service.updateWorkspace(workspaceId, data => {
        const department = data.assistant?.escalationDepartmentId
        const registry = service.registry()
        const queue = registry.snapshots[workspaceId].departments.find(d => d.id === department)
        const now = new Date().toISOString()
        const ticketId = `ENL-DEMO-${crypto.randomUUID().slice(0, 8)}`
        const handling = offline || !data.assistant?.enabled ? 'waiting' : 'ai'
        const conversation: Conversation = { id, contactId, customer: `${name.replace(/^Demo\s+/i, '').trim()}`, email, initials: 'DC', location: 'Visitor', tone: 'sage', channel: 'Website', status: handling === 'waiting' ? 'waiting' : 'open', handling, priority: /fraud/i.test(question) ? 'urgent' : 'normal', assignee: null, department: queue?.name || 'General Enquiries', departmentId: queue?.id, businessArea: 'general', category: 'General banking questions', tags: ['Support data'], unread: 1, createdAt: now, updatedAt: now, messages: [{ id: crypto.randomUUID(), author: `${name.trim()}`, text: question.trim(), kind: 'customer', time: now }, { id: crypto.randomUUID(), author: data.assistant?.name || 'Virtual Assistant', text: offline ? 'Your offline support request and ticket were saved.' : bankingReply(question, data), kind: 'agent', simulated: true, time: now, delivery: 'sent' }], history: [{ id: crypto.randomUUID(), title: 'widget enquiry', detail: 'Support request', when: now }] }
        return beginConversation({ ...data, contacts: [...data.contacts, { id: contactId, name: conversation.customer, email, organisation: 'Visitor', location: conversation.location, conversations: 1, tag: 'Customer identity', customerStatus: 'active' }], tickets: offline ? [...data.tickets, { id: ticketId, workspaceId, createdAt: now, updatedAt: now, activity: [{ id: crypto.randomUUID(), workspaceId, ticketId, actorId: contactId, timestamp: now, type: 'created', metadata: { source: 'offline-widget' } }], customer: conversation.customer, contactId, conversationId: id, department: conversation.department, departmentId: conversation.departmentId, category: conversation.category, businessArea: 'general', subject: 'Offline support request', status: 'New', priority: conversation.priority, assignee: 'Unassigned', updated: now, description: question.trim(), replies: [] }] : data.tickets }, workspaceId, conversation, handling)
      })
      if (/fraud/i.test(question)) await this.requestHuman(workspaceId, id, true)
      return id
    },
    async send(workspaceId: string, conversationId: string, text: string) {
      mustBeBanking(service, workspaceId); validateBankingMessage(text)
      await lifecycle.customerMessage(workspaceId, conversationId, text, crypto.randomUUID(), data => bankingReply(text, data))
      if (/fraud|stolen|scam/i.test(text)) await this.requestHuman(workspaceId, conversationId, true)
    },
    async requestHuman(workspaceId: string, conversationId: string, fraud = false) {
      const registry = mustBeBanking(service, workspaceId)
      const assistant = registry.snapshots[workspaceId].assistant
      await lifecycle.requestHuman(workspaceId, conversationId, fraud ? assistant?.fraudDepartmentId : assistant?.escalationDepartmentId, fraud)
    },
    async takeover(workspaceId: string, conversationId: string, actorId: string) {
      mustBeBanking(service, workspaceId)
      await lifecycle.takeover(workspaceId, conversationId, actorId)
    },
  }
}
export const bankingSupport = createBankingSupport(supportService)
