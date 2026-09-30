import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DemoData } from '../data/demoData'
import { AreaFields, useBusinessArea } from './BusinessArea'
import { categories, safeOfficialUrl } from '../lib/business'
export type ModuleProps = { data: DemoData; setData: (update: (current: DemoData) => DemoData) => Promise<boolean> }

export function Knowledge({ data, setData }: ModuleProps) {
  const { area } = useBusinessArea()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(data.articles[0]?.id || '')
  const article = data.articles.find(a => a.id === selected) || data.articles[0]
  function create() {
    const id = crypto.randomUUID()
    const businessArea = area === 'all' ? 'general' : area
    setData(d => ({ ...d, articles: [...d.articles, { id, title: 'Untitled article', body: '', businessArea, category: categories[businessArea][0], published: false, review: 'Draft - awaiting approved content', updated: new Date().toISOString() }] })); setSelected(id)
  }
  return <div className="module-page enhanced"><div className="module-heading"><div><span className="eyebrow">KNOWLEDGE</span><h1>Answers worth sharing</h1><p>Draft, edit and publish help for your customers.</p></div><div className="row-actions"><Link className="button-secondary" to="/help" target="_blank">Open help centre</Link><button className="button-primary" onClick={create}>New article</button></div></div>
    <label>Search articles<input value={search} onChange={e => setSearch(e.target.value)} /></label>
    <div className="editor-layout"><aside className="record-list">{data.articles.filter(a => `${a.title} ${a.category}`.toLowerCase().includes(search.toLowerCase())).map(a => <button className={`record-card ${selected === a.id ? 'selected' : ''}`} key={a.id} onClick={() => setSelected(a.id)}><strong>{a.title}</strong><small>{a.category} · {a.published ? 'Published' : 'Draft'}</small></button>)}</aside>
    {article && <ArticleEditor key={`${article.id}:${article.updated}`} article={article} save={next => setData(d => ({ ...d, articles: d.articles.map(a => a.id === next.id ? next : a) }))} />}</div>
  </div>
}
function ArticleEditor({ article, save }: { article: DemoData['articles'][number]; save: (article: DemoData['articles'][number]) => void }) {
  const [draft, setDraft] = useState(article)
  const [saved, setSaved] = useState(false)
  return <form className="glass-panel record-card" onSubmit={e => { e.preventDefault(); save({ ...draft, updated: new Date().toISOString() }); setSaved(true) }}><p>{article.published ? 'Published article' : 'Draft article'}</p><AreaFields area={draft.businessArea || 'general'} category={draft.category} onChange={(businessArea, category) => setDraft({ ...draft, businessArea, category })} /><label>Official source URL<input type="url" value={draft.sourceUrl || ''} onChange={e => setDraft({ ...draft, sourceUrl: e.target.value })} /></label>{safeOfficialUrl(draft.sourceUrl) && <a href={safeOfficialUrl(draft.sourceUrl)} target="_blank" rel="noreferrer">Open official source</a>}<label>Article title<input required maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>Category<input required value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></label><label>Article body<textarea required rows={12} value={draft.body || ''} onChange={e => setDraft({ ...draft, body: e.target.value })} /></label><label className="check-field"><input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} /> Publish in help centre</label><button className="button-primary">Save article</button>{saved && <p role="status">Article saved.</p>}</form>
}
