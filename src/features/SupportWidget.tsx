import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MessageCircle, Minus, Send, ArrowRight, Check, Star } from 'lucide-react'
import type { Message } from '../data/demoData'
import type { BusinessArea } from '../lib/business'
import { appendCustomerMessages, finishCustomerConversation, newSupportMessage, supportAreas } from '../lib/customerSupport'
import { supportService } from '../lib/supportService'
import './SupportWidget.css'

export interface SupportWidgetState {
  id: string; open: boolean; area: BusinessArea | null; status: 'active' | 'ended'
  messages: Message[]; draft: string; typing: boolean; unread: number; rating: number | null
}
const freshState = (open = false): SupportWidgetState => ({ id: crypto.randomUUID(), open, area: null, status: 'active', messages: [newSupportMessage('Hi! What can we help you with today?')], draft: '', typing: false, unread: 0, rating: null })

export function SupportWidget() {
  const [state, setState] = useState<SupportWidgetState>(() => freshState())
  const current = useRef(state)
  useEffect(() => { current.current = state }, [state])
  const [viewport, setViewport] = useState({ height: window.innerHeight, bottom: 0 })
  const launcher = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const endButton = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busy = useRef(false)
  const nearBottom = useRef(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const update = () => { const v = window.visualViewport; setViewport({ height: v?.height || window.innerHeight, bottom: v ? Math.max(0, window.innerHeight - v.height - v.offsetTop) : 0 }) }
    update(); window.visualViewport?.addEventListener('resize', update); window.visualViewport?.addEventListener('scroll', update)
    return () => { window.visualViewport?.removeEventListener('resize', update); window.visualViewport?.removeEventListener('scroll', update) }
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => supportService.subscribe(() => {
    void supportService.read().then(data => {
      setState(s => {
        if (s.status === 'ended') return s
        const c = data.conversations.find(c => c.id === s.id)
        if (!c) return s
        const messages = c.messages.filter(m => m.kind !== 'note')
        const incoming = messages.filter(m => m.kind === 'agent' && !s.messages.some(old => old.id === m.id)).length
        return { ...s, messages, unread: s.open ? 0 : s.unread + incoming }
      })
    })
  }), [])
  useEffect(() => {
    if (state.open) panel.current?.focus()
  }, [state.open])
  useEffect(() => {
    if (state.open && nearBottom.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [state.messages, state.typing, state.open])

  function minimise() { setState(s => ({ ...s, open: false })); launcher.current?.focus() }
  async function selectArea(area: BusinessArea) {
    if (busy.current || current.current.area) return
    busy.current = true
    const s = current.current
    const messages = [...s.messages, newSupportMessage(supportAreas[area].label, 'customer'), newSupportMessage(supportAreas[area].welcome)]
    try {
      await appendCustomerMessages(s.id, area, messages)
      setState(old => ({ ...old, area, messages })); setError('')
      requestAnimationFrame(() => composer.current?.focus())
    } catch { setError('Unable to start the conversation. Please try again.') }
    finally { busy.current = false }
  }
  async function send() {
    const s = current.current
    if (!s.draft.trim() || !s.area || s.status === 'ended' || busy.current || s.typing) return
    busy.current = true; nearBottom.current = true
    try {
      await appendCustomerMessages(s.id, s.area, [newSupportMessage(s.draft.trim(), 'customer')])
      setState(old => ({ ...old, draft: '', typing: true })); setError('')
      timer.current = setTimeout(async () => {
        if (current.current.id !== s.id || current.current.status === 'ended') return
        try { await appendCustomerMessages(s.id, s.area!, [newSupportMessage(supportAreas[s.area!].reply)]) }
        catch { setError('The reply could not be loaded. Please try another message.') }
        finally { setState(old => ({ ...old, typing: false })); busy.current = false; timer.current = null }
      }, 1250)
    } catch { setError('Your message could not be saved. Please try again.'); busy.current = false }
  }
  function closeConfirmation() { dialog.current?.close(); endButton.current?.focus() }
  function trapConfirmation(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const buttons = dialog.current?.querySelectorAll('button')
    if (!buttons?.length) return
    const first = buttons[0], last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  async function end() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null; busy.current = false
    const id = current.current.id
    setState(s => ({ ...s, status: 'ended', typing: false, draft: '' }))
    dialog.current?.close()
    await finishCustomerConversation(id)
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('[data-new-conversation]')?.focus())
  }
  return <div className="qalo-support" style={{ '--chat-height': `${viewport.height}px`, '--keyboard-bottom': `${viewport.bottom}px` } as CSSProperties}>
    {state.open && <section className="qs-panel" id="qalo-support-panel" ref={panel} tabIndex={-1} role="region" aria-label="Qalo Ya Afrika Support" onKeyDown={e => { if (e.key === 'Escape' && !dialog.current?.open) { e.preventDefault(); minimise() } }}>
      <header className="qs-header"><span className="qs-avatar"><MessageCircle size={23} /></span><div><strong>Qalo Ya Afrika Support</strong><small>Here to help you move forward</small></div><button className="qs-icon" aria-label="Minimise support chat" onClick={minimise}><Minus size={22} /></button></header>
      <div className="qs-toolbar"><span>{state.area ? supportAreas[state.area].label : 'A little help, a human touch.'}</span>{state.status === 'active' && <button ref={endButton} onClick={() => dialog.current?.showModal()}>End conversation</button>}</div>
      <div className="qs-messages" ref={scroller} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions text" onScroll={() => { const el = scroller.current!; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70 }}>
        <p className="qs-date">Today</p>
        {state.messages.map(m => <article className={`qs-message qs-${m.kind}`} key={m.id}><span>{m.kind === 'customer' ? 'You' : 'Qalo Support'}</span><p>{m.text}</p><time dateTime={m.time}>{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.kind === 'customer' && <Check size={12} aria-label="Sent" />}</time></article>)}
        {!state.area && state.status === 'active' && <div className="qs-choices" aria-label="Choose a support area">{(Object.keys(supportAreas) as BusinessArea[]).map(area => <button key={area} onClick={() => void selectArea(area)}>{supportAreas[area].label}<ArrowRight size={16} /></button>)}</div>}
        {state.typing && <div className="qs-typing" role="status"><i /><i /><i /><span>Qalo Support is typing</span></div>}
        {state.status === 'ended' && <div className="qs-ended"><strong>Conversation ended</strong><p>Thank you for chatting with us.</p><fieldset><legend>How was your experience? (Optional)</legend>{[1,2,3,4,5].map(n => <button key={n} aria-label={`Rate ${n} out of 5`} aria-pressed={state.rating === n} onClick={() => { setState(s => ({ ...s, rating: n })); void finishCustomerConversation(state.id, n) }}><Star size={24} fill={state.rating && n <= state.rating ? 'currentColor' : 'none'} /></button>)}</fieldset>{state.rating && <small role="status">Thank you for your feedback.</small>}<button className="qs-primary" data-new-conversation onClick={() => { nearBottom.current = true; setError(''); setState(freshState(true)); requestAnimationFrame(() => panel.current?.focus()) }}>Start new conversation</button></div>}
      </div>
      {error && <p className="qs-error" role="alert">{error}</p>}
      <form className="qs-composer" onSubmit={e => { e.preventDefault(); void send() }}><label className="qs-sr" htmlFor="qs-draft">Your message</label><textarea ref={composer} id="qs-draft" rows={2} value={state.draft} disabled={!state.area || state.status === 'ended'} placeholder={state.status === 'ended' ? 'This conversation has ended' : state.area ? 'Write your message…' : 'Choose a support area to begin'} onChange={e => setState(s => ({ ...s, draft: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }} /><button className="qs-send" type="submit" aria-label="Send message" disabled={!state.draft.trim() || !state.area || state.typing || state.status === 'ended'}><Send size={19} /></button><small>Qalo Ya Afrika · Economic Rebirth</small></form>
      <dialog ref={dialog} className="qs-confirm" aria-labelledby="qs-confirm-title" aria-describedby="qs-confirm-description" onKeyDown={trapConfirmation} onCancel={e => { e.preventDefault(); closeConfirmation() }}><h2 id="qs-confirm-title">End this conversation?</h2><p id="qs-confirm-description">You can start a new conversation whenever you need us.</p><div><button autoFocus onClick={closeConfirmation}>Keep chatting</button><button className="qs-primary" onClick={() => void end()}>Yes, end conversation</button></div></dialog>
    </section>}
    <button ref={launcher} className="qs-launcher" aria-label={state.open ? 'Minimise support chat' : 'Open support chat'} aria-expanded={state.open} aria-controls="qalo-support-panel" onClick={() => state.open ? minimise() : (nearBottom.current = true, setState(s => ({ ...s, open: true, unread: 0 })))}><MessageCircle size={27} />{state.unread > 0 && <span className="qs-unread" aria-label={`${state.unread} unread messages`}>{state.unread}</span>}</button>
    <span className="qs-sr" role="status">{!state.open && state.unread > 0 ? `${state.unread} unread support messages` : ''}</span>
  </div>
}
