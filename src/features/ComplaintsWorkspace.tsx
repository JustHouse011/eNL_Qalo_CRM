import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDownUp, ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown, Clock, Ellipsis, FileText, Filter, Flag, Layers, LockKeyhole, MessageSquare, Plus, Search, ShieldCheck, UserRound, UserRoundPlus, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import type { DemoData } from '../data/demoData'
import { complaintAccess, complaintCategories, complaintPriorities, complaintProducts, complaintStatuses, complaintSupport, type ComplaintDraft } from '../lib/complaintSupport'
import { eligibleAgent } from '../lib/ticketSupport'
import type { BankingCase, BankingCaseEvent } from '../lib/workspaceExperience'
import { useBusinessArea } from './BusinessArea'
import { useWorkspace } from './WorkspaceContext'
import './ComplaintsWorkspace.css'

const metrics = [FileText, Search, ArrowUpRight, CheckCircle2]
const detailTabs = ['Activity Timeline', 'Notes', 'Documents', 'Escalation'] as const
const sorts = ['Latest activity', 'Newest submitted', 'Oldest submitted', 'Highest priority'] as const
const emptyFilters = { category: '', priority: '', department: '', agent: '', product: '', from: '', until: '' }
const pageSize = 8
const reference = (value: string) => value.replace(/^ENL-DEMO-/, 'ENL-')
const lastActivity = (record: BankingCase) => Math.max(Date.parse(record.createdAt), ...record.history.map(event => Date.parse(event.time)))
const timeLabel = (value: string | number) => new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const eventTitles: Record<NonNullable<BankingCaseEvent['type']>, string> = {
  submitted: 'Complaint submitted', investigation: 'Investigation started', department: 'Department changed', assignment: 'Assignment updated',
  status: 'Status updated', priority: 'Priority updated', note: 'Internal note added', update: 'Staff update added',
  escalation: 'Escalation recorded', resolved: 'Complaint resolved', reopened: 'Complaint reopened',
}
const isEscalation = (event: BankingCaseEvent) => event.type === 'escalation' || (!event.type && /escalat/i.test(event.detail))
type Action = 'new' | 'filter' | 'assignment' | 'status' | 'escalate'
type Access = ReturnType<typeof complaintAccess>

