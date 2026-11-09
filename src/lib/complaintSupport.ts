import { validateBankingMessage } from './bankingSupport'
import { ENL_SLUG } from './enlWorkspace'
import { supportService, type SupportService } from './supportService'
import { eligibleAgent } from './ticketSupport'
import { bankingCaseStates, bankingProducts, type BankingCase, type BankingCaseEvent } from './workspaceExperience'
import { platformPreview } from './workspaceManagement'
import { canInWorkspace, type WorkspaceStore } from './workspaceTypes'

export const complaintStatuses = bankingCaseStates.complaint
export const complaintPriorities = ['normal', 'high', 'urgent'] as const
export const complaintProducts = [...bankingProducts, 'Stokvel Account']
export const complaintCategories = ['Service complaint', 'Card dispute', 'Digital banking complaint', 'Payment dispute']
export type ComplaintDraft = Pick<BankingCase, 'customerId' | 'subject' | 'product' | 'category' | 'priority' | 'departmentId' | 'agentId' | 'dueAt'> & { description: string }
type ComplaintChange =
  | { kind: 'assignment'; departmentId: string; agentId: string | null; revision: string | undefined }
  | { kind: 'status'; status: string; priority: BankingCase['priority']; reason: string; revision: string | undefined }
  | { kind: 'note' | 'update'; text: string }

export function complaintAccess(store: WorkspaceStore, workspaceId: string, actorId: string) {
  const workspace = store.workspaces.find(w => w.id === workspaceId && w.slug === ENL_SLUG && w.supportMode === 'banking' && w.status === 'active')
  const actor = actorId === platformPreview.id ? platformPreview : store.users.find(user => user.id === actorId)
  const snapshot = workspace && store.snapshots[workspaceId]
  const allowed = !!snapshot && canInWorkspace(actor, workspace, store.memberships, 'reply')
  const manage = allowed && canInWorkspace(actor, workspace, store.memberships, 'manage-support')
  const ownDepartments = snapshot ? snapshot.agents.find(agent => agent.userId === actorId)?.departmentIds : undefined
  const departments = allowed && snapshot ? snapshot.departments.filter(d => manage || !ownDepartments || ownDepartments.includes(d.id)) : []
  const agents = snapshot ? snapshot.agents.filter(agent => store.memberships.some(m => m.workspaceId === workspaceId && m.userId === agent.userId && m.status === 'active') && store.users.some(u => u.id === agent.userId && u.status === 'active')) : []
  return { allowed, manage, departments, agents, snapshot, actor }
}

