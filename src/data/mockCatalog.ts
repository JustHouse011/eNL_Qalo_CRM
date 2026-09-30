import { supportSeed } from './supportSeed'
import type { DemoData } from './demoData'
import { defaultWorkspaceSettings } from '../lib/workspaceSettings'
export type Role = 'Admin' | 'Supervisor' | 'Agent'
export const roles: Role[] = ['Admin', 'Supervisor', 'Agent']
export const agents = [
  { id: 'agent-1', name: 'Bongani Nombamba', initials: 'BN', role: 'Admin' as Role, teamId: 'team-support' },
  { id: 'agent-2', name: 'Phindile Khumalo', initials: 'PK', role: 'Supervisor' as Role, teamId: 'team-support' },
  { id: 'agent-3', name: 'Tumo Likotsi', initials: 'TL', role: 'Agent' as Role, teamId: 'team-support' },
]
export const teams = [{ id: 'team-support', name: 'Qalo Ya Afrika', workspaceId: 'workspace-qalo' }]
export const workspaces = [{ id: 'workspace-qalo', name: 'Qalo Ya Afrika', areas: ['community', 'store'] }]
export const initiatives = [{ id: 'bank', name: 'OWN THE BANK' }, { id: 'spaza', name: 'OWN SPAZA SHOPS' }, { id: 'sme', name: 'SME vetting and listing' }]
export const products = [{ id: 'tote', name: 'Nandi tote', price: 350, stock: 24 }, { id: 'jacket', name: 'Ubuntu jacket', price: 650, stock: 12 }]
export const orders = Array.from({ length: 5 }, (_, i) => ({ id: `ORDER-${i + 1}`, contactId: `c-${i + 1}`, productId: i === 1 ? 'jacket' : 'tote', quantity: 1, payment: 'Awaiting verification', fulfilment: i === 4 ? 'Delivered' : 'In transit', tracking: `QYA-TRACK-${i + 1}` }))
export const deliveries = orders.map(o => ({ id: `delivery-${o.id}`, orderId: o.id, tracking: o.tracking, status: o.fulfilment }))
export const refunds = [{ id: 'refund-1', orderId: 'ORDER-2', status: 'Under review', amount: 650 }]
export const notifications = [{ title: 'New enquiry assigned', detail: 'SME document checklist · Community Investment', time: 'Today', conversationId: 'community-4' }, { title: 'Follow-up due', detail: 'Courier tracking · Qalo Store', time: 'Today', conversationId: 'conv-1' }]
export const channels = ['Website chat', 'Email', 'WhatsApp', 'Facebook Messenger', 'Telegram', 'SMS', 'Order payments', 'Application records']
export function createMockData(): DemoData {
  const data = structuredClone(supportSeed)
  data.settings = structuredClone(defaultWorkspaceSettings)
  data.contacts.push({ id: 'c-5', name: 'Nomsa Pillay', email: 'nomsa.p@example.co.za', organisation: 'Independent', location: 'Gqeberha', conversations: 1, tag: 'Store customer' })
  for (const c of data.conversations) {
    if (c.businessArea === 'store') {
      const order = orders.find(o => o.contactId === c.contactId)!
      c.order = { reference: order.id, items: [products.find(p => p.id === order.productId)!.name], payment: order.payment, fulfilment: order.fulfilment, tracking: order.tracking, request: refunds.find(r => r.orderId === order.id)?.status || 'None' }
      c.messages = c.messages.map(m => m.kind === 'agent' ? { ...m, text: 'Thanks for contacting Qalo. I am reviewing your order enquiry.' } : { ...m, text: m.text.replace('QA-28491', order.id) })
    }
    if (c.status === 'resolved') { c.resolvedAt = c.updatedAt; c.resolutionEvents = [c.updatedAt]; c.satisfaction = 5 }
  }
  data.contacts = data.contacts.map(c => ({ ...c, conversations: data.conversations.filter(item => item.contactId === c.id).length }))
  data.tickets = data.tickets.map((t, i) => { const c = data.conversations.find(c => c.id === t.conversationId) || data.conversations.find(c => c.id === (i === 2 ? 'conv-2' : 'conv-5'))!; return { ...t, customer: c.customer, contactId: c.contactId, conversationId: c.id, updated: c.updatedAt } })
  data.visitors = data.visitors.map(v => ({ ...v, status: 'Browsing', activity: 'Viewed 3 pages · Current session' }))
  data.articles = data.articles.map(a => ({ ...a, body: `${a.businessArea === 'store' ? 'Share your order reference and describe the item or delivery issue. The support team can review your order, add a follow-up and track the request. A support case does not authorize a refund.' : 'Tell the support team which initiative interests you and provide your enquiry reference. We can record your question, request a document checklist and track the support stage. Your support team can help you follow up on the application.'}`, review: 'Editorial review' }))
  data.rules = [{ id: 'rule-demo', name: 'Refund enquiries', contains: 'refund', department: 'Returns, Refunds & Exchanges', priority: 'high', enabled: true, businessArea: 'store' }]
  data.presentationVersion = 1
  return data
}
