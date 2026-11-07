import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Search, X } from 'lucide-react'
import type { Conversation } from '../data/demoData'
import { useWorkspace } from './WorkspaceContext'
import { conversationLabels, conversationState } from '../lib/conversationLifecycle'
import { conversationTransfers, getEligibleTransferAgents, transferVersion } from '../lib/conversationTransfer'
import './TransferChatDialog.css'

export function TransferChatDialog({ conversation, close, complete }: { conversation: Conversation; close: () => void; complete: (name: string) => void }) {
  const { registry, actorId } = useWorkspace()
  const dialog = useRef<HTMLDialogElement>(null), submitting = useRef(false), mounted = useRef(true)
  const [original, setOriginal] = useState(conversation), [search, setSearch] = useState(''), [selected, setSelected] = useState(''), [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const requestId = useRef(crypto.randomUUID())
  const current = registry?.snapshots[original.workspaceId || '']?.conversations.find(c => c.id === original.id)
  const conflict = !current || transferVersion(current) !== transferVersion(original)
  const agents = registry && current ? getEligibleTransferAgents(registry, current, actorId) : []
  const eligible = agents.find(a => a.id === selected)
  const rows = agents.filter(a => `${a.name} ${a.role}`.toLowerCase().includes(search.trim().toLowerCase()))
  const workspace = registry?.workspaces.find(w => w.id === original.workspaceId)
  useEffect(() => {
    mounted.current = true
    const element = dialog.current!, previous = document.activeElement as HTMLElement
    element.showModal()
    return () => { mounted.current = false; element.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  async function transfer() {
    if (submitting.current || !eligible || conflict) return
    submitting.current = true; setBusy(true); setError('')
    try {
      await conversationTransfers.transfer({ workspaceId: original.workspaceId!, conversationId: original.id, actorId, agentId: eligible.id, expectedVersion: transferVersion(original), note, requestId: requestId.current })
      if (mounted.current) complete(eligible.name)
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Transfer failed. Please retry.') }
    finally { submitting.current = false; if (mounted.current) setBusy(false) }
  }
  function dismiss() { if (!submitting.current) close() }
  return <dialog ref={dialog} className="transfer-dialog" aria-labelledby="transfer-title" onCancel={event => { event.preventDefault(); dismiss() }} onClick={event => { if (event.target === event.currentTarget) { const b = event.currentTarget.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dismiss() } }}>
    <form onSubmit={event => { event.preventDefault(); void transfer() }}>
      <header><span className="transfer-symbol"><ArrowRightLeft size={20} /></span><div><h2 id="transfer-title">Transfer Conversation</h2><p>Assign this conversation to another authorised agent.</p></div><button type="button" className="icon-button" aria-label="Close transfer dialog" disabled={busy} onClick={dismiss}><X size={18} /></button></header>
      <dl className="transfer-summary"><div><dt>Customer</dt><dd>{original.customer}</dd></div><div><dt>Conversation</dt><dd>{original.id}</dd></div><div><dt>Workspace</dt><dd>{workspace?.name || 'Unavailable'}</dd></div><div><dt>Assigned agent</dt><dd>{current?.assignee || 'Unassigned'}</dd></div><div><dt>Status</dt><dd>{current ? conversationLabels[conversationState(current)] : 'Unavailable'}</dd></div></dl>
      {conflict && <div className="transfer-error" role="alert">This conversation has changed. Review its latest state before transferring.{current && current.status !== 'resolved' && <button type="button" className="button-secondary" onClick={() => { setOriginal(current); setSelected(''); setError(''); requestId.current = crypto.randomUUID() }}>Review latest assignment</button>}</div>}
      <fieldset disabled={busy || conflict}><legend>Receiving agent</legend><label className="transfer-search"><Search size={16} /><span className="sr-only">Search agents</span><input autoFocus aria-label="Search agents" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or role…" /></label>
      <div className="transfer-agent-list" role="radiogroup" aria-label="Receiving agent">{rows.map(agent => <label key={agent.id} className={`transfer-agent ${selected === agent.id ? 'selected' : ''}`}><input type="radio" name="receiving-agent" value={agent.id} checked={selected === agent.id} onChange={() => setSelected(agent.id)} /><span className="transfer-avatar" aria-hidden="true">{agent.initials}</span><span><strong>{agent.name}</strong><small>{agent.role} · {agent.workload} assigned conversation{agent.workload === 1 ? '' : 's'}</small></span><span className={`transfer-presence ${agent.presence || 'unknown'}`}>{agent.presence === 'online' ? 'Available' : agent.presence === 'away' ? 'Away' : 'Not recorded'}</span></label>)}</div>
      {!rows.length && <p className="transfer-empty" role="status">{agents.length ? 'No agents match your search.' : 'No eligible receiving agents are available in this workspace.'}</p>}
      <p className="transfer-help">Only authorised workspace agents are listed. Offline agents and the current assignee are excluded. Availability reflects recorded staff presence.</p>
      <label className="transfer-note">Transfer note <span>(optional, internal only)</span><textarea aria-label="Transfer note" maxLength={2000} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note for the receiving agent..." /></label></fieldset>
      {error && <p className="transfer-error" role="alert">{error}</p>}
      <footer><button type="button" className="button-secondary" disabled={busy} onClick={dismiss}>Cancel</button><button className="button-primary" disabled={busy || conflict || !eligible}>{busy ? 'Transferring…' : 'Transfer Chat'}</button></footer>
    </form>
  </dialog>
}
