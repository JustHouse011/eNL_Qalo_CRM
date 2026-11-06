import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from './WorkspaceContext';
import { supportService } from '../lib/supportService';
import { platformPreview, type ManagementCommand, type WorkspaceDraft } from '../lib/workspaceManagement';
import { isAdministrator, getAccessibleWorkspaces, canInWorkspace, type Workspace } from '../lib/workspaceTypes';
import './Workspaces.css';
const blank: WorkspaceDraft = { name: '', slug: '', description: '', type: 'Organisation', logo: null, primaryColor: '#933F98', secondaryColor: '#8CCDAB' };
export function Workspaces() {
    const { registry, actorId, selectWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const { workspaceId: detailId } = useParams();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [layout, setLayout] = useState('cards');
    const [editing, setEditing] = useState<Workspace | 'new' | null>(null);
    const [draft, setDraft] = useState(blank);
    const [administratorId, setAdministratorId] = useState('user-agent-1');
    const [memberName, setMemberName] = useState('');
    const [existingUser, setExistingUser] = useState('');
    const [memberRole, setMemberRole] = useState<'supervisor' | 'agent' | 'viewer'>('agent');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    useEffect(() => { if (editing)
        dialog.current?.showModal();
    else {
        dialog.current?.close();
        opener.current?.focus();
    } }, [editing]);
    if (!registry)
        return <p role="status">Loading workspaces…</p>;
    const actor = actorId === platformPreview.id ? platformPreview : registry.users.find(u => u.id === actorId);
    const platform = isAdministrator(actor);
    const visible = getAccessibleWorkspaces(actor, registry.workspaces, registry.memberships, true);
    const detail = visible.find(w => w.id === detailId);
    function run(command: ManagementCommand) {
        setBusy(true);
        setError('');
        try {
            supportService.manage(actorId, command);
            return true;
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to save changes.');
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    function open(id: string) {
        if (!window.confirm('Open this workspace? Open forms and unsent replies will be cleared.'))
            return;
        try {
            selectWorkspace(id, actorId);
            navigate('/overview');
        }
        catch (cause) {
            setError(String(cause));
        }
    }
    function edit(workspace: Workspace | 'new') { opener.current = document.activeElement as HTMLElement; setDraft(workspace === 'new' ? { ...blank } : { ...workspace }); setError(''); setEditing(workspace); }
    function statusAction(w: Workspace) {
        const next = w.status === 'active' ? 'inactive' : 'active';
        if (window.confirm(`${next === 'inactive' ? 'Deactivate' : 'Reactivate'} ${w.name}? All records will be retained.`))
            run({ kind: 'status', workspaceId: w.id, status: next });
    }
    function actions(w: Workspace) { return <div className="workspace-actions"><button className="button-primary" disabled={w.status !== 'active' || !canInWorkspace(actor, w, registry!.memberships, 'view')} onClick={() => open(w.id)}>Open workspace</button><Link className="button-secondary" to={`/workspaces/${w.id}`}>Details & settings</Link>{canInWorkspace(actor, w, registry!.memberships, 'manage-workspace') && <button className="button-secondary" onClick={() => edit(w)}>Edit</button>}{platform && <button className="button-secondary" onClick={() => statusAction(w)}>{w.status === 'active' ? 'Deactivate' : 'Reactivate'}</button>}</div>; }
    const editable = detail && canInWorkspace(actor, detail, registry.memberships, 'manage-workspace');
    return <section className="workspace-management enhanced"><header><div><span className="eyebrow">WORKSPACE MANAGEMENT</span><h1>{detail ? detail.name : 'Workspaces'}</h1></div>{platform && <button className="button-primary" onClick={() => edit('new')}>Create workspace</button>}</header><p>Manage workspaces, memberships and access permissions.</p>{error && <p role="alert">{error}</p>}
    {detailId ? detail ? <><Link to="/workspaces">Back to workspaces</Link><article className="glass-panel workspace-card"><h2>General & branding</h2><p>{detail.description || 'No description added.'}</p><p>{detail.type} · {detail.slug} · {detail.status}</p><div className="workspace-colours"><span style={{ background: detail.primaryColor }}/>{detail.primaryColor}<span style={{ background: detail.secondaryColor }}/>{detail.secondaryColor}</div>{actions(detail)}</article><article className="glass-panel workspace-card"><h2>Configuration</h2><p>Timezone: {detail.settings.operatingHours.timezone} · Hours: {detail.settings.operatingHours.opensAt}–{detail.settings.operatingHours.closesAt}</p><p>Routing: {detail.settings.routingEnabled ? detail.settings.assignmentMode : 'Disabled'}</p>{editable && <button className="button-secondary" onClick={() => edit(detail)}>Edit configuration</button>}</article><article className="glass-panel workspace-card"><h2>Activity</h2><p>{registry.snapshots[detail.id].conversations.length} conversations · {registry.snapshots[detail.id].tickets.length} tickets · {registry.snapshots[detail.id].contacts.length} contacts · {registry.snapshots[detail.id].articles.length} articles</p><p>Created {new Date(detail.createdAt).toLocaleDateString()} · Updated {new Date(detail.updatedAt).toLocaleString()}</p></article><article className="glass-panel workspace-card"><h2>Members</h2><div className="workspace-table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Assigned workspaces</th><th>Actions</th></tr></thead><tbody>{registry.memberships.filter(m => m.workspaceId === detail.id).map(m => <tr key={m.id}><td>{registry.users.find(u => u.id === m.userId)?.name}</td><td><select aria-label={`Role for ${m.userId}`} disabled={!editable || busy} value={m.role} onChange={e => run({ kind: 'member', workspaceId: detail.id, userId: m.userId, role: e.target.value as typeof m.role, status: m.status })}><option value="supervisor">Supervisor</option><option value="agent">Support Agent</option></select></td><td>{m.status}</td><td>{registry.memberships.filter(other => other.userId === m.userId && other.status === 'active').map(other => registry.workspaces.find(w => w.id === other.workspaceId)?.name).join(', ')}</td><td>{editable && <><button className="button-secondary" onClick={() => { if (window.confirm('Change this member’s access?'))
        run({ kind: 'member', workspaceId: detail.id, userId: m.userId, role: m.role, status: m.status === 'active' ? 'inactive' : 'active' }); }}>{m.status === 'active' ? 'Deactivate member' : 'Activate member'}</button><button className="button-secondary" onClick={() => { if (window.confirm('Remove membership? Support history will be retained.'))
        run({ kind: 'remove-member', workspaceId: detail.id, userId: m.userId }); }}>Remove member</button></>}</td></tr>)}</tbody></table></div>{editable && <form className="workspace-form" onSubmit={e => { e.preventDefault(); if (existingUser && registry.memberships.some(m => m.workspaceId === detail.id && m.userId === existingUser)) {
        setError('This user is already a member. Edit their existing membership.');
        return;
    } ; if (run({ kind: 'member', workspaceId: detail.id, userId: existingUser || undefined, name: memberName, role: memberRole, status: 'active' })) {
        setMemberName('');
        setExistingUser('');
    } }}><h3>Add member</h3><label>Existing user<select value={existingUser} onChange={e => setExistingUser(e.target.value)}><option value="">Create member</option>{registry.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>{!existingUser && <label>Member name<input required value={memberName} onChange={e => setMemberName(e.target.value)}/></label>}<label>Member role<select value={memberRole} onChange={e => setMemberRole(e.target.value as typeof memberRole)}><option value="supervisor">Supervisor</option><option value="agent">Support Agent</option></select></label><button className="button-primary" disabled={busy}>Add member</button></form>}</article></> : <p role="alert">Workspace unavailable or not assigned to this account.</p> : <><div className="workspace-filters"><label>Search workspaces<input value={search} onChange={e => setSearch(e.target.value)}/></label><label>Status<select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label>View<select aria-label="View" value={layout} onChange={e => setLayout(e.target.value)}><option value="cards">Cards</option><option value="list">List</option></select></label></div><div className={`workspace-grid ${layout}`}>{visible.filter(w => (status === 'all' || w.status === status) && `${w.name} ${w.slug}`.toLowerCase().includes(search.toLowerCase())).map(w => <article className="glass-panel workspace-card" key={w.id}><div className="workspace-identity">{w.logo ? <img src={w.logo} alt=""/> : <span className="workspace-avatar" style={{ background: w.primaryColor }}>{w.name.slice(0, 2).toUpperCase()}</span>}<h2>{w.name}</h2></div><p>{w.description}</p><p>{w.type} / {w.status}</p><p>{registry.memberships.filter(m => m.workspaceId === w.id).length} members / Created {new Date(w.createdAt).toLocaleDateString()}</p>{actions(w)}</article>)}</div>{!visible.length && <p>No workspaces are assigned to this account. Ask an administrator to add a membership.</p>}</>}
    <dialog ref={dialog} className="workspace-dialog enhanced" onCancel={() => { if (!busy)
        setEditing(null); }} aria-labelledby="workspace-dialog-title"><form className="workspace-form" onSubmit={e => { e.preventDefault(); if (!editing)
        return; const command: ManagementCommand = editing === 'new' ? { kind: 'create', draft, administratorId } : { kind: 'edit', workspaceId: editing.id, draft, settings: editing.settings }; if (run(command))
        setEditing(null); }}><h2 id="workspace-dialog-title">{editing === 'new' ? 'Create workspace' : 'Edit workspace'}</h2>{error && <p role="alert">{error}</p>}{(['name', 'slug', 'description', 'type'] as const).map(field => <label key={field}>{({ name: 'Workspace name', slug: 'Workspace slug', description: 'Description', type: 'Organisation type' })[field]}<input autoFocus={field === 'name'} required={field !== 'description'} value={draft[field]} onChange={e => setDraft({ ...draft, [field]: e.target.value })}/></label>)}<label>Primary colour<input type="color" value={draft.primaryColor} onChange={e => setDraft({ ...draft, primaryColor: e.target.value })}/></label><label>Secondary colour<input type="color" value={draft.secondaryColor} onChange={e => setDraft({ ...draft, secondaryColor: e.target.value })}/></label><label>Logo<select value={draft.logo || ''} onChange={e => setDraft({ ...draft, logo: e.target.value || null })}><option value="">Initials placeholder</option><option value="/qalo-logo.png">Qalo approved logo</option><option value="/qalo-website-logo.png">Qalo website logo</option></select></label>{editing === 'new' ? <label>Initial administrator<select value={administratorId} onChange={e => setAdministratorId(e.target.value)}>{registry.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label> : editing && <><label>Timezone<input required value={editing.settings.operatingHours.timezone} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, operatingHours: { ...editing.settings.operatingHours, timezone: e.target.value } } })}/></label>{(['opensAt', 'closesAt'] as const).map(field => <label key={field}>{field === 'opensAt' ? 'Opening time' : 'Closing time'}<input type="time" required value={editing.settings.operatingHours[field]} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, operatingHours: { ...editing.settings.operatingHours, [field]: e.target.value } } })}/></label>)}<label><input type="checkbox" checked={editing.settings.operatingHours.enabled} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, operatingHours: { ...editing.settings.operatingHours, enabled: e.target.checked } } })}/>Operating hours enabled</label><fieldset><legend>Operating days</legend>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <label key={day}><input type="checkbox" checked={editing.settings.operatingHours.days.includes(index)} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, operatingHours: { ...editing.settings.operatingHours, days: e.target.checked ? [...editing.settings.operatingHours.days, index] : editing.settings.operatingHours.days.filter(d => d !== index) } } })}/>{day}</label>)}</fieldset><label>Offline greeting<textarea value={editing.settings.operatingHours.offlineGreeting} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, operatingHours: { ...editing.settings.operatingHours, offlineGreeting: e.target.value } } })}/></label><fieldset><legend>Notifications</legend>{(Object.keys(editing.settings.notifications) as (keyof typeof editing.settings.notifications)[]).map(key => <label key={key}><input type="checkbox" checked={editing.settings.notifications[key]} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, notifications: { ...editing.settings.notifications, [key]: e.target.checked } } })}/>{key}</label>)}</fieldset><label><input type="checkbox" checked={editing.settings.routingEnabled} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, routingEnabled: e.target.checked } })}/>Routing enabled</label><label>Assignment mode<select value={editing.settings.assignmentMode} onChange={e => setEditing({ ...editing, settings: { ...editing.settings, assignmentMode: e.target.value as 'manual' | 'round-robin' } })}><option value="manual">Manual</option><option value="round-robin">Round robin</option></select></label></>}<div className="workspace-actions"><button type="button" className="button-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className="button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save workspace'}</button></div></form></dialog>
  </section>;
}
