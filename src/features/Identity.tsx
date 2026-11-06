import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDemoAccess } from './DemoAccess'
import { useWorkspace } from './WorkspaceContext'
import { previewUsers, roleLabels } from '../lib/identityPreview'
import { localPreferences, sessionPreferences } from '../lib/storage'
import { presentProductCopy } from '../lib/productCopy'
import { isAdministrator, type WorkspaceRole } from '../lib/workspaceTypes'
import './Identity.css'

type Preferences = { notifications: boolean; reducedMotion: boolean; contrast: boolean }
function read<T>(key: string, fallback: T): T { try { return presentProductCopy(JSON.parse(localPreferences.getItem(key) || 'null') || fallback) } catch { return fallback } }
export function DeveloperSession() {
  const { setRole } = useDemoAccess()
  const { registry } = useWorkspace()
  const navigate = useNavigate()
  const [selected, select] = useState('user-agent-1')
  return <main className="identity-page developer-session"><span className="eyebrow">ACCOUNT ACCESS</span><h1>Switch account</h1><p>Choose an account to open its workspace.</p><label>Account<select value={selected} onChange={e => select(e.target.value)}>{registry?.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><button className="button-primary" onClick={() => { sessionPreferences.setItem('qalo-developer-user', `user:${selected}`); setRole(`user:${selected}`); navigate('/overview') }}>Start session</button><Link to="/signin">Shared CRM login</Link></main>
}

type Invitation = { id: string; name: string; email: string; access: Record<string, WorkspaceRole>; status: 'Local draft' | 'pending'; at: string }
export function IdentityPage({ lightTheme, setTheme }: { lightTheme: boolean; setTheme: (next: boolean) => void }) {
  const { registry, actorId, workspaceId } = useWorkspace()
  const { section = 'profile' } = useParams()
  const location = useLocation()
  const user = registry?.users.find(u => u.id === actorId)
  const spec = previewUsers.find(u => u.id === actorId)
  const key = `qalo-personal:${actorId}`
  const [profile, setProfile] = useState(() => read(key, { name: user?.name || '', email: spec?.email || 'preview@example.invalid', phone: '', title: spec?.title || 'Support colleague' }))
  const [saved, setSaved] = useState('')
  const [prefs, setPrefs] = useState(() => read<Preferences>(`${key}:preferences`, { notifications: true, reducedMotion: false, contrast: false }))
  const [tab, setTab] = useState('User Directory')
  const [invitations, setInvitations] = useState(() => read<Invitation[]>('qalo-platform-invitations', []))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [access, setAccess] = useState<Record<string, WorkspaceRole>>({})
  const [review, setReview] = useState(false)
  const [platformName, setPlatformName] = useState(() => read('qalo-platform-settings', { name: 'eNL/Qalo CRM' }).name)
  useEffect(() => { localPreferences.setItem(`${key}:preferences`, JSON.stringify(prefs)); window.dispatchEvent(new Event('qalo-personal-change')); document.documentElement.classList.toggle('identity-reduced-motion', prefs.reducedMotion); document.documentElement.classList.toggle('identity-high-contrast', prefs.contrast) }, [key, prefs])
  if (!registry || !user) return <p role="status">Loading profile…</p>
  const memberships = registry.memberships.filter(m => m.userId === actorId && m.status === 'active')
  const organisations = memberships.map(m => registry.workspaces.find(w => w.id === m.workspaceId)?.name).filter(Boolean)
  const platform = location.pathname === '/platform'
  const titles: Record<string, string> = { profile: 'My Profile', security: 'Security', access: 'My Access', preferences: 'Preferences' }
  function saveInvitation(status: Invitation['status']) {
    if (!name.trim() || !email.trim() || !Object.keys(access).length) return
    const next = [...invitations, { id: crypto.randomUUID(), name: name.trim(), email: email.trim(), access: { ...access }, status, at: new Date().toISOString() }]
    setInvitations(next); localPreferences.setItem('qalo-platform-invitations', JSON.stringify(next)); setSaved(`${status} saved locally. No email sent.`); setReview(false); setName(''); setEmail(''); setAccess({})
  }
  function accessTable() { return <div className="identity-table"><table><thead><tr><th>Workspace</th><th>Role</th><th>Permissions</th><th>Status</th></tr></thead><tbody>{memberships.map(m => <tr key={m.id}><td>{registry!.workspaces.find(w => w.id === m.workspaceId)?.name}</td><td>{roleLabels[m.role]}</td><td>{m.role === 'supervisor' ? 'Support and operational oversight' : m.role === 'agent' ? 'View and handle support conversations and tickets' : 'Read-only access'}</td><td>{m.status}</td></tr>)}</tbody></table></div> }
  return <section className="module-page enhanced identity-page"><header><span className="eyebrow">{platform ? 'PLATFORM' : 'YOUR ACCOUNT'}</span><h1>{platform ? 'Platform Administration' : titles[section] || 'My Profile'}</h1><p>Account · {user.name}</p></header><nav className="identity-tabs" aria-label="Account settings">{Object.entries(titles).map(([id, title]) => <Link key={id} to={`/account/${id}`} aria-current={section === id && !platform ? 'page' : undefined}>{title}</Link>)}{isAdministrator(user) && <Link to="/platform">Platform Administration</Link>}</nav>{saved && <p role="status">{saved}</p>}
    {!platform && section === 'profile' && <form className="glass-panel identity-card identity-form" onSubmit={e => { e.preventDefault(); localPreferences.setItem(key, JSON.stringify(profile)); window.dispatchEvent(new Event('qalo-personal-change')); setSaved('Profile saved locally.') }}><span className="avatar">{profile.name.split(' ').map(n => n[0]).join('')}</span>{(['name', 'email', 'phone', 'title'] as const).map(field => <label key={field}>{({ name: 'Display name', email: 'Email', phone: 'Phone number (optional)', title: 'Job title' })[field]}<input type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} required={field !== 'phone'} maxLength={150} value={profile[field]} onChange={e => setProfile({ ...profile, [field]: e.target.value })} /></label>)}<p>Assigned organisations: {organisations.join(', ')}</p><button className="button-primary">Save profile</button></form>}
    {!platform && section === 'security' && <div className="identity-grid">{['Password management', 'Multi-factor authentication', 'Active sessions', 'Sign-in activity'].map(title => <article className="glass-panel identity-card" key={title}><h2>{title}</h2><p>{title === 'Active sessions' ? 'Current browser session.' : title === 'Sign-in activity' ? 'No verified sign-in history is available.' : 'Unavailable'}</p><button disabled className="button-secondary">Unavailable</button></article>)}</div>}
    {!platform && section === 'access' && <article className="glass-panel identity-card"><h2>Assigned workspaces</h2><p>Account status: Active · Platform role: {isAdministrator(user) ? 'Administrator' : 'Standard User'}</p>{accessTable()}<p>Current workspace: {registry.workspaces.find(w => w.id === workspaceId)?.name}. Membership changes require an administrator.</p></article>}
    {!platform && section === 'preferences' && <article className="glass-panel identity-card identity-form"><label>Theme<select value={lightTheme ? 'light' : 'dark'} onChange={e => setTheme(e.target.value === 'light')}><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Language<select aria-label="Language" disabled value="en"><option value="en">English</option></select><small>English is currently the supported language.</small></label>{(['notifications', 'reducedMotion', 'contrast'] as const).map(field => <label key={field}><input type="checkbox" checked={prefs[field]} onChange={e => setPrefs({ ...prefs, [field]: e.target.checked })} />{({ notifications: 'In-app notifications', reducedMotion: 'Reduced motion', contrast: 'Higher contrast' })[field]}</label>)}<p>Preferences save locally for this user.</p></article>}
    {platform && !isAdministrator(user) && <p role="alert">Administrator access required.</p>}
    {platform && isAdministrator(user) && <><p>Manage users, workspace access and invitation drafts.</p><nav className="identity-tabs" aria-label="Platform administration">{['User Directory', 'Invite User', 'Workspace Access', 'Roles & Permissions', 'Platform Settings', 'Audit History'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setSaved('') }}>{t}</button>)}</nav>
      {tab === 'User Directory' && <div className="identity-grid">{registry.users.map(u => <article className="glass-panel identity-card" key={u.id}><h2>{u.name}</h2><p>{isAdministrator(u) ? 'Administrator' : 'Standard User'} · Active</p><p>{registry.memberships.filter(m => m.userId === u.id && m.status === 'active').map(m => `${registry.workspaces.find(w => w.id === m.workspaceId)?.name}: ${roleLabels[m.role]}`).join(' · ') || 'No workspace memberships'}</p></article>)}</div>}
      {tab === 'Invite User' && <form className="glass-panel identity-card identity-form" onSubmit={e => { e.preventDefault(); setReview(true) }}><label>Name<input required maxLength={100} value={name} readOnly={review} onChange={e => setName(e.target.value)} /></label><label>Email<input required type="email" maxLength={200} value={email} readOnly={review} onChange={e => setEmail(e.target.value)} /></label><fieldset disabled={review}><legend>Workspace access</legend>{registry.workspaces.filter(w => w.status === 'active').map(w => <div key={w.id}><label><input type="checkbox" checked={!!access[w.id]} onChange={e => { const next = { ...access }; if (e.target.checked) next[w.id] = 'agent'; else delete next[w.id]; setAccess(next) }} />{w.name}</label>{access[w.id] && <label>Role in {w.name}<select value={access[w.id]} onChange={e => setAccess({ ...access, [w.id]: e.target.value as WorkspaceRole })}>{Object.entries(roleLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}</div>)}</fieldset>{review ? <><h2>Review invitation</h2><p>{name} · {email}</p>{Object.entries(access).map(([id, role]) => <p key={id}>{registry.workspaces.find(w => w.id === id)?.name}: {roleLabels[role]}</p>)}<button type="button" className="button-secondary" onClick={() => setReview(false)}>Edit invitation</button><button type="button" className="button-primary" onClick={() => saveInvitation('Local draft')}>Save local draft</button><button type="button" className="button-secondary" onClick={() => saveInvitation('pending')}>Save pending invitation</button></> : <button className="button-primary" disabled={!Object.keys(access).length}>Review invitation</button>}<p>No email will be sent.</p></form>}
      {tab === 'Workspace Access' && <article className="glass-panel identity-card"><h2>Manage workspace access</h2><Link to="/workspaces">Open workspace membership management</Link>{accessTable()}</article>}
      {tab === 'Roles & Permissions' && <article className="glass-panel identity-card"><h2>Roles & Permissions</h2>{Object.entries(roleLabels).map(([id, label]) => <p key={id}><strong>{label}</strong> — {id === 'supervisor' ? 'Support operations and oversight' : id === 'agent' ? 'Assigned support functionality' : 'Read-only interfaces'}</p>)}<p>Administrator: all workspaces and platform administration.</p></article>}
      {tab === 'Platform Settings' && <form className="glass-panel identity-card identity-form" onSubmit={e => { e.preventDefault(); localPreferences.setItem('qalo-platform-settings', JSON.stringify({ name: platformName })); setSaved('Platform display label saved locally.') }}><label>Platform display label<input required maxLength={100} value={platformName} onChange={e => setPlatformName(e.target.value)} /></label><button className="button-primary">Save local settings</button></form>}
      {tab === 'Audit History' && <article className="glass-panel identity-card"><h2>Local invitation history</h2>{invitations.length ? invitations.map(i => <p key={i.id}>{new Date(i.at).toLocaleString()} · {i.name} · {i.email} · {i.status}</p>) : <p>No local invitations recorded.</p>}<p>Review invitation and access history.</p></article>}
    </>}
  </section>
}
