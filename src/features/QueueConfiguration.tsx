import { useState } from 'react'
import type { ModuleProps } from './Knowledge'
import { areaLabels, defaultQueues, type BusinessArea } from '../lib/business'
export function QueueConfiguration({ data, setData }: ModuleProps) {
  const [name, setName] = useState('')
  const [area, setArea] = useState<BusinessArea>('community')
  return <section className="glass-panel record-card"><h2>Support queues</h2><p>Organise enquiries by team and business area. Existing queues stay available in case history.</p>{(data.queues || defaultQueues).map(q => <p key={`${q.area}-${q.name}`}>{q.name} · {areaLabels[q.area]}</p>)}<form className="inline-form" onSubmit={e => { e.preventDefault(); if ((data.queues || defaultQueues).some(q => q.name === name.trim() && q.area === area)) return; setData(d => ({ ...d, queues: [...(d.queues || defaultQueues), { name: name.trim(), area }] })); setName('') }}><label>Queue name<input required value={name} onChange={e => setName(e.target.value)} /></label><label>Queue business area<select value={area} onChange={e => setArea(e.target.value as BusinessArea)}>{Object.entries(areaLabels).filter(([v]) => v !== 'all').map(([v,label]) => <option key={v} value={v}>{label}</option>)}</select></label><button className="button-secondary">Add queue</button></form></section>
}