export function ComplaintsWorkspace({ data }: { data: DemoData }) {
  const { registry, workspaceId, actorId } = useWorkspace()
  const { departmentId, setDepartmentId } = useBusinessArea()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<typeof sorts[number]>(sorts[0])
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(0)
  const [action, setAction] = useState<Action>()
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const access = complaintAccess(registry!, workspaceId, actorId)
  const departments = access.departments.filter(d => !departmentId || d.id === departmentId)
  const cases = (data.bankingCases ?? []).filter(c => c.kind === 'complaint' && departments.some(d => d.id === c.departmentId))
  const customerName = (record: BankingCase) => data.contacts.find(c => c.id === record.customerId)?.name ?? 'Customer unavailable'
  const statuses = ['All', ...complaintStatuses]
  const counts = statuses.map(status => status === 'All' ? cases.length : cases.filter(record => record.status === status).length)
  const rows = cases.filter(c => (view === 'All' || c.status === view)
    && (!filters.category || c.category === filters.category)
    && (!filters.priority || c.priority === filters.priority)
    && (!filters.department || c.departmentId === filters.department)
    && (!filters.agent || (c.agentId ?? 'unassigned') === filters.agent)
    && (!filters.product || c.product === filters.product)
    && (!filters.from || Date.parse(c.createdAt) >= Date.parse(filters.from))
    && (!filters.until || Date.parse(c.createdAt) < Date.parse(filters.until) + 86400000)
    && `${c.reference} ${reference(c.reference)} ${c.subject} ${customerName(c)} ${c.product} ${c.category}`.toLowerCase().includes(query.trim().toLowerCase()))
  rows.sort((a, b) => {
    const submitted = Date.parse(b.createdAt) - Date.parse(a.createdAt)
    if (sort === 'Newest submitted') return submitted
    if (sort === 'Oldest submitted') return -submitted
    if (sort === 'Highest priority') return complaintPriorities.indexOf(b.priority) - complaintPriorities.indexOf(a.priority) || lastActivity(b) - lastActivity(a)
    return lastActivity(b) - lastActivity(a)
  })
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const requested = params.get('case')
  const selected = requested ? cases.find(c => c.id === requested) : rows[0]
  const activeFilters = Object.values(filters).filter(Boolean).length
  function select(id?: string, replace = false) {
    const next = new URLSearchParams(params)
    if (id) next.set('case', id); else next.delete('case')
    if (next.toString() !== params.toString()) setParams(next, { replace })
  }
  function resetQueue() { setPage(0); select(undefined, true) }
  function filterStatus(status: string) { setView(status); resetQueue() }
  function openAction(value: Action) { setActionError(''); setAction(value) }
  function closeAction() { if (!busy) setAction(undefined) }
  async function runAction(work: () => Promise<void>, message: string) {
    setBusy(true); setActionError(''); setNotice('')
    try { await work(); setAction(undefined); setNotice(message) }
    catch (error) { setActionError(error instanceof Error ? error.message : 'The complaint could not be saved. Try again.') }
    finally { setBusy(false) }
  }
  const change = (record: BankingCase, command: Parameters<typeof complaintSupport.change>[3]) => complaintSupport.change(workspaceId, actorId, record.id, command)

  return <section className={`module-page enhanced complaint-page ${requested ? 'complaint-mobile-open' : ''}`}>
    <header className="complaint-hero"><div><span className="eyebrow">eNL MUTUAL BANK · SUPPORT WORKSPACE</span><h1>Complaints &amp; Disputes</h1><p>Review complaints, investigations and escalations, and ensure timely resolution.</p></div><div className="complaint-hero-art" aria-hidden="true"><ShieldCheck /></div></header>
    <div className="complaint-metrics" aria-label="Complaint summary">{complaintStatuses.map((status, index) => {
      const Icon = metrics[index]
      return <button type="button" key={status} className={`complaint-metric tone-${index}`} aria-pressed={view === status} onClick={() => filterStatus(status)}><span className="complaint-metric-icon"><Icon size={23} /></span><span>{status}<strong>{counts[index + 1]}</strong></span></button>
    })}</div>
    <div className="complaint-navigation">
      <div className="complaint-segments" role="group" aria-label="Complaint status filters">{statuses.map((status, index) => <button type="button" key={status} aria-pressed={view === status} onClick={() => filterStatus(status)}>{status} ({counts[index]})</button>)}</div>
      {departments.length > 0 && <button type="button" className="button-primary complaint-create" onClick={() => openAction('new')}><Plus size={16} /> New Complaint</button>}
    </div>
    {notice && <p className="complaint-feedback" role="status">{notice}</p>}
    <div className="complaint-columns">
      <aside className="complaint-queue complaint-panel" aria-label="Complaint queue">
        <header><h2>Complaints &amp; Disputes <span>({rows.length})</span></h2><label className="complaint-sort"><ArrowDownUp size={13} /><span className="sr-only">Sort complaints</span><select value={sort} onChange={e => { setSort(e.target.value as typeof sort); setPage(0) }}>{sorts.map(item => <option key={item}>{item}</option>)}</select></label></header>
        <div className="complaint-search-bar"><label><Search size={16} /><span className="sr-only">Search complaints</span><input value={query} onChange={e => { setQuery(e.target.value); resetQueue() }} placeholder="Search by reference, customer or product…" />{query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); resetQueue() }}><X size={14} /></button>}</label><button type="button" aria-label="Filter complaints" className="complaint-icon-button" onClick={() => openAction('filter')}><Filter size={16} />{activeFilters > 0 && <span>{activeFilters}</span>}</button></div>
        <div className="complaint-rows">{rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(record => <button type="button" key={record.id} aria-pressed={selected?.id === record.id} className="complaint-row" onClick={() => select(record.id)}><span className="complaint-row-top"><span>{reference(record.reference)}</span><time>{timeLabel(lastActivity(record))}</time></span><strong>{record.subject}</strong><span className="complaint-row-customer"><UserRound size={13} />{customerName(record)}</span><Badges record={record} /></button>)}
          {!rows.length && <div className="complaint-empty"><Search size={23} /><h3>{!access.allowed ? 'Complaint access unavailable' : cases.length ? 'No matching complaints' : 'No complaints in this department scope'}</h3>{cases.length > 0 && <button type="button" className="button-secondary" onClick={() => { setFilters(emptyFilters); setQuery(''); filterStatus('All') }}>Clear filters</button>}</div>}
        </div>
        {pages > 1 && <nav className="complaint-pagination" aria-label="Complaint pages"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
      </aside>
      <section className="complaint-panel complaint-investigation" aria-label="Investigation workspace">
        <button type="button" className="complaint-back" onClick={() => select(undefined)}><ArrowLeft size={16} /> Back to Complaints</button>
        {selected ? <Investigation key={selected.id} record={selected} data={data} access={access} openAction={openAction} drafts={drafts} setDraft={(key, value) => setDrafts(current => ({ ...current, [key]: value }))} change={command => change(selected, command)} /> : <div className="complaint-empty"><ShieldCheck size={30} /><h2>{requested ? 'Complaint unavailable' : 'Select a complaint'}</h2><p>{requested ? 'This complaint was not found in the current workspace and department scope.' : 'Choose a case to review its activity and investigation details.'}</p></div>}
      </section>
    </div>
    {action === 'filter' && <ComplaintModal title="Filter complaints" close={closeAction}><FilterForm value={filters} status={view} cases={cases} access={access} departments={departments} close={closeAction} apply={(next, status) => { setFilters(next); filterStatus(status); closeAction() }} /></ComplaintModal>}
    {action === 'new' && access.allowed && <ComplaintModal title="New Complaint" close={closeAction} busy={busy}><CreateForm data={data} access={access} departments={departments} cases={cases} busy={busy} error={actionError} close={closeAction} save={(draft, requestId) => runAction(async () => {
      const id = await complaintSupport.create(workspaceId, actorId, draft, requestId)
      setView('All'); setQuery(''); setFilters(emptyFilters); setSort(sorts[0]); setPage(0); select(id)
    }, 'Complaint saved in this workspace.') } /></ComplaintModal>}
    {selected && access.allowed && (action === 'assignment' || action === 'status' || action === 'escalate') && <ComplaintModal title={action === 'assignment' ? 'Assign complaint' : action === 'escalate' ? 'Escalate complaint' : 'Update status'} close={closeAction} busy={busy}>
      <CaseActionForm record={selected} action={action} access={access} busy={busy} error={actionError} close={closeAction} save={command => runAction(async () => { await change(selected, command); if (command.kind === 'assignment' && departmentId && command.departmentId !== departmentId) setDepartmentId(command.departmentId); select(selected.id, true) }, 'Complaint updated in this workspace.')} />
    </ComplaintModal>}
  </section>
}

