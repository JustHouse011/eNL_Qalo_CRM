import { useState } from 'react'
import { Link } from 'react-router-dom'
import { localPreferences } from '../lib/storage'
import { useDemo } from '../lib/demoStore'
import { QueueConfiguration } from './ConfigurationEditors'
import { supportService } from '../lib/supportService'
import { useWorkspace } from './WorkspaceContext'
import { mergeWorkspaceSettings } from '../lib/workspaceSettings'
const { channels, workspaces } = supportService.referenceData()
export function SettingsPage() {
  const { data, setData } = useDemo()
  const { actorId, can, registry } = useWorkspace()
  const editable = can(actorId, 'manage-workspace')
  const role = registry?.users.find(user => user.id === actorId)?.role || 'Unavailable'
  const [section, setSection] = useState('Channels')
  const [selected, setSelected] = useState('')
  const [channelDraft, setChannelDraft] = useState({ displayName: '', accountReference: '' })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [noticePreview, setNoticePreview] = useState('')
  const [reduced, setReduced] = useState(() => localPreferences.getItem('qalo-reduced-motion') === 'true')
  if (!data) return <div className="module-page enhanced"><p role="status">Loading settings…</p></div>
  const settings = mergeWorkspaceSettings(data.settings)
  const channelConfig = settings.integrations
  async function saveSettings(patch: Partial<typeof settings>) {
    setSaving(true); setStatus('Saving changes…'); setError('')
    await new Promise(resolve => window.setTimeout(resolve, 300))
    const saved = await setData(current => ({ ...current, settings: { ...mergeWorkspaceSettings(current.settings), ...patch } }))
    setSaving(false); setStatus(saved ? 'Changes saved' : '')
    if (!saved) setError('Changes could not be saved. Please try again.')
  }
  function editChannel(name: string) {
    const saved = channelConfig[name]
    setSelected(name); setChannelDraft(saved ? { displayName: saved.displayName, accountReference: saved.accountReference } : { displayName: name, accountReference: '' }); setStatus(''); setError('')
  }
  return <div className="module-page enhanced"><div className="module-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Settings</h1><p>Manage your channels, team preferences and support queues.</p></div></div>
    <div className="settings-grid"><aside className="settings-menu" aria-label="Settings sections">{['Channels', 'Queues', 'Notifications', 'Workspace', 'Accessibility', 'Access'].map(item => <button className={section === item ? 'selected' : ''} key={item} onClick={() => { setSection(item); setSelected(''); setStatus(''); setError('') }}>{item}</button>)}</aside>
    <section className="glass-panel record-card">{section === 'Queues' ? <QueueConfiguration data={data} setData={setData} /> : section === 'Channels' ? <>
      <h2>Channel connections</h2><p>Save the intended setup for review. Saving does not verify an external connection.</p>{!editable && <p>Channel settings are managed by your workspace administrator.</p>}
      {channels.map(name => <article key={name} className="record-card"><div className="row-actions"><strong>{name}</strong><span className="publish-state">{channelConfig[name] ? 'Configuration saved' : 'Not configured'}</span><button className="button-secondary" disabled={!editable} onClick={() => editChannel(name)} aria-expanded={selected === name}>{channelConfig[name] ? 'Edit' : `Configure channel`}</button>{channelConfig[name] && <button className="button-secondary" disabled={!editable || saving} onClick={() => { void saveSettings({ integrations: Object.fromEntries(Object.entries(channelConfig).filter(([key]) => key !== name)) }); setSelected('') }}>Disconnect</button>}</div>
        {channelConfig[name] && <><p>{channelConfig[name].displayName} · {channelConfig[name].accountReference}</p><small>Connection not verified</small></>}
        {selected === name && editable && <form className="channel-setup" onSubmit={async e => { e.preventDefault(); if (channelDraft.accountReference.trim().length < 4) { setError('Enter an account or page reference with at least 4 characters.'); return } await saveSettings({ integrations: { ...channelConfig, [name]: { ...channelDraft, displayName: channelDraft.displayName.trim(), accountReference: channelDraft.accountReference.trim(), savedAt: new Date().toISOString() } } }); setSelected('') }}><label>Display name<input required maxLength={80} value={channelDraft.displayName} onChange={e => setChannelDraft({ ...channelDraft, displayName: e.target.value })} /></label><label>Account or page reference<input required maxLength={120} value={channelDraft.accountReference} onChange={e => setChannelDraft({ ...channelDraft, accountReference: e.target.value })} placeholder="qalo-support-page" /></label><p>Use a non-secret reference. Provider credentials are not collected here.</p><div className="integration-preview"><strong>Preview</strong><span>{channelDraft.displayName || name}</span><small>Configuration saved · Connection not verified</small></div>{error && <p role="alert">{error}</p>}<div className="row-actions"><button className="button-primary" disabled={saving || !channelDraft.displayName.trim() || !channelDraft.accountReference.trim()}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="button-secondary" onClick={() => { setSelected(''); setError(''); setStatus('') }}>Cancel</button></div></form>}
      </article>)}<p role="status">{status}</p>
    </> : section === 'Notifications' ? <><h2>Notification preferences</h2><p>Choose which updates appear in your workspace.</p>{(Object.entries({ assignment: 'Conversation assigned', reply: 'Customer replies', mention: 'Team mentions', followUp: 'Follow-ups due', desktop: 'Desktop notifications' }) as [keyof typeof settings.notifications, string][]).map(([key, label]) => <label className="check-field" key={key}><input type="checkbox" checked={settings.notifications[key]} onChange={e => { void saveSettings({ notifications: { ...settings.notifications, [key]: e.target.checked } }) }} />{label}</label>)}<button className="button-secondary" onClick={() => setNoticePreview('New enquiry assigned · Community Investment · just now')}>Send preview notification</button>{noticePreview && <p className="notification-preview" role="status"><strong>Preview</strong><span>{noticePreview}</span></p>}<p role="status">{status}</p></> : section === 'Workspace' ? <><h2>{workspaces[0].name}</h2><p>Community Investment and Qalo Store share one support workspace. Filter by business area to focus on the enquiries that matter to your team.</p><Link to="/widget">Configure chat widget</Link></> : section === 'Accessibility' ? <><h2>Display preferences</h2><label className="check-field"><input type="checkbox" checked={reduced} onChange={e => { setReduced(e.target.checked); localPreferences.setItem('qalo-reduced-motion', String(e.target.checked)); document.documentElement.dataset.reducedMotion = String(e.target.checked) }} /> Reduce motion</label><p>Your device’s reduced-motion preference is also respected.</p></> : <><h2>Workspace access</h2><p>Current profile: <strong>{role}</strong></p><p>Find team members, review their roles and prepare invitations from the team directory.</p><Link to="/team">Manage team</Link></>}{error && section !== 'Channels' && <p role="alert">{error}</p>}</section></div>
  </div>
}
