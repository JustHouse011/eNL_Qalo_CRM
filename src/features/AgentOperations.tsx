import { useState } from 'react'
import type { DemoData } from '../data/demoData'
import { useWorkspace } from './WorkspaceContext'
import { ticketSupport, ticketState } from '../lib/ticketSupport'
import type { WorkspaceAgent } from '../lib/workspaceTypes'

export function AgentOperations({ data, onToast }: { data: DemoData; onToast: (message: string) => void }) {
  const { registry, workspaceId, actorId, can } = useWorkspace()
  const snapshot = registry!.snapshots[workspaceId]
  const agents = snapshot.agents.filter(a => registry!.memberships.some(m => m.workspaceId === workspaceId && m.userId === a.userId && m.status === 'active'))
  const [selected, setSelected] = useState(''), [busy, setBusy] = useState(false)
  const agent = agents.find(a => a.id === selected)
  async function save(a: WorkspaceAgent, presence: NonNullable<WorkspaceAgent['presence']>, departments: string[]) {
    setBusy(true)
    try { await ticketSupport.agent(workspaceId, actorId, a.id, presence, departments); onToast('agent profile saved') } catch (error) { onToast(String(error)) } finally { setBusy(false) }
  }
  const editable = (a: WorkspaceAgent) => a.userId === actorId || can(actorId, 'manage-support')
  return <><p>Manage agent availability and assignments.</p><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Agent</th><th>Role</th><th>availability</th><th>Open conversations</th><th>Active tickets</th><th>Departments</th></tr></thead><tbody>{agents.map(a => <tr key={a.id}><td><button className="button-secondary" aria-label={`View ${a.name}`} onClick={() => setSelected(a.id)}>{a.name}</button></td><td>{a.role}</td><td>{a.presence || 'Not set'}</td><td>{data.conversations.filter(c => c.assigneeId === a.id && c.status !== 'resolved').length}</td><td>{data.tickets.filter(t => t.assigneeId === a.id && !['Resolved', 'Closed'].includes(ticketState(t))).length}</td><td>{a.departmentIds === undefined ? 'All departments (legacy eligibility)' : snapshot.departments.filter(d => a.departmentIds!.includes(d.id)).map(d => d.name).join(', ') || 'No departments'}</td></tr>)}</tbody></table></div>{agent && <section className="glass-panel record-card"><h2>{agent.name}</h2><p>{agent.role} - {agent.id}</p><label>availability<select aria-label="availability" disabled={busy || !editable(agent)} value={agent.presence || ''} onChange={e => void save(agent, e.target.value as NonNullable<WorkspaceAgent['presence']>, agent.departmentIds || snapshot.departments.map(d => d.id))}><option value="" disabled>Not set</option>{['online', 'away', 'offline'].map(p => <option key={p}>{p}</option>)}</select></label><fieldset disabled={busy || !can(actorId, 'manage-support')}><legend>Department memberships</legend>{snapshot.departments.map(d => <label className="check-field" key={d.id}><input type="checkbox" checked={agent.departmentIds === undefined || agent.departmentIds.includes(d.id)} onChange={e => { const ids = agent.departmentIds || snapshot.departments.map(d => d.id); void save(agent, agent.presence || 'away', e.target.checked ? [...ids, d.id] : ids.filter(id => id !== d.id)) }} />{d.name}</label>)}</fieldset><button className="button-secondary" onClick={() => setSelected('')}>Close profile</button></section>}<h2>Department workload</h2>{snapshot.departments.map(d => <p key={d.id}><strong>{d.name}</strong>: {data.conversations.filter(c => c.departmentId === d.id && c.status !== 'resolved').length} open conversations; {data.tickets.filter(t => t.departmentId === d.id && !['Resolved', 'Closed'].includes(ticketState(t))).length} active tickets</p>)}</>
}
