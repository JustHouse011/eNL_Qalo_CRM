import { PasswordRecovery } from './features/PasswordRecovery'
import { loginPathForWorkspace } from './lib/loginBranding'
import { LogOut } from 'lucide-react'
import './features/SidebarLogout.css'
import { ArrowRightLeft } from 'lucide-react'
import { TransferChatDialog } from './features/TransferChatDialog'
import { mayTransfer } from './lib/conversationTransfer'
import { IdentityPage, DeveloperSession } from './features/Identity'
import { roleLabels, routeCapability } from './lib/identityPreview'
import { CrmDirectory } from './features/CrmDirectory'
import { LiveVisitorsDashboard } from './features/LiveVisitorsDashboard'
import { WorkspaceSelector } from './features/WorkspaceSelector'
import { OverviewDashboard } from './features/OverviewDashboard'
import { localPreferences } from './lib/storage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Archive, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, AtSign,
  Bell, BookOpen, Check, CheckCheck, ChevronDown, ChevronLeft,
  ChevronRight, Clock3, Command, FileText,
  Inbox, ListFilter, Menu, MessageCircle, MoreHorizontal,
  Paperclip, Plus, Search, Send, Settings, ShieldCheck, Sparkles,
  Sun, Ticket, UserRound, UserRoundCheck, X,
} from 'lucide-react'
import { type Conversation, type DemoData, type Message } from './data/demoData'
import { branding } from './lib/branding'
import { ticketSupport, eligibleAgent, ticketState } from './lib/ticketSupport'
import { activeWorkspaceAgent } from './lib/workspaceTypes'
import { AgentOperations } from './features/AgentOperations'
import { conversationSupport, conversationLabels, conversationState } from './lib/conversationLifecycle'
import { EnlPreview, BankingAssistant, BankingWidgetSettings } from './features/BankingWorkspace'
import { BankingCases, BankingKnowledge, BankingSettings, BankingTickets } from './features/BankingOperations'
import { BankingProducts } from './features/BankingProducts'
import { ComplaintsWorkspace } from './features/ComplaintsWorkspace'
import { workspaceExperience } from './lib/workspaceExperience'
import { workspaceIcons } from './features/workspaceIcons'
import { ENL_SLUG } from './lib/enlWorkspace'
import { useWorkspaceTaxonomy } from './features/workspaceTaxonomy'
import { matchesArea } from './lib/business'
import { BusinessProvider, BusinessFilter, useBusinessArea } from './features/BusinessArea'
import { SupportContext } from './features/SupportContext'
import { SupportReports as Reports } from './features/SupportReports'
import { useDemo } from './lib/demoStore'
import { CustomerChat, HelpCentre } from './features/CustomerChat'
import { CustomerPreview } from './features/CustomerPreview'
import { Knowledge } from './features/Knowledge'
import { Tickets } from './features/Records'
import { Activities } from './features/Workflow'
import { LiveWorkspace } from './features/LiveWorkspace'
import { Pipelines as CrmPipeline } from './features/Pipelines'
import { AiConfiguration, Automations, WidgetConfiguration } from './features/ConfigurationEditors'
import { Feedback } from './features/Feedback'
import { Retail } from './features/Retail'
import { SettingsPage } from './features/ConfigurationEditors'
import './App.css'
import { DemoAccessProvider, DemoSignIn, useDemoAccess } from './features/DemoAccess'
import { supportService } from './lib/supportService'
import { mergeWorkspaceSettings } from './lib/workspaceSettings'
import { Workspaces } from './features/Workspaces'
import { platformPreview } from './lib/workspaceManagement'
import { isAdministrator, getAccessibleWorkspaces } from './lib/workspaceTypes'
import { WorkspaceProvider, useWorkspace } from './features/WorkspaceContext'
const { agents: mockAgents, notifications: mockNotifications } = supportService.referenceData()

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
function rgb(color: string) { return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).join(',') }
const accountTitles: Record<string, string> = { '/account/profile': 'My Profile', '/account/security': 'Security', '/account/access': 'My Access', '/account/preferences': 'Preferences', '/platform': 'Platform Administration' }
const queues = ['All', 'Mine', 'Unassigned', 'Waiting', 'Escalated', 'Resolved'] as const
type Queue = (typeof queues)[number]
type MobilePanel = 'list' | 'chat' | 'context'

function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><DemoAccessProvider><WorkspaceSession><BusinessProvider><Routes><Route path="/enl-preview" element={<EnlPreviewRoute />} /><Route path="/customer-preview" element={<CustomerPreview />} /><Route path="/dev/session" element={import.meta.env.DEV ? <DeveloperSession /> : <Navigate to="/signin" replace />} /><Route path="/signin" element={<LegacySignIn />} /><Route path="/qalo/signin" element={<DemoSignIn key="qalo" brand="qalo" />} /><Route path="/enl/signin" element={<DemoSignIn key="enl" brand="enl" />} /><Route path="/qalo/forgot-password" element={<PasswordRecovery key="qalo-forgot" brand="qalo" />} /><Route path="/qalo/reset-password" element={<PasswordRecovery key="qalo-reset" brand="qalo" reset />} /><Route path="/enl/forgot-password" element={<PasswordRecovery key="enl-forgot" brand="enl" />} /><Route path="/enl/reset-password" element={<PasswordRecovery key="enl-reset" brand="enl" reset />} /><Route path="/chat" element={<CustomerChat />} /><Route path="/help" element={<HelpCentre />} /><Route path="/live" element={<LiveWorkspace />} /><Route path="/live-chat" element={<LiveWorkspace customer />} /><Route path="*" element={<DemoWorkspace />} /></Routes></BusinessProvider></WorkspaceSession></DemoAccessProvider></BrowserRouter></QueryClientProvider>
}

function LegacySignIn() {
  const location = useLocation()
  let workspaceId = new URLSearchParams(location.search).get('workspace') || ''
  if (!workspaceId) { try { workspaceId = supportService.registry().activeWorkspaceId } catch { /* Qalo is the legacy default. */ } }
  return <Navigate to={loginPathForWorkspace(workspaceId)} replace />
}

function WorkspaceSession({ children }: { children: React.ReactNode }) {
  const { role } = useDemoAccess()
  return <WorkspaceProvider key={role}>{children}</WorkspaceProvider>
}

function EnlPreviewRoute() {
  const { registry } = useWorkspace()
  const workspace = registry?.workspaces.find(w => w.slug === ENL_SLUG)
  return workspace ? <EnlPreview key={workspace.id} workspaceId={workspace.id} /> : <p role="status">Opening eNL preview...</p>
}

function DemoWorkspace() {
  const { role } = useDemoAccess()
  return role === 'signed-out' ? <Navigate to="/signin" replace /> : <AuthenticatedWorkspace />
}