function Badges({ record }: { record: BankingCase }) {
  return <span className="complaint-badges"><span className="complaint-status" data-status={record.status}>{record.status}</span><span className="complaint-priority" data-priority={record.priority}>{record.priority}</span></span>
}

function Investigation({ record, data, access, openAction, drafts, setDraft, change }: {
  record: BankingCase; data: DemoData; access: Access; openAction: (action: Action) => void
  drafts: Record<string, string>; setDraft: (key: string, text: string) => void
  change: (command: Parameters<typeof complaintSupport.change>[3]) => Promise<void>
}) {
  const { registry } = useWorkspace()
  const [tab, setTab] = useState<typeof detailTabs[number]>('Activity Timeline')
  const [mode, setMode] = useState<'update' | 'note'>('update')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const tablist = useRef<HTMLDivElement>(null)
  const customer = data.contacts.find(c => c.id === record.customerId)
  const customerLink = `/contacts?customer=${encodeURIComponent(record.customerId)}`
  const departmentName = (id?: string) => access.snapshot?.departments.find(d => d.id === id)?.name
  const agentName = (id?: string | null) => access.snapshot?.agents.find(a => a.id === id)?.name
  const chronological = [...record.history].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  const notes = chronological.filter(event => event.type === 'note')
  const escalations = chronological.filter(isEscalation)
  const escalation = escalations.at(-1)
  const matchReference = (value?: string) => value === record.reference || value === record.id
  const withinDepartment = (id?: string | null) => access.manage || (!!id && access.departments.some(department => department.id === id))
  const relatedConversations = data.conversations.filter(c => withinDepartment(c.departmentId) && (matchReference(c.reference) || matchReference(c.id)))
  const documents = relatedConversations.flatMap(c => c.documents ?? [])
  const tickets = data.tickets.filter(ticket => withinDepartment(ticket.departmentId) && (matchReference(ticket.reference) || relatedConversations.some(c => c.id === ticket.conversationId)))
  const draftKey = `${record.id}:${mode}`
  const text = drafts[draftKey] ?? ''
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || !access.allowed) return
    setSaving(true); setError(''); setNotice('')
    try { await change({ kind: mode, text }); setDraft(draftKey, ''); setNotice(mode === 'note' ? 'Internal note saved.' : 'Staff update saved to the case.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The update could not be saved.') }
    finally { setSaving(false) }
  }
  function timeline(events: BankingCaseEvent[], empty: string) {
    return events.length ? <ol className="complaint-timeline">{events.map(event => {
      const Icon = isEscalation(event) ? ArrowUpRight : event.type === 'submitted' ? Flag : event.type === 'note' || event.type === 'update' ? MessageSquare : Clock
      return <li key={event.id}><span className="complaint-event-icon"><Icon size={16} /></span><div><strong>{event.type ? eventTitles[event.type] : isEscalation(event) ? 'Escalation recorded' : 'Recorded activity'}</strong><p>{event.detail}</p>{event.actorId && <small>{registry?.users.find(user => user.id === event.actorId)?.name || (event.actorId === access.actor?.id ? access.actor.name : '')}</small>}</div><time dateTime={event.time}>{timeLabel(event.time)}</time></li>
    })}</ol> : <p className="complaint-muted">{empty}</p>
  }
  return <>
    <header className="complaint-detail-head"><div><span className="complaint-reference">{reference(record.reference)}</span><h2>{record.subject}</h2><Badges record={record} /></div><div className="complaint-detail-actions">
      <details className="complaint-more"><summary aria-label="More actions"><Ellipsis size={17} /></summary><div>{customer && <Link to={customerLink}>Open customer profile</Link>}<Link to={`/banking-products?product=${encodeURIComponent(record.product)}`}>Open banking product</Link>{tickets.map(ticket => <Link key={ticket.id} to={`/tickets?ticket=${encodeURIComponent(ticket.id)}`}>{ticket.subject}</Link>)}</div></details>
      {access.allowed && <><button type="button" onClick={() => openAction('assignment')}><UserRoundPlus size={15} /> Assign</button><button type="button" onClick={() => openAction('status')}>Update Status <ChevronDown size={14} /></button></>}
    </div></header>
    <dl className="complaint-facts">
      <Fact label="Customer" icon={<UserRound size={16} />}>{customer ? <Link to={customerLink}>{customer.name}</Link> : 'Unavailable'}</Fact>
      <Fact label="Product" icon={<Layers size={16} />}><Link to={`/banking-products?product=${encodeURIComponent(record.product)}`}>{record.product}</Link></Fact>
      <Fact label="Submitted" icon={<CalendarDays size={16} />}>{timeLabel(record.createdAt)}</Fact>
      <Fact label="Last updated" icon={<Clock size={16} />}>{timeLabel(lastActivity(record))}</Fact>
      <Fact label="Assigned department">{departmentName(record.departmentId) ?? 'Unavailable'}</Fact>
      <Fact label="Assigned agent">{agentName(record.agentId) ?? 'Unassigned'}</Fact>
      <Fact label="Category">{record.category}</Fact><Fact label="Support due date">{timeLabel(record.dueAt)}</Fact>
    </dl>
    <section className="complaint-description"><h3>Description</h3><p>{record.description || 'No original description is recorded for this complaint.'}</p></section>
    <div className="complaint-detail-tabs" role="tablist" aria-label="Investigation sections" ref={tablist} onKeyDown={event => {
      const index = detailTabs.indexOf(tab)
      const next = ({ ArrowLeft: (index + 3) % 4, ArrowRight: (index + 1) % 4, Home: 0, End: 3 })[event.key]
      if (next === undefined) return
      event.preventDefault(); setTab(detailTabs[next]); tablist.current?.querySelectorAll('button')[next]?.focus()
    }}>{detailTabs.map((item, index) => {
      const Icon = [Clock, MessageSquare, FileText, ArrowUpRight][index]
      const count = item === 'Notes' ? notes.length + Number(!!record.resolution) : item === 'Documents' ? documents.length : 0
      return <button type="button" role="tab" id={`complaint-tab-${index}`} aria-controls="complaint-tab-panel" aria-selected={item === tab} tabIndex={item === tab ? 0 : -1} key={item} onClick={() => setTab(item)}><Icon size={16} />{item}{count > 0 && ` (${count})`}</button>
    })}</div>
    <div className="complaint-tab-panel" id="complaint-tab-panel" role="tabpanel" aria-labelledby={`complaint-tab-${detailTabs.indexOf(tab)}`} tabIndex={0}>
      {tab === 'Activity Timeline' && timeline(chronological, 'No activity has been recorded for this complaint.')}
      {tab === 'Notes' && <>{record.resolution && <div className="complaint-description"><h3>Existing support note</h3><p>{record.resolution}</p></div>}{(notes.length > 0 || !record.resolution) && timeline(notes, 'No internal notes have been recorded.')}</>}
      {tab === 'Documents' && <>{documents.length ? <ul className="complaint-documents">{documents.map((doc, index) => <li key={`${doc.name}:${index}`}><FileText size={15} /><span>{doc.name}</span><small>{doc.status}</small></li>)}</ul> : <p className="complaint-muted">No supporting documents are linked to this case.</p>}<p className="complaint-muted">File uploads and downloads are unavailable in this workspace.</p></>}
      {tab === 'Escalation' && <><dl className="complaint-facts complaint-escalation"><Fact label="Status">{record.status === 'Escalations' ? 'Escalated' : 'No active escalation'}</Fact>{escalation && <><Fact label="Last recorded escalation">{timeLabel(escalation.time)}</Fact>{escalation.departmentId && <Fact label="Escalation department">{departmentName(escalation.departmentId) ?? 'Unavailable'}</Fact>}{escalation.agentId && <Fact label="Escalation agent">{agentName(escalation.agentId) ?? 'Unavailable'}</Fact>}</>}</dl>{timeline(escalations, 'No escalation history is recorded.')}{access.allowed && record.status !== 'Escalations' && <button type="button" className="button-primary" onClick={() => openAction('escalate')}>Escalate complaint</button>}</>}
    </div>
    {access.allowed && <form className="complaint-composer" onSubmit={submit}>
      <div className="complaint-composer-modes" role="group" aria-label="Case update type"><button type="button" aria-pressed={mode === 'update'} disabled={saving} onClick={() => { setMode('update'); setError(''); setNotice('') }}><MessageSquare size={15} /> Add Update</button><button type="button" aria-pressed={mode === 'note'} disabled={saving} onClick={() => { setMode('note'); setError(''); setNotice('') }}><LockKeyhole size={15} /> Internal Note</button></div>
      <div className="complaint-compose-row"><label><span className="sr-only">{mode === 'note' ? 'Internal note' : 'Staff case update'}</span><textarea value={text} maxLength={2000} rows={2} disabled={saving} onChange={event => setDraft(draftKey, event.target.value)} placeholder={mode === 'note' ? 'Write an internal note…' : 'Type a staff update for this case…'} /></label><button type="submit" className="button-primary" disabled={!text.trim() || saving}>{saving ? 'Saving…' : mode === 'note' ? 'Save Note' : 'Save Update'}</button></div>
      <small>Staff only · saved to the case history</small>{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    </form>}
  </>
}

