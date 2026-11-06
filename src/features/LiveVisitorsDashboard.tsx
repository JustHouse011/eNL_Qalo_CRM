import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, ArrowRight, BarChart3, ChevronLeft, ChevronRight, Clock3, Eye, Globe2, History, MessageCircle, RefreshCw, Search, Users, WifiOff, X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useWorkspace } from './WorkspaceContext'
import { dayKey } from '../lib/reporting'
import { visitorHistory, visitorRange, visitorStatus, visitorStatusLabels, visitorSummary, visitorTimeline, type VisitorDataset, type VisitorSession, type VisitorSort, type VisitorStatus, type VisitorTimeRange } from '../lib/visitorAnalytics'
import type { VisitorRepository } from '../lib/visitorRepository'
import { visitorSourceFor, visitorDemoMode } from '../lib/liveVisitorsData'
import './LiveVisitorsDashboard.css'

const ranges: [VisitorTimeRange, string][] = [['live', 'Live Now'], ['30m', 'Last 30 Minutes'], ['hour', 'Last Hour'], ['today', 'Today'], ['7days', 'Last 7 Days'], ['custom', 'Custom Date Range']]
const stamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Not recorded'
const percent = (value: number | null) => value === null ? 'Not recorded' : `${Number(value.toFixed(1))}%`
const number = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString('en-ZA')
function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timeout = window.setTimeout(() => setDebounced(value), 250); return () => window.clearTimeout(timeout) }, [value])
  return debounced
}
function useReducedVisitorMotion() {
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(preference.matches || document.documentElement.dataset.reducedMotion === 'true')
    const observer = new MutationObserver(update)
    update(); preference.addEventListener('change', update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    return () => { preference.removeEventListener('change', update); observer.disconnect() }
  }, [])
  return reduced
}
function Status({ status }: { status: VisitorStatus }) { return <span className={`lv-status lv-status-${status}`}><i aria-hidden="true" />{visitorStatusLabels[status]}</span> }
function Trend({ value }: { value: number | null }) {
  return <span className={`lv-trend ${value === null || value === 0 ? 'neutral' : value > 0 ? 'up' : 'down'}`}>{value === null ? 'No prior comparison' : value === 0 ? 'No change' : <>{value > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(value).toFixed(1)}%</>}</span>
}
function Card({ title, icon, children, className = '' }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`lv-card glass-panel ${className}`} aria-label={title}><header><h2>{title}</h2><span className="lv-card-icon" aria-hidden="true">{icon}</span></header>{children}</section>
}
function WeekTrend({ days, field, label }: { days: ReturnType<typeof visitorSummary>['days']; field: 'visitors' | 'pageViews' | 'answered'; label: string }) {
  const max = Math.max(1, ...days.map(d => d[field] ?? 0))
  return <div className="lv-week" aria-label={label}>{days.map(d => <div key={d.date} title={`${d.date}: ${d[field] ?? 'Unavailable'}`}><span>{d[field] === null ? <i className="lv-unknown-bar" /> : <i style={{ height: `${Math.max(0, (d[field] || 0) / max * 29)}px` }} />}</span><small>{new Intl.DateTimeFormat('en-ZA', { weekday: 'narrow', timeZone: 'Africa/Johannesburg' }).format(new Date(`${d.date}T12:00:00Z`))}</small><span className="lv-sr">{d.date}: {d[field] ?? 'Unavailable'}</span></div>)}</div>
}
function DateFields({ prefix, from, to, onFrom, onTo }: { prefix: string; from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  return <div className="lv-custom-dates"><label>{prefix} from<input type="date" value={from} max={to || undefined} onChange={e => onFrom(e.target.value)} /></label><label>{prefix} to<input type="date" value={to} min={from || undefined} onChange={e => onTo(e.target.value)} /></label></div>
}
const LiveVisitorsChart = memo(function LiveVisitorsChart({ data, now }: { data: VisitorDataset; now: number }) {
  const reducedMotion = useReducedVisitorMotion()
  const id = useId().replaceAll(':', '')
  const [range, setRange] = useState<VisitorTimeRange>('live')
  const [from, setFrom] = useState(dayKey(new Date(now)))
  const [to, setTo] = useState(from)
  const window = useMemo(() => visitorRange(range, now, from, to), [range, now, from, to])
  const timeline = useMemo(() => visitorTimeline(data, window), [data, window])
  const summary = useMemo(() => visitorSummary(data, now), [data, now])
  const validRange = range !== 'custom' || (!!from && !!to && from <= to)
  const available = data.tracking.state === 'connected' && data.tracking.presence
  const total = range === 'live' ? summary.active : available && validRange ? new Set(data.sessions.filter(s => s.workspaceId === data.workspaceId && s.lastSeenAt && Date.parse(s.lastSeenAt) >= window.from && Date.parse(s.firstSeenAt || s.lastSeenAt) <= window.to).map(s => s.visitorKey || s.id)).size : null
  const hasActivity = timeline.some(point => point.visitors > 0)
  return <section className="lv-chart-panel lv-card glass-panel" aria-labelledby="lv-chart-heading"><header><h2 id="lv-chart-heading"><Activity size={19} />Live Visitors</h2><label className="lv-range-label"><span className="lv-sr">Visitor activity period</span><select value={range} onChange={e => setRange(e.target.value as VisitorTimeRange)}>{ranges.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></header><div className="lv-live-count"><strong key={String(total)} className={total === null ? 'lv-unavailable-count' : ''}>{total === null ? '—' : number(total)}</strong><span>{range === 'live' ? 'visitors online now' : 'visitors in selected period'}</span><span className={`lv-connection ${available ? 'connected' : ''}`}><i />{available ? data.mode === 'fixture' ? data.simulation?.paused ? 'Paused' : 'Activity running' : 'Live' : data.tracking.state === 'reconnecting' ? 'Reconnecting' : 'Tracking unavailable'}</span></div>
    {range === 'custom' && <DateFields prefix="Chart" from={from} to={to} onFrom={setFrom} onTo={setTo} />}
    {!validRange ? <p role="alert" className="lv-chart-message">Choose a valid start and end date.</p> : !available ? <div className="lv-chart-placeholder"><div className="lv-grid-lines" aria-hidden="true"><i /><i /><i /><i /></div><div><WifiOff size={24} /><h3>Live tracking unavailable</h3><p>Visitor presence and activity have not been recorded.</p></div></div> : <div className="lv-chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timeline} margin={{ top: 20, right: 14, left: -20, bottom: 0 }}><defs><linearGradient id={`${id}-visitor-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--lv-green)" stopOpacity={.2} /><stop offset="100%" stopColor="var(--lv-green)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" /><XAxis type="number" domain={['dataMin', 'dataMax']} dataKey="at" scale="time" tickFormatter={at => new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', ...(window.to - window.from > 86400000 ? { day: 'numeric', month: 'short' } : { hour: '2-digit', minute: '2-digit' }) }).format(new Date(at))} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={35} /><YAxis allowDecimals={false} domain={[0, (maximum: number) => Math.max(1, maximum)]} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={42} /><Tooltip labelFormatter={at => stamp(new Date(Number(at)).toISOString())} contentStyle={{ background: 'var(--glass-overlay-solid)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }} /><Area type="monotone" dataKey="visitors" name="Visitors" stroke="var(--lv-green)" strokeWidth={2.5} fill={`url(#${id}-visitor-fill)`} dot={false} activeDot={{ r: 4 }} isAnimationActive={!reducedMotion} animationDuration={350} animationEasing="ease-in-out" /></AreaChart></ResponsiveContainer>{!hasActivity && <div className="lv-chart-zero"><Activity size={19} /><span>{range === 'live' ? 'No live visitors right now' : 'No visitor activity in this period'}</span></div>}</div>}
    <footer className="lv-chart-footer"><span><i />{available ? 'Visitor presence' : 'Awaiting visitor tracking'}</span><span>Africa/Johannesburg</span></footer>
  </section>
})

function ReportingCard({ summary }: { summary: ReturnType<typeof visitorSummary> }) {
  const { actorId, can } = useWorkspace()
  return <Card title="Reporting" icon={<BarChart3 size={19} />} className="lv-reporting"><div className="lv-reporting-metrics">{[['Positive Sentiment', summary.sentiment, 'Ratings of 4–5 out of all recorded 1–5 customer ratings.'], ['Engagement', summary.engagement, 'Sessions linked to a customer conversation divided by recorded sessions.'], ['Availability', summary.availability, 'Requires timestamped agent availability intervals.']] .map(([label, value, description]) => <div key={String(label)} title={String(description)}><div><span>{label}</span><strong>{percent(value as number | null)}</strong></div><div className="lv-progress" role="img" aria-label={`${label}: ${percent(value as number | null)}`}><i style={{ width: `${typeof value === 'number' ? value : 0}%` }} /></div></div>)}</div><div className="lv-card-foot">Today · recorded activity{can(actorId, 'manage-support') && <Link className="lv-more" to="/reports">More <ArrowRight size={13} /></Link>}</div></Card>
}
function VisitorCountry({ visitor }: { visitor: VisitorSession }) {
  const code = visitor.countryCode?.toUpperCase()
  const flag = code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(char => char.charCodeAt(0) + 127397)) : null
  return <span className="lv-country">{flag ? <span aria-hidden="true">{flag}</span> : <Globe2 size={14} aria-hidden="true" />}{visitor.country || 'Not recorded'}</span>
}
function VisitorDetailsDrawer({ visitor, data, now, onClose, onHistory }: { visitor: VisitorSession; data: VisitorDataset; now: number; onClose: () => void; onHistory: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [invitationPrepared, setInvitationPrepared] = useState(false)
  const conversation = data.conversations.find(c => c.id === visitor.conversationId && c.workspaceId === data.workspaceId)
  const views = [...new Map(data.pageViews.filter(v => v.workspaceId === data.workspaceId && v.sessionId === visitor.sessionId).map(v => [v.id, v])).values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => {
      if (element?.open) element.close()
      requestAnimationFrame(() => { if (previous?.isConnected) previous.focus() })
    }
  }, [])
  const fields = [['Visitor identifier', visitor.id.replace(/^demo-visitor-/i, 'visitor-')], ['Country', visitor.country], ['Approximate location', visitor.location], ['First visit', stamp(visitor.firstSeenAt)], ['Last activity', stamp(visitor.lastSeenAt)], ['Current page', visitor.page], ['Device type', visitor.device], ['Browser', visitor.browser], ['Operating system', visitor.operatingSystem], ['Referrer', visitor.referrer || visitor.source], ['Total page views', data.tracking.pageViews ? String(views.length) : undefined], ['Session duration', visitor.firstSeenAt && visitor.lastSeenAt ? `${Math.max(0, Math.round((Date.parse(visitor.lastSeenAt) - Date.parse(visitor.firstSeenAt)) / 60000))} minutes` : undefined]]
  return <dialog ref={dialog} className="lv-drawer" aria-labelledby={title} onCancel={onClose} onClick={e => { if (e.target === dialog.current) { const bounds = dialog.current.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right) onClose() } }}><div className="lv-drawer-body"><header><span>VISITOR DETAILS</span><button className="lv-icon-button" onClick={onClose} aria-label="Close visitor details"><X size={20} /></button></header><span className="lv-drawer-avatar"><Users size={25} /></span><h2 id={title}>{visitor.name || visitor.id}</h2><Status status={visitorStatus(visitor, data, now)} /><section><h3>Visitor overview</h3><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section><section><h3>Conversation</h3><dl><div><dt>Assigned agent</dt><dd>{conversation?.assignee || 'Unassigned'}</dd></div><div><dt>Status</dt><dd>{conversation?.status || 'No linked conversation'}</dd></div><div><dt>Last conversation activity</dt><dd>{stamp(conversation?.updatedAt)}</dd></div></dl>{conversation && data.mode !== 'fixture' && <Link className="button-primary" to={`/inbox?conversation=${encodeURIComponent(conversation.id)}`} onClick={onClose}><MessageCircle size={15} />Open Conversation</Link>}{conversation && data.mode === 'fixture' && <details className="lv-conversation-preview"><summary>Conversation preview</summary>{conversation.messages.filter(m => m.kind !== 'note').map(m => <article key={m.id}><strong>{m.author}</strong><p>{m.text}</p><time>{stamp(m.time)}</time></article>)}</details>}</section><section><h3>Recent activity</h3>{visitor.activity && <p>{visitor.activity}</p>}{views.length ? <ol className="lv-timeline">{views.slice(0, 30).map(view => <li key={view.id}><span>{view.page}</span><time dateTime={view.at}>{stamp(view.at)}</time></li>)}</ol> : <p className="lv-muted">No timestamped page activity recorded.</p>}</section><button className="button-secondary" onClick={onHistory}><History size={15} />View Visitor History</button><button className="button-secondary" disabled={invitationPrepared} onClick={() => setInvitationPrepared(true)}>Prepare invitation</button>{invitationPrepared && <p role="status">Invitation draft prepared</p>}</div></dialog>
}
function VisitorHistory({ data, now, refreshing, refresh }: { data: VisitorDataset; now: number; refreshing: boolean; refresh: () => void }) {
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState<'all' | 'today' | '7days' | 'custom'>('all')
  const [sort, setSort] = useState<VisitorSort>('recent')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [from, setFrom] = useState(dayKey(new Date(now)))
  const [to, setTo] = useState(from)
  const [selected, setSelected] = useState<string | null>(null)
  const validRange = range !== 'custom' || (!!from && !!to && from <= to)
  const window = useMemo<{ from?: number; to?: number }>(() => range === 'all' ? {} : range === 'custom' ? visitorRange(range, now, from, to) : { ...visitorRange(range, now, from, to), to: Date.parse(`${dayKey(new Date(now))}T23:59:59.999+02:00`) }, [range, now, from, to])
  const result = useMemo(() => visitorHistory(data, { search: debounced, status, sort, page, pageSize, ...window }, now), [data, debounced, status, sort, page, pageSize, window, now])
  const activeVisitor = data.sessions.find(v => v.id === selected && v.workspaceId === data.workspaceId)
  return <section className="lv-history lv-card glass-panel" aria-labelledby="lv-history-heading"><header className="lv-history-header"><div><span className="lv-card-icon"><History size={19} /></span><h2 id="lv-history-heading">Visitor History</h2><span className="lv-count-chip">{result.total}</span></div><button className="lv-refresh" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? 'lv-spinning' : ''} size={14} />{refreshing ? 'Refreshing' : 'Refresh'}</button></header><div className="lv-history-controls"><label className="lv-search"><Search size={16} /><span className="lv-sr">Search visitor history</span><input placeholder="Search visitors, locations or pages…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></label><label><span className="lv-sr">Visitor status</span><select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="all">All Visitors</option><option value="online">Online</option><option value="offline">Offline</option><option value="in-chat">In Chat</option></select></label><label><span className="lv-sr">History date range</span><select value={range} onChange={e => { setRange(e.target.value as typeof range); setPage(1) }}><option value="all">All dates</option><option value="today">Today</option><option value="7days">Last 7 Days</option><option value="custom">Custom Date Range</option></select></label><label><span className="lv-sr">Sort visitor history</span><select value={sort} onChange={e => { setSort(e.target.value as VisitorSort); setPage(1) }}><option value="recent">Most recent activity</option><option value="oldest">Oldest activity</option><option value="name">Visitor name</option><option value="status">Status</option></select></label></div>
    {range === 'custom' && <DateFields prefix="History" from={from} to={to} onFrom={value => { setFrom(value); setPage(1) }} onTo={value => { setTo(value); setPage(1) }} />}
    {!validRange ? <p role="alert" className="lv-table-empty">Choose a valid start and end date.</p> : <div className="lv-table-scroll" tabIndex={0} role="region" aria-label="Visitor history table"><table><thead><tr><th scope="col">Visitor</th><th scope="col">Country</th><th scope="col">Current Page</th><th scope="col">Agent</th><th scope="col">Status</th><th scope="col">Time</th></tr></thead><tbody>{result.rows.map(visitor => {
      const conversation = data.conversations.find(c => c.id === visitor.conversationId && c.workspaceId === data.workspaceId)
      return <tr key={visitor.id} onClick={() => setSelected(visitor.id)}><td><button className="lv-visitor-button" onClick={() => setSelected(visitor.id)} aria-label={`View visitor ${visitor.name || visitor.id}`}><span className="lv-table-avatar">{visitor.name?.split(' ').map(n => n[0]).slice(0, 2).join('') || '?'}</span><span>{visitor.name || visitor.id}<small>{visitor.location || 'Location not recorded'}</small></span></button></td><td><VisitorCountry visitor={visitor} /></td><td><span className="lv-page-path" title={visitor.page}>{visitor.page || 'Not recorded'}</span></td><td>{conversation?.assignee || <span className="lv-muted">Unassigned</span>}</td><td><Status status={visitorStatus(visitor, data, now)} /></td><td><time dateTime={visitor.lastSeenAt}>{stamp(visitor.lastSeenAt)}</time>{conversation && data.mode !== 'fixture' && <Link className="lv-row-conversation" to={`/inbox?conversation=${encodeURIComponent(conversation.id)}`} onClick={e => e.stopPropagation()} aria-label={`Open conversation for ${visitor.name}`}><MessageCircle size={14} /></Link>}{conversation && data.mode === 'fixture' && <button className="lv-row-conversation" onClick={e => { e.stopPropagation(); setSelected(visitor.id) }} aria-label={`Preview conversation for ${visitor.name}`}><MessageCircle size={14} /></button>}</td></tr>
    })}</tbody></table>{!result.total && <div className="lv-table-empty"><Search size={24} /><h3>{data.sessions.length ? 'No visitors match these filters' : 'No visitor history yet'}</h3><p>{data.sessions.length ? 'Try another search, status or date range.' : 'Recorded visitor sessions will appear here.'}</p>{data.sessions.length > 0 && <button className="button-secondary" onClick={() => { setSearch(''); setStatus('all'); setRange('all'); setPage(1) }}>Clear filters</button>}</div>}</div>}
    <footer className="lv-pagination"><span role="status">{result.total ? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total} visitors` : '0 visitors'}</span><div><label>Rows<select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><button className="lv-icon-button" aria-label="Previous visitor page" disabled={result.page === 1} onClick={() => setPage(result.page - 1)}><ChevronLeft size={17} /></button><span>{result.page} / {result.pages}</span><button className="lv-icon-button" aria-label="Next visitor page" disabled={result.page === result.pages} onClick={() => setPage(result.page + 1)}><ChevronRight size={17} /></button></div></footer>
    {activeVisitor && <VisitorDetailsDrawer key={activeVisitor.id} visitor={activeVisitor} data={data} now={now} onClose={() => setSelected(null)} onHistory={() => { setSearch(activeVisitor.name || activeVisitor.id); setRange('all'); setStatus('all'); setPage(1); setSelected(null) }} />}
  </section>
}
export function LiveVisitorsDashboard({ repository: providedRepository }: { repository?: VisitorRepository }) {
  const { workspaceId, actorId, registry, can } = useWorkspace()
  const repository = providedRepository || visitorSourceFor(workspaceId)
  const client = useQueryClient()
  const key = useMemo(() => ['live-visitors', workspaceId, actorId, !providedRepository && visitorDemoMode ? 'fixture' : 'recorded'], [workspaceId, actorId, providedRepository])
  const [now, setNow] = useState(() => Date.now())
  const workspace = registry?.workspaces.find(w => w.id === workspaceId)
  const permitted = !!workspaceId && can(actorId, 'reply')
  const query = useQuery({ queryKey: key, queryFn: async ({ signal }) => {
    const result = await repository.read(workspaceId, actorId, signal)
    if (result.workspaceId !== workspaceId) throw new Error('Visitor workspace could not be verified.')
    return result
  }, enabled: permitted, retry: 1, retryDelay: 1000, staleTime: 15000, refetchOnReconnect: true })
  useEffect(() => {
    if (!permitted) return
    return repository.subscribe(workspaceId, () => { void client.invalidateQueries({ queryKey: key, exact: true }) })
  }, [repository, workspaceId, permitted, client, key])
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(interval) }, [])
  const data = query.data?.workspaceId === workspaceId ? query.data : undefined
  const effectiveNow = data?.asOf ?? now
  const summary = useMemo(() => data ? visitorSummary(data, effectiveNow) : null, [data, effectiveNow])
  if (!permitted) return <section className="module-page"><h1>Live Visitors</h1><p role="alert">Visitor access is unavailable for this workspace.</p></section>
  return <div className="lv-dashboard" data-workspace={workspaceId}><header className="lv-page-heading"><div><span className="lv-eyebrow">{workspace?.name} <span>/</span> AUDIENCE</span><h1>Live Visitors</h1><p>A closer look at your visitors and the conversations that follow.</p></div><div className="lv-heading-actions">{data?.mode === 'fixture' && <><span className="lv-demo-indicator">Demo Data</span><button className="lv-simulation-toggle" onClick={() => repository.setPaused?.(workspaceId, !data.simulation?.paused)} aria-label={data.simulation?.paused ? 'Resume visitor activity simulation' : 'Pause visitor activity simulation'}>{data.simulation?.paused ? 'Resume activity' : 'Pause activity'}</button></>}<span className="lv-workspace-chip"><span />{workspace?.name}</span></div></header>
    {query.isPending ? <div className="lv-loading" role="status" aria-label="Loading visitor dashboard"><div className="lv-skeleton lv-loading-chart glass-panel" /><div className="lv-loading-stats">{[1, 2, 3, 4].map(n => <div className="lv-skeleton glass-panel" key={n} />)}</div><div className="lv-skeleton lv-loading-history glass-panel" /><span className="lv-sr">Loading visitor dashboard</span></div> : !data || !summary ? <div className="lv-error glass-panel" role="alert"><WifiOff size={30} /><h2>Visitor data unavailable</h2><p>{query.error?.message || 'The visitor records could not be loaded.'}</p><button className="button-primary" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={15} />{query.isFetching ? 'Reconnecting…' : 'Reconnect'}</button></div> : <>{query.isError && <div className="lv-reconnect-note" role="alert">Connection interrupted. Showing the last loaded records. <button onClick={() => void query.refetch()}>Reconnect</button></div>}<div className="lv-top-grid"><LiveVisitorsChart data={data} now={effectiveNow} /><div className="lv-stat-grid"><Card title="Visitors" icon={<Users size={19} />}><div className="lv-stat-value"><strong className={summary.visitors === null ? 'lv-text-value' : ''}>{number(summary.visitors)}</strong><Trend value={summary.visitorsChange} /></div><span className="lv-stat-caption">Today · unique visitors</span><WeekTrend days={summary.days} field="visitors" label="Visitor counts for the last seven days" /><div className="lv-card-foot">Last 7 days<span>{summary.visitors === null ? 'No tracking data' : 'vs previous day, same time'}</span></div></Card><Card title="Chats" icon={<MessageCircle size={19} />}><div className="lv-chat-counts"><div><strong>{number(summary.chats.answered)}</strong><span>Answered</span><Trend value={summary.answeredChange} /></div><div><strong>{number(summary.chats.missed)}</strong><span>Missed</span><Trend value={summary.missedChange} /></div></div><WeekTrend days={summary.days} field="answered" label="Answered conversations for the last seven days" /><div className="lv-card-foot">Last 7 days<span title="Missed requires an explicit missed-conversation event; pending requests are excluded.">{summary.days.reduce((sum, day) => sum + day.answered, 0)} answered · {summary.days.reduce((sum, day) => sum + day.missed, 0)} missed</span></div></Card><Card title="Page Views" icon={<Eye size={19} />}><div className="lv-stat-value"><strong className={summary.pageViews === null ? 'lv-text-value' : ''}>{number(summary.pageViews)}</strong><Trend value={summary.pageViewsChange} /></div><span className="lv-stat-caption">Today · page loads & navigation</span><WeekTrend days={summary.days} field="pageViews" label="Page views for the last seven days" /><div className="lv-card-foot">Last 7 days<span>{summary.pageViews === null ? 'No page-view data' : 'vs previous day, same time'}</span></div></Card><ReportingCard summary={summary} /></div></div><VisitorHistory key={workspaceId} data={data} now={effectiveNow} refreshing={query.isFetching} refresh={() => { setNow(Date.now()); void query.refetch() }} /><p className="lv-footnote"><Clock3 size={12} />Times shown in Africa/Johannesburg. Missing timestamps and metrics are shown as not recorded.</p></>}
  </div>
}
