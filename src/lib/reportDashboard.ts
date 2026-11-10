import type { Conversation, DemoTicket } from '../data/demoData'
import { type BusinessArea, type AreaFilter } from './business'
import { dayKey, period } from './reporting'
import { ticketState } from './ticketSupport'
import { bankingProducts } from './workspaceExperience'
import { platformPreview } from './workspaceManagement'
import { canInWorkspace, isAdministrator, type WorkspaceStore } from './workspaceTypes'

const day = 86_400_000
export type ReportRange = { from: string; to: string }
export type DatePreset = '7' | '30' | 'month' | 'last-month' | 'custom'
type RecordKind = 'ticket' | 'conversation' | 'complaint' | 'application' | 'account'
export type ReportRecord = {
  id: string
  reference: string
  kind: RecordKind
  created: string
  resolutionDays: string[]
  status: string
  outcome: 'Resolved' | 'Open / In progress' | 'Escalated'
  agentId?: string | null
  responseAgentId?: string
  departmentId?: string | null
  area: BusinessArea
  category: string
  priority?: string
  channel?: string
  product?: string
  response?: number
  rating?: number
}
export type ReportFilters = { department: string; area: AreaFilter; agent: string; channel: string; category: string; product: string }
export type ReportGroup = { key: string; name: string; value: number }

const dateMs = (date: string) => Date.parse(date + 'T12:00:00Z')
const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10)
const validDay = (date: string) => /^\d{4}-\d\d-\d\d$/.test(date) && Number.isFinite(dateMs(date)) && dateAt(dateMs(date)) === date
export const validRange = ({ from, to }: ReportRange) => validDay(from) && validDay(to) && from <= to
export const inRange = (date: string, range: ReportRange) => !!date && date >= range.from && date <= range.to

export function presetRange(preset: Exclude<DatePreset, 'custom'>, today: string): ReportRange {
  if (preset === '7' || preset === '30') return period(Number(preset), today)
  const first = today.slice(0, 7) + '-01'
  if (preset === 'month') return { from: first, to: today }
  const last = dateAt(dateMs(first) - day)
  return { from: last.slice(0, 7) + '-01', to: last }
}

export function previousReportRange(range: ReportRange): ReportRange {
  const end = dateMs(range.from) - day
  return { from: dateAt(end - (dateMs(range.to) - dateMs(range.from))), to: dateAt(end) }
}

function resolutionDays(...dates: (string | undefined)[]) {
  return [...new Set(dates.filter((date): date is string => !!date).map(dayKey).filter(Boolean))].sort()
}

function outcome(status: string): ReportRecord['outcome'] {
  if (/^(resolved( cases)?|closed|completed|support completed)$/i.test(status)) return 'Resolved'
  if (/^escalat(ed|ions)$/i.test(status)) return 'Escalated'
  return 'Open / In progress'
}

function productFor(category?: string) {
  return bankingProducts.find(product => category?.toLowerCase() === product.replace(/ Account$/, '').toLowerCase() + ' enquiry')
}

function firstStaffResponse(conversation: Conversation, agentIds: Map<string, string>) {
  const messages = conversation.messages.filter(message => Number.isFinite(Date.parse(message.time)))
  const request = Math.min(...messages.filter(message => message.kind === 'customer').map(message => Date.parse(message.time)))
  const response = messages.filter(message =>
    message.kind === 'agent' && !message.simulated && (message.delivery === undefined || message.delivery === 'sent') &&
    !/\b(assistant|bot)\b/i.test(message.author) && Date.parse(message.time) >= request)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))[0]
  return response ? { response: (Date.parse(response.time) - request) / 60_000, responseAgentId: agentIds.get(response.author) } : {}
}

function ticketCreated(ticket: DemoTicket) {
  // Some imported eNL tickets have a dated creation entry in their initial reply.
  const firstReply = ticket.replies?.[0]
  const legacyCreation = firstReply?.private && /^ticket created with conversation context\.?$/i.test(firstReply.text) ? firstReply.time : ''
  return ticket.createdAt ?? ticket.activity?.find(event => event.type === 'created')?.timestamp ??
    legacyCreation
}

