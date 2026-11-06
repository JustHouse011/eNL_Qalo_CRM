import type { Conversation, DemoData } from '../data/demoData'
import { aggregateCases, dayKey } from './reporting'
import { areaLabels } from './business'
import type { WorkspaceAgent, WorkspaceDepartment } from './workspaceTypes'

export type DashboardCount = { key: string; name: string; value: number }
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
/** Read-only presentation selector over the already workspace/department-scoped data. */
export function dashboardSummary(data: DemoData, from: string, to: string, banking: boolean, departments: WorkspaceDepartment[], agents: WorkspaceAgent[]) {
  const records = [...new Map(data.conversations.map(c => [c.id, c])).values()].filter(c => (!from || dayKey(c.createdAt) >= from) && (!to || dayKey(c.createdAt) <= to))
  const duration = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 60000
  const responses = records.flatMap(c => {
    const start = c.messages.find(m => m.kind === 'customer')
    const reply = c.messages.find(m => m.kind === 'agent' && start && Date.parse(m.time) >= Date.parse(start.time))
    const value = start && reply ? duration(start.time, reply.time) : NaN
    return Number.isFinite(value) && value >= 0 ? [value] : []
  })
  const resolutions = records.flatMap(c => {
    const value = c.status === 'resolved' && c.resolvedAt ? duration(c.createdAt, c.resolvedAt) : NaN
    return Number.isFinite(value) && value >= 0 ? [value] : []
  })
  const ratings = records.flatMap(c => typeof c.satisfaction === 'number' && c.satisfaction >= 1 && c.satisfaction <= 5 ? [c.satisfaction] : [])
  const count = (key: (c: Conversation) => string, label: (key: string) => string = key => key): DashboardCount[] => Object.entries(records.reduce<Record<string, number>>((all, c) => { const name = key(c); all[name] = (all[name] || 0) + 1; return all }, {})).map(([key, value]) => ({ key, name: label(key), value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  const areas = banking
    ? count(c => c.departmentId || c.department || 'Unclassified', key => departments.find(d => d.id === key)?.name || key)
    : count(c => c.businessArea || 'general', key => areaLabels[key as keyof typeof areaLabels] || key)
  const categories = count(c => c.category?.trim() || 'Unclassified').slice(0, 5)
  const channels = count(c => c.channel)
  const open = records.filter(c => c.status !== 'resolved')
  const workloads = new Map<string, { key: string; name: string; initials: string; value: number }>()
  workloads.set('unassigned', { key: 'unassigned', name: 'Unassigned cases', initials: '?', value: 0 })
  for (const c of open) {
    const agent = agents.find(a => c.assigneeId ? a.id === c.assigneeId : a.name === c.assignee)
    const key = !c.assigneeId && !c.assignee ? 'unassigned' : agent?.id || 'other'
    const row = workloads.get(key) || { key, name: agent?.name || 'Other workspace assignments', initials: agent?.initials || '—', value: 0 }
    row.value++; workloads.set(key, row)
  }
  return {
    records, areas, categories, channels, workloads: [...workloads.values()],
    open: open.length,
    unassigned: open.filter(c => !c.assignee && !c.assigneeId).length,
    waiting: records.filter(c => c.status === 'waiting').length,
    resolved: records.filter(c => c.status === 'resolved').length,
    escalations: records.filter(c => c.tags.includes('Escalated') || c.priority === 'urgent').length,
    awaiting: banking ? (data.bankingCases || []).filter(c => c.status === 'Awaiting Documents' && (!from || dayKey(c.createdAt) >= from) && (!to || dayKey(c.createdAt) <= to)).length : records.filter(c => c.onboardingStage === 'Awaiting documents' || c.tags.includes('Awaiting documents')).length,
    backlog: data.tickets.filter(t => !['Resolved', 'Closed'].includes(t.status)).length,
    response: mean(responses), resolution: mean(resolutions), satisfaction: mean(ratings), ratingCount: ratings.length,
  }
}
export function dashboardActivity(records: Conversation[], from: string, to: string) { return aggregateCases(records, from, to) }

/** Quote CSV fields and neutralize spreadsheet formulas, including whitespace prefixes. */
export function dashboardCsv(rows: readonly (readonly (string | number)[])[]) {
  return rows.map(row => row.map(value => {
    const text = String(value)
    const safe = /^\s*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text
    return `"${safe.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
}
