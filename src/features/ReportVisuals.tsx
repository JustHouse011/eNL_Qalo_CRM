import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowDownUp, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { bucketLabel, formatResponse, formatSatisfaction, type agentReport, type ReportBucket, type ReportGroup, type ReportRecord } from '../lib/reportDashboard'

const dateFormatter = new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const reportDateLabel = (date: string) => dateFormatter.format(new Date(date + 'T12:00:00Z'))
const percent = (part: number, total: number) => total ? Math.round(part / total * 100) + '%' : '—'
const colors = ['var(--report-deep)', 'var(--report-mid)', 'var(--report-soft)', 'var(--report-other)']

export function ReportCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const id = useId()
  return <section className="analytics-card" aria-labelledby={id}>
    <header><h2 id={id}>{title}</h2><p>{subtitle}</p></header>
    {children}
  </section>
}
export function ReportEmpty({ children = 'No records for this period and filters.' }: { children?: ReactNode }) {
  return <p className="analytics-empty" role="status">{children}</p>
}

export function ReportTrend({ title, buckets, onBucket }: { title: string; buckets: ReportBucket[]; onBucket: (bucket: ReportBucket) => void }) {
  const fillId = useId()
  const created = buckets.some(bucket => bucket.created > 0)
  const resolved = buckets.some(bucket => bucket.resolved > 0)
  const axis = { fill: 'var(--muted)', fontSize: 10 }
  return <ReportCard title={title} subtitle="Created records and first recorded resolution in the period.">
    {!created && !resolved ? <ReportEmpty>No dated activity for this period and filters.</ReportEmpty> : <>
      <div className="analytics-chart">
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} onClick={state => {
            const bucket = buckets.find(item => item.date === state.activeLabel)
            if (bucket && (bucket.created || bucket.resolved)) onBucket(bucket)
          }}>
            <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--report-mid)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--report-mid)" stopOpacity={0.03} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" tickFormatter={reportDateLabel} tick={axis} minTickGap={18} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
            <YAxis allowDecimals={false} width={29} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip labelFormatter={value => reportDateLabel(String(value))} contentStyle={{ background: 'var(--surface-strong)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8 }} itemStyle={{ color: 'var(--text)' }} />
            {created && <Area type="monotone" name="Created" dataKey="created" stroke="var(--report-mid)" strokeWidth={2} fill={`url(#${fillId})`} isAnimationActive={false} activeDot={{ r: 4 }} />}
            {resolved && <Area type="monotone" name="Resolved" dataKey="resolved" stroke="var(--report-deep)" strokeWidth={2.5} fill="transparent" isAnimationActive={false} activeDot={{ r: 4 }} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="analytics-legend">{created && <span><i style={{ background: 'var(--report-mid)' }} />Created</span>}{resolved && <span><i style={{ background: 'var(--report-deep)' }} />Resolved</span>}</div>
      {(!created || !resolved) && <p className="analytics-note">{created ? 'No dated resolutions in scope.' : 'No dated creations in scope.'}</p>}
      <details><summary>View trend data</summary><div className="analytics-scroll analytics-trend-data"><table>
        <thead><tr><th>Period</th><th>Created</th><th>Resolved</th></tr></thead>
        <tbody>{buckets.map(bucket => <tr key={bucket.date}><th scope="row">{bucket.created || bucket.resolved ? <button className="analytics-text-button" type="button" onClick={() => onBucket(bucket)}>{bucketLabel(bucket)}</button> : bucketLabel(bucket)}</th><td>{bucket.created}</td><td>{bucket.resolved}</td></tr>)}</tbody>
      </table></div></details>
    </>}
  </ReportCard>
}

export function ReportDonut({ title, subtitle, rows, resolution = false, onSelect }: {
  title: string; subtitle: string; rows: ReportGroup[]; resolution?: boolean; onSelect?: (key: string) => void
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  let offset = 0
  const stops: string[] = []
  for (const [index, row] of rows.entries()) {
    const start = offset
    offset += row.value / total * 100
    stops.push(`${colors[index % colors.length]} ${start}% ${offset}%`)
  }
  return <ReportCard title={title} subtitle={subtitle}>
    {total ? <div className="analytics-donut-layout">
      <div className="analytics-donut" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div><strong>{resolution ? percent(rows.find(row => row.key === 'Resolved')?.value ?? 0, total) : total}</strong><span>{resolution ? `Resolved · ${total} total` : 'Total'}</span></div>
      </div>
      <ul className="analytics-outcomes">{rows.map((row, index) => <li key={row.key}>
        <i style={{ background: colors[index % colors.length] }} />
        {onSelect ? <button className="analytics-text-button" type="button" onClick={() => onSelect(row.key)}>{row.name}</button> : <span>{row.name}</span>}
        <strong>{row.value}</strong><small>{percent(row.value, total)}</small>
      </li>)}</ul>
    </div> : <ReportEmpty />}
  </ReportCard>
}

export function ReportBars({ title, subtitle, rows, onSelect }: { title: string; subtitle: string; rows: ReportGroup[]; onSelect?: (key: string) => void }) {
  const top = Math.max(1, ...rows.map(row => row.value))
  return <ReportCard title={title} subtitle={subtitle}>
    {rows.length ? <ul className="analytics-bars">{rows.map(row => {
      const content = <><span>{row.name}</span><span className="analytics-bar-track" aria-hidden="true"><i style={{ width: (row.value / top * 100) + '%' }} /></span><strong>{row.value}</strong></>
      return <li key={row.key}>{onSelect ? <button type="button" title={`${row.name}: ${row.value}`} onClick={() => onSelect(row.key)}>{content}</button> : <div>{content}</div>}</li>
    })}</ul> : <ReportEmpty />}
  </ReportCard>
}

const agentColumns = [
  ['name', 'Agent'], ['assigned', 'Assigned'], ['resolved', 'Resolved'], ['open', 'Open'],
  ['rate', 'Resolution rate'], ['response', 'Avg. response'], ['satisfaction', 'CSAT'],
] as const
type SortKey = typeof agentColumns[number][0]
type AgentRow = ReturnType<typeof agentReport>[number]
export function ReportAgentTable({ rows, onAgent }: { rows: AgentRow[]; onAgent: (row: AgentRow) => void }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'assigned', descending: true })
  const sorted = rows.filter(row => row.agent.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => {
    const nameOrder = a.agent.name.localeCompare(b.agent.name)
    if (sort.key === 'name') return sort.descending ? -nameOrder : nameOrder
    const left = a[sort.key], right = b[sort.key]
    if (left === undefined || right === undefined) return Number(left === undefined) - Number(right === undefined) || nameOrder
    return (sort.descending ? right - left : left - right) || nameOrder
  })
  return <ReportCard title="Agent Performance" subtitle="Current assignments and outcomes for records created in this period.">
    <label className="analytics-agent-search crm-field-group"><Search size={15} aria-hidden="true" /><span className="sr-only">Search report agents</span><input type="search" placeholder="Find an agent" value={search} onChange={event => setSearch(event.target.value)} /></label>
    {sorted.length ? <div className="analytics-scroll"><table>
      <thead><tr>{agentColumns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.descending ? 'descending' : 'ascending' : undefined}>
        <button type="button" onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : key !== 'name' })}>{label}<ArrowDownUp size={11} aria-hidden="true" /></button>
      </th>)}</tr></thead>
      <tbody>{sorted.map(row => <tr key={row.agent.id}>
        <th scope="row"><button type="button" className="analytics-text-button analytics-agent-name" onClick={() => onAgent(row)}><i aria-hidden="true">{row.agent.initials}</i>{row.agent.name}</button></th>
        <td>{row.assigned}</td><td>{row.resolved}</td><td>{row.open}</td>
        <td><span className="analytics-rate">{percent(row.resolved, row.assigned)}</span></td>
        <td>{formatResponse(row.response)}</td><td>{formatSatisfaction(row.satisfaction)}</td>
      </tr>)}</tbody>
    </table></div> : <ReportEmpty>No agents match this scope.</ReportEmpty>}
  </ReportCard>
}

