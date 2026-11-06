import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DemoData } from '../data/demoData'
import { AreaFields, useBusinessArea } from './BusinessArea'
import { safeOfficialUrl } from '../lib/business'
import { useWorkspace } from './WorkspaceContext'
import { useWorkspaceTaxonomy } from './workspaceTaxonomy'
export type ModuleProps = { data: DemoData; setData: (update: (current: DemoData) => DemoData) => Promise<boolean> }

export function Knowledge({ data, setData, articleFilter }: ModuleProps & { articleFilter?: (article: DemoData['articles'][number]) => boolean }) {
  const { categories, knowledgeCategories, banking } = useWorkspaceTaxonomy()
  const { area } = useBusinessArea()
  const { actorId, can } = useWorkspace()
  const allowed = !banking || can(actorId, 'manage-support')
  const [search, setSearch] = useState('')
  const visibleArticles = data.articles.filter(a => !articleFilter || articleFilter(a))
  const [selected, setSelected] = useState(visibleArticles[0]?.id || '')
  const article = data.articles.find(a => a.id === selected) || visibleArticles[0]
  function create() {
    if (!allowed) return
    const id = crypto.randomUUID()
    const businessArea = area === 'all' ? 'general' : area
    setData(d => ({ ...d, articles: [...d.articles, { id, title: 'Untitled article', body: '', businessArea, category: knowledgeCategories?.[0] || categories[businessArea][0], published: false, review: 'Draft - awaiting approved content', updated: new Date().toISOString() }] })); setSelected(id)
  }
  return <div className="module-page enhanced"><div className="module-heading"><div><span className="eyebrow">KNOWLEDGE</span><h1>Answers worth sharing</h1><p>Draft, edit and publish help for your customers.</p></div><div className="row-actions"><Link className="button-secondary" to={banking ? '/enl-preview' : '/help'} target="_blank">Open help centre</Link><button className="button-primary" disabled={!allowed} onClick={create}>New article</button></div></div>
    <label>Search articles<input value={search} onChange={e => setSearch(e.target.value)} /></label>
    <div className="editor-layout"><aside className="record-list">{visibleArticles.filter(a => `${a.title} ${a.category}`.toLowerCase().includes(search.toLowerCase())).map(a => <button className={`record-card ${selected === a.id ? 'selected' : ''}`} key={a.id} onClick={() => setSelected(a.id)}><strong>{a.title}</strong><small>{a.category} · {a.published ? 'Published' : 'Draft'}</small></button>)}</aside>
    {article && <ArticleEditor key={`${article.id}:${article.updated}`} article={article} save={next => setData(d => ({ ...d, articles: d.articles.map(a => a.id === next.id ? next : a) }))} />}</div>
  </div>
}
function ArticleEditor({ article, save }: { article: DemoData['articles'][number]; save: (article: DemoData['articles'][number]) => void }) {
  const { banking } = useWorkspaceTaxonomy()
  const { actorId, can } = useWorkspace()
  const allowed = !banking || can(actorId, 'manage-support')
  const [draft, setDraft] = useState(article)
  const [saved, setSaved] = useState(false)
  return <form className="glass-panel record-card" onSubmit={e => { e.preventDefault(); if (!allowed) return; save({ ...draft, published: banking ? draft.published && draft.review === 'Approved for use' : draft.published, updated: new Date().toISOString() }); setSaved(true) }}><fieldset disabled={!allowed} style={{ border: 0, minWidth: 0, padding: 0 }}><p>{article.published ? 'Published article' : 'Draft article'}</p><AreaFields area={draft.businessArea || 'general'} category={draft.category} onChange={(businessArea, category) => setDraft({ ...draft, businessArea, category })} /><label>Official source URL<input type="url" value={draft.sourceUrl || ''} onChange={e => setDraft({ ...draft, sourceUrl: e.target.value })} /></label>{!banking && safeOfficialUrl(draft.sourceUrl) && <a href={safeOfficialUrl(draft.sourceUrl)} target="_blank" rel="noreferrer">Open official source</a>}<label>Article title<input required maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>Category<input required value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></label><label>Article body<textarea required rows={12} value={draft.body || ''} onChange={e => setDraft({ ...draft, body: e.target.value })} /></label><>{banking && <label>Content review<select aria-label="Content review" value={draft.review === 'Approved for use' ? 'approved' : 'pending'} onChange={e => setDraft({ ...draft, review: e.target.value === 'approved' ? 'Approved for use' : 'Requires official content review; not approved', published: false })}><option value="pending">Requires review</option><option value="approved">Reviewed and approved for use</option></select></label>}</><label className="check-field"><input type="checkbox" disabled={banking && draft.review !== 'Approved for use'} checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} /> Publish in help centre</label><button className="button-primary">Save article</button></fieldset>{saved && <p role="status">Article saved.</p>}</form>
}
