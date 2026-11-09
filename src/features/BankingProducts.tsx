import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, BookOpen, Check, CircleHelp, ClipboardList, ExternalLink, FileText, Pencil, Search, ShieldCheck, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import type { DemoData } from '../data/demoData'
import { bankingCatalogue, enlProductUrl, productAvailability, productImage, productImages, type ProductContent, type ProductDraft } from '../lib/bankingCatalogue'
import { saveBankingProduct } from '../lib/bankingProductSupport'
import { useWorkspace } from './WorkspaceContext'
import './BankingProducts.css'

type Product = typeof bankingCatalogue[number]
const tabs = ['Overview', 'Product Information', 'FAQs', 'Related Support'] as const
const information = [
  ['customer', 'Intended customer'], ['eligibility', 'Eligibility requirements'], ['documents', 'Required documents'],
  ['application', 'Application instructions'], ['fees', 'Fees and charges'], ['limits', 'Limits'], ['guidance', 'Internal support guidance'],
] as const
const editableFields = [
  ['name', 'Product display name'], ['summary', 'Short description'], ['description', 'Full description'],
  ['features', 'Key features'], ['benefits', 'Benefits'], ...information,
] as const
const caseRoutes = { application: '/pipeline', account: '/account-support', complaint: '/complaints' }

export function BankingProducts({ data }: { data: DemoData }) {
  const [params] = useSearchParams()
  const linked = bankingCatalogue.filter(product => product.canonical === params.get('product'))
  const [search, setSearch] = useState(linked.length > 1 ? linked[0].canonical : '')
  const [selected, setSelected] = useState<Product | undefined>(linked.length === 1 ? linked[0] : undefined)
  const opener = useRef<HTMLButtonElement>(null)
  const { actorId, can } = useWorkspace()
  const allowed = can(actorId, 'manage-workspace')
  const query = search.trim().toLowerCase()
  const products = bankingCatalogue.filter(({ canonical, content }) =>
    [canonical, content.name, content.summary, content.features, ...content.faqs.map(faq => faq.question)].some(value => value.toLowerCase().includes(query)),
  )

  return <section className="module-page enhanced enl-catalogue">
    <header className="enl-products-hero">
      <div><span className="eyebrow">eNL MUTUAL BANK · KNOWLEDGE HUB</span>
        <h1>Banking Products</h1>
        <p>Explore the eNL catalogue, find product information and connect to related support records.</p>
      </div>
      <span className="enl-catalogue-badge"><BookOpen size={16} /> Product catalogue</span>
    </header>
    <div className="enl-product-toolbar">
      <label className="enl-product-search"><Search size={17} /><span className="sr-only">Search banking products</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products, features or FAQs…" />
      </label>
      {search && <button type="button" className="button-secondary" onClick={() => setSearch('')}>Clear search</button>}
      <span className="enl-product-count" role="status">{products.length} {products.length === 1 ? 'product' : 'products'}</span>
    </div>
    <div className="enl-product-grid">
      {products.map(product => {
        const { content } = product
        const draft = data.bankingProductDrafts?.[product.id]
        return <article className="enl-product-card" key={product.id}>
          <div className="enl-product-photo"><img src={productImage(content.image)} alt="" loading="lazy" /><span className="enl-photo-status"><Availability value={draft?.availability ?? product.availability} /></span></div>
          <div className="enl-product-copy"><h2>{content.name}</h2><p>{content.summary}</p>
            <Highlights value={content.features} limit={3} />
            <footer>{allowed && draft && <span className="enl-review-badge">{reviewLabel(draft)}</span>}
              <button type="button" aria-label={`View details: ${content.name}`} onClick={event => { opener.current = event.currentTarget; setSelected(product) }}>View Details <ArrowRight size={15} /></button>
            </footer>
          </div>
        </article>
      })}
    </div>
    {!products.length && <div className="enl-product-empty"><Search size={25} /><h2>No matching products</h2><p>Try another product name, feature or FAQ title.</p></div>}
    {selected && <ProductDrawer key={selected.id} product={selected} data={data} close={() => { setSelected(undefined); opener.current?.focus() }} />}
  </section>
}

