import { localPreferences } from './lib/storage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Activity, Archive, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, AtSign,
  BarChart3, Bell, BookOpen, Bot, Check, CheckCheck, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Command, FileText,
  Inbox, Kanban, ListFilter, Menu, MessageCircle, MoreHorizontal,
  Paperclip, Plus, Search, Send, Settings, ShieldCheck, Smile, Sparkles,
  Sun, Ticket, Users, UserRound, UserRoundCheck, X, Zap,
} from 'lucide-react'
import { type Conversation, type DemoData, type Message } from './data/demoData'
import { branding } from './lib/branding'
import { matchesArea, areaLabels } from './lib/business'
import { BusinessProvider, BusinessFilter, useBusinessArea } from './features/BusinessArea'
import { SupportContext } from './features/SupportContext'
import { SupportReports as Reports } from './features/SupportReports'
import { useDemo } from './lib/demoStore'
import { CustomerChat, HelpCentre } from './features/CustomerChat'
import { CustomerPreview } from './features/CustomerPreview'
import { Knowledge } from './features/Knowledge'
import { Tickets, Contacts } from './features/Records'
import { Activities } from './features/Workflow'
import { LiveWorkspace } from './features/LiveWorkspace'
import { Pipelines as CrmPipeline } from './features/Pipelines'
import { AiConfiguration, Automations, SavedReplies, WidgetConfiguration } from './features/ConfigurationEditors'
import { Feedback } from './features/Feedback'
import { Retail } from './features/Retail'
import { SettingsPage } from './features/ConfigurationEditors'
import './App.css'
import { DemoAccessProvider, DemoSignIn, useDemoAccess } from './features/DemoAccess'
import { supportService } from './lib/supportService'
import { mergeWorkspaceSettings } from './lib/workspaceSettings'
const { agents: mockAgents, notifications: mockNotifications } = supportService.referenceData()

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
const navItems = [
  { label: 'Overview', path: '/overview', icon: BarChart3 },
  { label: 'Inbox', path: '/inbox', icon: Inbox, badge: '4' },
  { label: 'Visitors', path: '/visitors', icon: Activity },
  { label: 'Orders & products', path: '/retail', icon: Archive },
  { label: 'Tickets', path: '/tickets', icon: Ticket, badge: '3' },
  { label: 'Contacts & organisations', path: '/contacts', icon: Users },
  { label: 'Enquiry & applications', path: '/pipeline', icon: Kanban },
  { label: 'Knowledge base', path: '/knowledge', icon: BookOpen },
  { label: 'Saved replies', path: '/saved-replies', icon: FileText },
  { label: 'Integrations', path: '/integrations', icon: Settings },
  { label: 'Automations', path: '/automations', icon: Zap },
  { label: 'AI Assist', path: '/ai-assist', icon: Bot },
  { label: 'Team', path: '/team', icon: UserRoundCheck },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
  { label: 'Activities', path: '/activities', icon: Clock3 },
  { label: 'Feedback', path: '/feedback', icon: Smile },
  { label: 'Chat widget', path: '/widget', icon: MessageCircle },
]
const queues = ['All', 'Mine', 'Unassigned', 'Waiting', 'Resolved'] as const
type Queue = (typeof queues)[number]
type MobilePanel = 'list' | 'chat' | 'context'

function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><BusinessProvider><DemoAccessProvider><Routes><Route path="/customer-preview" element={<CustomerPreview />} /><Route path="/signin" element={<DemoSignIn />} /><Route path="/chat" element={<CustomerChat />} /><Route path="/help" element={<HelpCentre />} /><Route path="/live" element={<LiveWorkspace />} /><Route path="/live-chat" element={<LiveWorkspace customer />} /><Route path="*" element={<DemoWorkspace />} /></Routes></DemoAccessProvider></BusinessProvider></BrowserRouter></QueryClientProvider>
}

function DemoWorkspace() {
  const { data, setData, error, saveError, saving } = useDemo()
  if (!data) return <div className="app-shell standalone enhanced"><main className="customer-chat glass-panel"><h1>Qalo Ya Afrika Support</h1><p role={error ? 'alert' : 'status'}>{error ? `Unable to load your workspace: ${error.message}. Reload to retry.` : 'Opening your workspace…'}</p></main></div>
  return <><Workspace data={data} setData={setData} />{saving && <div className="save-status" role="status">Saving changes…</div>}{saveError && <div className="toast-message" role="alert">Changes could not be saved: {saveError}. Retry your action.</div>}</>
}

