import type { Conversation, DemoData } from '../data/demoData'
import type { WorkspaceAgent, WorkspaceDepartment } from './workspaceTypes'

/** Additive browser-local development records. Existing IDs, records and edits are never replaced. */
export function addDirectoryFixtures(data: DemoData, workspaceId: string, banking: boolean, agents: WorkspaceAgent[], departments: WorkspaceDepartment[], now: number): DemoData {
  if (data.directoryFixtureVersion === 1) return data
  const next = structuredClone(data)
  const companies = (banking ? ['Metsi Enterprise', 'Horizon Community Trust', 'Acacia Trading'] : ['Ikhaya Community Co-operative', 'Naledi Enterprise Network', 'Sakhisizwe Stokvel']).map((name, i) => ({ id: `${workspaceId}:directory:organisation:${i}`, name, type: ['Co-operative', 'SME', 'Stokvel'][i], reference: `${banking ? 'ENL' : 'QYA'}-ORG-${String(i + 1).padStart(3, '0')}` }))
  next.organisations = [...(next.organisations || []), ...companies.filter(o => !next.organisations?.some(existing => existing.id === o.id))]
  const first = banking ? ['Amara', 'Kagiso', 'Lethabo', 'Zola', 'Reitumetse', 'Anele'] : ['Naledi', 'Musa', 'Buhle', 'Ayanda', 'Sanele', 'Kea']
  const surnames = ['Mokone', 'Serobe', 'Mabasa', 'Tshabalala', 'Moleko', 'Ngcobo']
  for (let i = 0; i < 18; i++) {
    const id = `${workspaceId}:directory:person:${i}`
    const email = `contact-${String(i + 1).padStart(2, '0')}@${banking ? 'enl' : 'qalo'}.example.invalid`
    if (next.contacts.some(c => c.id === id || c.email.toLowerCase() === email)) continue
    const organisation = companies[i % companies.length]
    const person = { id, name: `${first[i % first.length]} ${surnames[Math.floor(i / first.length) + (banking ? 2 : 0)]}`, email, organisation: organisation.name, organisationId: organisation.id, location: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha'][i % 5], conversations: i < 12 ? 1 : 0, tag: i % 3 === 0 ? 'Business enquiry' : 'Support contact', participantType: banking ? i % 3 === 0 ? 'business enquiry' : 'Customer' : ['Co-operative representative', 'SME representative', 'Stokvel representative'][i % 3], customerStatus: i % 5 === 0 ? 'inactive' as const : 'active' as const, preference: ['Email', 'Website chat'][i % 2], consent: 'Not recorded' }
    next.contacts.push(person)
    if (i >= 12) continue
    const agent = agents[i % Math.max(1, agents.length)]
    const department = departments[i % Math.max(1, departments.length)]
    const at = now - i * 86400000 / 3 - 3600000
    const conversationId = `${workspaceId}:directory:conversation:${i}`
    const status = (['open', 'waiting', 'resolved'] as const)[i % 3]
    const conversation: Conversation = { id: conversationId, workspaceId, contactId: id, organisationId: organisation.id, customer: person.name, email, initials: person.name.split(' ').map(n => n[0]).join(''), tone: 'lilac', location: person.location, channel: i % 2 ? 'Website' : 'Email', status, handling: status === 'resolved' ? 'resolved' : status === 'waiting' ? 'waiting' : 'human', priority: 'normal', assignee: agent?.name || null, assigneeId: agent?.id || null, department: department?.name || '', departmentId: department?.id || null, businessArea: banking ? 'general' : department?.area === 'store' ? 'store' : department?.area === 'general' ? 'general' : 'community', category: banking ? 'General banking support' : 'Participation enquiry', tags: ['Directory enquiry'], unread: 0, createdAt: new Date(at).toISOString(), updatedAt: new Date(at + 600000).toISOString(), resolvedAt: status === 'resolved' ? new Date(at + 600000).toISOString() : undefined, messages: [{ id: `${conversationId}:message:customer`, author: person.name, kind: 'customer', text: 'Please help me find information about the available support services.', time: new Date(at).toISOString() }, ...(agent && status !== 'waiting' ? [{ id: `${conversationId}:message:reply`, author: agent.name, kind: 'agent' as const, delivery: 'sent' as const, text: 'Thank you for reaching out. I can help you find the right support team.', time: new Date(at + 600000).toISOString() }] : [])], history: [{ id: `${conversationId}:opened`, title: 'Conversation opened', detail: 'Support enquiry received', when: new Date(at).toISOString() }, ...(status === 'resolved' ? [{ id: `${conversationId}:resolved`, title: 'Conversation resolved', detail: 'Support follow-up completed', when: new Date(at + 600000).toISOString() }] : [])] }
    if (!next.conversations.some(c => c.id === conversationId)) next.conversations.push(conversation)
  }
  next.directoryFixtureVersion = 1
  return next
}