function reviewLabel(draft?: ProductDraft) { return draft?.review === 'requires-review' ? 'Requires review' : draft ? 'Internal draft' : 'Reference content' }
function Availability({ value }: { value: ProductDraft['availability'] }) {
  return <span className="enl-availability" data-status={value}>{value}</span>
}
function Highlights({ value, limit }: { value: string; limit?: number }) {
  const lines = value.split('\n').map(line => line.trim()).filter(Boolean).slice(0, limit)
  return lines.length ? <ul className="enl-product-highlights">{lines.map((line, index) => <li key={index}><Check size={13} />{line}</li>)}</ul> : null
}

function ProductDrawer({ product, data, close }: { product: Product; data: DemoData; close: () => void }) {
  const { actorId, workspaceId, can } = useWorkspace()
  const allowed = can(actorId, 'manage-workspace')
  const dialog = useRef<HTMLDialogElement>(null)
  const tabList = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<typeof tabs[number]>('Overview')
  const [saved, setSaved] = useState(data.bankingProductDrafts?.[product.id])
  const [editor, setEditor] = useState<Pick<ProductDraft, 'content' | 'availability' | 'review'>>()
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const initial = saved?.content ?? product.content
  const availability = saved?.availability ?? product.availability
  const dirty = !!editor && (JSON.stringify(editor.content) !== JSON.stringify(initial) || editor.availability !== availability || editor.review !== (saved?.review ?? 'draft'))
  const content = allowed && preview && saved ? saved.content : product.content

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function discard() { return !dirty || window.confirm('Discard unsaved product changes?') }
  function requestClose() {
    if (busy || !discard()) return
    dialog.current?.close()
    close()
  }
  function cancelEdit() { if (!busy && discard()) { setEditor(undefined); setError('') } }
  function startEdit() {
    if (!allowed) return
    setNotice(''); setError('')
    setEditor({ content: structuredClone(initial), availability, review: saved?.review ?? 'draft' })
  }
  async function save(review: ProductDraft['review']) {
    if (!editor || busy || !allowed) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await saveBankingProduct(workspaceId, actorId, product.id, saved?.revision, { ...editor, review })
      setSaved(result.bankingProductDrafts?.[product.id]); setEditor(undefined); setPreview(true)
      setNotice(review === 'requires-review' ? 'Draft saved in this browser and marked for review.' : 'Product draft saved in this browser.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The product could not be saved.') }
    finally { setBusy(false) }
  }

  return <dialog className="enl-product-drawer" ref={dialog} aria-labelledby="enl-product-title" onCancel={event => { event.preventDefault(); requestClose() }} onClick={event => { if (event.target === event.currentTarget) requestClose() }}>
    <div className="enl-drawer-inner">
      <header className="enl-drawer-top"><span className="eyebrow">{editor ? 'PRODUCT EDITOR' : 'PRODUCT DETAILS'}</span><button type="button" className="icon-button" aria-label="Close product details" disabled={busy} onClick={requestClose} autoFocus><X size={20} /></button></header>
      <div className="enl-drawer-photo"><img src={productImage(editor?.content.image ?? content.image)} alt="" /></div>
      <div className="enl-drawer-heading">
        <div className="enl-badges"><Availability value={editor?.availability ?? availability} /><span className="enl-review-badge">{allowed ? reviewLabel(saved) : 'Reference content'}</span></div>
        <h2 id="enl-product-title">{content.name}</h2><p>{content.summary}</p>
        {allowed && !editor && <div className="enl-drawer-actions"><button type="button" className="button-primary enl-edit-product" onClick={startEdit}><Pencil size={14} /> Edit Product</button>{saved && <button type="button" className="button-secondary" onClick={() => setPreview(!preview)}>{preview ? 'View catalogue reference' : 'Preview internal draft'}</button>}</div>}
        {notice && <p role="status" className="enl-product-notice">{notice}</p>}
      </div>
      {editor && allowed ? <ProductEditor value={editor} change={setEditor} busy={busy} dirty={dirty} error={error} cancel={cancelEdit} save={save} /> : <>
        <div className="enl-drawer-tabs" role="tablist" aria-label="Product details" ref={tabList} onKeyDown={event => {
          const index = tabs.indexOf(tab)
          const next = ({ ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 })[event.key]
          if (next === undefined) return
          event.preventDefault(); setTab(tabs[next]); tabList.current?.querySelectorAll('button')[next]?.focus()
        }}>
          {tabs.map((item, index) => <button type="button" role="tab" id={`product-tab-${index}`} aria-selected={tab === item} aria-controls="product-panel" tabIndex={tab === item ? 0 : -1} key={item} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <div className="enl-drawer-body" id="product-panel" role="tabpanel" aria-labelledby={`product-tab-${tabs.indexOf(tab)}`} tabIndex={0}>
          {tab === 'Overview' && <><Detail title="Product overview" icon={<BookOpen size={16} />}><p>{content.description || content.summary}</p></Detail><Detail title="Key features" icon={<Check size={16} />}><Highlights value={content.features} /></Detail><Detail title="Benefits" icon={<ShieldCheck size={16} />}><p>{content.benefits || 'No reviewed benefits are recorded.'}</p></Detail><OfficialLink value={content.officialUrl}>Official product information</OfficialLink></>}
          {tab === 'Product Information' && <><dl className="enl-product-information">{information.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{content[key] || 'No reviewed information recorded.'}</dd></div>)}</dl><OfficialLink value={content.termsUrl}>Terms and conditions</OfficialLink><OfficialLink value={content.officialUrl}>Official product information</OfficialLink></>}
          {tab === 'FAQs' && <Detail title="Frequently asked questions" icon={<CircleHelp size={16} />}><p className="enl-muted">Internal support guidance</p>{content.faqs.map(faq => <details key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</Detail>}
          {tab === 'Related Support' && <RelatedSupport product={product} data={data} />}
        </div>
      </>}
    </div>
  </dialog>
}

function Detail({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="enl-product-detail"><h3>{icon}{title}</h3>{children}</section>
}
function OfficialLink({ value, children }: { value: string; children: ReactNode }) {
  const url = enlProductUrl(value)
  return url && <a className="enl-official-link" href={url} target="_blank" rel="noreferrer">{children}<ExternalLink size={14} /></a>
}

function RelatedSupport({ product, data }: { product: Product; data: DemoData }) {
  const cases = (data.bankingCases ?? []).filter(record => record.product === product.canonical)
  const references = new Set(cases.flatMap(record => [record.id, record.reference]))
  const ticketCategory = ({ 'Becha Account': 'Becha enquiry', 'Nala Account': 'Nala enquiry', 'Temo Account': 'Temo enquiry', 'Pusha Account': 'Pusha enquiry', 'Owner Account': 'Owner enquiry' } as Record<string, string>)[product.canonical]
  const tickets = data.tickets.filter(ticket => (ticket.reference && references.has(ticket.reference)) || (ticketCategory && ticket.category === ticketCategory))
  const business = /^(Pusha|Owner)/.test(product.canonical)
  const articleCategory = business ? 'Business Banking' : 'Personal Banking'
  const articles = data.articles.filter(article => article.category === articleCategory || article.category === 'Getting Started' || [product.canonical, product.content.name].some(name => article.title.toLowerCase().includes(name.toLowerCase())))
  const groups = [
    { title: 'Applications and Enquiries', rows: cases.filter(row => row.kind !== 'complaint').map(row => ({ id: row.id, name: row.subject, meta: row.reference, href: `${caseRoutes[row.kind]}?case=${encodeURIComponent(row.id)}` })) },
    { title: 'Support Tickets', rows: tickets.map(row => ({ id: row.id, name: row.subject, meta: row.id, href: `/tickets?ticket=${encodeURIComponent(row.id)}` })) },
    { title: 'Complaints and Disputes', rows: cases.filter(row => row.kind === 'complaint').map(row => ({ id: row.id, name: row.subject, meta: row.reference, href: `/complaints?case=${encodeURIComponent(row.id)}` })) },
    { title: 'Knowledge Base', rows: articles.map(row => ({ id: row.id, name: row.title, meta: row.published ? 'Published' : 'Draft', href: `/knowledge?article=${encodeURIComponent(row.id)}` })) },
  ]
  return <>{product.content.name !== product.canonical && /^(Pusha|Owner)/.test(product.canonical) && <p className="enl-muted">Existing support records are shared by the {product.canonical} variants.</p>}
    {groups.map(group => <Detail key={group.title} title={group.title} icon={<ClipboardList size={16} />}>
      {group.rows.length ? group.rows.map(row => <Link className="enl-related-row" to={row.href} key={row.id}><FileText size={15} /><span><strong>{row.name}</strong><small>{row.meta}</small></span><ArrowRight size={14} /></Link>) : <p>No linked records in the current scope.</p>}
    </Detail>)}
  </>
}

function ProductEditor({ value, change, busy, dirty, error, cancel, save }: {
  value: Pick<ProductDraft, 'content' | 'availability' | 'review'>
  change: (value: Pick<ProductDraft, 'content' | 'availability' | 'review'>) => void
  busy: boolean; dirty: boolean; error: string; cancel: () => void; save: (review: ProductDraft['review']) => Promise<void>
}) {
  const { content } = value
  const update = (patch: Partial<ProductContent>) => change({ ...value, content: { ...content, ...patch } })
  function moveFaq(index: number, offset: number) {
    const faqs = [...content.faqs]
    ;[faqs[index], faqs[index + offset]] = [faqs[index + offset], faqs[index]]
    update({ faqs })
  }
  return <form className="enl-product-form" onSubmit={event => { event.preventDefault(); const submitter = (event.nativeEvent as SubmitEvent).submitter; void save(submitter?.getAttribute('value') === 'review' ? 'requires-review' : 'draft') }}>
    <p className="enl-muted">Content saves as an internal draft. Availability updates the catalogue display in this workspace.</p>
    <fieldset disabled={busy}>
      <div className="enl-product-form-pair">
        <label>Availability<select value={value.availability} onChange={event => change({ ...value, availability: event.target.value as ProductDraft['availability'] })}>{productAvailability.map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Product image<select value={content.image} onChange={event => update({ image: event.target.value })}>{productImages.map(image => <option key={image}>{image}</option>)}</select></label>
      </div>
      {editableFields.map(([key, label]) => <label key={key}>{label}{key === 'name' ? <input required maxLength={120} value={content[key]} onChange={event => update({ [key]: event.target.value })} /> : <textarea required={key === 'summary'} maxLength={key === 'summary' ? 320 : 4000} rows={key === 'description' ? 4 : 2} value={content[key]} onChange={event => update({ [key]: event.target.value })} />}</label>)}
      <div className="enl-product-form-pair">{([['officialUrl', 'Official product URL'], ['termsUrl', 'Terms and conditions URL']] as const).map(([key, label]) => <label key={key}>{label}<input type="url" value={content[key]} onChange={event => update({ [key]: event.target.value })} /></label>)}</div>
      <h3>FAQs</h3>
      {content.faqs.map((faq, index) => <section className="enl-faq-editor" aria-label={`FAQ ${index + 1}`} key={faq.id}>
        <label>Question<input required maxLength={200} value={faq.question} onChange={event => update({ faqs: content.faqs.map(row => row.id === faq.id ? { ...row, question: event.target.value } : row) })} /></label>
        <label>Answer<textarea required maxLength={2000} rows={2} value={faq.answer} onChange={event => update({ faqs: content.faqs.map(row => row.id === faq.id ? { ...row, answer: event.target.value } : row) })} /></label>
        <div className="enl-faq-actions"><button type="button" disabled={index === 0} onClick={() => moveFaq(index, -1)}>Move up</button><button type="button" disabled={index === content.faqs.length - 1} onClick={() => moveFaq(index, 1)}>Move down</button><button type="button" onClick={() => update({ faqs: content.faqs.filter(row => row.id !== faq.id) })}>Remove FAQ</button></div>
      </section>)}
      <button type="button" className="button-secondary" disabled={content.faqs.length >= 20} onClick={() => update({ faqs: [...content.faqs, { id: crypto.randomUUID(), question: '', answer: '' }] })}>Add FAQ</button>
    </fieldset>
    <footer className="enl-product-edit-footer">
      {error && <p role="alert">{error}</p>}
      {dirty && <p className="enl-muted" role="status">Unsaved changes</p>}
      <div><button type="button" className="button-secondary" disabled={busy} onClick={cancel}>Cancel</button><button type="submit" value="review" className="button-secondary" disabled={busy}>Save for review</button><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button></div>
    </footer>
  </form>
}
