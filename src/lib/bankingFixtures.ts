import type { WorkspaceStore, WorkspaceData } from './workspaceTypes'
import type { DemoData } from '../data/demoData'
import { scopeWorkspaceData } from './workspaceMigration'
import { bankingProducts, bankingSupportCategories, bankingCaseStates, proposedBankingDepartments, type BankingCase } from './workspaceExperience'

/** Add once, without replacing existing records, settings, memberships or edits. */
export function addBankingFrontendFixtures(input: WorkspaceStore, workspaceId: string) {
  const original = input.snapshots[workspaceId]
  if (!original || (original.bankingFrontendVersion || 0) >= 1 || input.workspaces.find(w => w.id === workspaceId)?.supportMode !== 'banking') return { store: input, changed: false }
  const store = structuredClone(input)
  const data: DemoData & Pick<WorkspaceData, 'agents' | 'departments'> = store.snapshots[workspaceId]
  for (const name of proposedBankingDepartments) {
    if (!data.departments.some(d => d.name === name)) {
      const id = `${workspaceId}:stage0a-department:${name.toLowerCase().replace(/[^a-z]+/g, '-')}`
      data.departments.push({ id, workspaceId, name, area: 'general' })
      data.queues = [...(data.queues || []), { departmentId: id, name, area: 'general' }]
    }
  }
  const kinds = ['account', 'application', 'complaint'] as const
  const cases: BankingCase[] = []
  for (const kind of kinds) for (let i = 0; i < (kind === 'account' ? 7 : kind === 'application' ? 7 : 4); i++) {
    const customer = data.contacts[i % Math.max(1, data.contacts.length)]
    if (!customer) continue
    const departmentName = kind === 'complaint' ? 'Complaints & Escalations' : kind === 'application' ? 'Applications' : i === 3 ? 'Cards Support' : i === 4 || i === 5 ? 'Digital Banking' : 'Accounts & Transactions'
    const department = data.departments.find(d => d.name === departmentName)!
    const id = `${workspaceId}:stage0a:${kind}:${i}`
    const createdAt = new Date(Date.now() - (i + 1) * 86400000).toISOString()
    const status = bankingCaseStates[kind][i % bankingCaseStates[kind].length]
    cases.push({ id, workspaceId, kind, reference: `ENL-DEMO-${kind === 'account' ? 'SUP' : kind === 'application' ? 'APP' : 'CMP'}-${String(i + 1).padStart(4, '0')}`, customerId: customer.id, product: bankingProducts[i % bankingProducts.length], category: kind === 'account' ? bankingSupportCategories[i] : kind === 'application' ? 'Applications' : ['Service complaint', 'Card dispute', 'Digital banking complaint', 'Payment dispute'][i], subject: kind === 'account' ? ['Account access assistance', 'Failed transfer enquiry', 'Debit order enquiry', 'Card replacement enquiry', 'Mobile banking assistance', 'Online banking assistance', 'International payment enquiry'][i] : kind === 'application' ? `${bankingProducts[i]} support application` : ['Support response complaint', 'Card replacement dispute', 'Digital support escalation', 'Payment enquiry complaint'][i], status, priority: kind === 'complaint' && i === 2 ? 'urgent' : i % 3 === 0 ? 'high' : 'normal', departmentId: department.id, agentId: i % 3 === 0 ? null : data.agents[i % Math.max(1, data.agents.length)]?.id || null, createdAt, dueAt: new Date(Date.parse(createdAt) + 3 * 86400000).toISOString(), resolution: /Completed|Resolved/.test(status) ? 'Support workflow completed.' : '', history: [{ id: `${id}:created`, time: createdAt, detail: 'Support case created.' }, ...(status === 'Escalations' ? [{ id: `${id}:escalated`, time: createdAt, detail: 'escalation recorded for department review.' }] : [])] })
  }
  // Missing fields can be initialized; existing collections remain authoritative.
  data.bankingCases = data.bankingCases ?? cases
  const replyNames = ['Application status enquiries', 'Card replacement enquiries', 'Digital banking assistance', 'International payment enquiries', 'Complaint acknowledgement', 'Product information requests']
  data.savedReplies = [...(data.savedReplies || []), ...replyNames.map((title, i) => ({ id: `${workspaceId}:stage0a-reply:${i}`, workspaceId, title, body: `Thank you for your ${title.toLowerCase()}. We can record a support enquiry and explain the next support step. Official information requires review. Never share your PIN, password, OTP, CVV or full card number.`, businessArea: 'general' as const, approved: false })).filter(r => !data.savedReplies?.some(existing => existing.id === r.id))]
  data.visitors = [...data.visitors, ...['Active', 'Waiting for Agent', 'Offline Message'].map((status, i) => ({ id: `${workspaceId}:stage0a-visitor:${i}`, workspaceId, name: `Visitor ${i + 1}`, location: 'South Africa', page: ['/products', '/help', '/contact'][i], source: 'website session', activity: 'Website session', status })).filter(v => !data.visitors.some(existing => existing.id === v.id))]
  data.bankingFrontendVersion = 1
  store.snapshots[workspaceId] = scopeWorkspaceData(data, workspaceId)
  return { store, changed: true }
}