function Workspace({ data, setData }: { data: DemoData; setData: (update: DemoData | ((current: DemoData) => DemoData)) => Promise<boolean> }) {
  const { area, setArea } = useBusinessArea()
  const { role, setRole } = useDemoAccess()
  const agent = mockAgents.find(a => a.role === role)!
  const agentName = agent.name
  const agentInitials = agent.initials
  const notificationPreferences = mergeWorkspaceSettings(data.settings).notifications
  const visibleNotifications = mockNotifications.filter(notification => {
    const title = notification.title.toLowerCase()
    if (title.includes('assigned')) return notificationPreferences.assignment
    if (title.includes('follow-up')) return notificationPreferences.followUp
    if (title.includes('reply')) return notificationPreferences.reply
    if (title.includes('mention')) return notificationPreferences.mention
    return true
  })
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [queue, setQueue] = useState<Queue>('All')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(location.search).get('conversation') || 'conv-1')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('list')
  const [composer, setComposer] = useState('')
  const sending = useRef(false)
  const [internalNote, setInternalNote] = useState(false)
  const [showTicketDialog, setShowTicketDialog] = useState(false)
  const [ticketSubject, setTicketSubject] = useState('')
  const [toast, setToast] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsRead, setNotificationsRead] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(true)
  const [lightTheme, setLightTheme] = useState(() => localPreferences.getItem('qalo-theme') !== 'dark')

  useEffect(() => { const id = new URLSearchParams(location.search).get('conversation'); if (id) { setSelectedId(id); setArea('all'); setMobilePanel('chat') } }, [location.search, setArea])
  useEffect(() => { setCollapsed(false) }, [location.pathname])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('[aria-label="Search inbox"]')?.focus() }
      if (event.key === 'Escape') { setShowTicketDialog(false); setProfileOpen(false); setNotificationsOpen(false); setCollapsed(false) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    if (!notificationsOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => { if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false) }
    window.addEventListener('pointerdown', closeOnOutsideClick)
    return () => window.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [notificationsOpen])
  useEffect(() => {
    if (!showTicketDialog) return
    const previous = document.activeElement as HTMLElement
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = Array.from(document.querySelectorAll<HTMLElement>('.dialog button:not(:disabled), .dialog input'))
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', trap)
    return () => { window.removeEventListener('keydown', trap); previous?.focus() }
  }, [showTicketDialog])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const currentPath = location.pathname === '/' ? '/inbox' : location.pathname
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.conversations.filter((conversation) => {
      const latest = conversation.messages.at(-1)?.text ?? ''
      const matchesQueue = queue === 'All' ? conversation.status !== 'resolved'
        : queue === 'Mine' ? conversation.assignee === agentName && conversation.status !== 'resolved'
          : queue === 'Unassigned' ? !conversation.assignee && conversation.status !== 'resolved'
            : queue === 'Waiting' ? conversation.status === 'waiting'
              : conversation.status === 'resolved'
      const matchesSearch = !query || `${conversation.customer} ${conversation.email} ${latest} ${conversation.tags.join(' ')}`.toLowerCase().includes(query)
      return matchesArea(conversation, area) && matchesQueue && matchesSearch && (priorityFilter === 'all' || conversation.priority === priorityFilter)
    }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [data.conversations, queue, search, priorityFilter, area, agentName])

  const activeConversation = data.conversations.find((conversation) => conversation.id === selectedId && matchesArea(conversation, area))
  const scopedData = { ...data, conversations: data.conversations.filter(c => matchesArea(c, area)), tickets: data.tickets.filter(t => matchesArea(t, area)), articles: data.articles.filter(a => matchesArea(a, area)), tasks: data.tasks?.filter(t => matchesArea(t, area)), applications: data.applications?.filter(a => matchesArea(a, area)) }
  const activeNav = navItems.find((item) => item.path === currentPath)

  function updateConversation(id: string, updater: (conversation: Conversation) => Conversation) {
    return setData((current) => ({ ...current, conversations: current.conversations.map((conversation) => conversation.id === id ? updater(conversation) : conversation) }))
  }

  async function sendMessage() {
    const text = composer.trim()
    if (!text || !activeConversation || sending.current) return
    sending.current = true
    const message: Message = { id: crypto.randomUUID(), author: agentName, text, time: new Date().toISOString(), kind: internalNote ? 'note' : 'agent', delivery: 'sent' }
    const saved = await updateConversation(activeConversation.id, (conversation) => ({ ...conversation, messages: [...conversation.messages, message], status: !internalNote && conversation.status === 'resolved' ? 'open' : conversation.status, unread: 0, updatedAt: message.time }))
    sending.current = false
    if (!saved) return
    setComposer('')
    setInternalNote(false)
    setToast(internalNote ? 'Private note added' : 'Reply saved')
    if (!internalNote) {
      const time = new Date().toISOString()
      await updateConversation(activeConversation.id, c => ({ ...c, messages: [...c.messages, { id: crypto.randomUUID(), author: c.customer, text: 'Thank you for the update. Please keep me informed.', time, kind: 'customer' }], updatedAt: time }))
    }
  }

  function assignToMe() {
    if (!activeConversation) return
    updateConversation(activeConversation.id, (conversation) => ({ ...conversation, assignee: agentName, history: [...conversation.history, { id: crypto.randomUUID(), title: 'Conversation assigned', detail: agentName, when: new Date().toLocaleString() }] }))
    setToast(`Assigned to ${agentName}`)
  }

  function toggleResolution() {
    if (!activeConversation) return
    const resolving = activeConversation.status !== 'resolved'
    updateConversation(activeConversation.id, (conversation) => ({ ...conversation, status: resolving ? 'resolved' : 'open', resolvedAt: resolving ? new Date().toISOString() : undefined, resolutionEvents: [...new Set([...(conversation.resolutionEvents || []), ...(conversation.resolvedAt ? [conversation.resolvedAt] : []), ...(resolving ? [new Date().toISOString()] : [])])] }))
    setToast(resolving ? 'Conversation resolved' : 'Conversation reopened')
  }

  function createTicket() {
    if (!activeConversation || !ticketSubject.trim()) return
    const ticket = { id: `T-${String(data.tickets.length + 2049)}`, subject: ticketSubject.trim(), customer: activeConversation.customer, status: 'Open' as const, priority: activeConversation.priority, assignee: activeConversation.assignee || 'Unassigned', updated: 'Just now', conversationId: activeConversation.id, businessArea: activeConversation.businessArea, category: activeConversation.category, contactId: activeConversation.contactId, organisationId: activeConversation.organisationId, reference: activeConversation.reference, initiative: activeConversation.initiative }
    setData((current) => ({ ...current, tickets: [ticket, ...current.tickets] }))
    setTicketSubject('')
    setShowTicketDialog(false)
    setToast(`Ticket ${ticket.id} created with conversation context`)
  }

  function exportTranscript() {
    if (!activeConversation) return
    const content = activeConversation.messages.filter(message => message.kind !== 'note').map((message) => `[${new Date(message.time).toLocaleString()}] ${''}${message.author}: ${message.text}`).join('\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeConversation.id}-transcript.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${lightTheme ? 'theme-light' : ''}`}>
    <aside className="sidebar glass-panel">
      <div className="brand-lockup">
        <img className="official-logo" src={branding.logo} alt={branding.name} />
        <button className="icon-button collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}><ChevronLeft size={16} /></button>
      </div>
      <button className="workspace-switcher" title="Workspace settings" onClick={() => navigate("/settings")}>
        <span className="workspace-avatar">Q</span>{!collapsed && <><span className="workspace-copy"><strong>Qalo Support</strong><small>Workspace</small></span><ChevronDown size={15} /></>}
      </button>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">
        {navItems.map(({ label, path, icon: Icon, badge }) => <Link key={path} to={path} className={`nav-link ${currentPath === path ? 'active' : ''}`} title={collapsed ? label : undefined}>
          <Icon size={17} strokeWidth={1.8} /><span className="nav-label">{label}</span>{badge && !collapsed && <span className="nav-badge">{path === '/inbox' ? data.conversations.filter(c => c.status !== 'resolved').length : data.tickets.filter(t => t.status !== 'Resolved').length}</span>}
        </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <Link to="/settings" className={`nav-link ${currentPath === '/settings' ? 'active' : ''}`} title={collapsed ? 'Settings' : undefined}><Settings size={17} strokeWidth={1.8} /><span className="nav-label">Settings</span></Link>
        {!collapsed && <div className="sidebar-help"><div className="help-icon"><CircleHelp size={17} /></div><strong>Need a hand?</strong><span>Visit the help centre</span><button onClick={() => navigate('/knowledge')}>Explore help <ArrowUpRight size={13} /></button></div>}
        <button className="agent-mini" onClick={() => setProfileOpen(!profileOpen)}><span className="avatar avatar-small">{agentInitials}<span className={`presence-dot ${available ? 'online' : ''}`} /></span>{!collapsed && <span className="agent-mini-copy"><strong>{agentName}</strong><small>{available ? 'Available' : 'Away'}</small></span>}{!collapsed && <MoreHorizontal size={17} />}</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar glass-panel">
        <div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setCollapsed(!collapsed)}><Menu size={18} /></button><span className="crumb-workspace">Qalo Support</span><ChevronRight size={14} /><strong>{activeNav?.label ?? (currentPath === '/settings' ? 'Settings' : 'Inbox')}</strong></div>
        <div className="topbar-tools">
          <label className="global-search"><Search size={16} /><input aria-label="Search inbox" value={search} onChange={(event) => { setSearch(event.target.value); navigate('/inbox') }} placeholder="Search inbox..." /><kbd><Command size={11} /> K</kbd></label>
          <span className="topbar-divider" />
          <button className="icon-button theme-toggle" aria-label={lightTheme ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => { const next = !lightTheme; setLightTheme(next); localPreferences.setItem('qalo-theme', next ? 'light' : 'dark') }}><Sun size={16} /></button>
          <div className="notifications-menu" ref={notificationsRef}><button className="icon-button notification-button" aria-label={notificationsRead || !visibleNotifications.length ? 'Notifications' : `Notifications, ${visibleNotifications.length} unread`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}><Bell size={17} />{!notificationsRead && visibleNotifications.length > 0 && <i />}</button>{notificationsOpen && <section className="notifications-popover" aria-label="Notifications"><header><strong>Notifications</strong><button type="button" disabled={notificationsRead || !visibleNotifications.length} onClick={() => setNotificationsRead(true)}>Mark all read</button></header><ul>{visibleNotifications.length ? visibleNotifications.map((notification, index) => <li key={notification.title} className={!notificationsRead && index < visibleNotifications.length ? 'unread' : ''}><button type="button" onClick={() => { setNotificationsRead(true); setNotificationsOpen(false); navigate(`/inbox?conversation=${notification.conversationId}`) }}><span className="notification-copy"><strong>{notification.title}</strong><span>{notification.detail}</span><small>{notification.time}</small></span>{!notificationsRead && <i aria-hidden="true" />}</button></li>) : <li className="notification-empty">No notifications match your preferences.</li>}</ul></section>}</div>
          <button className={`availability ${available ? 'is-available' : ''}`} onClick={() => setAvailable(!available)}><i />{available ? 'Available' : 'Away'}<ChevronDown size={13} /></button>
          <button className="profile-button" aria-label="Profile menu" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }}><span className="avatar avatar-small">{agentInitials}<span className={`presence-dot ${available ? 'online' : ''}`} /></span><ChevronDown size={13} /></button>
          {profileOpen && <div className="profile-popover"><strong>{agentName}</strong><span>{role}</span><label>Switch account<select aria-label="Switch account" value={role} onChange={e => setRole(e.target.value as typeof role)}>{mockAgents.map(a => <option key={a.id} value={a.role}>{a.name}</option>)}</select></label><button type="button" onClick={() => { setRole('Admin'); setProfileOpen(false); navigate('/signin') }}>Log out</button><button onClick={() => { setAvailable(!available); setProfileOpen(false) }}>Set {available ? 'away' : 'available'}</button><button onClick={() => { setProfileOpen(false); navigate('/settings') }}>Profile settings</button></div>}
        </div>
      </header>

      <div className="business-scope-bar"><BusinessFilter />{currentPath !== '/overview' && <span>One shared inbox. Separate support context.</span>}</div>

      <Routes>
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/overview" element={<Reports data={scopedData} setData={setData} overview />} />
        <Route path="/saved-replies" element={<SavedReplies data={data} setData={setData} />} />
        <Route path="/integrations" element={<SettingsPage />} />
        <Route path="/knowledge" element={<Knowledge data={scopedData} setData={setData} />} />
        <Route path="/tickets" element={<Tickets data={scopedData} setData={setData} />} />
        <Route path="/contacts" element={<Contacts data={data} setData={setData} />} />
        <Route path="/reports" element={<Reports data={scopedData} setData={setData} />} />
        <Route path="/retail" element={<Retail data={data} setData={setData} />} />
        <Route path="/widget" element={<WidgetConfiguration data={data} setData={setData} />} />
        <Route path="/ai-assist" element={<AiConfiguration data={data} setData={setData} />} />
        <Route path="/automations" element={<Automations data={data} setData={setData} />} />
        <Route path="/pipeline" element={<CrmPipeline data={scopedData} setData={setData} />} />
        <Route path="/feedback" element={<Feedback data={scopedData} setData={setData} />} />
        <Route path="/activities" element={<Activities data={scopedData} setData={setData} />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/inbox" element={<InboxWorkspace data={data} conversations={filteredConversations} active={activeConversation} queue={queue} setQueue={setQueue} selectedId={selectedId} setSelectedId={(id) => { setSelectedId(id); setComposer(''); setInternalNote(false); setMobilePanel('chat'); updateConversation(id, (conversation) => ({ ...conversation, unread: 0 })) }} mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} search={search} setSearch={setSearch} composer={composer} setComposer={setComposer} internalNote={internalNote} setInternalNote={setInternalNote} onSend={sendMessage} onAssign={assignToMe} onResolve={toggleResolution} onCreateTicket={() => setShowTicketDialog(true)} onExport={exportTranscript} onToast={setToast} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} onUpdate={(patch) => { if (activeConversation) updateConversation(activeConversation.id, c => ({ ...c, ...patch })) }} />} />
        <Route path="*" element={<ModulePage path={currentPath} data={data} setData={setData} onToast={setToast} />} />
      </Routes>
    </main>
    {showTicketDialog && activeConversation && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowTicketDialog(false) }}><section className="dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title"><div className="dialog-head"><div><span className="eyebrow">CONVERT CONVERSATION</span><h2 id="ticket-dialog-title">Create a ticket</h2></div><button className="icon-button" onClick={() => setShowTicketDialog(false)} aria-label="Close"><X size={17} /></button></div><label className="field-label">Subject<input autoFocus value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} placeholder={`Follow-up for ${activeConversation.customer}`} onKeyDown={(event) => { if (event.key === 'Enter') createTicket() }} /></label><p className="context-preserved"><ShieldCheck size={15} /> Customer, priority and conversation context will be linked.</p><div className="dialog-actions"><button className="button-secondary" onClick={() => setShowTicketDialog(false)}>Cancel</button><button className="button-primary" disabled={!ticketSubject.trim()} onClick={createTicket}><Plus size={15} /> Create ticket</button></div></section></div>}
    {toast && <div className="toast-message" role="status"><Check size={15} />{toast}</div>}
  </div>
}

