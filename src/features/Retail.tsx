import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBusinessArea } from './BusinessArea'
import { useWorkspace } from './WorkspaceContext'
import { supportService } from '../lib/supportService'
import type { ModuleProps } from './Knowledge'
export function Retail({ data, setData, returnsOnly = false }: ModuleProps & { returnsOnly?: boolean }) {
  const { area } = useBusinessArea()
  const { workspaceId } = useWorkspace()
  const catalog = supportService.referenceData(workspaceId)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const orders = data.conversations.filter(c => c.order && (!returnsOnly || /return|refund|exchange|review/i.test(c.order.request)) && c.businessArea === 'store' && `${c.customer} ${c.order.reference} ${c.order.items.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  if (area === 'community') return <div className="module-page enhanced"><h1>{returnsOnly ? 'Returns & Refunds' : 'Orders & products'}</h1><p>Select Qalo Store or All business areas to review retail records.</p></div>
  return <div className="module-page enhanced"><span className="eyebrow">{workspaceId === 'workspace-qalo' ? 'QALO STORE / RETAIL' : 'RETAIL'}</span><h1>{returnsOnly ? 'Returns & Refunds' : 'Orders & products'}</h1><p>Review order details, follow deliveries and manage return enquiries.</p><label>Search orders<input value={search} onChange={e => setSearch(e.target.value)} /></label><div className="editor-layout"><section><h2>Orders and deliveries</h2>{orders.map(c => <article key={c.id} className="record-card glass-panel"><h3>{c.order!.reference}</h3><p>{c.customer} · {c.order!.items.join(', ')}</p><p>Payment: {c.order!.payment}</p><p>Delivery: {c.order!.fulfilment} · {catalog.deliveries.find(d => d.orderId === c.order!.reference)?.tracking || c.order!.tracking}</p><p>Refund / exchange request: {c.order!.request}</p><Link to={`/inbox?conversation=${c.id}`}>Open related support</Link><p><button className="button-secondary" onClick={async () => { const saved = await setData(d => ({ ...d, conversations: d.conversations.map(item => item.id === c.id ? { ...item, order: { ...item.order!, request: 'Review requested' } } : item) })); if (saved) setStatus(`Review requested for ${c.order!.reference}.`) }}>Request refund review</button></p></article>)}{!orders.length && <p>No matching orders.</p>}</section><section><h2>Products</h2>{catalog.products.map(p => <article key={p.id} className="record-card glass-panel"><h3>{p.name}</h3><p>R {p.price.toFixed(2)} · {p.stock} available</p></article>)}<h2>Refund requests</h2>{catalog.refunds.map(r => <p key={r.id}>{r.orderId} · R {r.amount.toFixed(2)} · {data.conversations.find(c => c.order?.reference === r.orderId)?.order?.request || r.status}</p>)}</section></div><p role="status">{status}</p></div>
}
