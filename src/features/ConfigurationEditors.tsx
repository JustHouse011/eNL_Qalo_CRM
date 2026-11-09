import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DemoData } from '../data/demoData'
import { supportService } from '../lib/supportService'
import { isPreviewWithinHours, mergeWorkspaceSettings } from '../lib/workspaceSettings'
import { defaultQueues, type BusinessArea } from '../lib/business'
import { branding } from '../lib/branding'
import { useDemo } from '../lib/demoStore'
import { localPreferences } from '../lib/storage'
import { useWorkspace } from './WorkspaceContext'
import type { ModuleProps } from './Knowledge'
import { useWorkspaceTaxonomy } from './workspaceTaxonomy'
import { useBusinessArea } from './BusinessArea'

const { channels } = supportService.referenceData()
type Queue = NonNullable<DemoData['queues']>[number]
type Rule = NonNullable<DemoData['rules']>[number]
const priorityOptions: Rule['priority'][] = ['low', 'normal', 'high', 'urgent']

export function QueueConfiguration({ data, setData }: ModuleProps) {
  const { areaLabels, areaOptions } = useWorkspaceTaxonomy()
  const { registry, workspaceId } = useWorkspace()
  const agents = registry?.snapshots[workspaceId]?.agents.filter(a => registry.memberships.some(m => m.workspaceId === workspaceId && m.userId === a.userId && m.status === 'active')) || []
  const queues = data.queues || defaultQueues
  const savedSettings = mergeWorkspaceSettings(data.settings)
  const [queueDraft, setQueueDraft] = useState<Queue | null>(null)
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [queueError, setQueueError] = useState('')
  const [status, setStatus] = useState('')
  const [routingDraft, setRoutingDraft] = useState(savedSettings)
  const [assignmentDirty, setAssignmentDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  async function saveQueue(event: React.FormEvent) {
    event.preventDefault()
    if (!queueDraft?.name.trim()) { setQueueError('Enter a queue name.'); return }
    const duplicate = queues.some(queue => !(editingQueue && queue.name === editingQueue.name && queue.area === editingQueue.area) && queue.area === queueDraft.area && queue.name.toLowerCase() === queueDraft.name.trim().toLowerCase())
    if (duplicate) { setQueueError('A queue with this name already exists for that business area.'); return }
    setSaving(true); setStatus('Saving changes…'); setQueueError('')
    const original = editingQueue
    const success = await setData(current => {
      const currentQueues = current.queues || defaultQueues
      const nextQueues = isNew ? [...currentQueues, { ...queueDraft, name: queueDraft.name.trim() }] : currentQueues.map(queue => queue.name === original?.name && queue.area === original.area ? { ...queueDraft, name: queueDraft.name.trim() } : queue)
      const oldName = original?.name
      return { ...current, queues: nextQueues, rules: current.rules?.map(rule => oldName && rule.department === oldName ? { ...rule, department: queueDraft.name.trim() } : rule), conversations: current.conversations.map(conversation => oldName && conversation.department === oldName ? { ...conversation, department: queueDraft.name.trim() } : conversation) }
    })
    setSaving(false); setStatus(success ? 'Changes saved' : '')
    if (success) { setQueueDraft(null); setEditingQueue(null); setIsNew(false) } else setQueueError('Changes could not be saved. Please try again.')
  }

  async function saveAssignment(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true); setStatus('Saving changes…')
    const success = await setData(current => ({ ...current, settings: { ...mergeWorkspaceSettings(current.settings), assignmentMode: routingDraft.assignmentMode, defaultAssignee: routingDraft.defaultAssignee } }))
    setSaving(false); setStatus(success ? 'Changes saved' : '')
    if (success) setAssignmentDirty(false)
  }

  async function removeQueue(queue: Queue) {
    const used = data.rules?.some(rule => rule.department === queue.name) || data.conversations.some(conversation => conversation.department === queue.name)
    if (used) { setQueueError('This queue is in use by a rule or conversation. Reassign those records before removing it.'); return }
    setSaving(true); setStatus('Saving changes…')
    const success = await setData(current => ({ ...current, queues: (current.queues || defaultQueues).filter(item => item.name !== queue.name || item.area !== queue.area) }))
    setSaving(false); setStatus(success ? 'Changes saved' : '')
  }

  return <section className="queue-settings">
    <h2>Support queues</h2><p>Organise enquiries by team and business area. Existing queues stay available in case history.</p>
    <div className="queue-list">{queues.map(queue => <article className="queue-setting-row" key={`${queue.area}-${queue.name}`}><div><strong>{queue.name}</strong><small>{areaLabels[queue.area]}</small></div><div className="row-actions"><button className="button-secondary" onClick={() => { setQueueDraft({ ...queue }); setEditingQueue(queue); setIsNew(false); setQueueError('') }}>Edit</button><button className="button-secondary" disabled={saving} onClick={() => void removeQueue(queue)}>Remove</button></div></article>)}</div>
    {queueDraft && <form className="channel-setup" onSubmit={saveQueue}><h3>{isNew ? 'New queue' : 'Edit queue'}</h3><label>Queue name<input required maxLength={80} value={queueDraft.name} onChange={event => setQueueDraft({ ...queueDraft, name: event.target.value })} /></label><label>Business area<select value={queueDraft.area} onChange={event => setQueueDraft({ ...queueDraft, area: event.target.value as BusinessArea })}>{Object.entries(areaLabels).filter(([value]) => areaOptions.includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{queueError && <p role="alert">{queueError}</p>}<div className="row-actions"><button className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" disabled={saving} onClick={() => { setQueueDraft(null); setEditingQueue(null); setQueueError(''); setStatus('') }}>Cancel</button></div></form>}
    {!queueDraft && <button className="button-secondary" onClick={() => { setQueueDraft({ name: '', area: 'community' }); setIsNew(true); setQueueError('') }}>Add queue</button>}
    <form className="record-card assignment-settings" onSubmit={saveAssignment}><h3>Assignment settings</h3><p>These preferences guide new website enquiries that do not match a routing rule.</p><label>Assignment method<select value={routingDraft.assignmentMode} onChange={event => { setRoutingDraft({ ...routingDraft, assignmentMode: event.target.value as typeof routingDraft.assignmentMode }); setAssignmentDirty(true) }}><option value="manual">Leave unassigned</option><option value="round-robin">Round robin</option></select></label>{routingDraft.assignmentMode === 'manual' && <label>Default assignee<select value={routingDraft.defaultAssignee} onChange={event => { setRoutingDraft({ ...routingDraft, defaultAssignee: event.target.value }); setAssignmentDirty(true) }}><option value="">No default assignee</option>{agents.map(agent => <option key={agent.id} value={agent.name}>{agent.name}</option>)}</select></label>}{assignmentDirty && <p className="unsaved-state">Unsaved changes</p>}<div className="row-actions"><button className="button-primary" disabled={saving || !assignmentDirty}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" disabled={saving || !assignmentDirty} onClick={() => { setRoutingDraft(savedSettings); setAssignmentDirty(false); setStatus('') }}>Cancel</button></div></form>
    <p role="status" aria-live="polite">{status}</p>
  </section>
}

const initialAi = { sources: [] as string[], tone: 'Clear, respectful and helpful', handoff: 'Hand off when information is unverified, sensitive, disputed or outside approved sources.', community: 'Use approved community knowledge. Qalo facilitates support, not banking operations.', store: 'Use approved store knowledge and verified order records only.' }
type AiSettings = typeof initialAi

export function AiConfiguration({ data, setData }: ModuleProps) {
  const saved = data.ai || initialAi
  const [draft, setDraft] = useState<AiSettings>({ ...saved, sources: [...saved.sources] })
  const [previewArea, setPreviewArea] = useState<'community' | 'store'>('community')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const selectedArticle = data.articles.find(article => article.published && draft.sources.includes(article.id))
  const preview = selectedArticle ? `Thanks for reaching out. ${selectedArticle.body || selectedArticle.title} Our response is guided by: ${draft[previewArea]}` : `Thanks for reaching out. I do not have an approved article selected for this question. ${draft[previewArea]} ${draft.handoff}`

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if ([draft.tone, draft.handoff, draft.community, draft.store].some(value => value.trim().length < 8)) { setError('Each guidance field must contain at least 8 characters.'); return }
    setSaving(true); setStatus('Saving changes…'); setError('')
    await new Promise(resolve => window.setTimeout(resolve, 300))
    const success = await setData(current => ({ ...current, ai: { ...draft, sources: [...draft.sources] } }))
    setSaving(false); setStatus(success ? 'Changes saved' : '')
    if (!success) setError('Changes could not be saved. Please try again.')
  }

  function cancel() { const current = data.ai || initialAi; setDraft({ ...current, sources: [...current.sources] }); setError(''); setStatus('') }

  return <div className="module-page enhanced"><span className="eyebrow">RESPONSE GUIDANCE</span><h1>AI Assist</h1><p>Configure an agent-reviewed assistant using approved response guidance.</p>
    <section className="glass-panel record-card"><h2>Required response boundaries</h2><ul><li>Use approved knowledge for the enquiry’s business area; acknowledge uncertainty and hand off to a human.</li><li>Never recommend investments, promise returns or invent eligibility, minimum contributions or approval decisions.</li><li>Never confirm contributions or imply support can make banking decisions.</li><li>Never invent stock, delivery times or return policies; verify payment, dispatch and refunds through authorised systems.</li><li>Keep conversation context during handoff; do not expose internal notes to customers.</li></ul></section>
    <form className="glass-panel record-card" onSubmit={save}><h2>Approved sources</h2>{data.articles.filter(article => article.published).map(article => <label className="check-field" key={article.id}><input type="checkbox" checked={draft.sources.includes(article.id)} onChange={event => setDraft(current => ({ ...current, sources: event.target.checked ? [...current.sources, article.id] : current.sources.filter(id => id !== article.id) }))} />{article.title}</label>)}<p>Draft articles are excluded. Published articles must follow the applicable approval process.</p>
      {(['tone', 'handoff', 'community', 'store'] as const).map(field => <label key={field}>{({ tone: 'Response tone', handoff: 'Human handoff', community: 'Community Investment instructions', store: 'Store instructions' })[field]}<textarea required minLength={8} maxLength={1200} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} /></label>)}{dirty && <p className="unsaved-state">Unsaved changes</p>}{error && <p role="alert">{error}</p>}<div className="row-actions"><button className="button-primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" disabled={saving || !dirty} onClick={cancel}>Cancel</button></div><p role="status" aria-live="polite">{status}</p>
    </form><section className="glass-panel record-card"><h2>Preview</h2><label>Preview business area<select value={previewArea} onChange={event => setPreviewArea(event.target.value as typeof previewArea)}><option value="community">Community Investment</option><option value="store">Qalo Store</option></select></label><p><strong>Customer enquiry:</strong> {previewArea === 'community' ? 'Can you guarantee my application will be approved?' : 'Can you guarantee my order will arrive tomorrow?'}</p><article className="ai-response-preview"><strong>Suggested reply</strong><p>{preview}</p><small>Response tone: {draft.tone}</small></article><p>Review every suggestion before using it.</p></section>
  </div>
}

function newRule(area: BusinessArea): Rule {
  return { id: '', name: '', contains: '', department: (defaultQueues.find(queue => queue.area === area) || defaultQueues[0]).name, priority: 'normal', enabled: true, businessArea: area, category: '', participantType: '', acknowledgement: '', followUp: false }
}

export function Automations({ data, setData }: ModuleProps) {
  const { areaLabels, areaOptions, categories, participantTypes } = useWorkspaceTaxonomy()
  const { area } = useBusinessArea()
  const settings = mergeWorkspaceSettings(data.settings)
  const [routingDraft, setRoutingDraft] = useState(settings.routingEnabled)
  const [routingDirty, setRoutingDirty] = useState(false)
  const [draft, setDraft] = useState<Rule | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [example, setExample] = useState('I need help with a refund for my order')
  const [exampleArea, setExampleArea] = useState<BusinessArea>('store')
  const [exampleCategory, setExampleCategory] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const rules = data.rules || []
  const match = routingDraft ? rules.find(rule => rule.enabled && (!rule.businessArea || rule.businessArea === exampleArea) && (!rule.category || !exampleCategory || rule.category === exampleCategory) && (!rule.participantType || rule.participantType === 'Store customer') && (!rule.contains || example.toLowerCase().includes(rule.contains.toLowerCase()))) : undefined
  const destination = routingDraft ? match?.department || (defaultQueues.find(queue => queue.area === exampleArea) || defaultQueues[0]).name : 'Manual assignment'

  async function saveRouting(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setStatus('Saving changes…')
    const success = await setData(current => ({ ...current, settings: { ...mergeWorkspaceSettings(current.settings), routingEnabled: routingDraft } }))
    setSaving(false); setStatus(success ? 'Changes saved' : ''); if (success) setRoutingDirty(false)
  }

  async function saveRule(event: React.FormEvent) {
    event.preventDefault()
    if (!draft?.name.trim()) { setError('Enter a name for this routing rule.'); return }
    if (!draft.department.trim()) { setError('Choose a destination queue.'); return }
    setSaving(true); setStatus('Saving changes…'); setError('')
    const savedRule = { ...draft, id: isNew ? crypto.randomUUID() : draft.id, name: draft.name.trim(), contains: draft.contains.trim() }
    const success = await setData(current => ({ ...current, rules: isNew ? [...(current.rules || []), savedRule] : (current.rules || []).map(rule => rule.id === savedRule.id ? savedRule : rule) }))
    setSaving(false); setStatus(success ? 'Changes saved' : '')
    if (success) { setDraft(null); setIsNew(false) } else setError('Changes could not be saved. Please try again.')
  }

  return <div className="module-page enhanced"><span className="eyebrow">NEW CHAT ROUTING</span><h1>Automations</h1><p>Route new conversations to the right team. The first enabled matching rule applies.</p>
    <form className="glass-panel record-card routing-controls" onSubmit={saveRouting}><h2>Routing</h2><label className="check-field"><input type="checkbox" checked={routingDraft} onChange={event => { setRoutingDraft(event.target.checked); setRoutingDirty(true) }} />Enable routing</label>{routingDirty && <p className="unsaved-state">Unsaved changes</p>}<div className="row-actions"><button className="button-primary" disabled={saving || !routingDirty}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" disabled={saving || !routingDirty} onClick={() => { setRoutingDraft(settings.routingEnabled); setRoutingDirty(false); setStatus('') }}>Cancel</button></div></form>
    <section className="glass-panel record-card"><h2>Routing preview</h2><p>Try an example enquiry to see its destination queue.</p><label>Example enquiry<input value={example} onChange={event => setExample(event.target.value)} /></label><div className="form-grid"><label>Business area<select value={exampleArea} onChange={event => setExampleArea(event.target.value as BusinessArea)}>{Object.entries(areaLabels).filter(([key]) => areaOptions.includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Category<select value={exampleCategory} onChange={event => setExampleCategory(event.target.value)}><option value="">Any category</option>{categories[exampleArea].map(category => <option key={category}>{category}</option>)}</select></label></div><p className="route-preview"><strong>Destination:</strong> {destination}{match && <span> · {match.name}</span>}</p></section>
    <section><h2>Routing rules</h2>{rules.filter(rule => area === 'all' || rule.businessArea === area || !rule.businessArea).map(rule => <article className="record-card glass-panel" key={rule.id}><div className="row-actions"><h3>{rule.name}</h3><span className="publish-state">{rule.enabled ? 'Enabled' : 'Disabled'}</span></div><p>{areaLabels[rule.businessArea || 'general']} · {rule.category || 'Any category'} · {rule.participantType || 'Any participant'}</p><p>Message contains: {rule.contains || 'Any text'} · {rule.department} · {rule.priority}</p><button className="button-secondary" onClick={() => { setDraft({ ...rule }); setIsNew(false); setError('') }}>Edit rule</button></article>)}{!rules.length && <p>No routing rules yet.</p>}</section>
    {draft && <form className="glass-panel record-card" onSubmit={saveRule}><h2>{isNew ? 'Create routing rule' : 'Edit routing rule'}</h2><label>Rule name<input required maxLength={80} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><div className="form-grid"><label>Business area<select value={draft.businessArea || 'general'} onChange={event => { const next = event.target.value as BusinessArea; setDraft({ ...draft, businessArea: next, category: '', department: (data.queues || defaultQueues).find(queue => queue.area === next)?.name || '' }) }}>{Object.entries(areaLabels).filter(([key]) => areaOptions.includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Category condition<select value={draft.category || ''} onChange={event => setDraft({ ...draft, category: event.target.value })}><option value="">Any category</option>{categories[draft.businessArea || 'general'].map(category => <option key={category}>{category}</option>)}</select></label><label>Participant condition<select value={draft.participantType || ''} onChange={event => setDraft({ ...draft, participantType: event.target.value })}><option value="">Any participant</option>{participantTypes.map(participant => <option key={participant}>{participant}</option>)}</select></label><label>Message contains<input maxLength={120} value={draft.contains} onChange={event => setDraft({ ...draft, contains: event.target.value })} /></label><label>Destination queue<select required value={draft.department} onChange={event => setDraft({ ...draft, department: event.target.value })}>{(data.queues || defaultQueues).filter(queue => queue.area === draft.businessArea || queue.area === 'general').map(queue => <option key={`${queue.area}-${queue.name}`} value={queue.name}>{queue.name}</option>)}</select></label><label>Priority<select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value as Rule['priority'] })}>{priorityOptions.map(priority => <option key={priority} value={priority}>{priority}</option>)}</select></label></div><label>Acknowledgement<textarea maxLength={1000} value={draft.acknowledgement || ''} onChange={event => setDraft({ ...draft, acknowledgement: event.target.value })} /></label><label className="check-field"><input type="checkbox" checked={draft.followUp || false} onChange={event => setDraft({ ...draft, followUp: event.target.checked })} />Create a follow-up task for tomorrow</label><label className="check-field"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />Rule enabled</label>{error && <p role="alert">{error}</p>}<div className="row-actions"><button className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" disabled={saving} onClick={() => { setDraft(null); setError(''); setStatus('') }}>Cancel</button></div></form>}
    {!draft && <button className="button-primary" onClick={() => { const next = newRule(area === 'all' ? 'community' : area); setDraft(next); setIsNew(true); setError('') }}>Create routing rule</button>}
    <section className="glass-panel record-card"><h2>Execution history</h2>{data.automationRuns?.length ? data.automationRuns.slice(-10).reverse().map(run => <p key={run.id}>{run.rule} · {run.status} · {new Date(run.time).toLocaleString()}</p>) : <p>No rules executed yet.</p>}</section><p role="status" aria-live="polite">{status}</p>
  </div>
}

type WidgetDraft = { greeting: string; colour: string; position: string; branding: boolean }

export function WidgetConfiguration({ data, setData }: ModuleProps) {
  const { registry, workspaceId } = useWorkspace()
  const workspace = registry?.workspaces.find(w => w.id === workspaceId)
  const currentSettings = mergeWorkspaceSettings(data.settings)
  const [draft, setDraft] = useState<WidgetDraft>(() => data.widget || { greeting: branding.greeting, colour: branding.colour, position: 'right', branding: true })
  const [hours, setHours] = useState(currentSettings.operatingHours)
  const [previewDay, setPreviewDay] = useState(2)
  const [previewTime, setPreviewTime] = useState('10:00')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savedWidget = data.widget || { greeting: branding.greeting, colour: branding.colour, position: 'right', branding: true }
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedWidget) || JSON.stringify(hours) !== JSON.stringify(currentSettings.operatingHours)
  const withinHours = isPreviewWithinHours(hours, previewDay, previewTime)
  const snippet = `<script src="${location.origin}/widget.js"></script>`

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.greeting.trim()) { setError('Add a greeting for visitors.'); return }
    if (!/^#[0-9a-f]{6}$/i.test(draft.colour)) { setError('Choose a valid six-digit brand colour.'); return }
    if (hours.enabled && !hours.days.length) { setError('Choose at least one operating day.'); return }
    if (hours.enabled && hours.closesAt <= hours.opensAt) { setError('Closing time must be later than opening time.'); return }
    setSaving(true); setStatus('Saving changes…'); setError('')
    await new Promise(resolve => window.setTimeout(resolve, 300))
    const success = await setData(current => ({ ...current, widget: { ...draft }, settings: { ...mergeWorkspaceSettings(current.settings), operatingHours: { ...hours, days: [...hours.days] } } }))
    setSaving(false); setStatus(success ? 'Changes saved' : '')
    if (!success) setError('Changes could not be saved. Please try again.')
  }

  function cancel() {
    setDraft({ ...(data.widget || { greeting: branding.greeting, colour: branding.colour, position: 'right', branding: true }) })
    setHours(mergeWorkspaceSettings(data.settings).operatingHours); setError(''); setStatus('')
  }

  return <div className="module-page enhanced"><div className="module-heading"><div><span className="eyebrow">WEBSITE CHAT</span><h1>A warm welcome</h1><p>Set the greeting, appearance and hours visitors will see.</p></div><Link to={workspace?.supportMode === 'banking' ? '/enl-preview' : '/chat'} target="_blank" className="button-primary">Open customer chat</Link></div>
    <div className="editor-layout"><form className="glass-panel record-card" onSubmit={save}><h2>Widget appearance</h2><label>Greeting<input required maxLength={180} value={draft.greeting} onChange={event => setDraft({ ...draft, greeting: event.target.value })} /></label><label>Brand colour<input type="color" value={draft.colour} onChange={event => setDraft({ ...draft, colour: event.target.value })} /></label><label>Position<select value={draft.position} onChange={event => setDraft({ ...draft, position: event.target.value })}><option value="right">Bottom right</option><option value="left">Bottom left</option></select></label><label className="check-field"><input type="checkbox" checked={draft.branding} onChange={event => setDraft({ ...draft, branding: event.target.checked })} />Show workspace branding</label>
      <h2>Operating hours</h2><p>Set when the widget should show your team as online.</p><label className="check-field"><input type="checkbox" checked={hours.enabled} onChange={event => setHours({ ...hours, enabled: event.target.checked })} />Enable operating hours</label>{hours.enabled && <><div className="day-selector" aria-label="Operating days">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <label className="check-field" key={day}><input type="checkbox" checked={hours.days.includes(index)} onChange={event => setHours({ ...hours, days: event.target.checked ? [...hours.days, index].sort() : hours.days.filter(value => value !== index) })} />{day}</label>)}</div><div className="form-grid"><label>Opens at<input type="time" required value={hours.opensAt} onChange={event => setHours({ ...hours, opensAt: event.target.value })} /></label><label>Closes at<input type="time" required value={hours.closesAt} onChange={event => setHours({ ...hours, closesAt: event.target.value })} /></label></div><label>Time zone<select value={hours.timezone} onChange={event => setHours({ ...hours, timezone: event.target.value })}><option value="Africa/Johannesburg">South Africa (SAST)</option><option value="UTC">UTC</option></select></label><label>Offline greeting<textarea required maxLength={240} value={hours.offlineGreeting} onChange={event => setHours({ ...hours, offlineGreeting: event.target.value })} /></label></>}
      {dirty && <p className="unsaved-state">Unsaved changes</p>}{error && <p role="alert">{error}</p>}<div className="row-actions"><button className="button-primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" disabled={saving || !dirty} onClick={cancel}>Cancel</button></div><p role="status" aria-live="polite">{status}</p><h2>Installation</h2><code className="pre-wrap">{snippet}</code><button type="button" className="button-secondary" onClick={() => { void navigator.clipboard.writeText(snippet).then(() => setStatus('Snippet copied')).catch(() => setStatus('Clipboard unavailable; select and copy the snippet.')) }}>Copy snippet</button></form>
      <section className={`glass-panel widget-live-preview glass-gradient-border glass-gradient-border-animated position-${draft.position}`}><span>PREVIEW</span><label>Preview day<select value={previewDay} onChange={event => setPreviewDay(Number(event.target.value))}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Preview time<input type="time" value={previewTime} onChange={event => setPreviewTime(event.target.value)} /></label><article className="record-card widget-preview-card" style={{ borderTop: `3px solid ${draft.colour}` }}><p className="widget-online-state"><i className={withinHours ? 'online' : ''} />{withinHours ? 'Online' : 'Offline'}</p><h2>{withinHours ? draft.greeting : hours.offlineGreeting}</h2><p>A helpful conversation starts here.</p>{draft.branding && <small>{workspace?.name || branding.name}</small>}<button type="button" style={{ backgroundColor: draft.colour }}>{draft.position === 'left' ? 'Chat bubble · bottom left' : 'Chat bubble · bottom right'}</button></article></section></div>
  </div>
}

