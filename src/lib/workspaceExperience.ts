import type { Workspace } from './workspaceTypes'

export const bankingProducts = ['Becha Account', 'Nala Account', 'Temo Account', 'Temo Savings', 'iMbewu Savings', 'Pusha Account', 'Owner Account'] as const
export const bankingSupportCategories = ['Account access', 'Failed transfers', 'Debit orders', 'Card replacement', 'Mobile banking', 'Online banking', 'International payment enquiries', 'Product information', 'Applications', 'Complaints']
export const proposedBankingDepartments = ['General Customer Support', 'Accounts & Transactions', 'Digital Banking', 'Cards Support', 'Applications', 'Complaints & Escalations', 'Business Banking']
export const bankingCaseStates = {
  account: ['New', 'In Progress', 'Awaiting Customer', 'Completed'],
  application: ['New Applications', 'In Progress', 'Awaiting Documents', 'Completed'],
  complaint: ['New Complaints', 'Open Investigations', 'Escalations', 'Resolved Cases'],
} as const
export type BankingCaseKind = keyof typeof bankingCaseStates
export type BankingCaseEvent = {
  id: string; time: string; detail: string; actorId?: string
  type?: 'submitted' | 'investigation' | 'department' | 'assignment' | 'status' | 'priority' | 'note' | 'update' | 'escalation' | 'resolved' | 'reopened'
  departmentId?: string; agentId?: string | null
}
export type BankingCase = {
  id: string; workspaceId?: string; kind: BankingCaseKind; reference: string; customerId: string
  product: string; category: string; subject: string; status: string; priority: 'normal' | 'high' | 'urgent'
  departmentId: string; agentId: string | null; createdAt: string; dueAt: string; resolution: string
  description?: string
  history: BankingCaseEvent[]
}
const entry = (label: string, path: string, icon: 'Activity' | 'Archive' | 'BarChart3' | 'BookOpen' | 'Bot' | 'Building2' | 'Clock3' | 'CreditCard' | 'FileText' | 'Inbox' | 'Kanban' | 'MessageCircle' | 'Settings' | 'ShieldCheck' | 'Smile' | 'Ticket' | 'Users' | 'UserRoundCheck' | 'Zap', badge?: 'conversations' | 'tickets') => ({ label, path, icon, badge })
const sharedTools = [entry('Workspaces', '/workspaces', 'Building2'), entry('Automations', '/automations', 'Zap'), entry('AI Assist', '/ai-assist', 'Bot'), entry('Activities', '/activities', 'Clock3'), entry('Feedback', '/feedback', 'Smile'), entry('Chat widget', '/widget', 'MessageCircle')]
const qaloSections = [
  { label: 'Operations', items: [entry('Overview', '/overview', 'BarChart3'), entry('Inbox', '/inbox', 'Inbox', 'conversations'), entry('Live Visitors', '/visitors', 'Activity'), entry('Contacts & organisations', '/contacts', 'Users'), entry('Orders & products', '/retail', 'Archive'), entry('Enquiries', '/pipeline', 'Kanban'), entry('Tickets', '/tickets', 'Ticket', 'tickets'), entry('Returns & Refunds', '/returns', 'Archive')] },
  { label: 'Knowledge', items: [entry('Knowledge base', '/knowledge', 'BookOpen')] },
  { label: 'Management', items: [entry('Agents', '/team', 'UserRoundCheck'), entry('Reports & Analytics', '/reports', 'BarChart3'), entry('Integrations', '/integrations', 'Settings'), entry('Settings', '/settings', 'Settings')] },
  { label: 'Workspace tools', items: sharedTools },
]
const bankingSections = [
  { label: 'Operations', items: [entry('Overview', '/overview', 'BarChart3'), entry('Inbox', '/inbox', 'Inbox', 'conversations'), entry('Live Visitors', '/visitors', 'Activity'), entry('Customers', '/contacts', 'Users'), entry('Accounts & Transactions', '/account-support', 'CreditCard'), entry('Applications & Enquiries', '/pipeline', 'Kanban'), entry('Support Tickets', '/tickets', 'Ticket', 'tickets'), entry('Complaints & Disputes', '/complaints', 'ShieldCheck')] },
  { label: 'Banking Knowledge', items: [entry('Banking Products', '/banking-products', 'Building2'), entry('Knowledge base', '/knowledge', 'BookOpen')] },
  { label: 'Management', items: [entry('Agents & Departments', '/team', 'UserRoundCheck'), entry('Reports & Analytics', '/reports', 'BarChart3'), entry('Integrations', '/integrations', 'Settings'), entry('Settings', '/settings', 'Settings')] },
  { label: 'Workspace tools', items: sharedTools },
]
/** Presentation configuration only; membership remains the existing local simulation. */
export function workspaceExperience(workspace?: Workspace) {
  const banking = workspace?.supportMode === 'banking'
  const sections = banking ? bankingSections : qaloSections
  return {
    id: workspace?.id || '', name: workspace?.name || 'Qalo YaAfrika', organisationType: workspace?.type || 'Customer Support',
    logo: workspace?.logo || (banking ? '/new%20logo%20full%20colour.svg' : null), placeholder: banking ? 'eNL' : 'Q',
    colours: { primary: workspace?.primaryColor || '#933F98', background: banking ? '#FFFFFF' : undefined },
    sections, routes: sections.flatMap(section => section.items.map(item => item.path)),
    dashboardWidgets: banking ? ['Total conversations', 'Active conversations', 'AI-handled conversations', 'Human-handled conversations', 'Open support cases', 'Pending applications', 'Unassigned tickets', 'Escalated complaints', 'Open tickets', 'Resolved tickets', 'online agents', 'Average response time'] : ['Conversations', 'Tickets', 'Support performance'],
    supportCategories: banking ? bankingSupportCategories : ['Community Investment', 'Qalo Store', 'General support'],
    departments: banking ? proposedBankingDepartments : ['Member Support', 'Orders & Payments', 'Technical Support'],
    products: banking ? [...bankingProducts] : ['Retail catalogue'],
    features: { banking, retail: !banking, complaints: banking, applications: true, liveChat: false },
    fixture: banking ? 'enl-stage0a' : 'existing-qalo',
    terminology: { customer: banking ? 'Customer' : 'Contact', ticket: banking ? 'Support Ticket' : 'Ticket', enquiry: banking ? 'Application / enquiry' : 'Enquiry' },
  }
}