type InboxProps = {
  priorityFilter: string; setPriorityFilter: (value: string) => void; onUpdate: (patch: Partial<Conversation>) => void
  data: DemoData; conversations: Conversation[]; active?: Conversation; queue: Queue; setQueue: (queue: Queue) => void
  selectedId: string; setSelectedId: (id: string) => void; mobilePanel: MobilePanel; setMobilePanel: (panel: MobilePanel) => void
  search: string; setSearch: (value: string) => void; composer: string; setComposer: (value: string) => void
  internalNote: boolean; setInternalNote: (value: boolean) => void; onSend: () => void; onAssign: () => void
  onResolve: () => void; onCreateTicket: () => void; onExport: () => void; onToast: (message: string) => void
}

function InboxWorkspace(props: InboxProps) {
  const { data, conversations, active, queue, setQueue, selectedId, setSelectedId, mobilePanel, setMobilePanel, search, setSearch, composer, setComposer, internalNote, setInternalNote, onSend, onAssign, onResolve, onCreateTicket, onExport, onToast } = props
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [replySearch, setReplySearch] = useState('')
  const [replyPicker, setReplyPicker] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [active?.messages.length])
  const unreadTotal = data.conversations.reduce((sum, conversation) => sum + conversation.unread, 0)

  function handleAttachment(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { onToast('Only JPEG, PNG and PDF files are supported'); return }
    if (file.size > 5 * 1024 * 1024) { onToast('Attachment exceeds the 5 MB limit'); return }
    setComposer(`${composer}${composer ? '\n' : ''}[Attachment reference: ${file.name}]`)
    onToast('Attachment reference added to your draft')
  }

  return <section className="inbox-layout" aria-label="Shared inbox">
    <aside className={`conversation-panel glass-panel glass-gradient-border glass-gradient-border-animated ${mobilePanel === 'list' ? 'mobile-active' : ''}`}>
      <div className="panel-heading"><div><div className="heading-overline">SHARED SUPPORT</div><h1>Inbox <span>{unreadTotal}</span></h1></div><button className="icon-button" aria-label="New conversation" onClick={() => window.open('/chat', '_blank', 'noopener')}><Plus size={18} /></button></div>
      <div className="inbox-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /><button aria-label="Conversation filters" onClick={() => setFiltersOpen(!filtersOpen)}><ListFilter size={15} /></button></div>
      <div className="queue-tabs" role="tablist" aria-label="Conversation queues">{queues.map((item) => <button key={item} role="tab" aria-selected={queue === item} className={queue === item ? 'selected' : ''} onClick={() => setQueue(item)}>{item}{item === 'Unassigned' && <small>{data.conversations.filter((conversation) => !conversation.assignee && conversation.status !== 'resolved').length}</small>}</button>)}</div>
      <label className="inbox-filter" hidden={!filtersOpen}>Priority<select value={props.priorityFilter} onChange={e => props.setPriorityFilter(e.target.value)}>{['all', 'low', 'normal', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}</select></label><div className="list-sort"><span>{conversations.length} conversations</span><button onClick={() => onToast('Conversations are sorted newest first')}><ArrowDownUp size={13} /> Latest</button></div>
      <div className="conversation-list">
        {conversations.map((conversation) => <button key={conversation.id} className={`conversation-row ${selectedId === conversation.id ? 'active' : ''}`} onClick={() => setSelectedId(conversation.id)}>
          <span className={`avatar avatar-customer tone-${conversation.tone}`}>{conversation.initials}<i className={conversation.channel === 'Website' ? 'channel-web' : 'channel-mail'}>{conversation.channel === 'Website' ? <MessageCircle size={9} /> : <AtSign size={9} />}</i></span>
          <span className="row-main"><span className="row-top"><strong>{conversation.customer}</strong><time>{formatRelative(conversation.updatedAt)}</time></span><span className="row-message">{conversation.messages.at(-1)?.kind === 'note' && <b>Note · </b>}{conversation.messages.at(-1)?.text}</span><span className="row-meta"><span className={`status-dot status-${conversation.status}`} />{conversation.status === 'waiting' ? 'Waiting' : conversation.assignee?.split(' ')[0] ?? 'Unassigned'}<span className="meta-separator">·</span>{conversation.tags[0] && <em>{conversation.tags[0]}</em>}</span></span>
          {conversation.unread > 0 && <span className="unread-count">{conversation.unread}</span>}
        </button>)}
        {conversations.length === 0 && <div className="empty-state"><Inbox size={24} /><strong>No conversations here</strong><span>Try another queue or search.</span></div>}
      </div>
      <div className="list-footer"><span><i className="online-dot" /> 3 agents online</span><button onClick={() => onToast('Queue settings are in Settings')} aria-label="Queue settings"><Settings size={14} /></button></div>
    </aside>

    <section className={`chat-panel glass-panel glass-gradient-border glass-gradient-border-animated ${mobilePanel === 'chat' ? 'mobile-active' : ''}`}>
      {active ? <>
        <header className="chat-header"><button className="mobile-back icon-button" onClick={() => setMobilePanel('list')} aria-label="Back to conversations"><ArrowLeft size={18} /></button><span className={`avatar avatar-customer tone-${active.tone}`}>{active.initials}</span><div className="chat-person"><strong>{active.customer}</strong><span><span className="status-dot status-open" />{active.status === 'resolved' ? 'Resolved' : 'Active conversation'} <span className="meta-separator">·</span> {active.channel}</span></div><div className="chat-actions"><button className="action-text" onClick={onCreateTicket}><Ticket size={15} /><span>Ticket</span></button><button className="icon-button" aria-label="Export transcript" onClick={onExport}><Archive size={16} /></button><button className="icon-button mobile-context-button" aria-label="Customer details" onClick={() => setMobilePanel('context')}><UserRound size={16} /></button><button className="icon-button" aria-label="More conversation actions" onClick={() => onToast('More actions: transfer, mark unread, or report')}><MoreHorizontal size={18} /></button></div></header>
        <div className="chat-subheader"><div className="breadcrumbs-mini"><span className="channel-icon"><MessageCircle size={13} /></span><span>{active.channel}</span><ChevronRight size={13} /><span>{active.id.toUpperCase()}</span></div><div className="header-assign"><button onClick={onAssign}><UserRoundCheck size={14} />{active.assignee ?? 'Assign to me'}<ChevronDown size={12} /></button><span className="priority-chip"><i className={`priority-${active.priority}`} />{active.priority}</span><button className="resolve-button" onClick={onResolve}>{active.status === 'resolved' ? <><ArrowRight size={13} /> Reopen</> : <><Check size={13} /> Resolve</>}</button></div></div>
        {active.status === 'resolved' && <div className="resolved-banner"><CheckCheck size={14} /> This conversation is resolved. Reopen it to reply.</div>}
        <div className="messages-scroll"><div className="day-divider"><span>{formatDate(active.createdAt)}</span></div>
          {active.messages.map((message) => <MessageBubble key={message.id} message={message} initials={active.initials} tone={active.tone} />)}
          {active.typing && <div className="typing-row"><span className="avatar avatar-customer tone-sage">{active.initials}</span><span className="typing-bubble"><i /><i /><i /></span><small>{active.customer} is typing</small></div>}
          <div ref={messageEndRef} />
        </div>
        <div className={`composer ${internalNote ? 'composer-note' : ''}`}>
          <div className="composer-tools"><button className={`composer-mode ${internalNote ? 'note-active' : ''}`} onClick={() => setInternalNote(!internalNote)}><FileText size={14} />{internalNote ? 'Internal note' : 'Reply'}<ChevronDown size={12} /></button><div className="composer-shortcuts"><button title="Saved replies" onClick={() => setReplyPicker(!replyPicker)}><Sparkles size={14} /></button><button title="Add attachment reference" onClick={() => fileRef.current?.click()}><Paperclip size={14} /></button><input ref={fileRef} className="visually-hidden" type="file" onChange={(event) => handleAttachment(event.target.files?.[0])} /></div><span className="composer-shortcut-hint">Search saved replies with the sparkle button</span></div>
          {replyPicker && <div className="saved-reply-picker enhanced"><label>Find saved reply<input value={replySearch} onChange={e => setReplySearch(e.target.value)} /></label>{data.savedReplies?.filter(r => r.approved && (r.businessArea === active.businessArea || r.businessArea === 'general') && `${r.title} ${r.body}`.toLowerCase().includes(replySearch.toLowerCase())).map(r => <button className="record-card" key={r.id} onClick={() => { setComposer(composer + (composer ? '\n' : '') + r.body); setInternalNote(false); setReplyPicker(false) }}>{r.title}</button>)}</div>}<textarea maxLength={4000} value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() } }} placeholder={internalNote ? 'Add a private note for your team...' : 'Write a reply...'} aria-label={internalNote ? 'Write an internal note' : 'Write a customer reply'} />
          <div className="composer-bottom"><span><ShieldCheck size={13} />{internalNote ? 'Only your team can see this note' : 'Replies as Qalo Support'}</span><div><span className="send-hint">Enter to send</span><button className="send-button" disabled={!composer.trim()} onClick={onSend} aria-label={internalNote ? 'Add internal note' : 'Send reply'}><Send size={15} /></button></div></div>
        </div>
      </> : <div className="empty-chat"><MessageCircle size={31} /><h2>Choose a conversation</h2><p>Select a customer from the list to get started.</p></div>}
    </section>

    <aside className={`context-panel glass-panel glass-gradient-border glass-gradient-border-static ${mobilePanel === 'context' ? 'mobile-active' : ''}`}>
      {active ? <>
        <div className="context-mobile-head"><button className="icon-button" onClick={() => setMobilePanel('chat')} aria-label="Back to conversation"><ArrowLeft size={17} /></button><strong>Customer details</strong></div>
        <div className="customer-profile"><span className={`avatar avatar-large tone-${active.tone}`}>{active.initials}</span><h2>{active.customer}</h2><span className="customer-type">{active.participantType || areaLabels[active.businessArea || 'general']}</span><div className="profile-actions"><button onClick={() => window.location.assign('/contacts')}><UserRound size={14} /> Profile</button><button onClick={() => onToast(`Email ${active.email}`)}><AtSign size={14} /> Email</button></div></div>
        <SupportContext conversation={active} data={data} update={props.onUpdate} /><div className="context-section"><div className="context-section-title"><span>Conversation details</span><button aria-label="Edit conversation details" onClick={() => onToast('Use the fields below to update conversation details')}>Edit</button></div><div className="enhanced context-edit"><label>Assignee<select aria-label="Assignee" value={active.assignee || ''} onChange={e => props.onUpdate({ assignee: e.target.value || null })}><option value="">Unassigned</option>{mockAgents.map(a => a.name).map(a => <option key={a}>{a}</option>)}</select></label><label>Department<select aria-label="Department" value={active.department} onChange={e => props.onUpdate({ department: e.target.value })}>{Array.from(new Set([active.department, ...(data.queues || []).filter(q => q.area === active.businessArea || q.area === 'general').map(q => q.name)])).map(d => <option key={d}>{d}</option>)}</select></label><label>Priority<select aria-label="Priority" value={active.priority} onChange={e => props.onUpdate({ priority: e.target.value as Conversation['priority'] })}>{['low','normal','high','urgent'].map(p => <option key={p}>{p}</option>)}</select></label><label>Tags (comma separated)<input key={active.id + '-tags'} defaultValue={active.tags.join(', ')} onBlur={e => props.onUpdate({ tags: Array.from(new Set(e.target.value.split(',').map(t => t.trim()).filter(Boolean))) })} /></label></div><Detail label="Channel" value={active.channel} /><Detail label="Created" value={formatDate(active.createdAt)} /></div>
        <div className="context-section"><div className="context-section-title"><span>Contact information</span><button aria-label="Edit customer information" onClick={() => window.location.assign('/contacts')}>Edit</button></div><Detail label="Email" value={active.email} /><Detail label="Location" value={active.location} /></div>
        <div className="context-section"><div className="context-section-title"><span>Tags</span><button aria-label="Add tag" onClick={() => onToast('Use the tag field below to edit tags')}><Plus size={13} /></button></div><div className="tag-list">{active.tags.map((tag) => <span key={tag}>{tag}<button aria-label={`Remove ${tag} tag`} onClick={() => props.onUpdate({ tags: active.tags.filter(t => t !== tag) })}>×</button></span>)}<button className="tag-add" onClick={() => onToast('Use the tag field above to edit tags')}>+ Add tag</button></div></div>
        <div className="context-section history-section"><div className="context-section-title"><span>Recent activity</span><button onClick={() => onToast('The entries below are the available conversation activity')}>View all</button></div>{active.history.map((item) => <div className="history-row" key={item.id}><span className="history-icon"><Clock3 size={12} /></span><div><strong>{item.title}</strong><small>{item.detail} · {item.when}</small></div></div>)}<button className="ticket-link" onClick={() => window.location.assign('/tickets')}><Ticket size={14} /> View tickets <ArrowRight size={13} /></button></div>
        <button className="context-article" onClick={() => window.open('/help', '_blank', 'noopener')}><BookOpen size={15} /><span><strong>Suggested article</strong><small>Track your order</small></span><ArrowUpRight size={13} /></button>
      </> : <div className="empty-context">Customer details appear here.</div>}
    </aside>
    <nav className="mobile-panel-nav" aria-label="Inbox panels"><button className={mobilePanel === 'list' ? 'active' : ''} onClick={() => setMobilePanel('list')}><Inbox size={17} /><span>Inbox</span></button><button className={mobilePanel === 'chat' ? 'active' : ''} onClick={() => setMobilePanel('chat')}><MessageCircle size={17} /><span>Chat</span></button><button className={mobilePanel === 'context' ? 'active' : ''} onClick={() => setMobilePanel('context')}><UserRound size={17} /><span>Customer</span></button></nav>
  </section>
}

