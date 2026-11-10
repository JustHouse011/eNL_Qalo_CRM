import type { Conversation, DemoData } from '../data/demoData'
import { manageWorkspace, platformPreview } from './workspaceManagement'
import { scopeWorkspaceData } from './workspaceMigration'
import { ENL_WORKSPACE_ID, isAdministrator, type WorkspaceStore } from './workspaceTypes'
import { addBankingFrontendFixtures } from './bankingFixtures'

export { ENL_WORKSPACE_ID } from './workspaceTypes'
export const ENL_SLUG = 'enl-mutual-bank'
export const bankingDepartments = ['General Enquiries', 'Personal Banking', 'Business Banking', 'Digital Banking Support', 'Cards and Payments', 'Complaints and Disputes', 'Fraud and Security']
export const bankingCategories = ['Becha enquiry', 'Nala enquiry', 'Temo enquiry', 'Pusha enquiry', 'Owner enquiry', 'Mobile banking assistance', 'Card support', 'General banking questions', 'Complaints', 'Fraud reporting']
export const bankingKnowledgeCategories = ['Getting Started', 'Personal Banking', 'Business Banking', 'Cards and Payments', 'Mobile Banking', 'Account Security', 'Complaints and Support']
export const bankingSafetyInstructions = 'Never request PINs, passwords, OTPs, CVVs or full card numbers. Never claim access to balances or transactions or perform banking actions. Never invent fees, rates, limits, eligibility or policies. Refer suspected fraud to independently verified official channels. A local human support request is not a completed live transfer.'

