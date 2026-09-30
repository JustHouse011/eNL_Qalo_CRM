import { useState } from 'react'
import type { ModuleProps } from './Knowledge'
import { useBusinessArea } from './BusinessArea'
import { areaLabels, matchesArea, type BusinessArea } from '../lib/business'
export function SavedReplies({ data, setData }: ModuleProps) {
  const { area } = useBusinessArea()
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [businessArea, setBusinessArea] = useState<BusinessArea>(area === 'all' ? 'general' : area)
  return <div className="module-page enhanced"><span className="eyebrow">CONTENT LIBRARY</span><h1>Saved replies</h1><p>Keep helpful answers close at hand. Search approved replies from the inbox composer.</p><label>Search saved replies<input value={search} onChange={e => setSearch(e.target.value)} /></label>{data.savedReplies?.filter(r => matchesArea(r, area) && `${r.title} ${r.body}`.toLowerCase().includes(search.toLowerCase())).map(r => <article className="record-card glass-panel" key={r.id}><h2>{r.title}</h2><small>{areaLabels[r.businessArea]} · {r.approved ? 'Available in composer' : 'Draft'}</small><p>{r.body}</p><button className="button-secondary" onClick={() => setData(d => ({ ...d, savedReplies: d.savedReplies?.map(reply => reply.id === r.id ? { ...reply, approved: !reply.approved } : reply) }))}>{r.approved ? 'Return to draft' : 'Approve template'}</button></article>)}<form className="record-card" onSubmit={e => { e.preventDefault(); setData(d => ({ ...d, savedReplies: [...(d.savedReplies || []), { id: crypto.randomUUID(), title, body, businessArea, approved: false }] })); setTitle(''); setBody('') }}><h2>New draft reply</h2><label>Title<input required value={title} onChange={e => setTitle(e.target.value)} /></label><label>Business area<select aria-label="Reply business area" value={businessArea} onChange={e => setBusinessArea(e.target.value as BusinessArea)}>{Object.entries(areaLabels).filter(([a]) => a !== 'all').map(([a, label]) => <option key={a} value={a}>{label}</option>)}</select></label><label>Reply content<textarea required maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></label><button className="button-primary">Save draft reply</button></form></div>
}
