import type { ModuleProps } from './Knowledge'
export function Feedback({ data }: ModuleProps) {
  const responses = data.conversations.filter(c => c.satisfaction)
  return <div className="module-page enhanced"><span className="eyebrow">CUSTOMER FEEDBACK</span><h1>Feedback</h1><p>Ratings are requested after support conversations are resolved.</p>{responses.length ? responses.map(c => <article className="record-card glass-panel" key={c.id}><h2>{c.customer}</h2><p>{c.satisfaction} / 5 · {c.category}</p><p>Support reference: {c.reference || c.id}</p></article>) : <p>No feedback collected for the selected business area.</p>}</div>
}
