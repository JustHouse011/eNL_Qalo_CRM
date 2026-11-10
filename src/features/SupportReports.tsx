import { useMemo, useState, type KeyboardEvent } from 'react'
import { Activity, BarChart3, CircleCheck, Clock3, Download, ShieldCheck, Star, Ticket, Users, type LucideIcon } from 'lucide-react'
import { areaLabels, type AreaFilter } from '../lib/business'
import { dashboardCsv } from '../lib/dashboardSummary'
import { dayKey } from '../lib/reporting'
import { agentReport, bucketLabel, filterReport, formatResponse, formatSatisfaction, inRange, presetRange, previousReportRange, reportGroup, reportMetrics, reportSource, reportTrend, validRange, type DatePreset, type ReportBucket, type ReportFilters, type ReportGroup, type ReportRange, type ReportRecord, type ReportSource } from '../lib/reportDashboard'
import { useBusinessArea } from './BusinessArea'
import { ReportAgentTable, ReportBars, ReportDetails, ReportDonut, ReportTrend } from './ReportVisuals'
import { useWorkspace } from './WorkspaceContext'
import './SupportReports.css'

const sections = [
  { label: 'Support Performance', slug: 'support-performance', icon: Activity },
  { label: 'Ticket Reports', slug: 'ticket-reports', icon: Ticket },
  { label: 'Complaints', slug: 'complaints', icon: ShieldCheck },
  { label: 'Agent Performance', slug: 'agent-performance', icon: Users },
] as const
const presets: [DatePreset, string][] = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['last-month', 'Last month'], ['custom', 'Custom range']]
const days = (range: ReportRange) => range.from + ' – ' + range.to
const valueOptions = (records: ReportRecord[], field: 'channel' | 'category' | 'product') =>
  [...new Set(records.flatMap(record => record[field] || []))].sort().map(value => [value, value] as const)
const recordKey = (record: ReportRecord) => record.kind + ':' + record.id
type Options = readonly (readonly [string, string])[]
type Metric = { label: string; value: string | number; previous?: string | number; icon: LucideIcon; tone?: string; records?: ReportRecord[]; unavailable?: boolean }
type Breakdown = { title: string; subtitle: string; rows: ReportGroup[]; records: ReportRecord[]; keyFor: (record: ReportRecord) => string }
const outcomeOf = (record: ReportRecord) => record.outcome
const outcomeOrder = ['Resolved', 'Open / In progress', 'Escalated']
const areaOf = (record: ReportRecord) => record.area
const categoryOf = (record: ReportRecord) => record.category
const departmentOf = (record: ReportRecord) => record.departmentId || ''
const assigneeOf = (record: ReportRecord) => record.agentId || ''

export function SupportReports() {
  const { registry, workspaceId, actorId } = useWorkspace()
  const source = useMemo(() => registry && reportSource(registry, workspaceId, actorId), [registry, workspaceId, actorId])
  if (!source) return <section className="module-page"><h1>Reports &amp; Analytics</h1><p role="status">No authorised reporting data is available for this workspace.</p></section>
  return <ReportDashboard key={workspaceId} source={source} />
}

