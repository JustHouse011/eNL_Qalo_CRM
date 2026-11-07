import {ApplicationsWorkspace} from './ApplicationsWorkspace'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import type { DemoData } from '../data/demoData'
import { bankingCaseStates, bankingProducts, workspaceExperience, type BankingCase, type BankingCaseKind } from '../lib/workspaceExperience'
import { useWorkspace } from './WorkspaceContext'
import { ticketState } from '../lib/ticketSupport'
import { Tickets } from './Records'
import { Knowledge, type ModuleProps } from './Knowledge'
import { SavedReplies, SettingsPage, WidgetConfiguration } from './ConfigurationEditors'
import { AgentOperations } from './AgentOperations'
import { validateBankingMessage } from '../lib/bankingSupport'

const finished = (status: string) => ['Completed', 'Resolved Cases', 'Resolved', 'Closed'].includes(status)
const date = (value: string) => new Date(value).toLocaleDateString('en-ZA')
export function BankingPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="module-page enhanced banking-operations"><header className="bank-page-header"><div><span className="eyebrow">eNL MUTUAL BANK · SUPPORT WORKSPACE</span><h1>{title}</h1><p>{description}</p></div><span className="bank-demo-label">Support workspace</span></header>{children}</section>
}
export function BankingViews({ options, value, onChange, label = 'Views' }: { options: readonly string[]; value: string; onChange: (next: string) => void; label?: string }) {
  return <div className="bank-view-tabs" role="group" aria-label={label}>{options.map(option => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>)}</div>
}
export function BankingCases({ kind, data, setData }: ModuleProps & { kind: BankingCaseKind }) {
  const { registry, workspaceId, actorId, can } = useWorkspace()
  const snapshot = registry!.snapshots[workspaceId]
  const [view, setView] = useState('All'), [search, setSearch] = useState(''), [category, setCategory] = useState('All')
  const [selectedId, setSelectedId] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const cases = (data.bankingCases || []).filter(c => c.kind === kind)
  const selected = cases.find(c => c.id === selectedId)
  const titles = { account: 'Accounts & Transactions', application: 'Applications & Enquiries', complaint: 'Complaints & Disputes' }
  const groups = ['All', ...bankingCaseStates[kind]]
  const categories = [...new Set(cases.map(c => c.category))]
  const records = cases.filter(c => (view === 'All' || c.status === view) && (category === 'All' || (category === 'transactions' ? /Failed transfers|Debit orders/.test(c.category) : category === 'digital' ? /Mobile banking|Online banking/.test(c.category) : c.category === category)) && `${c.reference} ${c.subject} ${c.product} ${snapshot.contacts.find(p => p.id === c.customerId)?.name}`.toLowerCase().includes(search.toLowerCase()))
  async function save(id: string, patch: Partial<BankingCase>) {
    if (busy || !can(actorId, 'reply')) return
    setBusy(true); setNotice('')
    try {
      if (patch.resolution) validateBankingMessage(patch.resolution)
      const now = new Date().toISOString()
      const success = await setData(current => ({ ...current, bankingCases: current.bankingCases?.map(c => c.id === id ? { ...c, ...patch, history: [...c.history, { id: crypto.randomUUID(), time: now, detail: `Local support update: ${patch.status ? `status → ${patch.status}` : patch.agentId !== undefined ? 'assignment changed' : 'support notes updated'}. No banking action performed.` }] } : c) }))
      setNotice(success ? 'Support case saved locally' : 'Unable to save. Retry your changes.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save.') }
    finally { setBusy(false) }
  }
  if (kind === 'application') return <ApplicationsWorkspace data={data} setData={setData} bankActions={{save,busy,notice}} />
  return <BankingPage title={titles[kind]} description={kind === 'account' ? 'Review account, card, digital banking and payment support enquiries. No balances, transfers or banking transactions are available.' : 'Review complaints, investigations and escalations.'}>
    <BankingViews options={groups} value={view} onChange={setView} />
    {kind === 'account' && <BankingViews label="Account support views" options={['All', 'Account Support', 'Transaction Enquiries', 'Card Support', 'Digital Banking', 'International Payments']} value={category === 'All' ? 'All' : category === 'Account access' ? 'Account Support' : category === 'transactions' || /Failed|Debit/.test(category) ? 'Transaction Enquiries' : category === 'Card replacement' ? 'Card Support' : category === 'digital' || /Mobile|Online/.test(category) ? 'Digital Banking' : 'International Payments'} onChange={next => { setCategory(next === 'All' ? 'All' : next === 'Account Support' ? 'Account access' : next === 'Transaction Enquiries' ? 'transactions' : next === 'Card Support' ? 'Card replacement' : next === 'Digital Banking' ? 'digital' : 'International payment enquiries') }} />}
    <div className="bank-toolbar"><label>Search support cases<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Reference, customer or product" /></label><label>Support category<select value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{categories.map(c => <option key={c}>{c}</option>)}{category === 'transactions' && <option value="transactions">Transaction Enquiries</option>}{category === 'digital' && <option value="digital">Digital Banking</option>}</select></label><span>{records.length} matching cases</span></div>
    <div className="bank-case-layout"><div className="bank-case-list">{records.map(c => <button key={c.id} className={`record-card ${selectedId === c.id ? 'selected' : ''}`} onClick={() => setSelectedId(c.id)}><small>{c.reference} · {c.product}</small><strong>{c.subject}</strong><span>{snapshot.contacts.find(p => p.id === c.customerId)?.name}</span><span className="bank-case-state">{c.status} · {c.priority}</span><small>{snapshot.agents.find(a => a.id === c.agentId)?.name || 'Unassigned'} · {date(c.createdAt)}</small></button>)}{!records.length && <p role="status">No cases match this view.</p>}</div>
    {selected ? <CaseDetail key={selected.id} item={selected} data={data} busy={busy} allowed={can(actorId, 'reply')} save={patch => save(selected.id, patch)} /> : <article className="record-card bank-empty"><h2>Select a support case</h2><p>Review its customer, product, assignment and activity history.</p></article>}</div>
    {notice && <p role="status" className="bank-save-notice">{notice}</p>}
  </BankingPage>
}
function CaseDetail({ item, data, busy, allowed, save }: { item: BankingCase; data: DemoData; busy: boolean; allowed: boolean; save: (patch: Partial<BankingCase>) => Promise<void> }) {
  const { registry, workspaceId } = useWorkspace()
  const snapshot = registry!.snapshots[workspaceId]
  const [status, setStatus] = useState(item.status), [agentId, setAgent] = useState(item.agentId || ''), [resolution, setResolution] = useState(item.resolution), [priority, setPriority] = useState(item.priority), [departmentId, setDepartment] = useState(item.departmentId)
  const customer = data.contacts.find(c => c.id === item.customerId)
  const agents = snapshot.agents.filter(a => registry!.memberships.some(m => m.workspaceId === workspaceId && m.userId === a.userId && m.status === 'active') && (!a.departmentIds || a.departmentIds.includes(departmentId)))
  return <article className="record-card bank-case-detail"><span className="eyebrow">{item.reference}</span><h2>{item.subject}</h2><dl className="bank-facts"><div><dt>Customer</dt><dd>{customer?.name}</dd></div><div><dt>email</dt><dd>{customer?.email}</dd></div><div><dt>Product</dt><dd>{item.product}</dd></div><div><dt>Submitted</dt><dd>{date(item.createdAt)}</dd></div><div><dt>Support due date</dt><dd>{date(item.dueAt)}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div></dl>
    <form onSubmit={e => { e.preventDefault(); void save({ status, agentId: agentId || null, departmentId, priority, resolution }) }}><fieldset disabled={!allowed || busy} className="banking-fields"><div className="form-grid"><label>Case status<select value={status} onChange={e => setStatus(e.target.value)}>{bankingCaseStates[item.kind].map(s => <option key={s}>{s}</option>)}</select></label><label>Case priority<select value={priority} onChange={e => setPriority(e.target.value as BankingCase['priority'])}>{['normal', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}</select></label><label>Assigned department<select value={departmentId} onChange={e => { setDepartment(e.target.value); setAgent('') }}>{snapshot.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Assigned agent<select value={agentId} onChange={e => setAgent(e.target.value)}><option value="">Unassigned</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div><label>Resolution / support notes<textarea maxLength={2000} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Record support notes and follow-up actions." /></label><button className="button-primary">{busy ? 'Saving…' : 'Save support case'}</button></fieldset></form><h3>Activity & escalation history</h3><ol className="bank-timeline">{item.history.map(h => <li key={h.id}><time>{date(h.time)}</time><p>{h.detail}</p></li>)}</ol><Link to={`/contacts?customer=${item.customerId}`}>Open customer profile</Link>
  </article>
}

export function BankingProducts({ data }: ModuleProps) {
  const [selected, setSelected] = useState<string>(bankingProducts[0]), [search, setSearch] = useState('')
  const enquiries = (data.bankingCases || []).filter(c => c.product === selected)
  return <BankingPage title="Banking Products" description="Product names supplied for support navigation. Descriptions and FAQs are placeholders awaiting approved source material.">
    <label>Search banking products<input value={search} onChange={e => setSearch(e.target.value)} /></label><div className="bank-case-layout"><div>{bankingProducts.filter(p => p.toLowerCase().includes(search.toLowerCase())).map(p => <button className={`record-card ${p === selected ? 'selected' : ''}`} key={p} onClick={() => setSelected(p)}><strong>{p}</strong><small>{p.includes('Savings') ? 'Savings support' : 'Account support'}</small></button>)}</div><article className="record-card"><span className="eyebrow">DESCRIPTION REQUIRES OFFICIAL REVIEW</span><h2>{selected}</h2><p>Placeholder for approved {selected} information. No fees, interest rates, eligibility or product terms are asserted.</p><h3>Related support categories</h3><p>Product information · Applications · Account access · General customer service</p><h3>Frequently asked questions</h3><details><summary>Where can I confirm product terms?</summary><p>Use reviewed official product material. This preview cannot confirm product terms.</p></details><details><summary>Can this CRM open an account or make payments?</summary><p>No. It records support enquiries only.</p></details><h3>Linked knowledge articles</h3>{data.articles.filter(a => /Personal|Business|Getting/.test(a.category)).map(a => <p key={a.id}><Link to="/knowledge">{a.title}</Link> · {a.published ? 'Published locally' : 'Draft — review required'}</p>)}<h3>Related enquiries ({enquiries.length})</h3>{enquiries.map(c => <p key={c.id}><Link to={c.kind === 'application' ? '/pipeline' : c.kind === 'complaint' ? '/complaints' : '/account-support'}>{c.reference}: {c.subject}</Link></p>)}</article></div>
  </BankingPage>
}

export function BankingTickets(props: ModuleProps) {
  const { registry, workspaceId, actorId } = useWorkspace()
  const [view, setView] = useState('All Tickets')
  const agent = registry?.snapshots[workspaceId].agents.find(a => a.userId === actorId)
  const [now] = useState(() => new Date().toISOString().slice(0, 10))
  const includeTicket = (t: DemoData['tickets'][number]) => view === 'All Tickets' || (view === 'My Tickets' ? !!agent && t.assigneeId === agent.id : view === 'Unassigned' ? !t.assigneeId : view === 'Closed' ? ticketState(t) === 'Closed' : !!t.dueDate && t.dueDate < now && !finished(t.status))
  return <div className="bank-module-stack"><BankingViews options={['All Tickets', 'My Tickets', 'Unassigned', 'Overdue', 'Closed']} value={view} onChange={setView} /><Tickets key={view} {...props} ticketFilter={includeTicket} /></div>
}
export function BankingKnowledge(props: ModuleProps) {
  const [view, setView] = useState('All Articles'), [category, setCategory] = useState('All')
  const categories = [...new Set(props.data.articles.map(a => a.category))]
  return <div className="bank-module-stack"><BankingViews options={['All Articles', 'Categories', 'Drafts', 'Published']} value={view} onChange={setView} />{view === 'Categories' && <label className="bank-category-filter">Knowledge category<select value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>}<Knowledge key={`${view}:${category}`} {...props} articleFilter={a => view === 'Drafts' ? !a.published : view === 'Published' ? a.published : view === 'Categories' && category !== 'All' ? a.category === category : true} /></div>
}

export function BankingReplies(props: ModuleProps) {
  const [view, setView] = useState('Reply Library'), [category, setCategory] = useState('All')
  return <div className="bank-module-stack"><BankingViews options={['Reply Library', 'Categories']} value={view} onChange={setView} />{view === 'Categories' && <label className="bank-category-filter">Reply category<select value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{props.data.savedReplies?.map(r => <option key={r.id}>{r.title}</option>)}</select></label>}<SavedReplies {...props} data={{ ...props.data, savedReplies: props.data.savedReplies?.filter(r => view !== 'Categories' || category === 'All' || r.title === category) }} /></div>
}
export function BankingAgents({ data }: ModuleProps) {
  const { registry, workspaceId } = useWorkspace()
  const [view, setView] = useState('Agent Directory'), [notice, setNotice] = useState('')
  const snapshot = registry!.snapshots[workspaceId]
  return <BankingPage title="Agents & Departments" description="Team directory, departments and agent availability."><BankingViews options={['Agent Directory', 'Departments', 'Assignments']} value={view} onChange={setView} />{view === 'Agent Directory' ? <AgentOperations data={data} onToast={setNotice} /> : view === 'Departments' ? <div className="bank-product-grid">{snapshot.departments.map(d => <article key={d.id} className="record-card"><h2>{d.name}</h2><p>{data.bankingCases?.filter(c => c.departmentId === d.id && !finished(c.status)).length || 0} open support cases</p><p>{data.conversations.filter(c => c.departmentId === d.id && c.status !== 'resolved').length} active conversations</p></article>)}</div> : <div className="bank-product-grid">{snapshot.agents.map(a => <article key={a.id} className="record-card"><h2>{a.name}</h2>{data.bankingCases?.filter(c => c.agentId === a.id).map(c => <p key={c.id}><Link to={c.kind === 'application' ? '/pipeline' : c.kind === 'complaint' ? '/complaints' : '/account-support'}>{c.reference}</Link> · {c.status}</p>)}{data.conversations.filter(c => c.assigneeId === a.id).map(c => <p key={c.id}><Link to={`/inbox?conversation=${c.id}`}>{c.customer}</Link> · {c.status}</p>)}</article>)}</div>}{notice && <p role="status">{notice}</p>}</BankingPage>
}
export function BankingSettings({ integrations = false, ...props }: ModuleProps & { integrations?: boolean }) {
  const options = integrations ? ['Website Chat', 'Communication Channels', 'Integration Status'] : ['Workspace Profile', 'Business Hours', 'Notifications', 'Support Configuration']
  const [view, setView] = useState(options[0])
  return <div className="bank-module-stack"><BankingViews options={options} value={view} onChange={setView} />{view === 'Website Chat' || view === 'Business Hours' ? <WidgetConfiguration {...props} /> : view === 'Integration Status' ? <BankingPage title="Integration Status" description="Review channel configuration and integration status."><article className="record-card"><h2>Website chat</h2><p>Website chat configuration</p><Link to="/enl-preview">Open eNL website preview</Link></article><article className="record-card"><h2>Communication channels</h2><p>Pending activation</p></article></BankingPage> : <SettingsPage key={view} initialSection={view === 'Workspace Profile' ? 'Workspace' : view === 'Notifications' ? 'Notifications' : view === 'Support Configuration' ? 'Queues' : 'Channels'} />}</div>
}

function counts(values: string[]) { return Object.entries(values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] || 0) + 1 }), {})).map(([name, value]) => ({ name, value })) }
function Breakdown({ title, rows }: { title: string; rows: { name: string; value: number }[] }) {
  return <article className="record-card bank-chart"><h2>{title}</h2>{rows.length ? <><div aria-hidden="true" style={{ height: 220, minWidth: 0 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="name" hide /><YAxis allowDecimals={false} width={30} /><Tooltip contentStyle={{ background: 'var(--surface-strong)', color: 'var(--text)', borderColor: 'var(--line)' }} /><Bar dataKey="value" fill="#652D8D" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><table><caption className="bank-sr">{title} data</caption><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody>{rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.value}</td></tr>)}</tbody></table></> : <p>No records in this view.</p>}</article>
}
export function BankingAnalytics({ data }: ModuleProps) {
  const { registry, workspaceId } = useWorkspace()
  const [view, setView] = useState('Support Performance')
  const enabledWidgets = workspaceExperience(registry?.workspaces.find(w => w.id === workspaceId)).dashboardWidgets
  const cases = data.bankingCases || [], records = data.conversations
  const agents = registry!.snapshots[workspaceId].agents.filter(a => registry!.memberships.some(m => m.workspaceId === workspaceId && m.userId === a.userId && m.status === 'active'))
  const responses = records.flatMap(c => { const question = c.messages.find(m => m.kind === 'customer'); const answer = c.messages.find(m => m.kind === 'agent' && question && m.time >= question.time); return question && answer ? [(Date.parse(answer.time) - Date.parse(question.time)) / 60000] : [] })
  const metrics = [ ['Total conversations', records.length], ['Active conversations', records.filter(c => c.status !== 'resolved').length], ['AI-handled conversations', records.filter(c => c.handling === 'ai').length], ['Human-handled conversations', records.filter(c => c.handling === 'human').length], ['Open support cases', cases.filter(c => !finished(c.status)).length], ['Pending applications', cases.filter(c => c.kind === 'application' && !finished(c.status)).length], ['Unassigned tickets', data.tickets.filter(t => !t.assigneeId && !finished(t.status)).length], ['Escalated complaints', cases.filter(c => c.kind === 'complaint' && c.status === 'Escalations').length], ['Open tickets', data.tickets.filter(t => !finished(t.status)).length], ['Resolved tickets', data.tickets.filter(t => t.status === 'Resolved').length], ['online agents', agents.filter(a => a.presence === 'online').length], ['Average response time', responses.length ? `${(responses.reduce((a, b) => a + b, 0) / responses.length).toFixed(1)} min` : 'Not recorded'] ] as const
  const [now] = useState(Date.now)
  const due = cases.filter(c => !finished(c.status)), overdue = due.filter(c => Date.parse(c.dueAt) < now).length
  const workload = agents.map(a => ({ name: a.name, value: records.filter(c => c.assigneeId === a.id && c.status !== 'resolved').length + cases.filter(c => c.agentId === a.id && !finished(c.status)).length + data.tickets.filter(t => t.assigneeId === a.id && !finished(t.status)).length }))
  function exportReport() {
    const rows = [['Metric', 'Value'], ...metrics.map(([name, value]) => [name, String(value)]), ['Overdue support cases', String(overdue)]]
    const csv = rows.map(row => row.map(v => `"${v.replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), link = document.createElement('a'); link.href = url; link.download = 'enl-support-report.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <BankingPage title="Reports & Analytics" description="Support activity and service targets for this workspace.">
    <BankingViews options={['Support Performance', 'Ticket Reports', 'Complaints', 'Agent Performance']} value={view} onChange={setView} />
    <div className="report-grid">{metrics.filter(([label]) => enabledWidgets.includes(label)).map(([label, value]) => <article key={label} className="report-metric record-card"><span>{label}</span><strong>{value}</strong></article>)}</div><div className="bank-service-strip"><span>service indicator</span><strong>{overdue} overdue / {due.length} open support cases</strong><small>Support follow-up target: 3 days.</small><button className="button-secondary" onClick={exportReport}>Export banking report</button></div>
    <div className="bank-product-grid">{(view === 'Support Performance') && <><Breakdown title="Conversations by category" rows={counts(records.map(c => c.category || 'Unclassified'))} /><Breakdown title="Support volumes" rows={counts(records.map(c => c.createdAt.slice(0, 10)))} /><Breakdown title="Application enquiries" rows={counts(cases.filter(c => c.kind === 'application').map(c => c.product))} /></>}{(view === 'Ticket Reports') && <Breakdown title="Ticket status distribution" rows={counts(data.tickets.map(ticketState))} />}{(view === 'Complaints') && <><Breakdown title="Complaint trends" rows={counts(cases.filter(c => c.kind === 'complaint').map(c => c.createdAt.slice(0, 10)))} /><Breakdown title="Complaint status" rows={counts(cases.filter(c => c.kind === 'complaint').map(c => c.status))} /></>}{(view === 'Agent Performance') && <Breakdown title="Agent workload" rows={workload} />}</div>
  </BankingPage>
}