function MessageBubble({ message, initials, tone }: { message: Message; initials: string; tone: string }) {
  const isCustomer = message.kind === 'customer'
  if (message.kind === 'note') return <div className="note-message"><div className="note-label"><FileText size={13} /> PRIVATE NOTE <span>{message.author}</span><time>{formatClock(message.time)}</time></div><p>{message.text}</p></div>
  return <div className={`message-row ${isCustomer ? 'from-customer' : 'from-agent'}`}>
    {isCustomer && <span className={`avatar avatar-message tone-${tone}`}>{initials}</span>}
    <div className="message-content"><div className="message-meta"><strong>{isCustomer ? message.author : 'You'}</strong><time>{formatClock(message.time)}</time></div><div className={`message-bubble ${isCustomer ? '' : 'agent-bubble'}`}>{message.text}</div>{!isCustomer && <div className="delivery-state"><Check size={12} /> {message.delivery === 'sent' ? 'Saved' : 'Sending'}</div>}</div>
    {!isCustomer && <span className="avatar avatar-message avatar-agent">BN</span>}
  </div>
}

function Detail({ label, value, avatar, status }: { label: string; value: string; avatar?: string; status?: string }) {
  return <div className="detail-row"><span>{label}</span><strong>{avatar && <i className="detail-avatar">{avatar}</i>}{status && <i className={`priority-indicator priority-${status}`} />}{value}</strong></div>
}

