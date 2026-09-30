import type { Conversation, Message } from '../data/demoData'
import { defaultQueue, type BusinessArea } from './business'
import { supportService } from './supportService'

export const supportAreas: Record<BusinessArea, { label: string; welcome: string; reply: string }> = {
  community: { label: 'Community Investment', welcome: 'Welcome! Are you enquiring as a member, a co-operative or an SME?', reply: 'I can help you explore participation and the application process. Are you already part of a registered co-operative or stokvel?' },
  store: { label: 'Qalo Store', welcome: 'Let’s help with your shopping. Is your question about a product, an order or a delivery?', reply: 'I can help with orders, deliveries and returns. Please share your order reference, or tell me which product you have in mind.' },
  general: { label: 'General & Technical Support', welcome: 'You’re in the right place for account and technical help. What seems to be the problem?', reply: 'Let’s work through this together. Which page are you using, and what happens when you try? Please don’t share your password.' },
}
export const newSupportMessage = (text: string, kind: 'agent' | 'customer' = 'agent'): Message => ({ id: crypto.randomUUID(), text, kind, author: kind === 'agent' ? 'Qalo Support' : 'Website Visitor', time: new Date().toISOString(), delivery: 'sent' })

// Adapter boundary: replace these local service operations when a backend is introduced.
export async function appendCustomerMessages(id: string, area: BusinessArea, messages: Message[]) {
  return supportService.update(data => {
    const existing = data.conversations.find(c => c.id === id)
    const time = messages.at(-1)!.time
    if (existing) return { ...data, conversations: data.conversations.map(c => c.id === id ? { ...c, messages: [...c.messages, ...messages], updatedAt: time, unread: c.unread + messages.filter(m => m.kind === 'customer').length } : c) }
    const conversation: Conversation = { id, customer: 'Website Visitor', email: 'visitor@example.test', initials: 'WV', tone: 'sage', location: 'Not provided', channel: 'Website', status: 'waiting', priority: 'normal', assignee: null, department: defaultQueue(area, ''), businessArea: area, category: supportAreas[area].label, tags: ['Website'], unread: messages.filter(m => m.kind === 'customer').length, createdAt: time, updatedAt: time, messages, history: [] }
    return { ...data, conversations: [conversation, ...data.conversations] }
  })
}
export async function finishCustomerConversation(id: string, satisfaction?: number) {
  return supportService.update(data => ({ ...data, conversations: data.conversations.map(c => c.id === id ? { ...c, status: 'resolved', resolvedAt: c.resolvedAt || new Date().toISOString(), satisfaction } : c) }))
}