/** Read only the active, authorised workspace and its allowed reporting departments. */
export function reportSource(store: WorkspaceStore, workspaceId: string, actorId: string) {
  const actor = actorId === platformPreview.id ? platformPreview : store.users.find(user => user.id === actorId)
  const workspace = store.workspaces.find(item => item.id === workspaceId && item.status === 'active')
  const snapshot = store.snapshots[workspaceId]
  if (!workspace || !snapshot || !canInWorkspace(actor, workspace, store.memberships, 'manage-support')) return undefined
  const banking = workspace.supportMode === 'banking'
  const ownDepartments = isAdministrator(actor) ? undefined : snapshot.agents.find(agent => agent.userId === actorId)?.departmentIds
  const departments = snapshot.departments.filter(department => !ownDepartments || ownDepartments.includes(department.id))
  const departmentIds = new Set(departments.map(department => department.id))
  const allowed = (record: { workspaceId?: string; departmentId?: string | null }) =>
    (!record.workspaceId || record.workspaceId === workspaceId) && (!ownDepartments || departmentIds.has(record.departmentId ?? ''))
  const agentsByName = new Map(snapshot.agents.filter(agent => agent.workspaceId === workspaceId).map(agent => [agent.name, agent.id]))
  const conversations = snapshot.conversations.filter(allowed)
  const conversationsById = new Map(conversations.map(conversation => [conversation.id, conversation]))
  const records: ReportRecord[] = conversations.map(conversation => ({
    id: conversation.id, reference: conversation.reference || conversation.id, kind: 'conversation',
    created: dayKey(conversation.createdAt), resolutionDays: resolutionDays(conversation.resolvedAt, ...(conversation.resolutionEvents ?? [])),
    status: conversation.status, outcome: outcome(conversation.status), agentId: conversation.assigneeId,
    departmentId: conversation.departmentId, area: conversation.businessArea ?? 'general',
    category: conversation.category || 'Unclassified', priority: conversation.priority, channel: conversation.channel,
    product: banking ? productFor(conversation.category) : undefined,
    rating: typeof conversation.satisfaction === 'number' && conversation.satisfaction >= 1 && conversation.satisfaction <= 5 ? conversation.satisfaction : undefined,
    ...firstStaffResponse(conversation, agentsByName),
  }))
  for (const ticket of snapshot.tickets.filter(allowed)) {
    const conversation = conversationsById.get(ticket.conversationId ?? '')
    const status = ticketState(ticket)
    records.push({
      id: ticket.id, reference: ticket.reference || ticket.id, kind: 'ticket', created: dayKey(ticketCreated(ticket)),
      resolutionDays: resolutionDays(ticket.resolvedAt, ...(ticket.resolutionEvents ?? []), ...(ticket.activity ?? []).filter(event => event.type === 'resolved' || (event.type === 'status-changed' && event.metadata.to === 'Resolved')).map(event => event.timestamp)),
      status, outcome: outcome(status), agentId: ticket.assigneeId, departmentId: ticket.departmentId,
      area: ticket.businessArea ?? 'general', category: ticket.category || 'Unclassified', priority: ticket.priority,
      channel: conversation?.channel, product: banking ? productFor(ticket.category) ?? productFor(conversation?.category) : undefined,
    })
  }
  if (banking) {
    for (const item of (snapshot.bankingCases ?? []).filter(allowed)) {
      records.push({
        id: item.id, reference: item.reference, kind: item.kind, created: dayKey(item.createdAt),
        resolutionDays: resolutionDays(...item.history.filter(event => event.type === 'resolved').map(event => event.time)),
        status: item.status, outcome: outcome(item.status), agentId: item.agentId, departmentId: item.departmentId,
        area: 'general', category: item.category || 'Unclassified', priority: item.priority, product: item.product,
      })
    }
  } else {
    for (const item of (snapshot.applications ?? []).filter(allowed)) {
      records.push({
        id: item.id, reference: item.reference || item.id, kind: 'application', created: dayKey(item.createdAt ?? ''),
        resolutionDays: [], status: item.stage, outcome: outcome(item.stage),
        agentId: agentsByName.get(item.owner), departmentId: item.departmentId, area: item.businessArea,
        category: item.workflow || 'Unclassified', priority: item.priority,
      })
    }
  }
  const assigned = new Set(records.flatMap(record => [record.agentId, record.responseAgentId]))
  const agents = snapshot.agents.filter(agent => agent.workspaceId === workspaceId &&
    (assigned.has(agent.id) || (
      store.memberships.some(member => member.workspaceId === workspaceId && member.userId === agent.userId && member.status === 'active') &&
      store.users.some(user => user.id === agent.userId && user.status === 'active') &&
      (!ownDepartments || !agent.departmentIds || agent.departmentIds.some(id => departmentIds.has(id)))
    )))
  return { workspace, banking, departments, agents, records: [...new Map(records.map(record => [record.kind + ':' + record.id, record])).values()] }
}
export type ReportSource = NonNullable<ReturnType<typeof reportSource>>

