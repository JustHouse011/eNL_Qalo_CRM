import { migratePresentation } from './presentationCopy'
import type { DemoData } from '../data/demoData'
import { mergeWorkspaceSettings } from './workspaceSettings'
import { agents, roles, teams, workspaces, initiatives, products, orders, deliveries, refunds, notifications, channels, createMockData } from '../data/mockCatalog'
export interface SupportService {
  referenceData(): { agents: typeof agents; roles: typeof roles; teams: typeof teams; workspaces: typeof workspaces; initiatives: typeof initiatives; products: typeof products; orders: typeof orders; deliveries: typeof deliveries; refunds: typeof refunds; notifications: typeof notifications; channels: typeof channels }
  read(): Promise<DemoData>
  update(change: (current: DemoData) => DemoData): Promise<DemoData>
  reset(): Promise<DemoData>
  subscribe(listener: () => void): () => void
}
const storageKey = 'qalo-frontend-demo-v1'
const events = new EventTarget()
let memory = createMockData()
let persistent = true
function readLocal() {
  try { const raw = persistent ? localStorage.getItem(storageKey) : null; if (raw) { const saved = JSON.parse(raw); if (Array.isArray(saved.conversations) && Array.isArray(saved.contacts) && Array.isArray(saved.tickets)) { const migrated = migratePresentation(saved); memory = { ...migrated, settings: mergeWorkspaceSettings(migrated.settings) } } } } catch { /* Browser storage is optional. */ }
  return structuredClone(memory)
}
function persist(data: DemoData) {
  memory = structuredClone(data)
  try { localStorage.setItem(storageKey, JSON.stringify(memory)) } catch { persistent = false }
  events.dispatchEvent(new Event('change'))
  return structuredClone(memory)
}
window.addEventListener('storage', e => { if (e.key === storageKey) events.dispatchEvent(new Event('change')) })
export const supportService: SupportService = {
  referenceData() { return structuredClone({ agents, roles, teams, workspaces, initiatives, products, orders, deliveries, refunds, notifications, channels }) },
  async read() { return readLocal() },
  async update(change) {
    const previous = readLocal()
    const next = change(structuredClone(previous))
    next.conversations = next.conversations.map(c => {
      const contact = next.contacts.find(p => p.id === c.contactId)
      const old = previous.contacts.find(p => p.id === c.contactId)
      return contact && old && (contact.name !== old.name || contact.email !== old.email) ? { ...c, customer: contact.name, email: contact.email, initials: contact.name.split(/\s+/).map(n => n[0]).join('').slice(0, 2), messages: c.messages.map(m => m.kind === 'customer' ? { ...m, author: contact.name } : m) } : c
    })
    next.contacts = next.contacts.map(c => ({ ...c, conversations: next.conversations.filter(item => item.contactId === c.id).length }))
    next.tickets = next.tickets.map(t => { const c = next.conversations.find(c => c.id === t.conversationId); return c ? { ...t, customer: c.customer, contactId: c.contactId } : t })
    return persist(next)
  },
  async reset() { return persist(createMockData()) },
  subscribe(listener) { events.addEventListener('change', listener); return () => events.removeEventListener('change', listener) },
}