const routes: Record<ReportRecord['kind'], [string, string]> = { ticket: ['/tickets', 'ticket'], complaint: ['/complaints', 'case'], conversation: ['/inbox', 'conversation'], application: ['/pipeline', 'case'], account: ['/account-support', 'case'] }
export function ReportDetails({ title, rows, close }: { title: string; rows: ReportRecord[]; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="analytics-details" aria-labelledby={id} onCancel={event => { event.preventDefault(); close() }}>
    <header><div><h2 id={id}>{title}</h2><p>{rows.length} records within the selected report filters</p></div><button type="button" className="icon-button" aria-label="Close report details" onClick={close}><X size={18} /></button></header>
    {rows.length ? <div className="analytics-scroll"><table><thead><tr><th>Reference</th><th>Record type</th><th>Created</th><th>Status</th></tr></thead>
      <tbody>{rows.map(row => {
        const [route, parameter] = routes[row.kind]
        const link = route + '?' + parameter + '=' + encodeURIComponent(row.id)
        return <tr key={row.kind + row.id}><th scope="row"><Link to={link}>{row.reference}</Link></th><td>{row.kind}</td><td>{row.created || 'Not recorded'}</td><td>{row.status}</td></tr>
      })}</tbody>
    </table></div> : <ReportEmpty />}
  </dialog>
}