function Filter({ label, value, onChange, all, options }: { label: string; value: string; onChange: (value: string) => void; all?: string; options: Options }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>
    {all && <option value="">{all}</option>}
    {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
  </select></label>
}

function MetricCard({ metric, onSelect }: { metric: Metric; onSelect: () => void }) {
  const Icon = metric.icon
  const content = <>
    <span className="analytics-kpi-icon" aria-hidden="true"><Icon size={20} /></span>
    <span><span>{metric.label}</span><strong data-unavailable={metric.unavailable}>{metric.value}</strong>{metric.previous !== undefined && <small>vs. {metric.previous} in the previous period</small>}</span>
  </>
  return metric.records?.length
    ? <button type="button" className="analytics-kpi" data-tone={metric.tone} onClick={onSelect}>{content}</button>
    : <article className="analytics-kpi" data-tone={metric.tone}>{content}</article>
}

function ReportDashboard({ source }: { source: ReportSource }) {
  const { banking, workspace, agents, records } = source
  const { departmentId, setDepartmentId, area, setArea } = useBusinessArea()
  const [today] = useState(() => dayKey(new Date()))
  const [preset, setPreset] = useState<DatePreset>('30')
  const [custom, setCustom] = useState(() => presetRange('30', today))
  const [selectedTab, setTab] = useState(0)
  const [agent, setAgent] = useState('')
  const [category, setCategory] = useState('')
  const [product, setProduct] = useState('')
  const [channel, setChannel] = useState('')
  const [exportError, setExportError] = useState('')
  const [drill, setDrill] = useState<{ title: string; keys: Set<string> }>()
  const current = sections[selectedTab]
  const range = preset === 'custom' ? custom : presetRange(preset, today)
  const valid = validRange(range)
  const departments = useMemo(() => source.departments.filter(department => area === 'all' || department.area === area), [source.departments, area])
  const filters = useMemo<ReportFilters>(() => ({ department: departmentId, area, agent, category, product, channel }), [departmentId, area, agent, category, product, channel])
  const filtered = useMemo(() => filterReport(source, filters), [source, filters])
  const options = useMemo(() => ({ channels: valueOptions(records, 'channel'), categories: valueOptions(records, 'category'), products: valueOptions(records, 'product') }), [records])
  const data = useMemo(() => {
    const series = filtered.filter(record => selectedTab === 2 ? record.kind === 'complaint' :
      selectedTab === 3 ? record.kind !== 'conversation' : record.kind === 'ticket')
    const conversations = filtered.filter(record => record.kind === 'conversation')
    if (!valid) return null
    const activeRange = { from: range.from, to: range.to }
    const summary = reportMetrics(series, conversations, activeRange)
    const previous = reportMetrics(series, conversations, previousReportRange(activeRange))
    const applications = filtered.filter(record => record.kind === 'application' && inRange(record.created, activeRange))
    const agentRows = agentReport(agents.filter(item => !agent || item.id === agent), summary.cohort, summary.requests)
    const undated = series.filter(record => !record.created)
    const undatedResolutions = summary.cohort.filter(record => record.outcome === 'Resolved' && !record.resolutionDays.length).length
    return {
      series, summary, previous, applications, agentRows, undated, undatedResolutions, trend: reportTrend(series, activeRange),
      conversations, conversationTrend: selectedTab === 0 ? reportTrend(conversations, activeRange) : [],
    }
  }, [filtered, selectedTab, valid, range.from, range.to, agents, agent])

  function reset() {
    setPreset('30'); setCustom(presetRange('30', today)); setDepartmentId(''); setArea('all')
    setAgent(''); setCategory(''); setProduct(''); setChannel(''); setExportError(''); setDrill(undefined)
  }
  function inspect(title: string, rows: ReportRecord[]) {
    setDrill({ title, keys: new Set(rows.map(recordKey)) })
  }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = { ArrowRight: (index + 1) % sections.length, ArrowLeft: (index + sections.length - 1) % sections.length, Home: 0, End: sections.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setTab(next)
    event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus()
  }

  const toolbar = <>
    <div className="analytics-filters" aria-label="Report filters">
      <Filter label="Date range" value={preset} options={presets} onChange={value => setPreset(value as DatePreset)} />
      <Filter label="Department" value={filters.department} all="All departments" options={departments.some(item => item.id === departmentId) || !departmentId
        ? departments.map(item => [item.id, item.name]) : [...departments.map(item => [item.id, item.name] as const), [departmentId, 'Unavailable department']]} onChange={setDepartmentId} />
      {!banking ? <>
        <Filter label="Business area" value={area} options={Object.entries(areaLabels)} onChange={value => { setArea(value as AreaFilter); setDepartmentId('') }} />
        <Filter label="Channel" value={channel} all="All channels" options={options.channels} onChange={setChannel} />
      </> : <Filter label="Support category" value={category} all="All categories" options={options.categories} onChange={setCategory} />}
      <Filter label="Agent" value={agent} all="All agents" options={agents.map(item => [item.id, item.name])} onChange={setAgent} />
      {banking && options.products.length > 0 && <Filter label="Product" value={product} all="All products" options={options.products} onChange={setProduct} />}
      <button type="button" className="button-primary analytics-export" disabled={!data} onClick={download}><Download size={16} aria-hidden="true" /> Export report</button>
    </div>
    <div className="analytics-filter-meta">
      {preset === 'custom' ? <>
        <label>From<input type="date" value={custom.from} aria-invalid={!valid} aria-describedby={!valid ? 'analytics-date-error' : undefined} onChange={event => setCustom({ ...custom, from: event.target.value })} /></label>
        <label>To<input type="date" value={custom.to} aria-invalid={!valid} aria-describedby={!valid ? 'analytics-date-error' : undefined} onChange={event => setCustom({ ...custom, to: event.target.value })} /></label>
        {!valid && <p className="crm-field-message" id="analytics-date-error" role="alert">Enter a valid date range. From must be on or before To.</p>}
      </> : <span>{days(range)}</span>}
      <button type="button" className="analytics-text-button" onClick={reset}>Reset filters</button>
    </div>
  </>

  const metrics: Metric[] = []
  const breakdowns: Breakdown[] = []
  const outcomes = data ? reportGroup(data.summary.cohort, outcomeOf).sort((a, b) => outcomeOrder.indexOf(a.key) - outcomeOrder.indexOf(b.key)) : []
  const departmentNames = new Map(source.departments.map(item => [item.id, item.name]))
  const agentNames = new Map(agents.map(item => [item.id, item.name]))
  if (data) {
    const { summary, previous } = data
    const { cohort, requests, resolutions } = summary
    const complaints = selectedTab === 2
    const agentView = selectedTab === 3
    function count(label: string, rows: ReportRecord[], icon: LucideIcon, tone?: string, prior?: number) {
      metrics.push({ label, value: rows.length, previous: prior, icon, tone, records: rows })
    }
    function group(title: string, subtitle: string, rows: ReportRecord[], keyFor: (record: ReportRecord) => string, label?: (key: string) => string, limit?: number) {
      breakdowns.push({ title, subtitle, records: rows, keyFor, rows: reportGroup(rows, keyFor, label).slice(0, limit) })
    }
    if (complaints) {
      for (const [status, icon, tone] of [['New Complaints', Ticket, 'purple'], ['Open Investigations', Clock3, 'blue'], ['Escalations', ShieldCheck, 'amber'], ['Resolved Cases', CircleCheck, 'green']] as const) {
        count(status, cohort.filter(record => record.status === status), icon, tone)
      }
    } else if (selectedTab === 1) {
      count('New Tickets', cohort.filter(record => record.status === 'New'), Ticket)
      count('Open Tickets', cohort.filter(record => record.outcome !== 'Resolved'), Clock3, 'blue')
      count('Resolved Tickets', resolutions, CircleCheck, 'green', previous.resolutions.length)
      count('Unassigned Tickets', cohort.filter(record => !record.agentId), Users, 'amber')
    } else {
      count(agentView ? 'Assigned Support Records' : 'Total Tickets', agentView ? cohort.filter(record => record.agentId) : cohort, Ticket, undefined,
        agentView ? previous.cohort.filter(record => record.agentId).length : previous.cohort.length)
      count(agentView ? 'Resolved Assigned Records' : 'Resolved Tickets', agentView ? cohort.filter(record => record.agentId && record.outcome === 'Resolved') : resolutions, CircleCheck, 'green',
        agentView ? previous.cohort.filter(record => record.agentId && record.outcome === 'Resolved').length : previous.resolutions.length)
      metrics.push(
        { label: 'Average Response Time', value: formatResponse(summary.response), unavailable: summary.response === undefined, previous: summary.response !== undefined && previous.response !== undefined ? formatResponse(previous.response) : undefined, icon: Clock3, tone: 'blue', records: requests.filter(record => record.response !== undefined) },
        { label: 'Customer Satisfaction', value: formatSatisfaction(summary.satisfaction), unavailable: summary.satisfaction === undefined, previous: summary.satisfaction !== undefined && previous.satisfaction !== undefined ? formatSatisfaction(previous.satisfaction) : undefined, icon: Star, tone: 'amber', records: requests.filter(record => record.rating !== undefined) },
      )
    }
    group(complaints ? 'Complaint Department Assignment' : 'Department Workload', 'Records created in this period, grouped by current department.', cohort, departmentOf, key => departmentNames.get(key) ?? 'Unassigned department')
    if (selectedTab === 1 || complaints) {
      group(complaints ? 'Complaint Categories' : 'Ticket Categories', 'Recorded categories for the selected period.', cohort, categoryOf)
      group('Priority Distribution', 'Recorded priorities for the selected period.', cohort, record => record.priority || 'Unspecified', key => key[0].toUpperCase() + key.slice(1))
    }
    if (banking && selectedTab === 0) {
      group('Support Conversations', 'Conversations created in this period, grouped by support category.', requests, categoryOf)
    }
    if (selectedTab === 0 && (banking || data.applications.length)) {
      group('Application enquiries', 'Application support records created in this period.', data.applications, record => record.product || record.category)
    }
    if (!banking) {
      group('Top Enquiry Categories', 'Top five categories by conversation count.', requests, categoryOf, undefined, 5)
      group('Volume by Channel', 'Only channels recorded on these conversations.', requests, record => record.channel || 'Unclassified')
    }
    if (!complaints) {
      const workload = !banking ? requests : cohort
      group('Agent Workload', 'Currently open records created in this period, including unassigned work.', workload.filter(record => record.outcome !== 'Resolved'), assigneeOf, key => agentNames.get(key) ?? 'Unassigned')
    }
  }

  function download() {
    if (!data) return
    setExportError('')
    try {
      const scopeLabel = (options: Options, value: string, fallback: string) => options.find(([key]) => key === value)?.[1] ?? fallback
      const rows: (string | number)[][] = [
        ['Workspace', workspace.name], ['Report', current.label], ['From', range.from], ['To', range.to], ['Time zone', 'Africa/Johannesburg'],
        ['Department', departmentNames.get(filters.department) ?? (filters.department ? 'Unavailable' : 'All departments')], ['Agent', agentNames.get(agent) ?? 'All agents'],
        ...(banking ? [['Support category', category || 'All categories'], ['Product', product || 'All products']] : [['Business area', areaLabels[area]], ['Channel', scopeLabel(options.channels, channel, 'All channels')]]),
        [], ['Metric', 'Value', 'Previous period'], ...metrics.map(metric => [metric.label, metric.value, metric.previous ?? '']),
        ['Undated records excluded from created totals', data.undated.length], ['Resolved cohort records without a recorded resolution date', data.undatedResolutions],
        [], ['Period from', 'Period to', 'Created', 'Resolved'], ...data.trend.map(bucket => [bucket.date, bucket.to, bucket.created, bucket.resolved]),
        [], ['Current outcome', 'Records'], ...outcomes.map(row => [row.name, row.value]),
      ]
      if (selectedTab === 0) rows.push([], ['Conversation activity from', 'To', 'Created', 'Resolved'],
        ...data.conversationTrend.map(bucket => [bucket.date, bucket.to, bucket.created, bucket.resolved]))
      for (const item of breakdowns) rows.push([], [item.title, 'Records'], ...item.rows.map(row => [row.name, row.value]))
      if (!banking) rows.push([], ['Business area', 'Conversations'], ...reportGroup(data.summary.requests, areaOf, key => areaLabels[key as AreaFilter]).map(row => [row.name, row.value]))
      if (selectedTab !== 2) rows.push([], ['Agent', 'Assigned', 'Resolved', 'Open', 'Resolution rate', 'Average response', 'Customer satisfaction'],
        ...data.agentRows.map(row => [row.agent.name, row.assigned, row.resolved, row.open, row.rate === undefined ? 'Not available' : (row.rate * 100).toFixed(1) + '%', formatResponse(row.response), formatSatisfaction(row.satisfaction)]))
      const url = URL.createObjectURL(new Blob(['\uFEFF', dashboardCsv(rows)], { type: 'text/csv;charset=utf-8' }))
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = `${workspace.slug}-${current.slug}-${range.from}-to-${range.to}.csv`
        link.click()
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
    } catch {
      setExportError('The report could not be downloaded. Try again.')
    }
  }

  function inspectBucket(bucket: ReportBucket, series: ReportRecord[]) {
    const span = { from: bucket.date, to: bucket.to }
    inspect('Activity · ' + bucketLabel(bucket), series.filter(record =>
      inRange(record.created, span) || inRange(record.resolutionDays.find(date => inRange(date, range)) ?? '', span)))
  }

  const trendTitle = selectedTab === 2 ? 'Complaint Volume Trend' : selectedTab === 3 ? 'Support Record Volume Trend' : 'Ticket Volume Trend'
  const workload = breakdowns[0]
  return <section className="module-page enhanced analytics-page">
    <header className="analytics-hero">
      <div><span className="eyebrow">{banking ? 'eNL MUTUAL BANK · SUPPORT WORKSPACE' : 'QALO YA AFRIKA · INSIGHTS & PERFORMANCE'}</span>
        <h1>Reports &amp; Analytics</h1>
        <p>{banking ? 'Track support performance, service efficiency and customer experience across eNL Mutual Bank.' : 'Track support activity, service performance and operational trends across the Qalo Ya Afrika workspace.'}</p>
      </div>
      <span className="analytics-hero-icon" aria-hidden="true"><BarChart3 size={54} strokeWidth={1.6} /></span>
    </header>
    {toolbar}
    {banking && <div className="analytics-tabs" role="tablist" aria-label="Report sections">{sections.map(({ label, icon: Icon }, index) =>
      <button type="button" key={label} role="tab" id={`analytics-tab-${index}`} aria-controls="analytics-tab-panel" aria-selected={index === selectedTab} tabIndex={index === selectedTab ? 0 : -1} onClick={() => setTab(index)} onKeyDown={event => navigateTabs(event, index)}><Icon size={16} aria-hidden="true" />{label}</button>
    )}</div>}
    {exportError && <p className="analytics-error" role="alert">{exportError}</p>}
    {data &&
      <div className="analytics-content" id="analytics-tab-panel" role={banking ? 'tabpanel' : undefined} aria-labelledby={banking ? `analytics-tab-${selectedTab}` : undefined}>
        <div className="analytics-kpis">{metrics.map(metric => <MetricCard key={metric.label} metric={metric} onSelect={() => inspect(metric.label, metric.records ?? [])} />)}</div>
        <div className="analytics-chart-grid">
          <ReportTrend title={trendTitle} buckets={data.trend} onBucket={bucket => inspectBucket(bucket, data.series)} />
          <ReportDonut title="Resolution Performance" subtitle="Current outcomes for records created in the selected period." rows={outcomes} resolution onSelect={key => inspect(key, data.summary.cohort.filter(record => record.outcome === key))} />
        </div>
        <div className="analytics-detail-grid">
          {workload && <ReportBars title={workload.title} subtitle={workload.subtitle} rows={workload.rows} onSelect={key => inspect(departmentNames.get(key) ?? 'Unassigned department', workload.records.filter(record => workload.keyFor(record) === key))} />}
          {selectedTab !== 2 && <ReportAgentTable rows={data.agentRows} onAgent={row => inspect(row.agent.name, row.records)} />}
        </div>
        <div className="analytics-more-grid">
          {selectedTab === 0 && <ReportTrend title="Support Activity" buckets={data.conversationTrend} onBucket={bucket => inspectBucket(bucket, data.conversations)} />}
          {!banking && <ReportDonut title="Enquiries by Business Area" subtitle="Conversations created in the selected period." rows={reportGroup(data.summary.requests, areaOf, key => areaLabels[key as AreaFilter])} onSelect={key => inspect(areaLabels[key as AreaFilter], data.summary.requests.filter(record => record.area === key))} />}
          {breakdowns.slice(1).map(item => <ReportBars key={item.title} title={item.title} subtitle={item.subtitle} rows={item.rows} onSelect={key => inspect(item.rows.find(row => row.key === key)?.name ?? item.title, item.records.filter(record => item.keyFor(record) === key))} />)}
        </div>
        {(data.undated.length > 0 || data.undatedResolutions > 0) && <p className="analytics-note">Date coverage. {data.undated.length > 0 && <><button className="analytics-text-button" type="button" onClick={() => inspect('Records without a creation date', data.undated)}>{data.undated.length} records</button> have no creation date and are excluded from created totals. </>}{data.undatedResolutions > 0 && `${data.undatedResolutions} resolved records in the created cohort have no recorded resolution date.`}</p>}
      </div>
    }
    {drill && <ReportDetails title={drill.title} rows={filtered.filter(record => drill.keys.has(recordKey(record)))} close={() => setDrill(undefined)} />}
  </section>
}
