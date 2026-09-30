import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ModuleProps } from './Knowledge'
import { areaLabels } from '../lib/business'
import { useBusinessArea } from './BusinessArea'
import { aggregateCases, dayKey, period } from '../lib/reporting'

const chartColors: Record<string, string> = { community: '#933F98', store: '#8CCDAB', general: '#DE752E' }
const chartAreaLabels: Record<string, string> = { community: 'Community Investment', store: 'Qalo Store', general: 'General & Technical' }
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
const dateKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
const monthKey = (value: string) => value.slice(0, 7)
const monthDate = (value: string) => { const [year, month] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, 1, 12)) }
const displayDate = (value: string) => new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`))

function ReportDatePicker({ id, label, value, min, max, onChange }: { id: string; label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  const today = dayKey(new Date())
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(monthKey(value || today))
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const month = monthDate(visibleMonth)
  const year = month.getUTCFullYear()
  const monthNumber = month.getUTCMonth() + 1
  const monthTitle = new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(month)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const days = Array.from({ length: 42 }, (_, index) => dateKey(new Date(Date.UTC(year, monthNumber - 1, 1 - firstWeekday + index, 12))))
  const todayDisabled = (!!min && today < min) || (!!max && today > max)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => { if (!pickerRef.current?.contains(event.target as Node)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  function shiftMonth(amount: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12))
    setVisibleMonth(dateKey(next).slice(0, 7))
  }

  function choose(date: string) {
    onChange(date)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div className="report-date-field">
    <span className="report-date-label" id={`${id}-label`}>{label}</span>
    <div className="report-date-picker" ref={pickerRef}>
      <button ref={triggerRef} id={`${id}-trigger`} className="report-date-trigger" type="button" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setVisibleMonth(monthKey(value || today)); setOpen(current => !current) }}>
        <span id={`${id}-value`}>{value ? displayDate(value) : 'yyyy/mm/dd'}</span><CalendarDays size={16} aria-hidden="true" />
      </button>
      {open && <div className={`report-date-popover${value ? ' has-value' : ''}`} role="dialog" aria-label={`${label} date picker`}>
        <div className="report-calendar-header"><button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button><strong>{monthTitle}</strong><button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button></div>
        <div className="report-calendar-weekdays" aria-hidden="true">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="report-calendar-days">{days.map(date => {
          const outsideMonth = monthKey(date) !== visibleMonth
          const disabled = (!!min && date < min) || (!!max && date > max)
          const accessibleDate = new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
          return <button key={date} type="button" className={`report-calendar-day${outsideMonth ? ' outside-month' : ''}${date === value ? ' selected' : ''}${date === today ? ' today' : ''}`} aria-label={accessibleDate} aria-pressed={date === value} aria-current={date === today ? 'date' : undefined} disabled={disabled} onClick={() => choose(date)}>{Number(date.slice(-2))}</button>
        })}</div>
        <div className="report-calendar-actions"><button type="button" onClick={() => choose('')}>Clear</button><button type="button" disabled={todayDisabled} onClick={() => choose(today)}>Today</button></div>
      </div>}
    </div>
  </div>
}

export function SupportReports({ data, overview = false }: ModuleProps & { overview?: boolean }) {
  const { area } = useBusinessArea()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [activityRange, setActivityRange] = useState<7 | 30>(7)
  const records = useMemo(() => [...new Map(data.conversations.map(c => [c.id, c])).values()].filter(c => (!from || dayKey(c.createdAt) >= from) && (!to || dayKey(c.createdAt) <= to)), [data.conversations, from, to])
  const activityPeriod = period(activityRange, to || undefined)
  const activity = useMemo(() => aggregateCases(data.conversations, from || activityPeriod.from, to || activityPeriod.to), [data.conversations, from, to, activityPeriod.from, activityPeriod.to])
  const areas = Object.entries(records.reduce<Record<string, number>>((counts, c) => { const key = c.businessArea || 'general'; counts[key] = (counts[key] || 0) + 1; return counts }, {})).map(([key, value]) => ({ key, name: chartAreaLabels[key] || areaLabels[key as keyof typeof areaLabels] || key, value })).sort((a, b) => b.value - a.value)
  const categoryCounts = Object.entries(records.reduce<Record<string, number>>((counts, c) => { const key = c.category?.trim() || 'Unclassified'; counts[key] = (counts[key] || 0) + 1; return counts }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5)
  const areaTotal = areas.reduce((sum, entry) => sum + entry.value, 0)
  const responses = records.flatMap(c => { const start = c.messages.find(m => m.kind === 'customer'); const reply = c.messages.find(m => m.kind === 'agent' && start && Date.parse(m.time) >= Date.parse(start.time)); return start && reply ? [(Date.parse(reply.time) - Date.parse(start.time)) / 60000] : [] })
  const resolutions = records.flatMap(c => c.status === 'resolved' && c.resolvedAt ? [(Date.parse(c.resolvedAt) - Date.parse(c.createdAt)) / 60000] : [])
  const satisfaction = records.flatMap(c => c.satisfaction ? [c.satisfaction] : [])
  const mean = (values: number[], suffix: string) => values.length ? `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}${suffix}` : 'Not recorded'
  const metrics: [string, string | number][] = [
    ['Open conversations', records.filter(c => c.status !== 'resolved').length], ['Unassigned enquiries', records.filter(c => !c.assignee && c.status !== 'resolved').length], ['Waiting cases', records.filter(c => c.status === 'waiting').length], ['Resolved cases', records.filter(c => c.status === 'resolved').length], ['Escalations', records.filter(c => c.tags.includes('Escalated') || c.priority === 'urgent').length], ['First response time', mean(responses, ' min')], ['Resolution time', mean(resolutions, ' min')], ['Satisfaction', mean(satisfaction, ' / 5')], ['Awaiting documents', records.filter(c => c.onboardingStage === 'Awaiting documents' || c.tags.includes('Awaiting documents')).length], ['Ticket backlog (all dates)', data.tickets.filter(t => t.status !== 'Resolved').length],
  ]
  const group = (field: 'businessArea' | 'category' | 'channel') => Object.entries(records.reduce<Record<string, number>>((counts, c) => { const label = field === 'businessArea' ? areaLabels[c.businessArea || 'general'] : c[field] || 'Unclassified'; counts[label] = (counts[label] || 0) + 1; return counts }, {}))
  function exportReport() { const rows = [['Scope', areaLabels[area]], ['From', from || 'All dates'], ['To', to || 'All dates'], ['Metric', 'Value'], ...metrics, ...group('businessArea'), ...group('category'), ...group('channel')]; const content = rows.map(row => row.map(v => `"${String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'support-report.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  return <div className="module-page enhanced"><div className="module-heading"><div><span className="eyebrow">{areaLabels[area]}</span><h1>{overview ? 'Support overview' : 'Reports'}</h1>{!overview && <p>Understand support activity across Community Investment and Qalo Store.</p>}</div><button className="button-secondary report-export-button" onClick={exportReport}>Export report</button></div><div className="form-grid"><ReportDatePicker id="report-from" label="From" value={from} max={to || undefined} onChange={setFrom} /><ReportDatePicker id="report-to" label="To" value={to} min={from || undefined} onChange={setTo} /></div><div className="report-grid">{metrics.map(([label, value]) => <article className="report-metric glass-panel glass-gradient-border glass-gradient-border-animated" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="report-charts">
      <section className="glass-panel report-chart report-activity glass-gradient-border glass-gradient-border-animated" aria-labelledby="activity-title">
        <div className="report-chart-heading"><div><h2 id="activity-title">Support activity</h2><p>New cases by creation date; resolved cases by resolution event date.</p></div><div className="segmented-control" role="group" aria-label="Support activity date range"><button className={activityRange === 7 ? 'selected' : ''} aria-pressed={activityRange === 7} onClick={() => setActivityRange(7)}>7 days</button><button className={activityRange === 30 ? 'selected' : ''} aria-pressed={activityRange === 30} onClick={() => setActivityRange(30)}>30 days</button></div></div>
        {activity.days.some(d => d.newCases || d.resolved) ? <><div className="report-line-chart"><ResponsiveContainer width="100%" height={220}><LineChart data={activity.days} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={24} /><YAxis allowDecimals={false} width={34} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip labelFormatter={value => dateLabel(String(value))} formatter={(value, name) => [value, name === 'newCases' ? 'New cases' : 'Resolved cases']} contentStyle={{ color: 'var(--text)', background: 'var(--surface-strong)', border: '1px solid var(--line-strong)', borderRadius: 6 }} labelStyle={{ color: 'var(--text)' }} itemStyle={{ color: 'var(--text)' }} /><Line isAnimationActive={false} type="monotone" dataKey="newCases" name="New cases" stroke="var(--chart-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--chart-primary)', stroke: 'var(--surface-strong)', strokeWidth: 2 }} /><Line isAnimationActive={false} type="monotone" dataKey="resolved" name="Resolved cases" stroke="var(--chart-secondary)" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4, fill: 'var(--chart-secondary)', stroke: 'var(--surface-strong)', strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div><div className="report-chart-legend"><span><i className="legend-purple" />New cases</span><span><i className="legend-mint" />Resolved cases</span></div><details className="chart-data"><summary>View data</summary><div className="chart-data-scroll"><table><thead><tr><th>Date</th><th>New cases</th><th>Resolved events</th></tr></thead><tbody>{activity.days.map(d => <tr key={d.date}><th scope="row">{dateLabel(d.date)}</th><td>{d.newCases}</td><td>{d.resolved}</td></tr>)}</tbody></table></div></details></> : <p className="chart-empty" role="status">No support activity in this date range.</p>}
      </section>
      <section className="glass-panel report-chart glass-gradient-border glass-gradient-border-animated" aria-labelledby="area-chart-title">
        <div className="report-chart-heading"><div><h2 id="area-chart-title">Enquiries by business area</h2><p>Unique conversations created in the selected date range.</p></div></div>
        {areas.length ? <><div className="report-donut-wrap"><ResponsiveContainer width="100%" height={190}><PieChart><Pie isAnimationActive={false} data={areas} dataKey="value" nameKey="name" innerRadius={57} outerRadius={78} paddingAngle={areas.length > 1 ? 3 : 0} stroke="none">{areas.map(entry => <Cell key={entry.key} fill={chartColors[entry.key] || '#933F98'} />)}</Pie><Tooltip formatter={(value, name) => [value, name]} contentStyle={{ color: 'var(--text)', background: 'var(--surface-strong)', border: '1px solid var(--line-strong)', borderRadius: 6 }} itemStyle={{ color: 'var(--text)' }} /></PieChart></ResponsiveContainer><div className="report-donut-total" aria-hidden="true"><strong>{areaTotal}</strong><span>Total</span></div></div><ul className="report-area-legend">{areas.map(entry => <li key={entry.key}><span><i style={{ background: chartColors[entry.key] || '#933F98' }} />{entry.name}</span><strong>{entry.value}</strong></li>)}</ul><details className="chart-data"><summary>View data</summary><div className="chart-data-scroll"><table><thead><tr><th>Business area</th><th>Conversations</th></tr></thead><tbody>{areas.map(entry => <tr key={entry.key}><th scope="row">{entry.name}</th><td>{entry.value}</td></tr>)}</tbody></table></div></details></> : <p className="chart-empty" role="status">No enquiries in this date range.</p>}
      </section>
      <section className="glass-panel report-chart glass-gradient-border glass-gradient-border-animated" aria-labelledby="category-chart-title">
        <div className="report-chart-heading"><div><h2 id="category-chart-title">Top enquiry categories</h2><p>{areaLabels[area]} · top five by conversation count.</p></div></div>
        {categoryCounts.length ? <><div className="report-category-list">{categoryCounts.map(entry => <div className="report-category-row" key={entry.name} tabIndex={0} role="img" aria-label={`${entry.name}: ${entry.value} enquiries`}><div className="report-category-label"><span>{entry.name}</span><strong>{entry.value}</strong></div><div className="report-category-track"><i style={{ width: `${Math.max(4, entry.value / categoryCounts[0].value * 100)}%` }} /></div></div>)}</div><details className="chart-data"><summary>View data</summary><div className="chart-data-scroll"><table><thead><tr><th>Category</th><th>Conversations</th></tr></thead><tbody>{categoryCounts.map(entry => <tr key={entry.name}><th scope="row">{entry.name}</th><td>{entry.value}</td></tr>)}</tbody></table></div></details></> : <p className="chart-empty" role="status">No enquiry categories in this date range.</p>}
      </section>
    </div>
    <div className="report-breakdowns"><section className="glass-panel record-card glass-gradient-border glass-gradient-border-static"><h2>Volume by channel</h2>{group('channel').map(([label, count]) => <div className="volume-row" key={label}><span>{label}</span><meter min="0" max={Math.max(records.length, 1)} value={count} aria-label={label} /><strong>{count}</strong></div>)}</section></div><section className="glass-panel record-card"><h2>Agent workload</h2>{Array.from(new Set(records.map(c => c.assignee || 'Unassigned'))).map(agent => <p key={agent}>{agent}: {records.filter(c => (c.assignee || 'Unassigned') === agent && c.status !== 'resolved').length} open</p>)}</section>{overview && <Link to="/inbox">Open shared inbox</Link>}</div>
}