function ModulePage({ path, data, onToast }: { path: string; data: DemoData; setData: (update: (current: DemoData) => DemoData) => void; onToast: (message: string) => void }) {
  const current = navItems.find(item => item.path === path)
  if (!current) return <div className="module-page enhanced"><h1>Page not found</h1><Link to="/inbox">Return to inbox</Link></div>
  return <div className="module-page"><div className="module-heading"><div><span className="heading-overline">QALO YA AFRIKA</span><h1>{current.label}</h1><p>{moduleDescription(path)}</p></div></div>
    {path === '/visitors' ? <VisitorTable visitors={data.visitors} onToast={onToast} /> : path === '/team' ? <TeamSurface data={data} onToast={onToast} /> : <p>Select a support workspace from the navigation.</p>}
  </div>
}

function VisitorTable({ visitors, onToast }: { visitors: DemoData['visitors']; onToast: (message: string) => void }) {
  const [invited, setInvited] = useState<string[]>([])
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Visitor</th><th>Current page</th><th>Entry source</th><th>Activity</th><th>Chat status</th><th /></tr></thead><tbody>{visitors.map((visitor) => <tr key={visitor.id}><td><strong>{visitor.name}</strong><span>{visitor.location}</span></td><td>{visitor.page}</td><td>{visitor.source}</td><td>{visitor.activity}</td><td><span className={`table-status status-${visitor.status.toLowerCase()}`}>{invited.includes(visitor.id) ? 'Invitation draft' : visitor.status}</span></td><td><button className="button-secondary table-action" onClick={() => { setInvited(current => [...new Set([...current, visitor.id])]); onToast('Invitation draft prepared') }}>Prepare invitation</button></td></tr>)}</tbody></table></div>
}