/** Atomic, explicit initialization through Phase 2 creation commands. Existing slugs are authoritative. */
export function initializeEnlStore(input: WorkspaceStore, actorId: string): { store: WorkspaceStore; workspaceId: string; created: boolean } {
  const actor = actorId === platformPreview.id ? platformPreview : input.users.find(u => u.id === actorId)
  if (!isAdministrator(actor)) throw new Error('Platform administrator permission is required.')
  const existing = input.workspaces.find(w => w.slug === ENL_SLUG)
  if (existing) { const result = addBankingFrontendFixtures(input, existing.id); return { store: result.store, workspaceId: existing.id, created: result.changed } }
  const adminId = 'user-enl-admin-demo'
  const base = structuredClone(input)
  if (!base.users.some(u => u.id === adminId)) base.users.push({ id: adminId, name: 'Naledi Dube', role: 'supervisor', status: 'active', legacyRole: 'workspace-admin', accessReviewRequired: true })
  const store = manageWorkspace(base, actorId, { kind: 'create', workspaceId: ENL_WORKSPACE_ID, administratorId: adminId, draft: { name: 'eNL Mutual Bank', slug: ENL_SLUG, type: 'Banking / Financial Services', description: 'Digital customer support and AI assistance workspace for eNL Mutual Bank.', primaryColor: '#652D8D', secondaryColor: '#B59BD3', logo: null } })
  const workspace = store.workspaces.find(w => w.id === ENL_WORKSPACE_ID)!
  workspace.supportMode = 'banking'; workspace.tagline = 'Banking you for a purpose'
  const agentSpecs = [{ id: 'admin', name: 'Naledi Dube', role: 'supervisor' as const }, { id: 'supervisor', name: 'Kabelo Maseko', role: 'supervisor' as const }, { id: 'agent', name: 'Zanele Mokoena', role: 'agent' as const }]
  for (const spec of agentSpecs.slice(1)) {
    const userId = `user-enl-${spec.id}-demo`
    if (!store.users.some(u => u.id === userId)) store.users.push({ id: userId, name: spec.name, role: spec.role, status: 'active' })
    store.memberships.push({ id: `${ENL_WORKSPACE_ID}:membership:${spec.id}`, workspaceId: ENL_WORKSPACE_ID, userId, role: spec.role, status: 'active' })
  }
  const agents = agentSpecs.map(spec => ({ id: `${ENL_WORKSPACE_ID}:agent:${spec.id}`, workspaceId: ENL_WORKSPACE_ID, userId: `user-enl-${spec.id}-demo`, name: spec.name, initials: spec.name.split(' ').map(n => n[0]).join(''), role: spec.id === 'admin' ? 'Admin' as const : spec.role === 'supervisor' ? 'Supervisor' as const : 'Agent' as const, teamId: 'enl-demo-support', presence: 'online' as const }))
  const departments = bankingDepartments.map((name, index) => ({ id: `${ENL_WORKSPACE_ID}:department:${index}`, workspaceId: ENL_WORKSPACE_ID, name, area: 'general' }))
  const customerNames = ['Thandi Molefe', 'Siphesihle Ndlovu', 'Amina Jacobs', 'Mpho Khumalo', 'Lindiwe Peters', 'Yusuf Daniels', 'Karabo Mokoena', 'Nomvula Sithole', 'Themba Naidoo', 'Lerato Dube']
  const contacts = customerNames.map((name, i) => ({ id: `${ENL_WORKSPACE_ID}:customer:${i}`, name, email: `customer-${i + 1}@example.invalid`, organisation: 'Customer', location: 'South Africa', conversations: 1, tag: 'Customer identity', customerStatus: 'active' as const, preference: 'Website chat', consent: 'Customer profile' }))
  const timestamp = (i: number, minute: number) => new Date(Date.now() - (9 - i) * 86400000 - 3600000 + minute * 60000).toISOString()
  const conversations: Conversation[] = bankingCategories.map((category, i) => {
    const departmentIndex = i < 5 ? (i === 3 || i === 4 ? 2 : 1) : i === 5 ? 3 : i === 6 ? 4 : i === 8 ? 5 : i === 9 ? 6 : 0
    const handling = (['ai', 'waiting', 'human', 'resolved'] as const)[i % 4]
    const human = handling === 'human' || handling === 'resolved'
    const contact = contacts[i]
    return { id: `${ENL_WORKSPACE_ID}:conversation:${i}`, contactId: contact.id, customer: contact.name, email: contact.email, initials: contact.name.split(' ').map(n => n[0]).join(''), tone: 'sage', location: contact.location, channel: 'Website', status: handling === 'resolved' ? 'resolved' : handling === 'waiting' ? 'waiting' : 'open', handling, priority: i === 9 ? 'urgent' : i === 8 ? 'high' : 'normal', assignee: human ? agents[i % 3].name : null, businessArea: 'general', category, department: departments[departmentIndex].name, departmentId: departments[departmentIndex].id, tags: ['Support data', ...(i === 9 ? ['Escalated'] : [])], unread: 0, createdAt: timestamp(i, 0), updatedAt: timestamp(i, 4), resolvedAt: handling === 'resolved' ? timestamp(i, 4) : undefined, messages: [{ id: `${ENL_WORKSPACE_ID}:message:${i}:customer`, author: contact.name, text: `This is a ${category.toLowerCase()} support question. Please explain the next support step without accessing any banking records.`, time: timestamp(i, 0), kind: 'customer' }, { id: `${ENL_WORKSPACE_ID}:message:${i}:reply`, author: human ? agents[i % 3].name : 'eNL Virtual Assistant', text: i === 9 ? 'For fraud reports, use independently verified official contact channels. Do not share credentials or card details here.' : 'Official product information requires review. I can record a request for human support.', time: timestamp(i, human ? 4 : 1), kind: 'agent', delivery: 'sent' }], history: [{ id: `${ENL_WORKSPACE_ID}:history:${i}`, title: 'case created', detail: `${category} / proposed support queue`, when: timestamp(i, 0) }] }
  })
  const data: DemoData & { agents: typeof agents; departments: typeof departments } = {
    seedVersion: 1, agents, departments, contacts, conversations,
    tickets: conversations.filter((_, i) => i % 2 === 1 || i === 8).map((c, i) => ({ id: `ENL-DEMO-${1001 + i}`, subject: `${c.category}`, customer: c.customer, contactId: c.contactId, conversationId: c.id, category: c.category, businessArea: 'general', department: c.department, departmentId: c.departmentId, priority: c.priority, status: c.status === 'resolved' ? 'Resolved' : 'Open', assignee: c.assignee || 'Unassigned', updated: c.updatedAt, description: 'Customer support case.', replies: [{ id: `${ENL_WORKSPACE_ID}:ticket-history:${i}`, text: 'ticket created with conversation context.', private: true, time: c.createdAt }] })),
    articles: bankingKnowledgeCategories.map((category, i) => ({ id: `${ENL_WORKSPACE_ID}:article:${i}`, title: `draft: ${category}`, category, businessArea: 'general', published: false, updated: timestamp(i, 0), review: 'Requires official content review; not approved', body: `${category} support starts with a general question. Never share credentials or card details. Specific product features, fees, limits and policies require approved official sources and review.` })),
    visitors: [], organisations: [], queues: departments.map(d => ({ name: d.name, area: 'general', departmentId: d.id })), tasks: [], rules: [], workflows: [], applications: [], savedReplies: [], automationRuns: [],
    settings: structuredClone(workspace.settings), widget: { greeting: 'Welcome to the eNL Virtual Assistant. How can we help with a general banking support question? Never share banking credentials or card details.', colour: '#652D8D', position: 'right', branding: true },
    ai: { sources: [], tone: 'Professional, friendly and security-conscious', handoff: 'Record a local human support request; never claim a completed live transfer.', community: 'Generic banking support only. Product details require official review.', store: 'No banking actions, balances, transactions or policy claims.' },
    assistant: { id: `${ENL_WORKSPACE_ID}:assistant`, workspaceId: ENL_WORKSPACE_ID, name: 'eNL Virtual Assistant', enabled: true, persona: 'Professional, friendly, concise and security-conscious South African banking support assistant.', instructions: bankingSafetyInstructions, sourceIds: [], escalationDepartmentId: departments[0].id, fraudDepartmentId: departments[6].id },
    notifications: conversations.filter(c => c.handling === 'waiting').map((c, i) => ({ id: `${ENL_WORKSPACE_ID}:notification:${i}`, workspaceId: ENL_WORKSPACE_ID, title: 'customer waiting for an agent', detail: `${c.customer} / ${c.department}`, time: c.updatedAt, conversationId: c.id })),
  }
  store.snapshots[ENL_WORKSPACE_ID] = scopeWorkspaceData(data, ENL_WORKSPACE_ID)
  return { store: addBankingFrontendFixtures(store, ENL_WORKSPACE_ID).store, workspaceId: ENL_WORKSPACE_ID, created: true }
}
