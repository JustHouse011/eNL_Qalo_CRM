import type { RetailState } from '../lib/retailData'
import type { BusinessArea } from '../lib/business.ts'
import type { WorkspaceSettings } from '../lib/workspaceSettings'
import type { BankingCase } from '../lib/workspaceExperience'
export type SupportContext = {
  workspaceId?: string; assigneeId?: string | null; departmentId?: string | null
  businessArea?: BusinessArea; category?: string; contactId?: string; organisationId?: string
  participantType?: string; initiative?: string; reference?: string; onboardingStage?: string
  documents?: { name: string; status: 'Awaiting verification' | 'Requested' | 'Received' }[]
  order?: { reference: string; items: string[]; payment: string; fulfilment: string; tracking: string; request: string }
  resolvedAt?: string; resolutionEvents?: string[]; satisfaction?: number
}
export type Message = {
  simulated?: boolean
  workspaceId?: string
  conversationId?: string
  id: string
  author: string
  text: string
  time: string
  kind: 'customer' | 'agent' | 'note'
  delivery?: 'sending' | 'sent' | 'failed'
}

export type Conversation = SupportContext & {
  lifecycle?: 'new' | 'ai' | 'waiting' | 'human' | 'resolved' | 'reopened'
  handling?: 'ai' | 'waiting' | 'human' | 'resolved'
  id: string
  customer: string
  email: string
  initials: string
  tone: string
  location: string
  channel: 'Website' | 'Email'
  status: 'open' | 'waiting' | 'resolved'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignee: string | null
  department: string
  tags: string[]
  unread: number
  typing?: boolean
  createdAt: string
  updatedAt: string
  messages: Message[]
  history: { transfer?: { requestId: string; workspaceId: string; conversationId: string; fromAgentId: string | null; fromAgentName: string | null; toAgentId: string; toAgentName: string; actorId: string; actorName: string; note: string }; id: string; title: string; detail: string; when: string; type?: string; from?: string; to?: string }[]
}

export type DemoTicket = SupportContext & {
  id: string
  subject: string
  customer: string
  status: 'New' | 'Open' | 'In Progress' | 'Pending Customer' | 'Pending' | 'Escalated' | 'Resolved' | 'Reopened' | 'Closed'
  createdAt?: string
  updatedAt?: string
  closedAt?: string
  resolution?: string
  requestId?: string
  activity?: { id: string; workspaceId: string; ticketId: string; actorId: string; timestamp: string; type: string; metadata: Record<string, string> }[]
  priority: Conversation['priority']
  assignee: string
  updated: string
  conversationId?: string
  description?: string
  dueDate?: string
  department?: string
  tags?: string[]
  replies?: { id: string; text: string; private: boolean; time: string }[]
}

export type DemoData = {
  retail?: RetailState
  directoryFixtureVersion?: number
  bankingCases?: BankingCase[]
  bankingFrontendVersion?: number
  schemaVersion?: number
  presentationVersion?: number
  conversations: Conversation[]
  tickets: DemoTicket[]
  contacts: { id: string; name: string; email: string; organisation: string; location: string; conversations: number; tag: string; customerStatus?: 'active' | 'inactive'; organisationId?: string; participantType?: string; preference?: string; consent?: string }[]
  visitors: { id: string; name: string; location: string; page: string; source: string; activity: string; status: string }[]
  articles: { id: string; title: string; category: string; updated: string; published: boolean; body?: string; helpful?: number; unhelpful?: number; businessArea?: BusinessArea; sourceUrl?: string; review?: string }[]
  widget?: { greeting: string; colour: string; position: string; branding: boolean }
  deals?: { id: string; title: string; contact: string; owner: string; value: number; stage: string }[]
  tasks?: { id: string; title: string; due: string; done: boolean; businessArea?: BusinessArea; contactId?: string; conversationId?: string }[]
  rules?: { id: string; name: string; contains: string; department: string; departmentId?: string | null; priority: Conversation['priority']; enabled: boolean; businessArea?: BusinessArea; category?: string; participantType?: string; acknowledgement?: string; followUp?: boolean }[]
  organisations?: { id: string; name: string; type: string; reference: string }[]
  queues?: { name: string; area: BusinessArea; departmentId?: string | null }[]
  workflows?: { id: string; name: string; area: BusinessArea; stages: string[] }[]
  applications?: { id: string; title: string; contact: string; workflow: string; stage: string; owner: string; reference: string; businessArea: BusinessArea }[]
  savedReplies?: { id: string; title: string; body: string; businessArea: BusinessArea; approved: boolean }[]
  automationRuns?: { id: string; rule: string; conversationId: string; time: string; status: string }[]
  ai?: { sources: string[]; tone: string; handoff: string; community: string; store: string }
  settings?: WorkspaceSettings
  assistant?: { id: string; workspaceId: string; name: string; enabled: boolean; persona: string; instructions: string; sourceIds: string[]; escalationDepartmentId: string; fraudDepartmentId: string }
  notifications?: { recipientUserId?: string; id: string; workspaceId: string; title: string; detail: string; time: string; conversationId: string }[]
  seedVersion?: number
}

