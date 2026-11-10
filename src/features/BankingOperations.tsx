import {AccountsWorkspace} from './AccountsWorkspace'
import {ApplicationsWorkspace} from './ApplicationsWorkspace'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DemoData } from '../data/demoData'
import { bankingCaseStates, type BankingCase, type BankingCaseKind } from '../lib/workspaceExperience'
import { useWorkspace } from './WorkspaceContext'
import { ticketState } from '../lib/ticketSupport'
import { Tickets } from './Records'
import { Knowledge, type ModuleProps } from './Knowledge'
import { SettingsPage, WidgetConfiguration } from './ConfigurationEditors'
import { activeWorkspaceAgent } from '../lib/workspaceTypes'
import { eligibleAgent } from '../lib/ticketSupport'
import { validateBankingMessage } from '../lib/bankingSupport'

const finished = (status: string) => ['Completed', 'Resolved Cases', 'Resolved', 'Closed'].includes(status)
const date = (value: string) => new Date(value).toLocaleDateString('en-ZA')
export function BankingPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="module-page enhanced banking-operations"><header className="bank-page-header"><div><span className="eyebrow">eNL MUTUAL BANK · SUPPORT WORKSPACE</span><h1>{title}</h1><p>{description}</p></div><span className="bank-demo-label">Support workspace</span></header>{children}</section>
}
export function BankingViews({ options, value, onChange, label = 'Views' }: { options: readonly string[]; value: string; onChange: (next: string) => void; label?: string }) {
  return <div className="bank-view-tabs" role="group" aria-label={label}>{options.map(option => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>)}</div>
}
export function BankingCases({ kind, data, setData }: ModuleProps & { kind: Exclude<BankingCaseKind, 'complaint'> }) {
  const { actorId, can } = useWorkspace()
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const cases = (data.bankingCases || []).filter(c => c.kind === kind)
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
  if (kind === 'account') return <AccountsWorkspace cases={cases} data={data} notice={notice} busy={busy} renderDetail={item => <CaseDetail key={item.id} item={item} data={data} busy={busy} allowed={can(actorId, 'reply')} save={patch => save(item.id, patch)} />} />
  return <ApplicationsWorkspace data={data} setData={setData} bankActions={{save,busy,notice}} />
}
function CaseDetail({ item, data, busy, allowed, save }: { item: BankingCase; data: DemoData; busy: boolean; allowed: boolean; save: (patch: Partial<BankingCase>) => Promise<void> }) {
  const { registry, workspaceId } = useWorkspace()
  const snapshot = registry!.snapshots[workspaceId]
  const [status, setStatus] = useState(item.status), [agentId, setAgent] = useState(item.agentId || ''), [resolution, setResolution] = useState(item.resolution), [priority, setPriority] = useState(item.priority), [departmentId, setDepartment] = useState(item.departmentId)
  const customer = data.contacts.find(c => c.id === item.customerId)
  const agents = snapshot.agents.filter(a => activeWorkspaceAgent(registry!, a) && eligibleAgent(a, departmentId))
  return <article className="record-card bank-case-detail"><span className="eyebrow">{item.reference}</span><h2>{item.subject}</h2><dl className="bank-facts"><div><dt>Customer</dt><dd>{customer?.name}</dd></div><div><dt>email</dt><dd>{customer?.email}</dd></div><div><dt>Product</dt><dd>{item.product}</dd></div><div><dt>Submitted</dt><dd>{date(item.createdAt)}</dd></div><div><dt>Support due date</dt><dd>{date(item.dueAt)}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div></dl>
    <form onSubmit={e => { e.preventDefault(); void save({ status, agentId: agentId || null, departmentId, priority, resolution }) }}><fieldset disabled={!allowed || busy} className="banking-fields"><div className="form-grid"><label>Case status<select value={status} onChange={e => setStatus(e.target.value)}>{bankingCaseStates[item.kind].map(s => <option key={s}>{s}</option>)}</select></label><label>Case priority<select value={priority} onChange={e => setPriority(e.target.value as BankingCase['priority'])}>{['normal', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}</select></label><label>Assigned department<select value={departmentId} onChange={e => { setDepartment(e.target.value); setAgent('') }}>{snapshot.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Assigned agent<select value={agentId} onChange={e => setAgent(e.target.value)}><option value="">Unassigned</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div><label>Resolution / support notes<textarea maxLength={2000} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Record support notes and follow-up actions." /></label><button className="button-primary">{busy ? 'Saving…' : 'Save support case'}</button></fieldset></form><h3>Activity & escalation history</h3><ol className="bank-timeline">{item.history.map(h => <li key={h.id}><time>{date(h.time)}</time><p>{h.detail}</p></li>)}</ol><Link to={`/contacts?customer=${item.customerId}`}>Open customer profile</Link>
  </article>
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

export function BankingSettings({ integrations = false, ...props }: ModuleProps & { integrations?: boolean }) {
  const options = integrations ? ['Website Chat', 'Communication Channels', 'Integration Status'] : ['Workspace Profile', 'Business Hours', 'Notifications', 'Support Configuration']
  const [view, setView] = useState(options[0])
  return <div className="bank-module-stack"><BankingViews options={options} value={view} onChange={setView} />{view === 'Website Chat' || view === 'Business Hours' ? <WidgetConfiguration {...props} /> : view === 'Integration Status' ? <BankingPage title="Integration Status" description="Review channel configuration and integration status."><article className="record-card"><h2>Website chat</h2><p>Website chat configuration</p><Link to="/enl-preview">Open eNL website preview</Link></article><article className="record-card"><h2>Communication channels</h2><p>Pending activation</p></article></BankingPage> : <SettingsPage key={view} initialSection={view === 'Workspace Profile' ? 'Workspace' : view === 'Notifications' ? 'Notifications' : view === 'Support Configuration' ? 'Queues' : 'Channels'} />}</div>
}
