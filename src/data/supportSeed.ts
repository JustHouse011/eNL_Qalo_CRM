import { initialDemoData as legacy, type Conversation, type DemoData } from './demoData.ts'
import { defaultQueue, defaultQueues, defaultWorkflows, officialLinks, type BusinessArea } from '../lib/business.ts'

const examples: [string, string, BusinessArea, string, string, string, string][] = [
  ['Naledi Dube', 'How does our stokvel register?', 'community', 'Co-operative and stokvel participation', 'Stokvel representative', 'org-stokvel', ''],
  ['Themba Nkosi', 'Where can I request the OWN THE BANK documents?', 'community', 'OWN THE BANK enquiries', 'Co-operative representative', 'org-coop', 'OWN THE BANK'],
  ['Zanele Maseko', 'Our contribution is not showing in the portal.', 'community', 'Contribution records and reconciliation', 'Stokvel representative', 'org-stokvel', 'OWN THE BANK'],
  ['Bongani Mthembu', 'Which documents does our SME need for vetting?', 'community', 'SME application, vetting and listing', 'SME representative', 'org-sme', ''],
  ['Amina Jacobs', 'Where can I access our reports?', 'community', 'Statements and reporting access', 'Co-operative representative', 'org-coop', ''],
  ['Nokuthula Cele', 'How can our co-operative request OWN SPAZA SHOPS information?', 'community', 'OWN SPAZA SHOPS enquiries', 'Co-operative representative', 'org-coop', 'OWN SPAZA SHOPS'],
  ['Kabelo Molefe', 'I have not received the member communication.', 'community', 'Member communications', 'Individual / prospective member', '', ''],
  ['Thabo Nene', 'I cannot sign in to the platform. How do I update my contact details?', 'general', 'Account access', 'Individual / prospective member', '', ''],
]
const community: Conversation[] = examples.map(([customer, text, businessArea, category, participantType, organisationId, initiative], i) => ({
  id: `community-${i + 1}`, customer, email: `participant${i + 1}@example.org`, initials: customer.split(' ').map(n => n[0]).join(''), tone: ['sage', 'gold', 'blue', 'rose'][i % 4], location: ['Johannesburg', 'Durban', 'Cape Town', 'Polokwane'][i % 4], channel: 'Website', status: i === 3 ? 'waiting' : 'open', priority: i === 2 ? 'high' : 'normal', assignee: i % 2 ? 'Bongani Nombamba' : null, department: defaultQueue(businessArea, category), tags: i === 3 ? ['Awaiting documents'] : i === 2 ? ['Escalated', 'Awaiting verification'] : ['Support enquiry'], unread: 1, businessArea, category, participantType, organisationId, initiative, contactId: `participant-${i + 1}`, reference: `SUP-${100 + i}`, onboardingStage: i === 3 ? 'Awaiting documents' : 'New enquiry', documents: i === 3 ? [{ name: 'Document requirements - request approved checklist', status: 'Requested' }] : [], createdAt: `2026-09-30T08:${String(10 + i).padStart(2, '0')}:00+02:00`, updatedAt: `2026-09-30T08:${String(20 + i).padStart(2, '0')}:00+02:00`, messages: [{ id: `community-message-${i}`, author: customer, text, time: `2026-09-30T08:${String(20 + i).padStart(2, '0')}:00+02:00`, kind: 'customer' }], history: [{ id: `community-history-${i}`, title: 'Support enquiry created', detail: 'Support request recorded', when: '30 Sep' }],
}))
const topics: [string, BusinessArea, string, string][] = [
  ['Getting started with Qalo Ya Afrika', 'community', 'Registration and onboarding', officialLinks.about],
  ['Co-operative and stokvel participation', 'community', 'Co-operative and stokvel participation', officialLinks.cooperative],
  ['Requesting OWN THE BANK documents', 'community', 'OWN THE BANK enquiries', officialLinks.bank],
  ['Requesting OWN SPAZA SHOPS documents', 'community', 'OWN SPAZA SHOPS enquiries', officialLinks.spaza],
  ['SME vetting and listing enquiries', 'community', 'SME application, vetting and listing', officialLinks.sme],
  ['Submitting required documents', 'community', 'Required documents', officialLinks.contact],
  ['Contribution record enquiries', 'community', 'Contribution records and reconciliation', officialLinks.contact],
  ['Accessing reports and member communications', 'community', 'Statements and reporting access', officialLinks.contact],
  ['Complaints and escalation', 'community', 'Complaints and escalation', officialLinks.contact],
  ['Qalo Store product enquiries', 'store', 'Product and merchandise enquiries', officialLinks.store],
  ['Orders and checkout help', 'store', 'Orders and checkout', officialLinks.store],
  ['Payment enquiry guidance', 'store', 'Payment enquiries', officialLinks.store],
  ['Delivery tracking enquiries', 'store', 'Delivery tracking', officialLinks.store],
  ['Returns and exchanges', 'store', 'Returns, refunds and exchanges', officialLinks.store],
  ['Refund enquiries', 'store', 'Returns, refunds and exchanges', officialLinks.store],
  ['Missing, damaged or incorrect items', 'store', 'Damaged, incorrect or missing items', officialLinks.store],
  ['Account access and technical help', 'general', 'Account access', officialLinks.contact],
]
export const supportSeed: DemoData = {
  ...legacy, schemaVersion: 7,
  tasks: [
    { id: 'task-followup-courier', title: 'Follow up on Lerato’s courier update', due: '2026-10-01T09:00:00+02:00', done: false, businessArea: 'store', contactId: 'c-1', conversationId: 'conv-1' },
    { id: 'task-sme-checklist', title: 'Prepare the requested SME document checklist', due: '2026-10-01T11:00:00+02:00', done: false, businessArea: 'community', contactId: community[3].contactId, conversationId: community[3].id },
    { id: 'task-exchange-request', title: 'Review Sipho’s exchange request', due: '2026-10-02T14:30:00+02:00', done: false, businessArea: 'store', contactId: 'c-2', conversationId: 'conv-2' },
  ],
  conversations: [...community, ...legacy.conversations.map((c, i): Conversation => ({ ...c, typing: false, businessArea: 'store', category: ['Delivery tracking', 'Returns, refunds and exchanges', 'Product and merchandise enquiries', 'Payment enquiries', 'Orders and checkout'][i], participantType: 'Store customer', reference: `STORE-${i + 1}`, contactId: `c-${i + 1}`, department: ['Deliveries', 'Returns, Refunds & Exchanges', 'Product Enquiries', 'Orders & Payments', 'Orders & Payments'][i], order: { reference: `ORDER-${i + 1}`, items: ['Merchandise details awaiting order connector'], payment: 'Not connected', fulfilment: 'Not connected', tracking: 'Not connected', request: i === 1 ? 'Exchange enquiry - no decision recorded' : 'Support enquiry' }, messages: c.messages.map(m => m.kind === 'agent' ? { ...m, text: 'Thank you for contacting Qalo Store support. I can record your enquiry and request verified information. Our order system is not connected.' } : m), history: c.history.map(h => ({ ...h, when: 'Support enquiry' })) }))],
  contacts: [...community.map(c => ({ id: c.contactId!, name: c.customer, email: c.email, organisation: '', organisationId: c.organisationId, participantType: c.participantType, location: c.location, conversations: 1, tag: 'Support enquiry', preference: 'Not recorded', consent: 'Not recorded' })), ...legacy.contacts.map(c => ({ ...c, participantType: 'Store customer', preference: 'Not recorded', consent: 'Not recorded' }))],
  tickets: [{ id: 'CASE-COMM-1', subject: 'Request approved SME document checklist', customer: community[3].customer, status: 'Pending', priority: 'normal', assignee: 'Bongani Nombamba', updated: '2026-09-30T08:30:00+02:00', conversationId: community[3].id, businessArea: 'community', category: community[3].category, reference: community[3].reference, organisationId: 'org-sme', contactId: community[3].contactId }, ...legacy.tickets.map(t => ({ ...t, businessArea: 'store' as BusinessArea, category: 'Orders and checkout' }))],
  articles: topics.map(([title, businessArea, category, sourceUrl], i) => ({ id: `knowledge-${i + 1}`, title, businessArea, category, sourceUrl, published: i === 0 || i === 9, updated: '2026-09-30', review: i === 0 || i === 9 ? 'Official navigation reference; not a policy' : 'Draft - awaiting approved wording', body: i === 0 ? 'Use the official Qalo Ya Afrika website to learn about the platform and its participants. Support can help you find information and record enquiries. Qalo support does not provide investment recommendations or make banking decisions.' : i === 9 ? 'Use the official Qalo Store page for current store information. Product availability, payment, dispatch and refunds need authorised records. This help page does not establish store policies.' : 'Draft - awaiting approved content. Support can record your question and refer it to the responsible team. Do not use this draft to confirm eligibility, contributions, stock, payments, dispatch, refunds, timeframes or business decisions.' })),
  visitors: [{ id: 'demo-visitor-community', name: 'Website visitor A', location: 'Johannesburg', page: '/investments/own-the-bank', source: 'Direct', activity: 'No recent activity', status: 'Not tracked' }, { id: 'demo-visitor-store', name: 'Website visitor B', location: 'Durban', page: '/store', source: 'Search', activity: 'No recent activity', status: 'Not tracked' }],
  organisations: [{ id: 'org-stokvel', name: 'Sisonke Stokvel', type: 'Stokvel', reference: 'ORG-001' }, { id: 'org-coop', name: 'Masakhane Co-operative', type: 'Co-operative', reference: 'ORG-002' }, { id: 'org-sme', name: 'Ubuntu Enterprise', type: 'SME', reference: 'ORG-003' }],
  queues: defaultQueues.map(q => ({ ...q })), workflows: structuredClone(defaultWorkflows),
  applications: [{ id: 'application-demo-1', title: 'SME checklist enquiry', contact: 'participant-4', workflow: 'sme', stage: 'Information requested', owner: 'Bongani Nombamba', reference: 'SUP-103', businessArea: 'community' }],
  savedReplies: [
    { id: 'reply-community', title: 'Community enquiry acknowledgement', businessArea: 'community', approved: true, body: 'Thank you for your enquiry. Please share the initiative or support reference so we can route your question. We cannot confirm contributions or application outcomes without authorised records.' },
    { id: 'reply-store', title: 'Store enquiry acknowledgement', businessArea: 'store', approved: true, body: 'Thank you for contacting Qalo Store support. Please share your order reference and a short description of the issue. We will request verified information before confirming any payment, dispatch or refund.' },
    { id: 'reply-general', title: 'Account assistance', businessArea: 'general', approved: true, body: 'Please describe the issue and any error message. Do not share passwords, PINs, full identity numbers or banking details in chat.' },
  ],
}