const today = '2026-09-29T'

export const initialDemoData: DemoData = {
  conversations: [
    {
      id: 'conv-1', customer: 'Lerato Mokoena', email: 'lerato.mokoena@example.co.za', initials: 'LM', tone: 'sage', location: 'Johannesburg, Gauteng', channel: 'Website', status: 'open', priority: 'high', assignee: 'Bongani Nombamba', department: 'Orders & delivery', tags: ['Order delay', 'Returning customer'], unread: 2, typing: true, createdAt: `${today}08:42:00+02:00`, updatedAt: `${today}09:42:00+02:00`,
      messages: [
        { id: 'm-1', author: 'Lerato Mokoena', text: 'Hi there, I placed an order last week but the tracking hasn’t updated since Monday. Could you please check?', time: `${today}09:32:00+02:00`, kind: 'customer' },
        { id: 'm-2', author: 'Bongani Nombamba', text: 'Sawubona Lerato! I’d be happy to look into that for you. Could you share your order number?', time: `${today}09:35:00+02:00`, kind: 'agent', delivery: 'sent' },
        { id: 'm-3', author: 'Lerato Mokoena', text: 'Of course, it’s QA-28491. I was hoping it would arrive before the weekend.', time: `${today}09:39:00+02:00`, kind: 'customer' },
        { id: 'm-4', author: 'Bongani Nombamba', text: 'I can see your parcel is with the courier in Midrand. I’m checking the latest delivery estimate now.', time: `${today}09:42:00+02:00`, kind: 'agent', delivery: 'sent' },
      ],
      history: [{ id: 'h-1', title: 'Conversation started', detail: 'Website chat', when: 'Today, 08:42' }, { id: 'h-2', title: 'Order delay tag added', detail: 'By Phindile Khumalo', when: 'Today, 08:48' }],
    },
    {
      id: 'conv-2', customer: 'Sipho Dlamini', email: 'sipho.d@example.co.za', initials: 'SD', tone: 'blue', location: 'Cape Town, Western Cape', channel: 'Website', status: 'waiting', priority: 'normal', assignee: 'Phindile Khumalo', department: 'Returns & refunds', tags: ['Return'], unread: 1, createdAt: `${today}09:18:00+02:00`, updatedAt: `${today}09:35:00+02:00`,
      messages: [{ id: 'm-5', author: 'Sipho Dlamini', text: 'I need to exchange a jacket for a different size. What’s the easiest way to do that?', time: `${today}09:35:00+02:00`, kind: 'customer' }], history: [{ id: 'h-3', title: 'Conversation started', detail: 'Website chat', when: 'Today, 09:18' }],
    },
    {
      id: 'conv-3', customer: 'Ayesha Khan', email: 'ayesha.khan@example.co.za', initials: 'AK', tone: 'gold', location: 'Durban, KwaZulu-Natal', channel: 'Email', status: 'open', priority: 'low', assignee: null, department: 'Customer care', tags: ['Product question'], unread: 1, createdAt: `${today}09:06:00+02:00`, updatedAt: `${today}09:28:00+02:00`,
      messages: [{ id: 'm-6', author: 'Ayesha Khan', text: 'Do you have the Nandi tote in stock in the sage colour?', time: `${today}09:28:00+02:00`, kind: 'customer' }], history: [{ id: 'h-4', title: 'Email received', detail: 'Website contact form', when: 'Today, 09:06' }],
    },
    {
      id: 'conv-4', customer: 'Mandla Ndlovu', email: 'mandla.n@example.co.za', initials: 'MN', tone: 'rose', location: 'Pretoria, Gauteng', channel: 'Website', status: 'open', priority: 'urgent', assignee: 'Tumo Likotsi', department: 'Payments', tags: ['Payment', 'Escalated'], unread: 0, createdAt: `${today}08:58:00+02:00`, updatedAt: `${today}09:17:00+02:00`,
      messages: [{ id: 'm-7', author: 'Mandla Ndlovu', text: 'I was charged twice for one order. Please help me sort this out.', time: `${today}09:17:00+02:00`, kind: 'customer' }, { id: 'm-8', author: 'Tumo Likotsi', text: 'I’m sorry about that. I’m checking the payment record with our team.', time: `${today}09:19:00+02:00`, kind: 'note' }], history: [{ id: 'h-5', title: 'Priority raised', detail: 'Urgent · Tumo Likotsi', when: 'Today, 09:20' }],
    },
    {
      id: 'conv-5', customer: 'Nomsa Pillay', email: 'nomsa.p@example.co.za', initials: 'NP', tone: 'lilac', location: 'Gqeberha, Eastern Cape', channel: 'Website', status: 'resolved', priority: 'normal', assignee: 'Bongani Nombamba', department: 'Customer care', tags: ['Account'], unread: 0, createdAt: `${today}07:32:00+02:00`, updatedAt: `${today}08:46:00+02:00`,
      messages: [{ id: 'm-9', author: 'Nomsa Pillay', text: 'I can’t update my delivery address.', time: `${today}08:10:00+02:00`, kind: 'customer' }, { id: 'm-10', author: 'Bongani Nombamba', text: 'I’ve updated the address on your order. You’re all set!', time: `${today}08:46:00+02:00`, kind: 'agent', delivery: 'sent' }], history: [{ id: 'h-6', title: 'Conversation resolved', detail: 'By Bongani Nombamba', when: 'Today, 08:46' }],
    },
  ],
  tickets: [
    { id: 'T-2048', subject: 'Courier tracking has not updated', customer: 'Lerato Mokoena', status: 'Open', priority: 'high', assignee: 'Bongani Nombamba', updated: '12 min ago', conversationId: 'conv-1' },
    { id: 'T-2047', subject: 'Refund confirmation', customer: 'Zanele Khumalo', status: 'Pending', priority: 'normal', assignee: 'Phindile Khumalo', updated: '1 hour ago' },
    { id: 'T-2046', subject: 'Update delivery address', customer: 'Nomsa Pillay', status: 'Resolved', priority: 'low', assignee: 'Bongani Nombamba', updated: 'Today' },
  ],
  contacts: [
    { id: 'c-1', name: 'Lerato Mokoena', email: 'lerato.mokoena@example.co.za', organisation: 'Independent', location: 'Johannesburg', conversations: 6, tag: 'Returning' },
    { id: 'c-2', name: 'Sipho Dlamini', email: 'sipho.d@example.co.za', organisation: 'Umoya Studio', location: 'Cape Town', conversations: 3, tag: 'Wholesale' },
    { id: 'c-3', name: 'Ayesha Khan', email: 'ayesha.khan@example.co.za', organisation: 'Independent', location: 'Durban', conversations: 2, tag: 'New customer' },
    { id: 'c-4', name: 'Mandla Ndlovu', email: 'mandla.n@example.co.za', organisation: 'Ndlovu & Co.', location: 'Pretoria', conversations: 4, tag: 'Priority' },
  ],
  visitors: [
    { id: 'v-1', name: 'Visitor 84A2', location: 'Johannesburg', page: '/products/nandi-tote', source: 'Instagram', activity: 'Viewed 3 pages · 4 min', status: 'Browsing' },
    { id: 'v-2', name: 'Visitor 39F1', location: 'Cape Town', page: '/delivery', source: 'Google', activity: 'Viewing now · 2 min', status: 'Browsing' },
    { id: 'v-3', name: 'Visitor A701', location: 'Durban', page: '/returns', source: 'Direct', activity: 'Chat invited · 8 min', status: 'Invited' },
  ],
  articles: [
    { id: 'a-1', title: 'Track your order', category: 'Orders & delivery', updated: '2 days ago', published: true },
    { id: 'a-2', title: 'Delivery timeframes by province', category: 'Orders & delivery', updated: '5 days ago', published: true },
    { id: 'a-3', title: 'My tracking link is not updating', category: 'Orders & delivery', updated: 'Today', published: false },
    { id: 'a-4', title: 'Change your delivery address', category: 'Orders & delivery', updated: '1 week ago', published: true },
  ],
}