export function createComplaintSupport(service: SupportService) {
  function authorize(workspaceId: string, actorId: string) {
    const access = complaintAccess(service.registry(), workspaceId, actorId)
    if (!access.allowed) throw new Error('Your role cannot manage complaints in this workspace.')
    if (service.persistenceState() !== 'persistent') throw new Error('Browser storage is unavailable. The complaint was not saved.')
    return access
  }
  function checkAssignment(access: ReturnType<typeof authorize>, departmentId: string, agentId: string | null) {
    if (!access.departments.some(d => d.id === departmentId)) throw new Error('Choose a department you can access.')
    if (agentId && !access.agents.some(a => a.id === agentId && eligibleAgent(a, departmentId))) throw new Error('The agent is unavailable or ineligible for this eNL department.')
  }
  return {
    async create(workspaceId: string, actorId: string, draft: ComplaintDraft, requestId: string) {
      const id = `${workspaceId}:complaint:${requestId}`
      await service.updateWorkspace(workspaceId, current => {
        const access = authorize(workspaceId, actorId)
        const cases = current.bankingCases ?? []
        if (cases.some(record => record.id === id)) return current
        checkAssignment(access, draft.departmentId, draft.agentId)
        const subject = draft.subject.trim(), description = draft.description.trim()
        if (!subject || subject.length > 160) throw new Error('Enter a complaint subject of up to 160 characters.')
        validateBankingMessage(subject)
        if (description) validateBankingMessage(description)
        if (!current.contacts.some(customer => customer.id === draft.customerId)) throw new Error('Choose a customer from this workspace.')
        if (!complaintProducts.includes(draft.product) || ![...complaintCategories, ...cases.filter(c => c.kind === 'complaint').map(c => c.category)].includes(draft.category) || !complaintPriorities.includes(draft.priority)) throw new Error('Choose a valid product, category and priority.')
        if (!Number.isFinite(Date.parse(draft.dueAt))) throw new Error('Choose a valid support due date.')
        const now = new Date().toISOString()
        const sequence = Math.max(0, ...cases.map(record => Number(/(?:^|-)CMP-(\d+)$/i.exec(record.reference)?.[1] || 0))) + 1
        const reference = `ENL-CMP-${String(sequence).padStart(4, '0')}`
        const record: BankingCase = {
          ...draft, id, workspaceId, kind: 'complaint', reference, subject, description, status: complaintStatuses[0],
          createdAt: now, resolution: '', history: [{ id: crypto.randomUUID(), time: now, type: 'submitted', actorId, detail: 'Complaint recorded.' }],
        }
        return { ...current, bankingCases: [...cases, record] }
      })
      return id
    },
    async change(workspaceId: string, actorId: string, id: string, change: ComplaintChange) {
      await service.updateWorkspace(workspaceId, current => {
        const access = authorize(workspaceId, actorId)
        const record = current.bankingCases?.find(c => c.id === id && c.kind === 'complaint')
        if (!record || !access.departments.some(d => d.id === record.departmentId)) throw new Error('This complaint is unavailable in your department scope.')
        if ('revision' in change && record.history.at(-1)?.id !== change.revision) throw new Error('This case changed. Close and reopen the action to review the latest details.')
        const now = new Date().toISOString()
        const events: BankingCaseEvent[] = []
        const add = (type: NonNullable<BankingCaseEvent['type']>, detail: string, extra?: Partial<BankingCaseEvent>) => events.push({ id: crypto.randomUUID(), time: now, actorId, type, detail, ...extra })
        let patch: Partial<BankingCase> = {}
        if (change.kind === 'assignment') {
          if (record.departmentId !== change.departmentId && !access.manage) throw new Error('Cross-department reassignment requires a support manager.')
          if (record.departmentId !== change.departmentId || record.agentId !== change.agentId) {
            checkAssignment(access, change.departmentId, change.agentId)
            patch = { departmentId: change.departmentId, agentId: change.agentId }
            if (record.departmentId !== change.departmentId) add('department', `Assigned to ${access.departments.find(d => d.id === change.departmentId)!.name}.`)
            if (record.agentId !== change.agentId) add('assignment', change.agentId ? `Assigned to ${access.agents.find(a => a.id === change.agentId)!.name}.` : 'Agent assignment cleared.')
          }
        } else if (change.kind === 'status') {
          const status = complaintStatuses.find(value => value === change.status)
          if (!status || !complaintPriorities.includes(change.priority)) throw new Error('Select a valid complaint status and priority.')
          patch = { status, priority: change.priority }
          if (record.status !== status) {
            if (status === 'Escalations') {
              const reason = change.reason.trim()
              validateBankingMessage(reason)
              add('escalation', reason, { departmentId: record.departmentId, agentId: record.agentId })
            } else {
              const type = status === 'Resolved Cases' ? 'resolved' : record.status === 'Resolved Cases' ? 'reopened' : status === 'Open Investigations' ? 'investigation' : 'status'
              add(type, `Status changed from ${record.status} to ${status}.`)
            }
          }
          if (record.priority !== change.priority) add('priority', `Priority changed from ${record.priority} to ${change.priority}.`)
        } else {
          const detail = change.text.trim()
          validateBankingMessage(detail)
          add(change.kind, detail)
        }
        if (!events.length) return current
        return { ...current, bankingCases: current.bankingCases?.map(c => c.id === id ? { ...c, ...patch, history: [...c.history, ...events] } : c) }
      })
    },
  }
}
export const complaintSupport = createComplaintSupport(supportService)