function AuthenticatedWorkspace() {
  const { workspaceId, actorId, registry } = useWorkspace()
  const { data, setData, error, saveError, saving } = useDemo()
  if (registry && !workspaceId) return <Workspace key={actorId} data={{ conversations: [], tickets: [], contacts: [], visitors: [], articles: [] }} setData={async () => false} />
  if (!data) return <div className="app-shell standalone enhanced"><main className="customer-chat glass-panel"><h1>eNL/Qalo CRM</h1><p role={error ? 'alert' : 'status'}>{error ? `Unable to load your workspace: ${error.message}. Reload to retry.` : 'Opening your workspaceâ€¦'}</p></main></div>
  return <><BusinessProvider key={workspaceId}><Workspace key={`${workspaceId}:${actorId}`} data={data} setData={setData} /></BusinessProvider>{saving && <div className="save-status" role="status">Saving changesâ€¦</div>}{saveError && <div className="toast-message" role="alert">Changes could not be saved: {saveError}. Retry your action.</div>}</>
}

function Workspace({ data, setData }: { data: DemoData; setData: (update: DemoData | ((current: DemoData) => DemoData)) => Promise<boolean> }) {
  const { area, setArea, departmentId, setDepartmentId } = useBusinessArea()
  const { signOut } = useDemoAccess()
  const context = useWorkspace()
  const currentWorkspace = context.registry?.workspaces.find(w => w.id === context.workspaceId)
  const experience = useMemo(() => workspaceExperience(currentWorkspace), [currentWorkspace])
  const navItems = experience.sections.flatMap(section => section.items)
  const actor = context.actorId === platformPreview.id ? platformPreview : context.registry?.users.find(u => u.id === context.actorId)
  const availableWorkspaces = context.registry ? getAccessibleWorkspaces(actor, context.registry.workspaces, context.registry.memberships) : []
  const taxonomy = useWorkspaceTaxonomy()
  const viewAlive = useRef(true)
  useEffect(() => { viewAlive.current = true; return () => { viewAlive.current = false } }, [])
  const bank = experience.features.banking
  const scopedAgents = context.registry?.snapshots[context.workspaceId]?.agents.filter(a => activeWorkspaceAgent(context.registry!, a)) || []
  const agent = scopedAgents.find(a => a.userId === context.actorId) || (bank || isAdministrator(actor) ? scopedAgents[0] : mockAgents.find(a => a.name === actor?.name)) || { name: platformPreview.name, initials: 'PA' }
  const palette = currentWorkspace && (currentWorkspace.primaryColor !== '#933F98' || currentWorkspace.secondaryColor !== '#8CCDAB') ? { '--brand-purple': currentWorkspace.primaryColor, '--brand-mint': currentWorkspace.secondaryColor, '--primary': currentWorkspace.primaryColor, '--purple-rgb': rgb(currentWorkspace.primaryColor), '--mint-rgb': rgb(currentWorkspace.secondaryColor) } as React.CSSProperties : undefined
  const [, refreshPersonal] = useState(0)
  useEffect(() => { const refresh = () => refreshPersonal(n => n + 1); window.addEventListener('qalo-personal-change', refresh); return () => window.removeEventListener('qalo-personal-change', refresh) }, [])
  const agentName: string = (() => { try { return JSON.parse(localPreferences.getItem(`qalo-personal:${context.actorId}`) || '{}').name || actor?.name || agent.name } catch { return actor?.name || agent.name } })()
  const membership = context.registry?.memberships.find(m => m.userId === context.actorId && m.workspaceId === context.workspaceId && m.status === 'active')
  const identityRole = isAdministrator(actor) ? 'Administrator' : membership ? roleLabels[membership.role] : 'Standard User'
  const agentInitials = agentName.split(' ').map(n => n[0]).join('')
  const personalPreferences = (() => { try { return JSON.parse(localPreferences.getItem(`qalo-personal:${context.actorId}:preferences`) || '{}') } catch { return {} } })()
  const notificationPreferences = mergeWorkspaceSettings(data.settings).notifications
  const visibleNotifications = [...(context.workspaceId === 'workspace-qalo' ? mockNotifications : []), ...(data.notifications || [])].map((notification, index) => ({ ...notification, id: 'id' in notification ? String(notification.id) : `seed:${index}` })).filter(notification => {
    if ('recipientUserId' in notification && notification.recipientUserId && notification.recipientUserId !== context.actorId) return false
    const title = notification.title.toLowerCase()
    if (title.includes('assigned')) return notificationPreferences.assignment
    if (title.includes('follow-up')) return notificationPreferences.followUp
    if (title.includes('reply')) return notificationPreferences.reply
    if (title.includes('mention')) return notificationPreferences.mention
    return true
  }).filter(() => personalPreferences.notifications !== false)
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia('(max-width: 820px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)')
    const update = () => setMobileViewport(media.matches)
    media.addEventListener('change', update)
    const visibility = () => { document.documentElement.dataset.documentHidden = String(document.hidden) }
    visibility(); document.addEventListener('visibilitychange', visibility)
    return () => { media.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (!mobileViewport || !collapsed) return
    const previous = document.activeElement as HTMLElement | null
    const sidebar = document.getElementById('workspace-navigation')
    const focusable = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),select:not(:disabled)') || [])
    focusable()[0]?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    sidebar?.addEventListener('keydown', trap)
    return () => { sidebar?.removeEventListener('keydown', trap); previous?.focus() }
  }, [mobileViewport, collapsed])
  const [queue, setQueue] = useState<Queue>('All')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [handlingFilter, setHandlingFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(location.search).get('conversation') || 'conv-1')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('list')
  const [composer, setComposer] = useState('')
  const sending = useRef(false)
  const [internalNote, setInternalNote] = useState(false)
  const [showTicketDialog, setShowTicketDialog] = useState(false)
  const [ticketSubject, setTicketSubject] = useState('')
  const ticketRequest = useRef('')
  const ticketSubmitting = useRef(false)
  const [ticketBusy, setTicketBusy] = useState(false)
  const [ticketCategory, setTicketCategory] = useState('')
  const [ticketPriority, setTicketPriority] = useState<Conversation['priority']>('normal')
  const [ticketDepartment, setTicketDepartment] = useState('')
  const [ticketAssignee, setTicketAssignee] = useState('')
  const [toast, setToast] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const logoutPending = useRef(false)
  async function logout() {
    if (logoutPending.current) return
    logoutPending.current = true; setLoggingOut(true); setLogoutError('')
    try {
      signOut()
      await queryClient.cancelQueries()
      queryClient.clear()
      navigate(loginPathForWorkspace(context.workspaceId), { replace: true })
    } catch (cause) {
      if (viewAlive.current) setLogoutError(cause instanceof Error ? cause.message : 'Unable to sign out. Please retry.')
    } finally {
      logoutPending.current = false
      if (viewAlive.current) setLoggingOut(false)
    }
  }
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])
  const notificationsRead = visibleNotifications.every(n => readNotificationIds.includes(n.id))
  const notificationsRef = useRef<HTMLDivElement>(null)
  const presenceAgent = scopedAgents.find(a => a.userId === context.actorId)
  const available = presenceAgent?.presence === 'online'
  const presenceLabel = presenceAgent?.presence ? ` ${presenceAgent.presence}` : 'Availability not set'
  function setAvailable(next: boolean) { if (presenceAgent) void conversationAction(() => ticketSupport.agent(context.workspaceId, context.actorId, presenceAgent.id, next ? 'online' : 'away', [...(presenceAgent.departmentIds || context.registry!.snapshots[context.workspaceId].departments.map(d => d.id))]), 'availability saved') }
  const [lightTheme, setLightTheme] = useState(() => localPreferences.getItem('qalo-theme') !== 'dark')

  useEffect(() => { document.documentElement.classList.toggle('identity-reduced-motion', personalPreferences.reducedMotion === true); document.documentElement.classList.toggle('identity-high-contrast', personalPreferences.contrast === true) }, [personalPreferences.reducedMotion, personalPreferences.contrast])
  useEffect(() => { const id = new URLSearchParams(location.search).get('conversation'); if (id) { setSelectedId(id); setArea('all'); setDepartmentId(''); setMobilePanel('chat') } }, [location.search, setArea, setDepartmentId])
  useEffect(() => { setCollapsed(false) }, [location.pathname])
  useEffect(() => {
    const path = location.pathname === '/' ? '/' : location.pathname
    if (currentWorkspace && path !== '/' && !path.startsWith('/account/') && !path.startsWith('/platform') && !path.startsWith('/workspaces') && !experience.routes.includes(path)) navigate('/overview', { replace: true })
  }, [context.workspaceId, currentWorkspace, experience.routes, location.pathname, navigate])
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
      const items = Array.from(document.querySelectorAll<HTMLElement>('.dialog button:not(:disabled), .dialog input:not(:disabled), .dialog select:not(:disabled), .dialog textarea:not(:disabled)'))
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
  const filteredConversations = (() => {
    const query = search.trim().toLowerCase()
    return data.conversations.filter((conversation) => {
      const latest = conversation.messages.at(-1)?.text ?? ''
      const matchesQueue = queue === 'All' ? conversation.status !== 'resolved'
        : queue === 'Mine' ? (conversation.assigneeId ? conversation.assigneeId === scopedAgents.find(a => a.userId === context.actorId)?.id : conversation.assignee === (actor?.name || agentName)) && conversation.status !== 'resolved'
          : queue === 'Unassigned' ? !conversation.assignee && conversation.status !== 'resolved'
          : queue === 'Waiting' ? conversation.status === 'waiting'
            : queue === 'Escalated' ? conversation.priority === 'urgent' || conversation.tags.includes('Escalated')
              : conversation.status === 'resolved'
      const matchesSearch = !query || `${conversation.customer} ${conversation.email} ${latest} ${conversation.messages.map(m => m.text).join(' ')} ${conversation.category || ''} ${conversation.department} ${conversation.tags.join(' ')}`.toLowerCase().includes(query)
      return matchesArea(conversation, area) && (!departmentId || conversation.departmentId === departmentId) && matchesQueue && matchesSearch && (handlingFilter === 'all' || conversationState(conversation) === handlingFilter) && (priorityFilter === 'all' || conversation.priority === priorityFilter)
    }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  })()

  const activeConversation = data.conversations.find((conversation) => conversation.id === selectedId && matchesArea(conversation, area) && (!departmentId || conversation.departmentId === departmentId))
  const scopedData = { ...data, bankingCases: data.bankingCases?.filter(c => !departmentId || c.departmentId === departmentId), conversations: data.conversations.filter(c => matchesArea(c, area) && (!departmentId || c.departmentId === departmentId)), tickets: data.tickets.filter(t => matchesArea(t, area) && (!departmentId || t.departmentId === departmentId)), articles: data.articles.filter(a => matchesArea(a, area)), tasks: data.tasks?.filter(t => matchesArea(t, area)), applications: data.applications?.filter(a => matchesArea(a, area)) }
  const activeNav = navItems.find((item) => item.path === currentPath)

  function updateConversation(id: string, updater: (conversation: Conversation) => Conversation) {
    return setData((current) => ({ ...current, conversations: current.conversations.map((conversation) => conversation.id === id ? updater(conversation) : conversation) }))
  }

  async function conversationAction(action: () => Promise<unknown>, success: string) {
    try { await action(); setToast(success); return true }
    catch (cause) { setToast(cause instanceof Error ? cause.message : String(cause)); return false }
  }
  async function sendMessage() {
    const text = composer.trim()
    if (!text || !activeConversation || sending.current) return
    sending.current = true
    const id = activeConversation.id, note = internalNote
    try {
      const saved = await conversationAction(() => conversationSupport.reply(context.workspaceId, id, context.actorId, text, note), note ? 'Private note added' : 'Reply saved')
      if (!saved) return
      setComposer(''); setInternalNote(false)
      // Retain the existing fictional Qalo customer acknowledgement, not an AI reply.
      if (!note && !bank) await conversationSupport.customerMessage(context.workspaceId, id, 'Thank you for the update. Please keep me informed.')
    } finally { sending.current = false }
  }
  function assignToMe() {
    if (activeConversation) void conversationAction(() => conversationSupport.takeover(context.workspaceId, activeConversation.id, context.actorId), 'Human takeover recorded')
  }
  function toggleResolution() {
    if (activeConversation) void conversationAction(() => conversationSupport.resolve(context.workspaceId, activeConversation.id, context.actorId, activeConversation.status === 'resolved'), activeConversation.status === 'resolved' ? 'Conversation reopened' : 'Conversation resolved')
  }
  function returnToAi() {
    if (activeConversation) void conversationAction(() => conversationSupport.returnToAi(context.workspaceId, activeConversation.id, context.actorId), 'Returned to AI')
  }

  async function createTicket() {
    if (!activeConversation || !ticketSubject.trim() || ticketSubmitting.current) return
    ticketSubmitting.current = true; setTicketBusy(true)
    try {
      const id = await ticketSupport.create(context.workspaceId, context.actorId, { subject: ticketSubject, conversationId: activeConversation.id, category: ticketCategory, priority: ticketPriority, departmentId: ticketDepartment || null, assigneeId: ticketAssignee || null }, ticketRequest.current)
      if (!viewAlive.current) return
      setDepartmentId(''); setArea('all')
      setTicketSubject(''); setShowTicketDialog(false); setToast(`Ticket ${id} created with conversation context`); navigate(`/tickets?ticket=${id}`)
    } catch (error) { setToast(String(error)) } finally { ticketSubmitting.current = false; setTicketBusy(false) }
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

  return <div style={palette} className={`app-shell ${bank ? 'banking-shell' : ''} ${collapsed ? 'sidebar-collapsed' : ''} ${lightTheme ? 'theme-light' : ''}`}>
    <div className="ambient-glow" aria-hidden="true"><i className="glow-orb glow-orb-1" /><i className="glow-orb glow-orb-2" /><i className="glow-orb glow-orb-3" /></div>
    <aside id="workspace-navigation" className="sidebar glass-panel" aria-label="Workspace navigation" role={mobileViewport && collapsed ? "dialog" : undefined} aria-modal={mobileViewport && collapsed ? true : undefined} inert={mobileViewport && !collapsed}>
      <div className="brand-lockup">
        <>{currentWorkspace ? bank ? <picture><source media={collapsed ? '(min-width: 821px)' : '(min-width: 821px) and (max-width: 1060px)'} srcSet="/New%20Crest.svg" /><img className="official-logo" src="/new%20logo%20full%20colour.svg" alt={currentWorkspace.name} /></picture> : experience.logo ? <img className="official-logo" src={experience.logo} alt={currentWorkspace.name} /> : <strong>{currentWorkspace.name}</strong> : <img className="official-logo" src={branding.logo} alt={branding.name} />}</>
        <button className="icon-button collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}><ChevronLeft size={16} /></button>
      </div>
      <WorkspaceSelector options={availableWorkspaces} value={context.workspaceId} onChange={workspaceId => { if (window.confirm('Switch workspace? Open forms and unsent replies will be cleared.')) { context.selectWorkspace(workspaceId, context.actorId); navigate(location.pathname) } }} />
      <nav className="primary-nav" aria-label="Main navigation">
        {experience.sections.map(section => <div className="workspace-nav-section" key={section.label}><div className="side-section-label">{section.label.toUpperCase()}</div>{section.items.filter(item => context.can(context.actorId, routeCapability(item.path))).map(({ label, path, icon, badge }) => <Link key={path} to={path} aria-label={label} aria-current={currentPath === path ? 'page' : undefined} className={`nav-link ${currentPath === path ? 'active' : ''}`} title={collapsed ? label : undefined}>
          <WorkspaceNavIcon name={icon} /><span className="nav-label">{label}</span>{badge && !collapsed && <span className="nav-badge">{path === '/inbox' ? data.conversations.filter(c => c.status !== 'resolved').length : data.tickets.filter(t => !['Resolved', 'Closed'].includes(t.status)).length}</span>}
        </Link>)}</div>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="sidebar-logout" type="button" aria-label="Log Out" title="Log Out" disabled={loggingOut} aria-busy={loggingOut} onClick={() => void logout()}><LogOut size={18} aria-hidden="true" /><span>{loggingOut ? 'Logging out…' : 'Log Out'}</span></button>
      </div>
    </aside>

    {mobileViewport && collapsed && <button className="navigation-scrim" aria-label="Close navigation" onClick={() => setCollapsed(false)} />}
    <main className="main-area" inert={mobileViewport && collapsed}>
      <header className="topbar glass-panel">
<label className="global-search"><Search size={16} /><input aria-label="Search inbox" value={search} onChange={(event) => { setSearch(event.target.value); navigate('/inbox') }} placeholder="Search inbox..." /><kbd><Command size={11} /> K</kbd></label>
        <div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={collapsed} onClick={() => setCollapsed(!collapsed)}><Menu size={18} /></button><span className="crumb-workspace">{currentWorkspace?.name || "Workspaces"}</span><ChevronRight size={14} /><strong>{activeNav?.label ?? (accountTitles[currentPath] || 'Inbox')}</strong></div>
        <div className="topbar-tools">

          <span className="topbar-divider" />
          <button className="icon-button theme-toggle" aria-label={lightTheme ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => { const next = !lightTheme; setLightTheme(next); localPreferences.setItem('qalo-theme', next ? 'light' : 'dark') }}><Sun size={16} /></button>
          <div className="notifications-menu" ref={notificationsRef}><button className="icon-button notification-button" aria-label={notificationsRead || !visibleNotifications.length ? 'Notifications' : `Notifications, ${visibleNotifications.filter(n => !readNotificationIds.includes(n.id)).length} unread`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}><Bell size={17} />{!notificationsRead && visibleNotifications.length > 0 && <i />}</button>{notificationsOpen && <section className="notifications-popover" aria-label="Notifications"><header><strong>Notifications</strong><button type="button" disabled={notificationsRead || !visibleNotifications.length} onClick={() => setReadNotificationIds(visibleNotifications.map(n => n.id))}>Mark all read</button></header><ul>{visibleNotifications.length ? visibleNotifications.map((notification, index) => <li key={`${notification.title}:${notification.time}:${index}`} className={!notificationsRead && index < visibleNotifications.length ? 'unread' : ''}><button type="button" onClick={() => { setReadNotificationIds(visibleNotifications.map(n => n.id)); setNotificationsOpen(false); navigate(`/inbox?conversation=${notification.conversationId}`) }}><span className="notification-copy"><strong>{notification.title}</strong><span>{notification.detail}</span><small>{notification.time}</small></span>{!notificationsRead && <i aria-hidden="true" />}</button></li>) : <li className="notification-empty">No notifications match your preferences.</li>}</ul></section>}</div>
          <button className={`availability ${available ? 'is-available' : ''}`} disabled={!presenceAgent} onClick={() => setAvailable(!available)}><i />{presenceLabel}<ChevronDown size={13} /></button>
          <button className="profile-button" aria-label="Profile menu" aria-expanded={profileOpen} aria-controls={profileOpen ? "personal-account-menu" : undefined} onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }}><span className="avatar avatar-small">{agentInitials}<span className={`presence-dot ${available ? 'online' : ''}`} /></span><ChevronDown size={13} /></button>
          {profileOpen && <div id="personal-account-menu" className="profile-popover"><strong>{agentName}</strong><span>{identityRole}</span>{['My Profile', 'Security', 'My Access', 'Preferences', ...(isAdministrator(actor) ? ['Platform Administration'] : [])].map((label, i) => <button key={label} onClick={() => { setProfileOpen(false); navigate(['/account/profile', '/account/security', '/account/access', '/account/preferences', '/platform'][i]) }}>{label}</button>)}<button disabled={loggingOut} onClick={() => void logout()}>{loggingOut ? 'Logging out…' : 'Sign Out'}</button></div>}
        </div>
      </header>

      {currentPath !== '/reports' && <div className="business-scope-bar"><BusinessFilter />{currentPath !== '/overview' && <span>{bank ? 'Support records and queues' : 'One shared inbox. Separate support context.'}</span>}</div>}

      {!context.workspaceId && !currentPath.startsWith('/account/') && !currentPath.startsWith('/platform') && !currentPath.startsWith('/workspaces') ? <section className="module-page enhanced"><h1>No workspace available</h1><p>Ask an administrator to add an active workspace membership.</p><Link to="/workspaces">View workspaces</Link></section> : !context.can(context.actorId, routeCapability(currentPath)) ? <section className="module-page"><h1>Access unavailable</h1><p>Your current role does not permit this interface.</p></section> : <Routes>
        <Route path="/account/:section" element={<IdentityPage lightTheme={lightTheme} setTheme={next => { setLightTheme(next); localPreferences.setItem('qalo-theme', next ? 'light' : 'dark') }} />} />
        <Route path="/platform" element={<IdentityPage lightTheme={lightTheme} setTheme={setLightTheme} />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/workspaces/:workspaceId" element={<Workspaces />} />
        <Route path="/workspaces/:workspaceId/settings" element={<Workspaces />} />
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/overview" element={<OverviewDashboard data={scopedData} />} />
        <Route path="/integrations" element={bank ? <BankingSettings key="integrations" data={data} setData={setData} integrations /> : <SettingsPage />} />
        <Route path="/knowledge" element={bank ? <BankingKnowledge data={scopedData} setData={setData} /> : <Knowledge data={scopedData} setData={setData} />} />
        <Route path="/tickets" element={bank ? <BankingTickets data={scopedData} setData={setData} /> : <Tickets data={scopedData} setData={setData} />} />
        <Route path="/contacts" element={<CrmDirectory key={`${context.workspaceId}:${context.actorId}`} data={data} setData={setData} />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/retail" element={bank ? <Navigate to="/overview" replace /> : <Retail data={data} setData={setData} />} />
        <Route path="/returns" element={bank ? <Navigate to="/overview" replace /> : <Retail data={data} setData={setData} returnsOnly />} />
        <Route path="/account-support" element={bank ? <BankingCases key="accounts" kind="account" data={{ ...scopedData, bankingCases: data.bankingCases?.filter(c => !departmentId || c.departmentId === departmentId) }} setData={setData} /> : <Navigate to="/overview" replace />} />
        <Route path="/complaints" element={bank ? <ComplaintsWorkspace data={scopedData} /> : <Navigate to="/overview" replace />} />
        <Route path="/banking-products" element={bank ? <BankingProducts data={scopedData} /> : <Navigate to="/overview" replace />} />
        <Route path="/visitors" element={<LiveVisitorsDashboard key={`${context.workspaceId}:${context.actorId}`} />} />
        <Route path="/team" element={<AgentOperations data={data} />} />
        <Route path="/widget" element={bank ? <BankingWidgetSettings data={data} setData={setData} /> : <WidgetConfiguration data={data} setData={setData} />} />
        <Route path="/ai-assist" element={bank ? <BankingAssistant data={data} setData={setData} /> : <AiConfiguration data={data} setData={setData} />} />
        <Route path="/automations" element={<Automations data={data} setData={setData} />} />
        <Route path="/pipeline" element={bank ? <BankingCases key="applications" kind="application" data={{ ...scopedData, bankingCases: data.bankingCases?.filter(c => !departmentId || c.departmentId === departmentId) }} setData={setData} /> : <CrmPipeline data={scopedData} setData={setData} />} />
        <Route path="/feedback" element={<Feedback data={scopedData} setData={setData} />} />
        <Route path="/activities" element={<Activities data={scopedData} setData={setData} />} />
        <Route path="/settings" element={bank ? <BankingSettings key="settings" data={data} setData={setData} /> : <SettingsPage />} />
        <Route path="/inbox" element={<InboxWorkspace data={data} conversations={filteredConversations} active={activeConversation} queue={queue} setQueue={setQueue} selectedId={selectedId} setSelectedId={(id) => { setSelectedId(id); setComposer(''); setInternalNote(false); setMobilePanel('chat'); updateConversation(id, (conversation) => ({ ...conversation, unread: 0 })) }} mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} search={search} setSearch={setSearch} composer={composer} setComposer={setComposer} internalNote={internalNote} setInternalNote={setInternalNote} onSend={sendMessage} onAssign={assignToMe} onReturnToAi={returnToAi} onResolve={toggleResolution} onCreateTicket={() => { ticketRequest.current = crypto.randomUUID(); setTicketSubject(`Follow-up for ${activeConversation?.customer || 'customer'}`); setTicketAssignee(scopedAgents.find(a => a.id === activeConversation?.assigneeId && eligibleAgent(a, activeConversation?.departmentId))?.id || ''); setTicketCategory(activeConversation?.category || ''); setTicketPriority(activeConversation?.priority || 'normal'); setTicketDepartment(activeConversation?.departmentId || ''); setShowTicketDialog(true) }} onExport={exportTranscript} onToast={setToast} handlingFilter={handlingFilter} setHandlingFilter={setHandlingFilter} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} onUpdate={(patch) => { if (activeConversation) void conversationAction(() => conversationSupport.update(context.workspaceId, activeConversation.id, context.actorId, patch), 'Conversation updated') }} />} />
        <Route path="*" element={<ModulePage path={currentPath} />} />
      </Routes>}
    </main>
    {showTicketDialog && activeConversation && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowTicketDialog(false) }}><section className="dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title"><div className="dialog-head"><div><span className="eyebrow">CONVERT CONVERSATION</span><h2 id="ticket-dialog-title">Create a ticket</h2></div><button className="icon-button" onClick={() => setShowTicketDialog(false)} aria-label="Close"><X size={17} /></button></div><label className="field-label">Subject<input autoFocus value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} placeholder={`Follow-up for ${activeConversation.customer}`} onKeyDown={(event) => { if (event.key === 'Enter') createTicket() }} /></label><label>Category<select aria-label="Ticket category" value={ticketCategory} onChange={e => setTicketCategory(e.target.value)}>{Array.from(new Set([ticketCategory, ...taxonomy.categories[activeConversation.businessArea || 'general']])).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></label><label>Priority<select value={ticketPriority} onChange={e => setTicketPriority(e.target.value as Conversation['priority'])}>{['low', 'normal', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}</select></label><label>Department<select value={ticketDepartment} onChange={e => { setTicketDepartment(e.target.value); if (!scopedAgents.some(a => a.id === ticketAssignee && eligibleAgent(a, e.target.value))) setTicketAssignee('') }}><option value="">Unassigned</option>{context.registry?.snapshots[context.workspaceId].departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Assigned agent<select aria-label="Conversation ticket assignee" value={ticketAssignee} onChange={e => setTicketAssignee(e.target.value)}><option value="">Unassigned</option>{scopedAgents.filter(a => eligibleAgent(a, ticketDepartment)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><p className="context-preserved"><ShieldCheck size={15} /> Customer, priority and conversation context will be linked.</p><div className="dialog-actions"><button className="button-secondary" onClick={() => setShowTicketDialog(false)}>Cancel</button><button className="button-primary" disabled={ticketBusy || !ticketSubject.trim()} onClick={createTicket}><Plus size={15} /> Create ticket</button></div></section></div>}
    {logoutError && <div className="toast-message" role="alert">{logoutError}</div>}
    {toast && <div className="toast-message" role="status"><Check size={15} />{toast}</div>}
  </div>
}

type InboxProps = {
  handlingFilter: string; setHandlingFilter: (value: string) => void; priorityFilter: string; setPriorityFilter: (value: string) => void; onUpdate: (patch: Partial<Conversation>) => void
  data: DemoData; conversations: Conversation[]; active?: Conversation; queue: Queue; setQueue: (queue: Queue) => void
  selectedId: string; setSelectedId: (id: string) => void; mobilePanel: MobilePanel; setMobilePanel: (panel: MobilePanel) => void
  search: string; setSearch: (value: string) => void; composer: string; setComposer: (value: string) => void
  internalNote: boolean; setInternalNote: (value: boolean) => void; onSend: () => void; onAssign: () => void
  onReturnToAi: () => void; onResolve: () => void; onCreateTicket: () => void; onExport: () => void; onToast: (message: string) => void
}

function InboxWorkspace(props: InboxProps) {
  const { areaLabels, banking } = useWorkspaceTaxonomy()
  const { registry, workspaceId, can, actorId } = useWorkspace()
  const mockAgents = registry?.snapshots[workspaceId]?.agents.filter(a => activeWorkspaceAgent(registry, a)) || []
  const { data, conversations, active, queue, setQueue, selectedId, setSelectedId, mobilePanel, setMobilePanel, search, setSearch, composer, setComposer, internalNote, setInternalNote, onSend, onAssign, onResolve, onCreateTicket, onExport, onToast } = props
  const ownsReply = !!registry && !!active && (can(actorId, 'manage-support') || (active.assigneeId ? mockAgents.find(a => a.userId === actorId)?.id === active.assigneeId : mockAgents.find(a => a.userId === actorId)?.name === active.assignee))
  const [transfer, setTransfer] = useState<Conversation | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [replySearch, setReplySearch] = useState('')
  const [replyPicker, setReplyPicker] = useState(false)
  const [compactDetails, setCompactDetails] = useState(() => window.matchMedia('(max-width: 1279px)').matches)
  const [detailsCollapsed, setDetailsCollapsed] = useState(false)
  const detailsRef = useRef<HTMLDialogElement>(null)
  const detailsTrigger = useRef<HTMLButtonElement>(null)
  const selectedRowRef = useRef<HTMLButtonElement>(null)
  const chatTitleRef = useRef<HTMLElement>(null)
  useEffect(() => { selectedRowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [selectedId])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1279px)')
    const change = () => setCompactDetails(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const dialog = detailsRef.current
    if (!dialog) return
    if (!compactDetails) {
      if (dialog.matches(':modal')) dialog.close()
      dialog.toggleAttribute('open', !detailsCollapsed)
    } else {
      if (dialog.open && !dialog.matches(':modal')) dialog.removeAttribute('open')
      if (mobilePanel === 'context' && !dialog.open) dialog.showModal()
      else if (mobilePanel !== 'context' && dialog.open) dialog.close()
    }
  }, [compactDetails, detailsCollapsed, mobilePanel])
  function closeDetails() {
    if (compactDetails) setMobilePanel('chat')
    else setDetailsCollapsed(true)
    detailsTrigger.current?.focus()
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reducedMotion === 'true' || document.documentElement.classList.contains('identity-reduced-motion') ? 'instant' : 'smooth', block: 'end' }) }, [active?.messages.length])
  const unreadTotal = data.conversations.reduce((sum, conversation) => sum + conversation.unread, 0)

  function handleAttachment(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { onToast('Only JPEG, PNG and PDF files are supported'); return }
    if (file.size > 5 * 1024 * 1024) { onToast('Attachment exceeds the 5 MB limit'); return }
    setComposer(`${composer}${composer ? '\n' : ''}[Attachment reference: ${file.name}]`)
    onToast('Attachment reference added to your draft')
  }

  return <section className={`inbox-layout inbox-console ${detailsCollapsed ? 'details-collapsed' : ''}`} aria-label="Shared inbox">
    <aside className={`conversation-panel glass-panel glass-gradient-border glass-gradient-border-animated ${mobilePanel === 'list' ? 'mobile-active' : ''}`}>
      <div className="panel-heading"><div><div className="heading-overline">WEBSITE LIVE CHAT</div><h1>Inbox <span title="Unread messages">{unreadTotal}</span></h1></div><button className="icon-button" aria-label="New conversation" disabled={workspaceId !== 'workspace-qalo' && !banking} title={workspaceId === 'workspace-qalo' || banking ? 'Open this workspace customer preview' : 'No customer preview is configured for this workspace'} onClick={() => window.open(banking ? '/enl-preview' : '/chat', '_blank', 'noopener')}><Plus size={18} /></button></div>
      <div className="inbox-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /><button aria-label="Conversation filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><ListFilter size={15} /></button></div>
      <div className="queue-tabs" role="tablist" aria-label="Conversation queues">{queues.map((item) => <button key={item} role="tab" aria-selected={queue === item} className={queue === item ? 'selected' : ''} onClick={() => setQueue(item)}>{banking ? ({ All: 'All Conversations', Mine: 'My Conversations', Unassigned: 'Unassigned', Waiting: 'Waiting', Escalated: 'Escalated', Resolved: 'Resolved' }[item]) : item}{item === 'Unassigned' && <small>{data.conversations.filter((conversation) => !conversation.assignee && conversation.status !== 'resolved').length}</small>}</button>)}</div>
      {filtersOpen && <label className="inbox-filter">Priority<select value={props.priorityFilter} onChange={e => props.setPriorityFilter(e.target.value)}>{['all', 'low', 'normal', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}</select></label>}{filtersOpen && <label className="inbox-filter">Handling state<select aria-label="Handling state filter" value={props.handlingFilter} onChange={e => props.setHandlingFilter(e.target.value)}><option value="all">All handling states</option>{Object.entries(conversationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<div className="list-sort"><span>{conversations.length} conversations</span><button onClick={() => onToast('Conversations are sorted newest first')}><ArrowDownUp size={13} /> Latest</button></div>
      <div className="conversation-list" role="region" aria-label="Conversation queue" tabIndex={0}>
        {conversations.map((conversation) => <button key={conversation.id} data-conversation-id={conversation.id} className={`conversation-row ${selectedId === conversation.id ? 'active' : ''}`} ref={selectedId === conversation.id ? selectedRowRef : undefined} aria-current={selectedId === conversation.id ? 'true' : undefined} onClick={() => { setSelectedId(conversation.id); if (window.matchMedia('(max-width: 820px)').matches) requestAnimationFrame(() => chatTitleRef.current?.focus()) }}>
          <span className={`avatar avatar-customer tone-${conversation.tone}`}>{conversation.initials}<i className={conversation.channel === 'Website' ? 'channel-web' : 'channel-mail'}>{conversation.channel === 'Website' ? <MessageCircle size={9} /> : <AtSign size={9} />}</i></span>
          <span className="row-main"><span className="row-top"><strong>{conversation.customer}</strong><time dateTime={conversation.updatedAt} title={new Date(conversation.updatedAt).toLocaleString()}>{formatRelative(conversation.updatedAt)}</time></span><span className="row-message">{conversation.messages.at(-1)?.kind === 'note' && <b>Note · </b>}{conversation.messages.at(-1)?.text}</span><span className="row-meta"><i className={`queue-priority priority-${conversation.priority}`} role="img" aria-label={`${conversation.priority} priority`} title={`${conversation.priority} priority`} /><span className={`status-dot status-${conversation.status}`} />{conversationLabels[conversationState(conversation)]}<span className="meta-separator">·</span>{conversation.assignee && <em title={conversation.assignee}>{conversation.assignee}</em>}{!conversation.assignee && conversation.tags[0] && <em>{conversation.tags[0]}</em>}</span></span>
          {conversation.unread > 0 && <span className="unread-count">{conversation.unread}</span>}
        </button>)}
        {conversations.length === 0 && <div className="empty-state"><Inbox size={24} /><strong>No conversations here</strong><span>Try another queue or search.</span></div>}
      </div>
      <div className="list-footer"><span><i className="online-dot" /> Availability</span><button onClick={() => onToast('Queue settings are in Settings')} aria-label="Queue settings"><Settings size={14} /></button></div>
    </aside>

    <section className={`chat-panel glass-panel glass-gradient-border glass-gradient-border-animated ${mobilePanel === 'chat' ? 'mobile-active' : ''}`}>
      {active ? <>
        <header className="chat-header"><button className="mobile-back icon-button" onClick={() => setMobilePanel('list')} aria-label="Back to conversations"><ArrowLeft size={18} /></button><span className={`avatar avatar-customer tone-${active.tone}`}>{active.initials}</span><div className="chat-person"><strong ref={chatTitleRef} tabIndex={-1}>{active.customer}</strong><span><span className="status-dot status-open" />{active.status === 'resolved' ? 'Resolved' : 'Active conversation'} <span className="meta-separator">·</span> {active.channel}</span></div><div className="chat-actions"><button className="icon-button" aria-label="Export transcript" onClick={onExport}><Archive size={16} /></button><button ref={detailsTrigger} className="icon-button inbox-details-toggle" aria-label="Customer details" aria-controls="inbox-customer-details" aria-expanded={compactDetails ? mobilePanel === 'context' : !detailsCollapsed} onClick={() => { if (compactDetails) setMobilePanel('context'); else setDetailsCollapsed(!detailsCollapsed) }}><UserRound size={16} /></button><button className="icon-button" aria-label="Return to AI" title="Return to AI" disabled={!can(actorId, 'reply') || active.status === 'resolved' || active.handling === 'ai'} onClick={props.onReturnToAi}><MoreHorizontal size={18} /></button></div></header>
        <div className="chat-subheader"><div className="breadcrumbs-mini"><span className="channel-icon"><MessageCircle size={13} /></span><span>{active.channel}</span>{<span className="banking-badge">{conversationLabels[conversationState(active)]}</span>}<ChevronRight size={13} /><span>{active.id.toUpperCase()}</span></div><div className="header-assign"><button disabled={!can(actorId, 'reply') || active.status === 'resolved'} onClick={onAssign}><UserRoundCheck size={14} />{active.assignee ? (active.handling === 'human' ? active.assignee : 'Take over') : banking ? 'Take over' : 'Assign to me'}<ChevronDown size={12} /></button><span className="priority-chip"><i className={`priority-${active.priority}`} />{active.priority}</span><button className="resolve-button" disabled={!can(actorId, 'reply')} onClick={onResolve}>{active.status === 'resolved' ? <><ArrowRight size={13} /> Reopen</> : <><Check size={13} /> Resolve</>}</button></div></div>
        {active.status === 'resolved' && <div className="resolved-banner"><CheckCheck size={14} /> This conversation is resolved. Reopen it to reply.</div>}
        <div className="messages-scroll" role="region" aria-label="Conversation messages" tabIndex={0}>
          {!active.messages.length && <div className="timeline-empty"><MessageCircle size={24} /><p>No messages recorded yet.</p></div>}
          {active.messages.map((message, index) => <div className="timeline-entry" key={message.id}>{(index === 0 || new Date(message.time).toDateString() !== new Date(active.messages[index - 1].time).toDateString()) && <div className="day-divider"><span>{formatDate(message.time)}</span></div>}<MessageBubble message={message} initials={active.initials} tone={active.tone} /></div>)}
          {active.typing && <div className="typing-row"><span className="avatar avatar-customer tone-sage">{active.initials}</span><span className="typing-bubble"><i /><i /><i /></span><small>{active.customer} is typing</small></div>}
          <div ref={messageEndRef} />
        </div>
        <div className={`composer ${internalNote ? 'composer-note' : ''}`} role="region" aria-label="Reply composer">
          <div className="composer-tools"><button className={`composer-mode ${internalNote ? 'note-active' : ''}`} onClick={() => setInternalNote(!internalNote)}><FileText size={14} />{internalNote ? 'Internal note' : 'Reply'}<ChevronDown size={12} /></button><div className="composer-shortcuts"><button title="Saved replies" aria-label="Saved replies" aria-expanded={replyPicker} onClick={() => setReplyPicker(!replyPicker)}><Sparkles size={14} /></button><button title="Add attachment reference" aria-label="Add attachment reference" onClick={() => fileRef.current?.click()}><Paperclip size={14} /></button><input ref={fileRef} className="visually-hidden" type="file" onChange={(event) => handleAttachment(event.target.files?.[0])} /></div><span className="composer-shortcut-hint">Search saved replies with the sparkle button</span></div>
          {replyPicker && <div className="saved-reply-picker enhanced"><label>Find saved reply<input value={replySearch} onChange={e => setReplySearch(e.target.value)} /></label>{data.savedReplies?.filter(r => r.approved && (r.businessArea === active.businessArea || r.businessArea === 'general') && `${r.title} ${r.body}`.toLowerCase().includes(replySearch.toLowerCase())).map(r => <button className="record-card" key={r.id} onClick={() => { setComposer(composer + (composer ? '\n' : '') + r.body); setInternalNote(false); setReplyPicker(false) }}>{r.title}</button>)}</div>}<textarea disabled={!can(actorId, 'reply') || (!internalNote && (!ownsReply || active.status === 'resolved' || (active.handling ? active.handling !== 'human' : !active.assignee)))} maxLength={4000} value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() } }} placeholder={internalNote ? 'Add a private note for your team...' : 'Write a reply...'} aria-label={internalNote ? 'Write an internal note' : 'Write a customer reply'} />
          <div className="composer-bottom"><span><ShieldCheck size={13} />{internalNote ? 'Only your team can see this note' : active.handling === 'ai' || !active.assignee ? 'Take over to send a human reply' : `Human reply - ${active.assignee}`}</span><div><span className="send-hint">Enter to send</span><button className="send-button" disabled={!composer.trim() || !can(actorId, 'reply') || (!internalNote && (!ownsReply || active.status === 'resolved' || (active.handling ? active.handling !== 'human' : !active.assignee)))} onClick={onSend} aria-label={internalNote ? 'Add internal note' : 'Send reply'}><Send size={15} /></button></div></div>
        </div>
        <div className="conversation-action-bar" aria-label="Conversation support actions"><button className="inbox-create-ticket" aria-label="Create Ticket" disabled={!can(actorId, 'reply')} onClick={onCreateTicket}><Ticket size={15} />Create Ticket</button><button className="inbox-transfer-chat" disabled={!registry || !mayTransfer(registry, active, actorId)} onClick={() => setTransfer(structuredClone(active))}><ArrowRightLeft size={14} />Transfer Chat</button>{transfer && transfer.id === active.id && <TransferChatDialog conversation={transfer} close={() => setTransfer(null)} complete={name => { setTransfer(null); setComposer(''); setInternalNote(false); onToast(`Conversation transferred successfully to ${name}.`) }} />}<span className="linked-ticket-count">{data.tickets.filter(ticket => ticket.conversationId === active.id).length} linked tickets</span></div>
      </> : <div className="empty-chat"><MessageCircle size={31} /><h2>Choose a conversation</h2><p>Select a customer from the list to get started.</p></div>}
    </section>

    <dialog ref={detailsRef} id="inbox-customer-details" className="inbox-details-dialog" role={compactDetails ? 'dialog' : 'complementary'} aria-label="Customer details" onCancel={event => { event.preventDefault(); closeDetails() }} onClick={event => { if (compactDetails && event.target === event.currentTarget) closeDetails() }}>
    <aside className="context-panel glass-panel glass-gradient-border glass-gradient-border-static" aria-label="Customer context">
      <div className="context-mobile-head"><strong>Details</strong><button className="icon-button" onClick={closeDetails} aria-label="Back to conversation"><X size={17} /></button></div>
      {active ? <>
        <div className="customer-profile"><span className={`avatar avatar-large tone-${active.tone}`}>{active.initials}</span><h2>{active.customer}</h2><span className="customer-type">{active.participantType || areaLabels[active.businessArea || 'general']}</span><div className="profile-actions"><button onClick={() => window.location.assign('/contacts')}><UserRound size={14} /> Profile</button><button onClick={() => onToast(`Email ${active.email}`)}><AtSign size={14} /> Email</button></div></div>
        <div className="context-section"><div className="context-section-title"><h3>Customer information</h3><button aria-label="Edit customer information" onClick={() => window.location.assign('/contacts')}>Edit</button></div><Detail label="Email" value={active.email} /><Detail label="Location" value={active.location} /></div>
        <div className="context-section context-section-heading"><h3>{banking ? 'Banking support context' : 'Support context'}</h3></div><SupportContext conversation={active} data={data} update={props.onUpdate} /><div className="context-section"><div className="context-section-title"><h3>Conversation</h3><button aria-label="Edit conversation details" onClick={() => onToast('Use the fields below to update conversation details')}>Edit</button></div><div className="enhanced context-edit"><label>Assignee<select aria-label="Assignee" disabled={!can(actorId, 'reply') || active.status === 'resolved'} value={active.assignee || ''} onChange={e => props.onUpdate({ assignee: e.target.value || null })}><option value="">Unassigned</option>{mockAgents.map(a => a.name).map(a => <option key={a}>{a}</option>)}</select></label><label>Department<select aria-label="Department" disabled={!can(actorId, 'reply')} value={active.department} onChange={e => props.onUpdate({ department: e.target.value })}>{Array.from(new Set([active.department, ...(data.queues || []).filter(q => q.area === active.businessArea || q.area === 'general').map(q => q.name)])).map(d => <option key={d}>{d}</option>)}</select></label><label>Priority<select aria-label="Priority" disabled={!can(actorId, 'reply')} value={active.priority} onChange={e => props.onUpdate({ priority: e.target.value as Conversation['priority'] })}>{['low','normal','high','urgent'].map(p => <option key={p}>{p}</option>)}</select></label><label>Tags (comma separated)<input disabled={!can(actorId, 'reply')} key={active.id + '-tags'} defaultValue={active.tags.join(', ')} onBlur={e => props.onUpdate({ tags: Array.from(new Set(e.target.value.split(',').map(t => t.trim()).filter(Boolean))) })} /></label></div><Detail label="Reference" value={active.id} /><Detail label="Status" value={conversationLabels[conversationState(active)]} /><Detail label="Channel" value={active.channel} /><Detail label="Created" value={formatDate(active.createdAt)} /></div>

        <div className="context-section"><div className="context-section-title"><span>Tags</span><button aria-label="Add tag" onClick={() => onToast('Use the tag field below to edit tags')}><Plus size={13} /></button></div><div className="tag-list">{active.tags.map((tag) => <span key={tag}>{tag}<button disabled={!can(actorId, 'reply')} aria-label={`Remove ${tag} tag`} onClick={() => props.onUpdate({ tags: active.tags.filter(t => t !== tag) })}>Ã—</button></span>)}<button className="tag-add" disabled={!can(actorId, 'reply')} onClick={() => onToast('Use the tag field above to edit tags')}>+ Add tag</button></div></div>
        <div className="context-section history-section"><div className="context-section-title"><h3>Activity & related support</h3><button onClick={() => onToast('The entries below are the available conversation activity')}>View all</button></div>{active.history.map((item) => <div className="history-row" key={item.id}><span className="history-icon"><Clock3 size={12} /></span><div><strong>{item.title}</strong><small>{item.detail} · {item.when}</small></div></div>)}{data.tickets.filter(t => t.conversationId === active.id).map(t => <Link className="ticket-link" key={t.id} to={`/tickets?ticket=${t.id}`}>{t.id.replace(/^ENL-DEMO-/, 'ENL-')}: {t.subject} - {ticketState(t)}</Link>)}<button className="ticket-link" onClick={() => window.location.assign('/tickets')}><Ticket size={14} /> View tickets <ArrowRight size={13} /></button></div>
        <button className="context-article" onClick={() => window.location.assign('/knowledge')}><BookOpen size={15} /><span><strong>Workspace knowledge</strong><small>Browse this workspace's articles</small></span><ArrowUpRight size={13} /></button>
      </> : <div className="empty-context">Customer details appear here.</div>}
    </aside>
    </dialog>
    <nav className="mobile-panel-nav" aria-label="Inbox panels"><button className={mobilePanel === 'list' ? 'active' : ''} onClick={() => setMobilePanel('list')}><Inbox size={17} /><span>Inbox</span></button><button className={mobilePanel === 'chat' ? 'active' : ''} onClick={() => setMobilePanel('chat')}><MessageCircle size={17} /><span>Chat</span></button><button className={mobilePanel === 'context' ? 'active' : ''} onClick={() => setMobilePanel('context')}><UserRound size={17} /><span>Customer</span></button></nav>
  </section>
}