export function SettingsPage({ initialSection = 'Channels' }: { initialSection?: string } = {}) {
  const { data, setData } = useDemo()
  const context = useWorkspace()
  const allowed = context.can(context.actorId, 'manage-workspace')
  const role = allowed ? 'Admin' : 'Agent'
  const workspace = context.registry?.workspaces.find(w => w.id === context.workspaceId)
  const [section, setSection] = useState(initialSection)
  const [selected, setSelected] = useState('')
  const [channelDraft, setChannelDraft] = useState({ displayName: '', accountReference: '' })
  const [notificationDraft, setNotificationDraft] = useState(mergeWorkspaceSettings(data?.settings).notifications)
  const [noticePreview, setNoticePreview] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reduced, setReduced] = useState(() => localPreferences.getItem('qalo-reduced-motion') === 'true')
  const settings = mergeWorkspaceSettings(data?.settings)
  const channelConfig = settings.integrations
  const notificationDirty = JSON.stringify(notificationDraft) !== JSON.stringify(settings.notifications)

  async function saveSettings(patch: Partial<typeof settings>) {
    if (!allowed) { setError('Workspace administrator permission is required.'); return }
    setSaving(true); setStatus('Saving changes…'); setError('')
    await new Promise(resolve => window.setTimeout(resolve, 300))
    const success = await setData(current => ({ ...current, settings: { ...mergeWorkspaceSettings(current.settings), ...patch } }))
    setSaving(false); setStatus(success ? 'Changes saved' : '')
    if (!success) setError('Changes could not be saved. Please try again.')
  }

  function editChannel(name: string) {
    const saved = channelConfig[name]
    setSelected(name); setChannelDraft(saved ? { displayName: saved.displayName, accountReference: saved.accountReference } : { displayName: name, accountReference: '' }); setStatus(''); setError('')
  }

  if (!data) return <div className="module-page enhanced"><p role="status">Loading settings…</p></div>

  return <div className="module-page enhanced"><div className="module-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Settings</h1><p>Manage your channels, team preferences and support queues.</p></div></div>
    <div className="settings-grid"><aside className="settings-menu" aria-label="Settings sections">{['Channels', 'Queues', 'Notifications', 'Security', 'Workspace', 'Accessibility', 'Access'].map(item => <button className={section === item ? 'selected' : ''} key={item} onClick={() => { setSection(item); setSelected(''); setStatus(''); setError('') }}>{item}</button>)}</aside>
      <section className="glass-panel record-card glass-gradient-border glass-gradient-border-animated"><fieldset disabled={!allowed && !['Accessibility', 'Workspace', 'Access'].includes(section)} style={{ border: 0, padding: 0, minWidth: 0 }}>
        {section === 'Queues' ? <QueueConfiguration data={data} setData={setData} /> : section === 'Channels' ? <>
          <h2>Channel connections</h2><p>Save the intended setup for review. Saving does not verify an external connection.</p>{role !== 'Admin' && <p>Channel settings are managed by your workspace administrator.</p>}
          {channels.map(name => { const saved = channelConfig[name]; const channelDirty = selected === name && JSON.stringify(channelDraft) !== JSON.stringify(saved ? { displayName: saved.displayName, accountReference: saved.accountReference } : { displayName: name, accountReference: '' }); return <article key={name} className="record-card"><div className="row-actions"><strong>{name}</strong><span className="publish-state">{saved ? 'Configuration saved' : 'Not configured'}</span><button className="button-secondary" disabled={role !== 'Admin'} onClick={() => editChannel(name)} aria-expanded={selected === name}>{saved ? 'Edit' : 'Configure channel'}</button>{saved && <button className="button-secondary" disabled={role !== 'Admin' || saving} onClick={() => { const integrations = Object.fromEntries(Object.entries(channelConfig).filter(([key]) => key !== name)); void saveSettings({ integrations }); setSelected('') }}>Disconnect</button>}</div>
            {saved && <><p>{saved.displayName} · {saved.accountReference}</p><small>Connection not verified</small></>}
            {selected === name && role === 'Admin' && <form className="channel-setup" onSubmit={async event => { event.preventDefault(); if (channelDraft.accountReference.trim().length < 4) { setError('Enter an account or page reference with at least 4 characters.'); return } await saveSettings({ integrations: { ...channelConfig, [name]: { ...channelDraft, displayName: channelDraft.displayName.trim(), accountReference: channelDraft.accountReference.trim(), savedAt: new Date().toISOString() } } }); setSelected('') }}><label>Display name<input required maxLength={80} value={channelDraft.displayName} onChange={event => setChannelDraft({ ...channelDraft, displayName: event.target.value })} /></label><label>Account or page reference<input required maxLength={120} value={channelDraft.accountReference} onChange={event => setChannelDraft({ ...channelDraft, accountReference: event.target.value })} placeholder="qalo-support-page" /></label><p>Use a non-secret reference. Provider credentials are not collected here.</p><div className="integration-preview"><strong>Preview</strong><span>{channelDraft.displayName || name}</span><small>Configuration saved · Connection not verified</small></div>{channelDirty && <p className="unsaved-state">Unsaved changes</p>}{error && <p role="alert">{error}</p>}<div className="row-actions"><button className="button-primary" disabled={saving || !channelDraft.displayName.trim() || !channelDraft.accountReference.trim()}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" disabled={saving} onClick={() => { setSelected(''); setError(''); setStatus('') }}>Cancel</button></div></form>}
          </article> })}<p role="status" aria-live="polite">{status}</p>
        </> : section === 'Notifications' ? <>
          <h2>Notification preferences</h2><p>Choose which updates appear in your workspace.</p>{(Object.entries({ assignment: 'Conversation assigned', reply: 'Customer replies', mention: 'Team mentions', followUp: 'Follow-ups due', desktop: 'Desktop notifications' }) as [keyof typeof notificationDraft, string][]).map(([key, label]) => <label className="check-field" key={key}><input type="checkbox" checked={notificationDraft[key]} onChange={event => setNotificationDraft(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}{notificationDirty && <p className="unsaved-state">Unsaved changes</p>}<div className="row-actions"><button className="button-primary" disabled={saving || !notificationDirty} onClick={() => void saveSettings({ notifications: notificationDraft })}>{saving ? 'Saving…' : 'Save changes'}</button><button className="button-secondary" disabled={saving || !notificationDirty} onClick={() => { setNotificationDraft(settings.notifications); setStatus('') }}>Cancel</button><button className="button-secondary" onClick={() => setNoticePreview(`New enquiry assigned · ${workspace?.supportMode === 'banking' ? 'Banking Support' : 'Community Investment'} · in-app preview · desktop notifications ${notificationDraft.desktop ? 'on' : 'off'}`)}>Send preview notification</button></div>{noticePreview && <p className="notification-preview" role="status"><strong>Preview</strong><span>{noticePreview}</span></p>}<p role="status" aria-live="polite">{status}</p>
        </> : section === 'Security' ? <SecuritySettings /> : section === 'Workspace' ? <><h2>{workspace?.name}</h2><p>{workspace?.description}</p><Link to="/widget">Configure chat widget</Link></> : section === 'Accessibility' ? <><h2>Display preferences</h2><label className="check-field"><input type="checkbox" checked={reduced} onChange={event => { setReduced(event.target.checked); localPreferences.setItem('qalo-reduced-motion', String(event.target.checked)); document.documentElement.dataset.reducedMotion = String(event.target.checked) }} />Reduce motion</label><p>Your device’s reduced-motion preference is also respected.</p></> : <><h2>Workspace access</h2><p>Current profile: <strong>{role}</strong></p><p>Find team members, review their roles and prepare invitations from the team directory.</p><Link to={`/workspaces/${context.workspaceId}`}>Manage workspace members</Link></>}
        {error && section !== 'Channels' && <p role="alert">{error}</p>}
      </fieldset></section>
    </div>
  </div>
}

function SecuritySettings() {
  return <section className="security-settings"><h2>Security</h2><p>Password management is unavailable pending real authentication integration.</p><button className="button-secondary" disabled>Change password unavailable</button><p>No password or MFA changes can be performed in this preview.</p><Link to="/account/security">View account security</Link></section>
}
