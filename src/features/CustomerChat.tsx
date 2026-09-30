import { sessionPreferences } from '../lib/storage'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../lib/demoStore'
import { branding } from '../lib/branding'
import { AreaFields } from './BusinessArea'
import { areaLabels, categories, defaultQueue, participantTypes, safeOfficialUrl, type BusinessArea } from '../lib/business'
import type { Conversation } from '../data/demoData'
import { isWithinOperatingHours, mergeWorkspaceSettings } from '../lib/workspaceSettings'
import { supportService } from '../lib/supportService'
const chatPageOpenedAt = Date.now()

export function CustomerChat() {
  const { data, setData, error, saveError } = useDemo()
  const [session, setSession] = useState(() => sessionPreferences.getItem('qalo-demo-chat') || '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [businessArea, setBusinessArea] = useState<BusinessArea>('community')
  const [category, setCategory] = useState(categories.community[0])
  const [participantType, setParticipantType] = useState(participantTypes[0])
  const [helpSearch, setHelpSearch] = useState('')
  const workspaceSettings = mergeWorkspaceSettings(data?.settings)
  const onlineNow = isWithinOperatingHours(workspaceSettings.operatingHours, chatPageOpenedAt)
  const conversation = data?.conversations.find(c => c.id === session)
  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!data || !text.trim() || busy) return
    setBusy(true)
    const id = conversation?.id || crypto.randomUUID()
    const time = new Date().toISOString()
    const message = { id: crypto.randomUUID(), author: conversation?.customer || name.trim(), text: text.trim(), time, kind: 'customer' as const }
    const created: Conversation = { id, customer: name.trim(), email, initials: name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2), tone: 'sage', location: 'Not provided', channel: 'Website', status: 'waiting', priority: 'normal', assignee: null, department: defaultQueue(businessArea, category), businessArea, category, participantType, reference: `SUP-${id.slice(0, 8)}`, tags: [], unread: 1, createdAt: time, updatedAt: time, messages: [message], history: [] }
    try {
      const saved = await setData(current => {
        if (current.conversations.some(c => c.id === id)) return { ...current, conversations: current.conversations.map(c => c.id === id ? { ...c, status: 'waiting', resolvedAt: undefined, updatedAt: time, unread: c.unread + 1, messages: [...c.messages, message] } : c) }
        const contact = current.contacts.find(c => c.email.toLowerCase() === email.toLowerCase())
        const contactId = contact?.id || crypto.randomUUID()
        const next = { ...created, contactId }
        const configuration = mergeWorkspaceSettings(current.settings)
        const rule = configuration.routingEnabled ? current.rules?.find(r => r.enabled && (!r.businessArea || r.businessArea === businessArea) && (!r.category || r.category === category) && (!r.participantType || r.participantType === participantType) && (!r.contains || text.toLowerCase().includes(r.contains.toLowerCase()))) : undefined
        const agents = supportService.referenceData().agents
        const assignee = configuration.assignmentMode === 'round-robin' ? agents[current.conversations.length % agents.length].name : configuration.defaultAssignee || null
        next.assignee = assignee
        if (rule) {
          next.department = rule.department; next.priority = rule.priority
          if (rule.acknowledgement) next.messages = [...next.messages, { id: crypto.randomUUID(), author: 'Automation', kind: 'agent', delivery: 'sent', text: rule.acknowledgement, time }]
          next.history = [...next.history, { id: crypto.randomUUID(), title: 'Routing rule executed', detail: rule.name, when: time }]
        }
        return { ...current, conversations: [next, ...current.conversations], contacts: contact ? current.contacts : [...current.contacts, { id: contactId, name: name.trim(), email, organisation: '', location: '', conversations: 1, tag: 'Website enquiry', participantType, preference: 'Reply to this enquiry', consent: 'Not recorded' }],
          tasks: rule?.followUp ? [...(current.tasks || []), { id: crypto.randomUUID(), title: `Follow up: ${name}`, due: new Date(Date.parse(time) + 86400000).toISOString(), done: false, businessArea, contactId, conversationId: id }] : current.tasks,
          automationRuns: rule ? [...(current.automationRuns || []), { id: crypto.randomUUID(), rule: rule.name, conversationId: id, time, status: 'Succeeded' }] : current.automationRuns }
      })
      if (!saved) return
      sessionPreferences.setItem('qalo-demo-chat', id); setSession(id); setText('')
      await setData(d => ({ ...d, conversations: d.conversations.map(c => c.id === id ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), author: 'Qalo Support', text: 'We have recorded your enquiry for the support team.', kind: 'agent', delivery: 'sent', time: new Date().toISOString() }] } : c) }))
    } finally { setBusy(false) }
  }
  return <div className="app-shell standalone"><main className="customer-chat glass-panel enhanced">
    <span className="eyebrow">CUSTOMER SUPPORT</span><h1>{branding.name}</h1>
    <p>{onlineNow ? data?.widget?.greeting || branding.greeting : workspaceSettings.operatingHours.offlineGreeting}</p><p><span className={`chat-availability ${onlineNow ? 'online' : ''}`} />{onlineNow ? 'Our team is online' : 'Our team is offline'} · Community Investment, Qalo Store and platform assistance.</p>
    {(error || saveError) && <p role="alert">{saveError || error?.message}</p>}
    <div className="customer-messages" aria-live="polite">{conversation?.messages.filter(m => m.kind !== 'note').map(m => <article className={`public-message ${m.kind}`} key={m.id}><strong>{m.kind === 'agent' ? branding.name : 'You'}</strong><p>{m.text}</p><small>{new Date(m.time).toLocaleTimeString()}</small></article>)}</div>
    {conversation?.status === 'resolved' && <p role="status">Your conversation is resolved. Sending another message reopens it.</p>}
    {conversation?.status === 'resolved' && <label>Rate your support conversation<select aria-label="Support satisfaction" value={conversation.satisfaction || ''} onChange={e => { const rating = Number(e.target.value); void setData(d => ({ ...d, conversations: d.conversations.map(c => c.id === conversation.id ? { ...c, satisfaction: rating } : c) })) }}><option value="">Choose a rating</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>}
    <form onSubmit={send}>{!conversation && <><h2>What do you need help with?</h2><AreaFields area={businessArea} category={category} onChange={(area, nextCategory) => { setBusinessArea(area); setCategory(nextCategory); setParticipantType(area === 'store' ? 'Store customer' : participantTypes[0]) }} /><label>Participant type<select aria-label="Participant type" value={participantType} onChange={e => setParticipantType(e.target.value)}>{participantTypes.map(t => <option key={t}>{t}</option>)}</select></label></>}{!conversation && <div className="form-grid"><label>Your name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label></div>}
      <label>Message<textarea required maxLength={4000} value={text} onChange={e => setText(e.target.value)} /></label><button className="button-primary" aria-busy={busy} disabled={busy || !data || !text.trim()}>{busy ? 'Saving…' : 'Send message'}</button>
    </form>{conversation && <button className="button-secondary" onClick={() => { sessionPreferences.removeItem('qalo-demo-chat'); setSession(''); setText('') }}>Start another enquiry</button>}<label>Search help articles<input value={helpSearch} onChange={e => setHelpSearch(e.target.value)} /></label>{helpSearch && data?.articles.filter(a => a.published && a.businessArea === (conversation?.businessArea || businessArea) && `${a.title} ${a.body}`.toLowerCase().includes(helpSearch.toLowerCase())).map(a => <details key={a.id}><summary>{a.title}</summary><p>{a.body}</p>{safeOfficialUrl(a.sourceUrl) && <a href={safeOfficialUrl(a.sourceUrl)} target="_blank" rel="noreferrer">Official information</a>}</details>)}<Link to="/help">Browse help articles</Link>
  </main></div>
}

