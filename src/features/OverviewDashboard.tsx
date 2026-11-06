import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Download, Globe, Inbox, Mail, MessageCircle, Smile, Star, Users, Zap } from 'lucide-react'
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DemoData } from '../data/demoData'
import { period } from '../lib/reporting'
import { dashboardActivity, dashboardSummary, dashboardCsv } from '../lib/dashboardSummary'
import { areaLabels } from '../lib/business'
import { useBusinessArea } from './BusinessArea'
import { useWorkspace } from './WorkspaceContext'
import { ReportDatePicker } from './ReportDatePicker'
import './OverviewDashboard.css'

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
const format = (value: number | null) => value === null ? 'Not recorded' : value.toFixed(1)
const areaColors: Record<string, string> = { community: '#933F98', store: '#8CCDAB', general: '#DE752E' }
const bankColors = ['#652D8D', '#B59BD3', '#9d79bb', '#80708e', '#c9b5d9', '#51415e', '#a68db8']
const qaloColors = ['#933F98', '#8CCDAB', '#DE752E', '#3EAD53', '#FBBF16']
const tooltipStyle = { color: 'var(--text)', background: 'var(--surface-strong)', border: '1px solid var(--line-strong)', borderRadius: 12, fontFamily: 'Inter', fontWeight: 400 }
function Panel({ id, title, description, children, className = '', action }: { id: string; title: string; description: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return <section className={`dashboard-panel glass-panel ${className}`} aria-labelledby={id}><header><div><h2 id={id}>{title}</h2><p>{description}</p></div>{action}</header>{children}</section>
}
function Progress({ value, total, color }: { value: number; total: number; color?: string }) {
  return <div className="dashboard-progress" role="meter" aria-label="Share of enquiries" aria-valuenow={value} aria-valuemin={0} aria-valuemax={Math.max(total, 1)}><i style={{ width: `${total ? value / total * 100 : 0}%`, ...(color ? { background: color } : {}) }} /></div>
}
function Empty({ children }: { children: ReactNode }) { return <p className="dashboard-empty" role="status"><Inbox size={26} aria-hidden="true" />{children}</p> }
export function OverviewDashboard({ data, bankingSupplement, extraExportRows = [] }: { data: DemoData; bankingSupplement?: ReactNode; extraExportRows?: readonly (readonly [string, string | number])[] }) {
  const { workspaceId, registry, actorId, can } = useWorkspace()
  const workspace = registry?.workspaces.find(w => w.id === workspaceId)
  const banking = workspace?.supportMode === 'banking'
  const { area, departmentId } = useBusinessArea()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [preset, setPreset] = useState<7 | 30 | null>(null)
  const departments = useMemo(() => registry?.snapshots[workspaceId]?.departments || [], [registry, workspaceId])
  const agents = useMemo(() => registry?.snapshots[workspaceId]?.agents.filter(a => registry.memberships.some(m => m.workspaceId === workspaceId && m.userId === a.userId && m.status === 'active')) || [], [registry, workspaceId])
  const summary = useMemo(() => dashboardSummary(data, from, to, !!banking, departments, agents), [data, from, to, banking, departments, agents])
  const activityPeriod = period(preset || 7, to || undefined)
  const chartFrom = from || activityPeriod.from, chartTo = to || activityPeriod.to
  const activity = useMemo(() => dashboardActivity(data.conversations, chartFrom, chartTo), [data.conversations, chartFrom, chartTo])
  const gradientId = useId().replace(/:/g, '')
  const scope = departmentId ? departments.find(d => d.id === departmentId)?.name || 'Selected department' : banking ? 'All support departments' : areaLabels[area]
  const filtered = from || to
  const rangeLabel = filtered ? `${from ? dateLabel(from) : 'All dates'} – ${to ? dateLabel(to) : 'Today'}` : 'All dates'
  function selectPreset(days: 7 | 30) { const next = period(days); setFrom(next.from); setTo(next.to); setPreset(days) }
  const primary = [
    { label: 'Open conversations', value: String(summary.open), detail: `${summary.unassigned} unassigned`, badge: 'Active', icon: MessageCircle, tone: 'featured', unit: '' },
    { label: 'Unassigned enquiries', value: String(summary.unassigned), detail: 'Open conversations without an owner', badge: 'Needs an owner', icon: Users, tone: 'amber', unit: '' },
    { label: 'First response time', value: format(summary.response), detail: summary.response === null ? 'No response timestamps in this range' : 'Average first recorded response', icon: Zap, tone: 'blue', unit: summary.response === null ? '' : 'min' },
    { label: 'Satisfaction', value: format(summary.satisfaction), detail: summary.satisfaction === null ? 'No recorded customer ratings' : `${summary.ratingCount} recorded ${summary.ratingCount === 1 ? 'rating' : 'ratings'}`, icon: Smile, tone: 'green', unit: summary.satisfaction === null ? '' : '/ 5' },
  ]
  const secondary: [string, string | number][] = [['Waiting cases', summary.waiting], ['Resolved cases', summary.resolved], ['Escalations', summary.escalations], ['Resolution time', summary.resolution === null ? 'Not recorded' : `${format(summary.resolution)} min`], ['Awaiting documents', summary.awaiting], ['Ticket backlog (all dates)', summary.backlog]]
  function exportReport() {
    const rows: (readonly (string | number)[])[] = [['Workspace', workspace?.name || ''], ['Scope', scope], ['From', from || 'All dates'], ['To', to || 'All dates'], ['Activity from', chartFrom], ['Activity to', chartTo], ['Metric', 'Value'], ...primary.map(m => [m.label, `${m.value}${m.unit ? ` ${m.unit}` : ''}`]), ...secondary, ['Breakdown', 'Count'], ...summary.areas.map(r => [r.name, r.value]), ...summary.categories.map(r => [r.name, r.value]), ...summary.channels.map(r => [r.name, r.value]), ['Agent workload (open conversations)', 'Count'], ...summary.workloads.map(r => [r.name, r.value]), ...extraExportRows.map(([label, value]) => [`All dates · ${label}`, value])]
    const csv = dashboardCsv(rows)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), link = document.createElement('a'); link.href = url; link.download = banking ? 'enl-support-report.csv' : 'support-report.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const color = (key: string, index: number) => banking ? bankColors[index % bankColors.length] : areaColors[key] || qaloColors[index % qaloColors.length]
  return <div className={`module-page enhanced overview-dashboard ${banking ? 'dashboard-bank' : ''}`}>
    <header className="dashboard-heading"><div><span className="dashboard-scope">{scope}</span><h1>{banking ? 'eNL support dashboard' : 'Support overview'}</h1></div><div className="dashboard-controls"><div className="dashboard-dates"><ReportDatePicker id="dashboard-from" label="From" value={from} max={to || undefined} onChange={v => { setFrom(v); setPreset(null) }} /><ReportDatePicker id="dashboard-to" label="To" value={to} min={from || undefined} onChange={v => { setTo(v); setPreset(null) }} /></div><div className="dashboard-presets" role="group" aria-label="Support activity date range">{([7, 30] as const).map(days => <button key={days} aria-pressed={preset === days} onClick={() => selectPreset(days)}>{days} days</button>)}</div><button className="dashboard-export" onClick={exportReport}><Download size={15} aria-hidden="true" />{banking ? 'Export banking report' : 'Export report'}</button></div></header>
    <div className="dashboard-range"><span>Conversations created: {rangeLabel}</span>{filtered && <button onClick={() => { setFrom(''); setTo(''); setPreset(null) }}>Clear date filters</button>}<span>Ticket backlog uses all dates in the current scope.{banking ? ' Document waits count banking cases created in the selected range.' : ''}</span></div>
    <div className="dashboard-primary-grid">{primary.map((metric, index) => <article key={metric.label} aria-label={metric.label} className={`dashboard-kpi report-metric glass-panel tone-${metric.tone}`} style={{ '--card-index': index } as CSSProperties}><div className="dashboard-kpi-top"><span>{metric.label}</span><span className="dashboard-kpi-icon"><metric.icon size={18} aria-hidden="true" /></span></div><div className="dashboard-value"><strong className={metric.value === 'Not recorded' ? 'unavailable-value' : ''}>{metric.value}</strong>{metric.unit && <span>{metric.unit}</span>}{metric.badge && <span className="dashboard-status">{metric.badge}</span>}</div>{index === 3 && summary.satisfaction !== null && <div className="dashboard-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill={i < Math.round(summary.satisfaction!) ? 'currentColor' : 'none'} />)}</div>}<p>{metric.detail}</p></article>)}</div>
    <div className="dashboard-secondary-grid">{secondary.map(([label, value], index) => <article key={label} aria-label={label} className={`dashboard-secondary report-metric glass-panel secondary-${index}`} style={{ '--card-index': index + 4 } as CSSProperties}><span>{label}</span><strong className={value === 'Not recorded' ? 'unavailable-value' : ''}>{value}</strong></article>)}</div>
    <Panel id="dashboard-activity-title" title="Support activity" description={`New cases by creation date; resolved cases by resolution event date. ${dateLabel(chartFrom)} – ${dateLabel(chartTo)}.`} className="dashboard-activity" action={<span className="dashboard-chip">{activity.days.length} days</span>}>
      {activity.days.some(d => d.newCases || d.resolved) ? <><div className="dashboard-activity-chart" aria-label="New and resolved support cases"><ResponsiveContainer width="100%" height={256}><ComposedChart data={activity.days} margin={{ top: 18, right: 16, left: -20, bottom: 4 }}><defs><linearGradient id={`${gradientId}-activity`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand-purple)" stopOpacity={.24} /><stop offset="100%" stopColor="var(--brand-purple)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'Inter', fontWeight: 400 }} tickLine={false} axisLine={false} minTickGap={26} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={38} /><Tooltip labelFormatter={v => dateLabel(String(v))} contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text)' }} /><Area type="monotone" dataKey="newCases" name="New cases" stroke="none" fill={`url(#${gradientId}-activity)`} tooltipType="none" isAnimationActive={false} /><Line type="monotone" dataKey="newCases" name="New cases" stroke="var(--dashboard-chart-primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} /><Line type="monotone" dataKey="resolved" name="Resolved cases" stroke="var(--dashboard-chart-secondary)" strokeWidth={2.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div><div className="dashboard-chart-legend"><span><i />New cases</span><span><i />Resolved cases</span></div></> : <Empty>No support activity in this date range.</Empty>}
      <details className="dashboard-data"><summary>View activity data</summary><div><table><thead><tr><th>Date</th><th>New cases</th><th>Resolved events</th></tr></thead><tbody>{activity.days.map(d => <tr key={d.date}><th scope="row">{d.date}</th><td>{d.newCases}</td><td>{d.resolved}</td></tr>)}</tbody></table></div></details>
    </Panel>
    <div className="dashboard-insights-grid">
      <Panel id="dashboard-area-title" title={banking ? 'Enquiries by support department' : 'Enquiries by business area'} description="Unique conversations created in the selected date range." action={<span className="dashboard-chip">{summary.records.length} total</span>}>
        {summary.areas.length ? <div className="dashboard-donut-layout"><div className="dashboard-donut"><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={summary.areas} dataKey="value" nameKey="name" innerRadius={59} outerRadius={79} paddingAngle={summary.areas.length > 1 ? 4 : 0} stroke="none" isAnimationActive={false}>{summary.areas.map((r, i) => <Cell key={r.key} fill={color(r.key, i)} />)}</Pie><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text)' }} /></PieChart></ResponsiveContainer><div className="dashboard-donut-total" aria-hidden="true"><strong>{summary.records.length}</strong><span>Total</span></div></div><ul className="dashboard-area-legend">{summary.areas.map((r, i) => <li key={r.key}><span><i style={{ background: color(r.key, i) }} />{r.name}</span><strong>{r.value}</strong></li>)}</ul></div> : <Empty>No enquiries in this date range.</Empty>}
      </Panel>
      <Panel id="dashboard-categories-title" title="Top enquiry categories" description={`${scope}, top five by conversation count.`}>
        {summary.categories.length ? <div className="dashboard-bars">{summary.categories.map(r => <div key={r.key} className="dashboard-bar-row"><div><span>{r.name}</span><strong>{r.value}</strong></div><Progress value={r.value} total={summary.records.length} /></div>)}</div> : <Empty>No enquiry categories in this date range.</Empty>}
      </Panel>
      <Panel id="dashboard-channels-title" title="Volume by channel" description="Recorded inbound channels; connection status is not inferred.">
        {summary.channels.length ? <div className="dashboard-bars">{summary.channels.map(r => <div key={r.key} className="dashboard-bar-row"><div><span>{r.key === 'Email' ? <Mail size={16} aria-hidden="true" /> : <Globe size={16} aria-hidden="true" />}{r.name}</span><strong>{r.value} <small>{Math.round(r.value / summary.records.length * 100)}%</small></strong></div><Progress value={r.value} total={summary.records.length} color={r.key === 'Website' && !banking ? 'linear-gradient(90deg,#3EAD53,#8CCDAB)' : undefined} /></div>)}</div> : <Empty>No channel volume in this date range.</Empty>}
      </Panel>
      <Panel id="dashboard-workload-title" title="Agent workload" description="Open conversations created in the selected date range." action={can(actorId, 'reply') ? <Link to="/inbox" aria-label="Open shared inbox"><ArrowUpRight size={18} /></Link> : undefined}>
        <ul className="dashboard-workload">{summary.workloads.map(r => <li key={r.key}><span className={`dashboard-agent-avatar ${r.key === 'unassigned' ? 'is-unassigned' : ''}`}>{r.initials}</span><span>{r.name}</span><strong>{r.value}<small>open</small></strong></li>)}</ul>
      </Panel>
    </div>
    {bankingSupplement && <div className="dashboard-extra">{bankingSupplement}</div>}
    <p className="dashboard-footnote">{banking ? 'Banking support records only. No account balances or transaction processing.' : 'Support records in the current workspace and selected business scope.'} Activity uses recorded creation and resolution events.</p>
  </div>
}