function Fact({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return <div>{icon}<div><dt>{label}</dt><dd>{children}</dd></div></div>
}
function ComplaintModal({ title, children, close, busy }: { title: string; children: ReactNode; close: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  return <dialog ref={dialog} className="complaint-modal" aria-labelledby="complaint-modal-title" onCancel={event => { event.preventDefault(); close() }}>
    <header><h2 id="complaint-modal-title">{title}</h2><button type="button" className="complaint-icon-button" aria-label="Close dialog" disabled={busy} onClick={close}><X size={18} /></button></header>
    {children}
  </dialog>
}

function FilterForm({ value, status, cases, access, departments, close, apply }: {
  value: typeof emptyFilters; status: string; cases: BankingCase[]; access: Access; departments: Access['departments']
  close: () => void; apply: (filters: typeof emptyFilters, status: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [state, setState] = useState(status)
  const [error, setError] = useState('')
  const choices = (values: string[]) => [...new Set(values)].sort().map(item => ({ id: item, name: item }))
  const filters = [
    { key: 'category', label: 'Support category', options: choices(cases.map(c => c.category)) },
    { key: 'priority', label: 'Priority', options: complaintPriorities.map(id => ({ id, name: id })) },
    { key: 'department', label: 'Department', options: departments },
    { key: 'agent', label: 'Assigned agent', options: [{ id: 'unassigned', name: 'Unassigned' }, ...(access.snapshot?.agents.filter(a => cases.some(c => c.agentId === a.id)) ?? [])] },
    { key: 'product', label: 'Product', options: choices(cases.map(c => c.product)) },
  ] as const
  return <form className="complaint-modal-form" onSubmit={event => {
    event.preventDefault()
    if (draft.from && draft.until && draft.from > draft.until) { setError('The end date must be on or after the start date.'); return }
    apply(draft, state)
  }}>
    <label>Status<select value={state} onChange={event => setState(event.target.value)}>{['All', ...complaintStatuses].map(item => <option key={item}>{item}</option>)}</select></label>
    {filters.map(({ key, label, options }) => <label key={key}>{label}<select value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })}><option value="">All</option>{options.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>)}
    <div className="complaint-form-pair"><label>Submitted from<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label><label>Submitted through<input type="date" value={draft.until} onChange={event => setDraft({ ...draft, until: event.target.value })} /></label></div>
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" className="button-secondary" onClick={() => apply(emptyFilters, 'All')}>Reset filters</button><button type="button" className="button-secondary" onClick={close}>Cancel</button><button className="button-primary">Apply filters</button></footer>
  </form>
}

function AssignmentFields({ access, departments, departmentId, agentId, change }: { access: Access; departments: Access['departments']; departmentId: string; agentId: string | null; change: (departmentId: string, agentId: string | null) => void }) {
  const agents = access.agents.filter(a => eligibleAgent(a, departmentId))
  return <div className="complaint-form-pair"><label>Assigned department<select required value={departmentId} onChange={event => change(event.target.value, null)}>{departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
    <label>Assigned agent<select value={agentId ?? ''} onChange={event => change(departmentId, event.target.value || null)}><option value="">Unassigned</option>{agentId && !agents.some(a => a.id === agentId) && <option value={agentId} disabled>Current agent (unavailable)</option>}{agents.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label></div>
}
function CreateForm({ data, access, departments, cases, busy, error, close, save }: { data: DemoData; access: Access; departments: Access['departments']; cases: BankingCase[]; busy: boolean; error: string; close: () => void; save: (draft: ComplaintDraft, id: string) => void }) {
  const [requestId] = useState(() => crypto.randomUUID())
  const [draft, setDraft] = useState<ComplaintDraft>(() => ({ customerId: '', subject: '', description: '', product: complaintProducts[0], category: complaintCategories[0], priority: 'normal', departmentId: departments.find(d => d.name === 'Complaints & Escalations')?.id ?? departments[0]?.id ?? '', agentId: null, dueAt: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) }))
  const patch = (fields: Partial<ComplaintDraft>) => setDraft(current => ({ ...current, ...fields }))
  return <form className="complaint-modal-form" onSubmit={event => { event.preventDefault(); if (!busy) save(draft, requestId) }}><fieldset disabled={busy}>
    <label>Customer<select required value={draft.customerId} onChange={event => patch({ customerId: event.target.value })}><option value="">Select a customer</option>{data.contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Subject<input required maxLength={160} value={draft.subject} onChange={event => patch({ subject: event.target.value })} /></label>
    <label>Description<textarea rows={3} maxLength={2000} value={draft.description} onChange={event => patch({ description: event.target.value })} /></label>
    <div className="complaint-form-pair"><label>Related product<select value={draft.product} onChange={event => patch({ product: event.target.value })}>{complaintProducts.map(product => <option key={product}>{product}</option>)}</select></label>
      <label>Support category<select value={draft.category} onChange={event => patch({ category: event.target.value })}>{[...new Set([...complaintCategories, ...cases.map(c => c.category)])].map(category => <option key={category}>{category}</option>)}</select></label></div>
    <div className="complaint-form-pair"><label>Priority<select value={draft.priority} onChange={event => patch({ priority: event.target.value as BankingCase['priority'] })}>{complaintPriorities.map(priority => <option key={priority}>{priority}</option>)}</select></label><label>Support due date<input required type="date" value={draft.dueAt} onChange={event => patch({ dueAt: event.target.value })} /></label></div>
    <AssignmentFields access={access} departments={departments} departmentId={draft.departmentId} agentId={draft.agentId} change={(departmentId, agentId) => patch({ departmentId, agentId })} />
    </fieldset><ActionFooter busy={busy} error={error} close={close} label="Save Complaint" />
  </form>
}
function CaseActionForm({ record, action, access, busy, error, close, save }: { record: BankingCase; action: 'assignment' | 'status' | 'escalate'; access: Access; busy: boolean; error: string; close: () => void; save: (command: Parameters<typeof complaintSupport.change>[3]) => void }) {
  const [revision] = useState(record.history.at(-1)?.id)
  const [departmentId, setDepartment] = useState(record.departmentId)
  const [agentId, setAgent] = useState(record.agentId)
  const [status, setStatus] = useState(action === 'escalate' ? 'Escalations' : record.status)
  const [priority, setPriority] = useState(record.priority)
  const [reason, setReason] = useState('')
  return <form className="complaint-modal-form" onSubmit={event => { event.preventDefault(); if (!busy) save(action === 'assignment' ? { kind: 'assignment', departmentId, agentId, revision } : { kind: 'status', status, priority, reason, revision }) }}><fieldset disabled={busy}>
    {action === 'assignment' ? <AssignmentFields access={access} departments={access.manage ? access.departments : access.departments.filter(d => d.id === record.departmentId)} departmentId={departmentId} agentId={agentId} change={(department, agent) => { setDepartment(department); setAgent(agent) }} /> : <>
      {action === 'status' && <div className="complaint-form-pair"><label>Case status<select value={status} onChange={event => setStatus(event.target.value)}>{complaintStatuses.map(item => <option key={item}>{item}</option>)}</select></label><label>Case priority<select value={priority} onChange={event => setPriority(event.target.value as BankingCase['priority'])}>{complaintPriorities.map(item => <option key={item}>{item}</option>)}</select></label></div>}
      {status === 'Escalations' && record.status !== status && <label>Escalation reason<textarea rows={3} required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label>}
    </>}
    </fieldset><ActionFooter busy={busy} error={error} close={close} label={action === 'assignment' ? 'Save Assignment' : action === 'escalate' ? 'Record Escalation' : 'Save Status'} />
  </form>
}
function ActionFooter({ busy, error, close, label }: { busy: boolean; error: string; close: () => void; label: string }) {
  return <>{error && <p role="alert" className="complaint-error">{error}</p>}<footer><button type="button" className="button-secondary" disabled={busy} onClick={close}>Cancel</button><button className="button-primary" disabled={busy}>{busy ? 'Saving…' : label}</button></footer></>
}