function MessageBubble({ message, initials, tone }: { message: Message; initials: string; tone: string }) {
  const isCustomer = message.kind === 'customer'
  if (message.kind === 'note') return <div className="note-message"><div className="note-label"><FileText size={13} /> PRIVATE NOTE <span>{message.author}</span><time>{formatClock(message.time)}</time></div><p>{message.text}</p></div>
  return <div className={`message-row ${isCustomer ? 'from-customer' : 'from-agent'}`}>
    {isCustomer && <span className={`avatar avatar-message tone-${tone}`}>{initials}</span>}
    <div className="message-content"><div className="message-meta"><strong>{message.author}</strong><time>{formatClock(message.time)}</time></div><div className={`message-bubble ${isCustomer ? '' : 'agent-bubble'}`}>{message.text}</div>{!isCustomer && <div className="delivery-state"><Check size={12} /> {message.delivery === 'sent' ? 'Saved locally' : message.delivery === 'failed' ? 'Not saved' : message.delivery === 'sending' ? 'Saving' : 'Recorded message'}</div>}</div>
    {!isCustomer && <span className="avatar avatar-message avatar-agent">{message.author.split(/\s+/).map(word => word[0]).join('').slice(0, 2)}</span>}
  </div>
}

function Detail({ label, value, avatar, status }: { label: string; value: string; avatar?: string; status?: string }) {
  return <div className="detail-row"><span>{label}</span><strong>{avatar && <i className="detail-avatar">{avatar}</i>}{status && <i className={`priority-indicator priority-${status}`} />}{value}</strong></div>
}

function ModulePage({ path }: { path: string }) {
  const { registry, workspaceId } = useWorkspace()
  const navItems = workspaceExperience(registry?.workspaces.find(w => w.id === workspaceId)).sections.flatMap(section => section.items)
  const current = navItems.find(item => item.path === path)
  if (!current) return <div className="module-page enhanced"><h1>Page not found</h1><Link to="/inbox">Return to inbox</Link></div>
  return <div className="module-page"><div className="module-heading"><div><span className="heading-overline">QALO YA AFRIKA</span><h1>{current.label}</h1><p>{moduleDescription(path)}</p></div></div>
    <p>Select a support workspace from the navigation.</p>
  </div>
}

function moduleDescription(path: string) {
  const descriptions: Record<string, string> = {
    '/overview': 'A clear view of your teamâ€™s support, today.', '/visitors': 'Understand who is browsing and offer help at the right moment.',
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

function WorkspaceNavIcon({ name }: { name: keyof typeof workspaceIcons }) { const Icon = workspaceIcons[name]; return <Icon size={17} strokeWidth={1.8} /> }