function TeamSurface({ data, onToast }: { data: DemoData; onToast: (message: string) => void }) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const agents = mockAgents.map(a => [a.initials, a.name, a.role, 'Online'])
  return <><div className="team-summary"><span><strong>{agents.length}</strong> team members</span><span><i className="online-dot" /> {agents.filter(([, , , status]) => status === 'Online').length} available</span><button className="button-primary" onClick={() => setInviteOpen(true)}>Invite teammate <Plus size={14} /></button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Agent</th><th>Role</th><th>Availability</th><th>Open conversations</th><th>Department</th><th /></tr></thead><tbody>{agents.map(([initials, name, role, status]) => <tr key={name}><td><span className="table-person"><span className="avatar avatar-small tone-sage">{initials}</span><strong>{name}</strong></span></td><td>{role}</td><td><span className="agent-status"><i className={status === 'Online' ? 'online' : ''} />{status}</span></td><td>{data.conversations.filter(c => c.assignee === name && c.status !== 'resolved').length}</td><td>Customer care</td><td><button className="icon-button" aria-label={`View ${name}`} onClick={() => onToast(`${name} is a ${role.toLowerCase()} in Customer care` )}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div>{inviteOpen && <InviteTeammateDialog onClose={() => setInviteOpen(false)} />}</>
}

function InviteTeammateDialog({ onClose }: { onClose: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [submitted, setSubmitted] = useState(false)
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="dialog glass-panel invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-teammate-title"><div className="dialog-head"><div><span className="eyebrow">TEAM</span><h2 id="invite-teammate-title">Invite teammate</h2></div><button className="icon-button" type="button" aria-label="Close invite dialog" onClick={onClose}><X size={17} /></button></div>{submitted ? <div role="status" aria-live="polite"><p><strong>Invitation draft prepared for {firstName} {surname}.</strong></p><p>{email} · {role}</p><p className="muted">Ready for administrator review.</p><div className="dialog-actions"><button className="button-primary" type="button" onClick={onClose}>Done</button></div></div> : <form className="invite-form" onSubmit={event => { event.preventDefault(); setSubmitted(true) }}><div className="invite-name-fields"><label className="field-label invite-field">First name<input required autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} /></label><label className="field-label invite-field">Surname<input required autoComplete="family-name" value={surname} onChange={event => setSurname(event.target.value)} /></label></div><label className="field-label invite-field">Email address<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="field-label invite-field">Role<select required value={role} onChange={event => setRole(event.target.value)}><option value="">Choose a role</option><option>Admin</option><option>Supervisor</option><option>Agent</option></select></label><div className="dialog-actions"><button className="button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit">Save invitation draft</button></div></form>}</section></div>
}

function moduleDescription(path: string) {
  const descriptions: Record<string, string> = {
    '/overview': 'A clear view of your team’s support, today.', '/visitors': 'Understand who is browsing and offer help at the right moment.',
    '/tickets': 'Track work that needs a little more time.', '/contacts': 'Keep every customer relationship in one place.', '/pipeline': 'Track community participation, SME vetting and store support enquiries.',
    '/knowledge': 'Give customers and agents answers they can trust.', '/automations': 'Let thoughtful rules handle the repeatable work.', '/ai-assist': 'Help agents respond with your approved knowledge.',
    '/team': 'Make ownership, availability and responsibilities clear.', '/reports': 'Measure service with transparent, useful metrics.', '/activities': 'A shared record of what your team has done.', '/feedback': 'Keep a pulse on customer experience.', '/widget': 'Shape the customer chat experience on your site.',
  }
  return descriptions[path] ?? 'A calmer way to look after every customer.'
}

function formatRelative(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
  return mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
}
function formatClock(value: string) { return new Date(value).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) }

export default App