const agentAliases: Record<string, string> = { 'Thandi Mokoena': 'Bongani Nombamba', 'Sizwe Khumalo': 'Phindile Khumalo', 'Amina Naidoo': 'Tumo Likotsi', 'James Botha': 'Tumo Likotsi' }
const renameAgent = (name: string) => agentAliases[name] || name
const renameAgentInText = (text: string) => Object.entries(agentAliases).reduce((result, [previous, current]) => result.replaceAll(previous, current), text)
const cleanDisclosureText = (text: string) => text.replace(/^DEMO-/, '').replaceAll('Fictional demo', 'Support enquiry').replaceAll('Fictional participant; no business record verified', 'Support request recorded').replaceAll('Fictional visitor', 'Website visitor').replaceAll(' (fictional)', '').replaceAll('Sample session - not tracked', 'No recent activity').replaceAll('Received (demo)', 'Received').replaceAll('in this demo.', '.')
const cleanReference = (reference?: string) => reference?.replace(/^DEMO-/, '')

// Additive demo upgrade: retain IDs, messages, edits and legacy deals. No production data is read.
export function upgradeDemo(data: DemoData): DemoData {
  if (data.schemaVersion === 7) return data
  const conversations = data.conversations.map(c => ({ ...c, assignee: c.assignee ? renameAgent(c.assignee) : c.assignee, email: c.email.replace(/^fictional\./, ''), location: c.location === 'Demo visitor' ? 'Not provided' : c.location, reference: cleanReference(c.reference), tags: c.tags.map(cleanDisclosureText), businessArea: c.businessArea || 'store' as BusinessArea, category: c.category || 'Orders and checkout', typing: false, documents: c.documents?.map(doc => ({ ...doc, status: cleanDisclosureText(doc.status) as typeof doc.status })), order: c.order ? { ...c.order, reference: cleanReference(c.order.reference) || c.order.reference } : c.order, messages: c.messages.map(m => ({ ...m, author: renameAgent(m.author), text: cleanDisclosureText(m.text) })), history: c.history.map(h => ({ ...h, title: cleanDisclosureText(h.title), detail: cleanDisclosureText(renameAgentInText(h.detail)), when: cleanDisclosureText(h.when) })) }))
  return { ...data, schemaVersion: 7,
    conversations: [...conversations, ...community.filter(c => !conversations.some(old => old.id === c.id))],
    tickets: data.tickets.map(t => ({ ...t, assignee: renameAgent(t.assignee), reference: cleanReference(t.reference), businessArea: t.businessArea || conversations.find(c => c.id === t.conversationId)?.businessArea || 'general', category: t.category || 'Legacy case - review category' })),
    contacts: [...data.contacts.map(c => ({ ...c, email: c.email.replace(/^fictional\./, ''), tag: cleanDisclosureText(c.tag) })), ...supportSeed.contacts.filter(c => !data.contacts.some(old => old.id === c.id || old.email === c.email))],
    articles: [...data.articles.map(a => a.businessArea ? a : { ...a, businessArea: 'store' as BusinessArea, published: false, review: 'Preserved legacy draft - requires policy review' }), ...supportSeed.articles.filter(a => !data.articles.some(old => old.id === a.id))],
    organisations: (data.organisations || supportSeed.organisations || []).map(o => ({ ...o, name: cleanDisclosureText(o.name), reference: cleanReference(o.reference) || o.reference })), visitors: data.visitors.map(v => ({ ...v, name: cleanDisclosureText(v.name), activity: cleanDisclosureText(v.activity), status: v.status === 'Demo' ? 'Not tracked' : v.status })), tasks: data.tasks?.length ? data.tasks : supportSeed.tasks, queues: data.queues || supportSeed.queues, workflows: data.workflows || supportSeed.workflows, applications: (data.applications || []).map(a => ({ ...a, owner: renameAgent(a.owner), reference: cleanReference(a.reference) || a.reference })), savedReplies: data.savedReplies || supportSeed.savedReplies,
  }
}
