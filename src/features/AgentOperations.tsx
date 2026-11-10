import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Building2, ChevronRight, Clock, Layers, Pencil, Plus, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DemoData } from '../data/demoData'
import { previewUsers, roleLabels } from '../lib/identityPreview'
import { supportService } from '../lib/supportService'
import { ticketState, ticketSupport } from '../lib/ticketSupport'
import { agentManagementWorkspaces, type AgentProfileDraft, type AgentWorkspaceAccess, type ManagementCommand } from '../lib/workspaceManagement'
import { activeWorkspaceAgent, canInWorkspace, type Workspace, type WorkspaceAgent, type WorkspaceDepartment, type WorkspaceMembership, type WorkspaceStore, type WorkspaceUser } from '../lib/workspaceTypes'
import type { BusinessArea } from '../lib/business'
import { useWorkspace } from './WorkspaceContext'
import './AgentOperations.css'

type DirectoryAgent = { agent: WorkspaceAgent; user: WorkspaceUser; membership: WorkspaceMembership }
type Editor = { kind: 'add' } | { kind: 'edit'; entry: DirectoryAgent } | { kind: 'department'; department?: WorkspaceDepartment }
const tabs = ['Profile', 'Roles & Access', 'Departments', 'Activity'] as const
const presenceOptions = ['online', 'away', 'offline'] as const
const caseRoutes = { application: '/pipeline', complaint: '/complaints', account: '/account-support' }
const closed = ['Resolved', 'Closed', 'Completed', 'Resolved Cases']
const roleName = ({ user, membership }: DirectoryAgent) => user.role === 'administrator' ? 'Administrator' : roleLabels[membership.role]
const emailFor = ({ agent, user }: DirectoryAgent) => agent.email ?? previewUsers.find(spec => spec.id === user.id)?.email ?? ''
const titleFor = ({ agent, user }: DirectoryAgent) => agent.title ?? previewUsers.find(spec => spec.id === user.id)?.title ?? ''
const capital = (value: string) => value[0].toUpperCase() + value.slice(1)
const time = (value: string) => new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })

export function AgentOperations({ data }: { data: DemoData }) {
  const { registry, workspaceId, actorId, can } = useWorkspace()
  const store = registry!
  const snapshot = store.snapshots[workspaceId]
  const workspace = store.workspaces.find(w => w.id === workspaceId)!
  const [view, setView] = useState<'Agents' | 'Departments'>('Agents')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [workspaceFilter, setWorkspaceFilter] = useState('all')
  const [selection, setSelection] = useState('')
  const [editor, setEditor] = useState<Editor>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const opener = useRef<HTMLElement>(null)
  const managers = can(actorId, 'manage-support')
  const members = can(actorId, 'manage-members')
  const managedWorkspaces = agentManagementWorkspaces(store, actorId, workspaceId)
  const visibleWorkspaces = members ? managedWorkspaces : [workspace]
  const directoryScope = visibleWorkspaces.find(item => item.id === workspaceFilter)
  function workspaceEntries(id: string): DirectoryAgent[] {
    return store.snapshots[id].agents.flatMap(agent => {
      const user = store.users.find(item => item.id === agent.userId)
      const membership = store.memberships.find(item => item.workspaceId === id && item.userId === agent.userId)
      return user && membership ? [{ agent, user, membership }] : []
    })
  }
  const scopedEntries = directoryScope ? workspaceEntries(directoryScope.id).filter(entry => filter === 'inactive' || entry.membership.status === 'active')
    : visibleWorkspaces.flatMap(item => workspaceEntries(item.id)).sort((a, b) =>
      Number(b.membership.status === 'active') - Number(a.membership.status === 'active') ||
      Number(b.agent.workspaceId === workspaceId) - Number(a.agent.workspaceId === workspaceId))
  const entriesByUser = new Map<string, DirectoryAgent>()
  for (const entry of scopedEntries) if (!entriesByUser.has(entry.user.id)) entriesByUser.set(entry.user.id, entry)
  const directory = [...entriesByUser.values()].sort((a, b) => Number(b.user.id === actorId) - Number(a.user.id === actorId) || a.agent.name.localeCompare(b.agent.name))
  const rows = directory.filter(entry => `${entry.agent.name} ${emailFor(entry)} ${roleName(entry)}`.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'all' || (filter === 'active') === (entry.user.status === 'active' && entry.membership.status === 'active')))
  const selected = rows.find(entry => entry.user.id === selection) ?? rows[0]
  function open(next: Editor, trigger: HTMLElement) { opener.current = trigger; setError(''); setEditor(next) }
  function close() { setEditor(undefined); opener.current?.focus() }
  function save(command: ManagementCommand) {
    try {
      supportService.manage(actorId, command)
      const next = supportService.registry()
      if (command.kind === 'agent-access') {
        setWorkspaceFilter('all'); setFilter('all')
        setSelection(command.userId ?? next.users.at(-1)?.id ?? '')
        if (editor?.kind === 'add') setQuery('')
      }
      setNotice(supportService.persistenceState() === 'persistent' ? 'Changes saved in this browser.' : 'Changes saved for this session.')
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Changes could not be saved.'); return false }
  }

  return <section className={`module-page enhanced agent-workspace ${selection && selected ? 'agent-mobile-profile' : ''}`}>
    <header className="agent-hero"><div><span className="eyebrow">{workspace.name.toUpperCase()} · MANAGEMENT</span><h1>Agents &amp; Departments</h1><p>Manage agent accounts, roles and support departments.</p></div><span className="agent-hero-icon" aria-hidden="true"><Users size={46} /></span></header>
    <div className="agent-navigation">
      <div role="group" aria-label="Team workspace sections">
        <button type="button" aria-pressed={view === 'Agents'} onClick={() => setView('Agents')}><UserRound size={16} /> Agents ({directory.length})</button>
        <button type="button" aria-pressed={view === 'Departments'} onClick={() => setView('Departments')}><Building2 size={16} /> Departments ({snapshot.departments.length})</button>
      </div>
      {view === 'Agents' && members && <button type="button" className="button-primary" onClick={e => open({ kind: 'add' }, e.currentTarget)}><Plus size={16} /> Add Agent</button>}
      {view === 'Departments' && managers && <button type="button" className="button-primary" onClick={e => open({ kind: 'department' }, e.currentTarget)}><Plus size={16} /> Add Department</button>}
    </div>
    {notice && <p role="status" className="agent-notice">{notice}</p>}
    {view === 'Agents' ? <div className="agent-columns">
      <aside className="agent-panel agent-directory" aria-label="Agent directory">
        <div className="agent-directory-tools"><label className="agent-search"><Search size={16} /><span className="sr-only">Search agents</span><input placeholder="Search agents by name, email or role…" value={query} onChange={e => { setQuery(e.target.value); setSelection('') }} /></label><label className="agent-filter"><span className="sr-only">Filter agent access</span><select value={filter} onChange={e => { setFilter(e.target.value); setSelection('') }}><option value="all">All access</option><option value="active">Active</option><option value="inactive">Restricted</option></select></label></div>
        {visibleWorkspaces.length > 1 && <label className="agent-filter agent-workspace-filter"><span className="sr-only">Filter agents by workspace</span><select value={directoryScope?.id ?? 'all'} onChange={e => { setWorkspaceFilter(e.target.value); setSelection('') }}><option value="all">All authorised workspaces</option>{visibleWorkspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <div className="agent-directory-list">{rows.map(entry => <button key={entry.user.id} type="button" aria-label={`View ${entry.agent.name}`} aria-pressed={selected?.user.id === entry.user.id} onClick={() => setSelection(entry.user.id)} className="agent-row">
          <Avatar agent={entry.agent} /><span className="agent-row-copy"><strong>{entry.agent.name}</strong><span className="agent-labels"><span className="agent-role">{roleName(entry)}</span><Status value={entry.user.status === 'active' ? entry.membership.status : entry.user.status} /></span><span className="agent-labels">{visibleWorkspaces.filter(item => canInWorkspace(entry.user, item, store.memberships, 'view')).map(item => <span className="agent-role" key={item.id}>{item.name}</span>)}</span></span><ChevronRight size={16} />
        </button>)}{rows.length === 0 && <p className="agent-muted">No agents match the current search.</p>}</div>
        <p className="agent-muted agent-count">Showing {rows.length} of {directory.length} agents</p>
      </aside>
      <section className="agent-panel agent-profile" aria-label="Agent profile">
        <button type="button" className="agent-back" onClick={() => setSelection('')}><ArrowLeft size={15} /> Back to agents</button>
        {selected ? <Profile key={selected.agent.id} entry={selected} data={selected.agent.workspaceId === workspaceId ? data : store.snapshots[selected.agent.workspaceId]} store={store} workspaceId={selected.agent.workspaceId} activeWorkspaceId={workspaceId} visibleWorkspaces={visibleWorkspaces} actorId={actorId} managers={managers} members={members} edit={trigger => open({ kind: 'edit', entry: selected }, trigger)} /> : <p className="agent-muted">Choose an agent to see their profile and access.</p>}
      </section>
    </div> : <div className="agent-departments-grid" aria-label="Support departments">{snapshot.departments.map(department => {
      const agents = workspaceEntries(workspaceId).filter(entry => activeWorkspaceAgent(store, entry.agent) && (entry.agent.departmentIds === undefined || entry.agent.departmentIds.includes(department.id)))
      return <article key={department.id} className="agent-panel agent-department"><header><Building2 size={20} /><h2>{department.name}</h2>{managers && <button type="button" className="button-secondary" aria-label={`Edit ${department.name}`} onClick={e => open({ kind: 'department', department }, e.currentTarget)}><Pencil size={13} /> Edit</button>}</header>
        <p className="agent-muted">{department.area === 'store' ? 'Qalo Store' : capital(department.area)}</p>
        <dl className="agent-workload"><Fact label="Eligible agents">{agents.length}</Fact><Fact label="Open conversations">{data.conversations.filter(c => c.departmentId === department.id && c.status !== 'resolved').length}</Fact><Fact label="Active tickets">{data.tickets.filter(t => t.departmentId === department.id && !closed.includes(ticketState(t))).length}</Fact>{workspace.supportMode === 'banking' && <Fact label="Open cases">{data.bankingCases?.filter(c => c.departmentId === department.id && !closed.includes(c.status)).length ?? 0}</Fact>}</dl>
        <div className="agent-labels">{agents.map(({ agent }) => <button type="button" className="agent-tag" key={agent.id} onClick={() => { setView('Agents'); setQuery(''); setFilter('all'); setWorkspaceFilter(workspaceId); setSelection(agent.userId) }}>{agent.name}</button>)}</div>
      </article>
    })}{!snapshot.departments.length && <p className="agent-muted">No departments are recorded in this workspace.</p>}</div>}
    {editor && <TeamDrawer editor={editor} workspaceId={editor.kind === 'edit' ? editor.entry.agent.workspaceId : workspaceId} workspaces={managedWorkspaces} store={store} error={error} save={save} close={close} />}
  </section>
}

function Avatar({ agent }: { agent: WorkspaceAgent }) { return <span aria-hidden="true" className="agent-avatar">{agent.initials}</span> }
function Status({ value }: { value: string }) { return <span className="agent-status" data-state={value}><i />{capital(value)}</span> }
function Fact({ label, children }: { label: string; children: ReactNode }) { return <div><dt>{label}</dt><dd>{children}</dd></div> }
function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <section className="agent-card"><h3>{icon}{title}</h3><div>{children}</div></section> }

function Profile({ entry, data, store, workspaceId, activeWorkspaceId, visibleWorkspaces, actorId, managers, members, edit }: { entry: DirectoryAgent; data: DemoData; store: WorkspaceStore; workspaceId: string; activeWorkspaceId: string; visibleWorkspaces: Workspace[]; actorId: string; managers: boolean; members: boolean; edit: (trigger: HTMLElement) => void }) {
  const { agent, user, membership } = entry
  const { departments } = store.snapshots[workspaceId]
  const [tab, setTab] = useState<typeof tabs[number]>('Profile')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const tablist = useRef<HTMLDivElement>(null)
  const eligible = agent.departmentIds ?? departments.map(d => d.id)
  const conversations = data.conversations.filter(c => c.assigneeId === agent.id && c.status !== 'resolved')
  const tickets = data.tickets.filter(t => t.assigneeId === agent.id && !closed.includes(ticketState(t)))
  const cases = (data.bankingCases ?? []).filter(c => c.agentId === agent.id && !closed.includes(c.status))
  const assignments = [...conversations.map(c => ({ id: c.id, label: c.customer, url: `/inbox?conversation=${encodeURIComponent(c.id)}` })), ...tickets.map(t => ({ id: t.id, label: t.subject, url: `/tickets?ticket=${encodeURIComponent(t.id)}` })), ...cases.map(c => ({ id: c.id, label: c.subject, url: `${caseRoutes[c.kind]}?case=${encodeURIComponent(c.id)}` }))]
  const events = [
    ...(agent.activity ?? []),
    ...data.tickets.flatMap(ticket => (ticket.activity ?? []).filter(event => event.actorId === user.id).map(event => ({ id: event.id, time: event.timestamp, actorId: user.id, detail: `Ticket ${ticket.id} · ${event.type.replaceAll('-', ' ')}` }))),
    ...(data.bankingCases ?? []).flatMap(record => record.history.filter(event => event.actorId === user.id).map(event => ({ id: event.id, time: event.time, actorId: user.id, detail: `Case ${record.reference} · ${(event.type ?? 'update').replaceAll('-', ' ')}` }))),
  ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
  const workspace = store.workspaces.find(w => w.id === workspaceId)
  async function saveAvailability(presence: NonNullable<WorkspaceAgent['presence']>, ids: string[]) {
    if (busy) return
    setBusy(true); setNotice(''); setError('')
    try { await ticketSupport.agent(workspaceId, actorId, agent.id, presence, ids); setNotice(supportService.persistenceState() === 'persistent' ? 'Agent assignments and availability saved.' : 'Agent assignments and availability saved for this session.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The agent could not be updated.') }
    finally { setBusy(false) }
  }
  return <>
    <header className="agent-profile-head"><Avatar agent={agent} /><div><h2>{agent.name}</h2><p>{titleFor(entry) || roleName(entry)}</p><div className="agent-labels"><Status value={user.status} />{actorId === user.id && <span className="agent-role">You</span>}{membership.status !== 'active' && <span className="agent-role">Workspace access paused</span>}</div></div>{members && <button type="button" className="button-primary" onClick={e => edit(e.currentTarget)}><Pencil size={15} /> Edit Agent</button>}</header>
    <div ref={tablist} className="agent-profile-tabs" role="tablist" aria-label="Agent details" onKeyDown={event => {
      const index = tabs.indexOf(tab)
      const next = ({ ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 })[event.key]
      if (next === undefined) return
      event.preventDefault(); setTab(tabs[next]); tablist.current?.querySelectorAll('button')[next]?.focus()
    }}>{tabs.map((item, index) => { const Icon = [UserRound, ShieldCheck, Layers, Clock][index]; return <button type="button" role="tab" key={item} id={`agent-tab-${index}`} aria-selected={tab === item} aria-controls="agent-detail-panel" tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)}><Icon size={17} />{item}</button> })}</div>
    <div className="agent-detail-panel" role="tabpanel" id="agent-detail-panel" aria-labelledby={`agent-tab-${tabs.indexOf(tab)}`} tabIndex={0}>
      {notice && <p role="status" className="agent-notice">{notice}</p>}{error && <p role="alert" className="agent-error">{error}</p>}
      {tab === 'Profile' && <><div className="agent-profile-grid"><Card title="Personal Information" icon={<UserRound size={17} />}><dl className="agent-fields"><Fact label="Full name">{agent.name}</Fact><Fact label="Email address">{emailFor(entry) || 'Not recorded'}</Fact><Fact label="Phone number">{agent.phone || 'Not recorded'}</Fact><Fact label="Job title">{titleFor(entry) || 'Not recorded'}</Fact></dl></Card>
        <div className="agent-card-stack"><Card title="Primary Role" icon={<ShieldCheck size={17} />}><span className="agent-role">{roleName(entry)}</span><p className="agent-muted">{user.role === 'administrator' ? 'Manages platform access and workspace configuration.' : membership.role === 'supervisor' ? 'Oversees support operations and department assignments.' : membership.role === 'agent' ? 'Handles support cases and conversations.' : 'Has read-only workspace access.'}</p></Card><Card title="Account Status" icon={<Clock size={17} />}><Status value={user.status} /><label className="agent-presence">Availability<select aria-label="availability" disabled={busy || (!managers && actorId !== user.id)} value={agent.presence ?? ''} onChange={e => void saveAvailability(e.target.value as NonNullable<WorkspaceAgent['presence']>, eligible)}><option value="" disabled>Not set</option>{presenceOptions.map(p => <option key={p}>{p}</option>)}</select></label></Card></div></div>
        <Card title="Assignment & Access" icon={<Layers size={17} />}><dl className="agent-workload"><Fact label="Departments">{agent.departmentIds === undefined ? 'All departments' : departments.filter(d => eligible.includes(d.id)).map(d => d.name).join(', ') || 'None'}</Fact><Fact label="Workspace access">{membership.status === 'active' && user.status === 'active' ? workspace?.name : 'Restricted'}</Fact><Fact label="Last sign-in">Not recorded</Fact></dl><dl className="agent-workload"><Fact label="Open conversations">{conversations.length}</Fact><Fact label="Active tickets">{tickets.length}</Fact>{workspace?.supportMode === 'banking' && <Fact label="Open cases">{cases.length}</Fact>}</dl></Card></>}
      {tab === 'Roles & Access' && <Card title="Workspace roles and access" icon={<ShieldCheck size={17} />}><dl className="agent-fields">{visibleWorkspaces.map(item => {
        const member = store.memberships.find(m => m.userId === user.id && m.workspaceId === item.id)
        const role = user.role === 'administrator' ? 'Administrator' : member && roleLabels[member.role]
        const access = canInWorkspace(user, item, store.memberships, 'view')
        return <Fact key={item.id} label={item.name}>{role ? `${role} · ${access ? 'Active' : 'Restricted'}` : 'No access'}</Fact>
      })}</dl><h4>Permissions in {workspace?.name}</h4><ul className="agent-permissions">{([['view', 'View workspace'], ['reply', 'Handle support'], ['manage-support', 'Manage support operations'], ['manage-members', 'Manage workspace access'], ['manage-platform', 'Manage platform']] as const).map(([capability, label]) => <li key={capability}>{label} <strong>{canInWorkspace(user, workspace, store.memberships, capability) ? 'Allowed' : 'Restricted'}</strong></li>)}</ul>{members && <Link to="/workspaces">Manage access across workspaces</Link>}</Card>}
      {tab === 'Departments' && <Card title="Department assignments" icon={<Layers size={17} />}><fieldset disabled={busy || !managers || !activeWorkspaceAgent(store, agent)}><legend className="sr-only">Department memberships</legend>{departments.map(d => <label key={d.id} className="check-field"><input type="checkbox" checked={eligible.includes(d.id)} onChange={e => void saveAvailability(agent.presence ?? 'away', e.target.checked ? [...eligible, d.id] : eligible.filter(id => id !== d.id))} />{d.name}</label>)}</fieldset><h4>Current support assignments</h4>{assignments.length ? <ul>{assignments.map(record => <li key={record.id}>{activeWorkspaceId === workspaceId ? <Link to={record.url}>{record.label}</Link> : record.label}</li>)}</ul> : <p className="agent-muted">No open support assignments.</p>}</Card>}
      {tab === 'Activity' && <Card title="Recorded activity" icon={<Clock size={17} />}>{events.length ? <ol className="agent-activity">{events.map(event => <li key={event.id}><span><strong>{event.detail}</strong><small>{store.users.find(u => u.id === event.actorId)?.name ?? 'Unknown actor'}</small></span><time dateTime={event.time}>{time(event.time)}</time></li>)}</ol> : <p className="agent-muted">No activity has been recorded for this agent in this workspace.</p>}</Card>}
    </div>
  </>
}
function TeamDrawer({ editor, workspaceId, workspaces, store, error, save, close }: { editor: Editor; workspaceId: string; workspaces: Workspace[]; store: WorkspaceStore; error: string; save: (command: ManagementCommand) => boolean; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [profile, setProfile] = useState<AgentProfileDraft>(() => editor.kind === 'edit' ? {
    name: editor.entry.agent.name, email: emailFor(editor.entry), phone: editor.entry.agent.phone ?? '', title: titleFor(editor.entry), role: editor.entry.membership.role, status: editor.entry.membership.status, accountStatus: editor.entry.user.status,
  } : { name: '', email: '', phone: '', title: '', role: 'agent', status: 'active', accountStatus: 'active' })
  const [existing, setExisting] = useState('')
  const protectedAccount = editor.kind === 'edit' && editor.entry.user.role === 'administrator'
  function workspaceChoices(userId?: string, adding = false) {
    return workspaces.map(item => {
      const membership = store.memberships.find(member => member.userId === userId && member.workspaceId === item.id)
      const agent = store.snapshots[item.id].agents.find(record => record.userId === userId)
      return {
        workspaceId: item.id, role: membership?.role ?? 'agent' as const, departmentIds: agent?.departmentIds,
        enabled: protectedAccount || membership?.status === 'active' || (adding && item.id === workspaceId),
      }
    })
  }
  const [choices, setChoices] = useState(() => workspaceChoices(editor.kind === 'edit' ? editor.entry.user.id : undefined, editor.kind === 'add'))
  const hasAccess = choices.some(choice => choice.enabled)
  function updateChoice(id: string, changes: Partial<Omit<AgentWorkspaceAccess, 'workspaceId'> & { enabled: boolean }>) {
    setChoices(current => current.map(choice => choice.workspaceId === id ? { ...choice, ...changes } : choice))
  }
  const [departmentName, setDepartmentName] = useState(editor.kind === 'department' ? editor.department?.name ?? '' : '')
  const [area, setArea] = useState<BusinessArea>(editor.kind === 'department' ? (editor.department?.area as BusinessArea | undefined) ?? 'general' : 'general')
  const banking = store.workspaces.find(w => w.id === workspaceId)?.supportMode === 'banking'
  const accounts = store.users.filter(user => user.role !== 'administrator' && user.status === 'active' &&
    workspaces.some(item => !store.memberships.some(m => m.workspaceId === item.id && m.userId === user.id && m.status === 'active')))
  const title = editor.kind === 'add' ? 'Add Agent' : editor.kind === 'edit' ? 'Edit Agent' : editor.department ? 'Edit Department' : 'Add Department'
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  function dismiss() { dialog.current?.close(); close() }
  function submit() {
    if (editor.kind === 'department') return save({ kind: 'department', workspaceId, departmentId: editor.department?.id, name: departmentName, area })
    if (editor.kind === 'edit' && protectedAccount) return save({ kind: 'agent-profile', workspaceId, agentId: editor.entry.agent.id, draft: profile })
    return save({
      kind: 'agent-access', workspaceId, userId: editor.kind === 'edit' ? editor.entry.user.id : existing || undefined,
      profile: existing ? undefined : profile,
      access: choices.filter(choice => choice.enabled).map(({ workspaceId, role, departmentIds }) => ({ workspaceId, role, departmentIds })),
    })
  }
  return <dialog className="agent-drawer" ref={dialog} aria-labelledby="agent-drawer-title" onCancel={event => { event.preventDefault(); dismiss() }}>
    <header><h2 id="agent-drawer-title">{title}</h2><button type="button" className="icon-button" aria-label="Close team editor" onClick={dismiss}><X size={19} /></button></header>
    <form onSubmit={event => { event.preventDefault(); if (submit()) dismiss() }}>
      {editor.kind === 'department' ? <><label>Department name<input required maxLength={100} value={departmentName} onChange={e => setDepartmentName(e.target.value)} /></label>{!banking && !editor.department && <label>Business area<select value={area} onChange={e => setArea(e.target.value as BusinessArea)}><option value="general">General</option><option value="community">Community</option><option value="store">Qalo Store</option></select></label>}</> : <>
        {editor.kind === 'add' && <><label>Account<select value={existing} onChange={e => { setExisting(e.target.value); setChoices(workspaceChoices(e.target.value || undefined, true)) }}><option value="">Create a local account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><p className="agent-muted">Select an existing account to give the same identity access to additional workspaces.</p></>}
        {!existing && <><label>Full name<input required maxLength={100} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label><label>Email address<input type="email" maxLength={200} value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} /></label></>}
        {editor.kind === 'edit' && <div className="agent-form-grid"><label>Phone number<input type="tel" maxLength={40} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></label><label>Job title<input maxLength={100} value={profile.title} onChange={e => setProfile({ ...profile, title: e.target.value })} /></label></div>}
        <fieldset className="agent-access-options" aria-describedby={hasAccess ? undefined : 'agent-access-required'}>
          <legend>Workspace Access</legend>
          {workspaces.map(item => {
            const choice = choices.find(option => option.workspaceId === item.id)
            if (!choice) return null
            const departments = store.snapshots[item.id].departments
            const selected = choice.departmentIds ?? departments.map(department => department.id)
            return <section className="agent-access-option" key={item.id}>
              <label className="check-field"><input type="checkbox" checked={choice.enabled} disabled={protectedAccount} onChange={e => updateChoice(item.id, { enabled: e.target.checked })} />{item.name}</label>
              {choice.enabled && (protectedAccount ? <p className="agent-muted">Administrator</p> : <>
                <label>{item.name} role<select value={choice.role} onChange={e => updateChoice(item.id, { role: e.target.value as AgentWorkspaceAccess['role'] })}>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
                <details>
                  <summary>{item.name} departments ({selected.length} of {departments.length})</summary>
                  <fieldset><legend className="sr-only">{item.name} departments</legend>{departments.map(department => <label className="check-field" key={department.id}>
                    <input type="checkbox" checked={selected.includes(department.id)} onChange={e => updateChoice(item.id, { departmentIds: e.target.checked ? [...selected, department.id] : selected.filter(id => id !== department.id) })} />{department.name}
                  </label>)}</fieldset>
                </details>
              </>)}
            </section>
          })}
          {!hasAccess && <p className="agent-error" id="agent-access-required">Select at least one workspace.</p>}
        </fieldset>
        {editor.kind === 'edit' && <><label>Account status<select disabled={protectedAccount} value={profile.accountStatus} onChange={e => setProfile({ ...profile, accountStatus: e.target.value as AgentProfileDraft['accountStatus'] })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label><p className="agent-muted">Account status applies across workspaces.</p></>}
      </>}
      {error && <p role="alert" className="agent-error">{error}</p>}
      <footer><button type="button" className="button-secondary" onClick={dismiss}>Cancel</button><button className="button-primary" type="submit" disabled={editor.kind !== 'department' && !hasAccess}>{editor.kind === 'add' ? 'Add Agent' : 'Save Changes'}</button></footer>
    </form>
  </dialog>
}