export function filterReport(source: ReportSource, filter: ReportFilters) {
  if (filter.department && !source.departments.some(department => department.id === filter.department)) return []
  if (filter.agent && !source.agents.some(agent => agent.id === filter.agent)) return []
  return source.records.filter(record =>
    (!filter.department || record.departmentId === filter.department) &&
    (filter.area === 'all' || record.area === filter.area) &&
    (!filter.agent || record.agentId === filter.agent) &&
    (!filter.channel || record.channel === filter.channel) &&
    (!filter.category || record.category === filter.category) &&
    (!filter.product || record.product === filter.product))
}

export function reportGroup(records: ReportRecord[], keyFor: (record: ReportRecord) => string, label = (key: string) => key): ReportGroup[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = keyFor(record)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([key, value]) => ({ key, name: label(key), value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

export function reportTrend(records: ReportRecord[], range: ReportRange) {
  if (!validRange(range)) return []
  const days = Math.round((dateMs(range.to) - dateMs(range.from)) / day) + 1
  const step = days <= 35 ? 1 : 7
  const monthly = days > 100
  const annually = days > 730
  const buckets: { date: string; to: string; created: number; resolved: number }[] = []
  for (let start = dateMs(range.from); start <= dateMs(range.to);) {
    const date = dateAt(start)
    const boundary = new Date(start)
    const next = annually ? boundary.setUTCFullYear(boundary.getUTCFullYear() + 1, 0, 1)
      : monthly ? boundary.setUTCMonth(boundary.getUTCMonth() + 1, 1) : start + step * day
    buckets.push({ date, to: dateAt(Math.min(next - day, dateMs(range.to))), created: 0, resolved: 0 })
    start = next
  }
  const bucketKey = (date: string) => annually ? date.slice(0, 4) : monthly ? date.slice(0, 7)
    : String(Math.floor((dateMs(date) - dateMs(range.from)) / (step * day)))
  const lookup = new Map(buckets.map(bucket => [bucketKey(bucket.date), bucket]))
  for (const record of records) {
    const resolved = record.resolutionDays.find(date => inRange(date, range))
    if (inRange(record.created, range)) lookup.get(bucketKey(record.created))!.created++
    if (resolved) lookup.get(bucketKey(resolved))!.resolved++
  }
  return buckets
}
export type ReportBucket = ReturnType<typeof reportTrend>[number]
export const bucketLabel = (bucket: ReportBucket) => bucket.date === bucket.to ? bucket.date : bucket.date + ' – ' + bucket.to
export const formatResponse = (value?: number) => value === undefined ? 'Not available' : value.toFixed(1) + ' min'
export const formatSatisfaction = (value?: number) => value === undefined ? 'No rating data' : value.toFixed(1) + ' / 5'

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
export function reportMetrics(records: ReportRecord[], conversations: ReportRecord[], range: ReportRange) {
  const cohort = records.filter(record => inRange(record.created, range))
  const resolutions = records.filter(record => record.resolutionDays.some(date => inRange(date, range)))
  const requests = conversations.filter(record => inRange(record.created, range))
  return {
    cohort, resolutions, requests,
    response: mean(requests.flatMap(record => record.response ?? [])),
    satisfaction: mean(requests.flatMap(record => record.rating ?? [])),
  }
}

/** Assigned and resolved use current assignees of the created cohort. Response uses the first recorded staff author. */
export function agentReport(agents: ReportSource['agents'], cohort: ReportRecord[], requests: ReportRecord[]) {
  function byAgent(records: ReportRecord[], field: 'agentId' | 'responseAgentId') {
    const groups = new Map<string, ReportRecord[]>()
    for (const record of records) {
      const id = record[field]
      if (!id) continue
      const group = groups.get(id)
      if (group) group.push(record)
      else groups.set(id, [record])
    }
    return groups
  }
  const workloads = byAgent(cohort, 'agentId')
  const replies = byAgent(requests, 'responseAgentId')
  const ratings = byAgent(requests, 'agentId')
  return agents.map(agent => {
    const assigned = workloads.get(agent.id) ?? []
    const resolved = assigned.filter(record => record.outcome === 'Resolved').length
    return {
      agent, records: assigned, assigned: assigned.length, resolved,
      open: assigned.length - resolved, rate: assigned.length ? resolved / assigned.length : undefined,
      response: mean((replies.get(agent.id) ?? []).flatMap(record => record.response ?? [])),
      satisfaction: mean((ratings.get(agent.id) ?? []).flatMap(record => record.rating ?? [])),
    }
  })
}