export function HelpCentre() {
  const { data, setData } = useDemo()
  const [search, setSearch] = useState('')
  const [helpArea, setHelpArea] = useState('all')
  const [voted, setVoted] = useState<string[]>([])
  return <div className="app-shell standalone enhanced"><main className="help-centre"><span className="eyebrow">HELP CENTRE</span><h1>{branding.name}</h1><label>Help area<select aria-label="Help area" value={helpArea} onChange={e => setHelpArea(e.target.value)}>{Object.entries(areaLabels).map(([v,label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>Search articles<input value={search} onChange={e => setSearch(e.target.value)} /></label>{data?.articles.filter(a => a.published && (helpArea === 'all' || a.businessArea === helpArea) && `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase())).map(a => <article key={a.id} className="glass-panel record-card"><small>{a.category}</small><h2>{a.title}</h2><p className="pre-wrap">{a.body || 'Awaiting approved content.'}</p>{safeOfficialUrl(a.sourceUrl) && <a href={safeOfficialUrl(a.sourceUrl)} target="_blank" rel="noreferrer">Official information</a>}<div className="row-actions">{['Helpful', 'Not helpful'].map((label, index) => <button className="button-secondary" disabled={voted.includes(a.id)} key={label} onClick={() => { void setData(d => ({ ...d, articles: d.articles.map(article => article.id === a.id ? { ...article, helpful: (article.helpful || 0) + (index === 0 ? 1 : 0), unhelpful: (article.unhelpful || 0) + index } : article) })); setVoted([...voted, a.id]) }}>{label}</button>)}</div></article>)}<Link to="/chat">Contact support</Link></main></div>
}
