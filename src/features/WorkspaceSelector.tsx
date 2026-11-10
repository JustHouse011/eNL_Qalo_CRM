import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type WorkspaceOption = { id: string; name: string }
/** Select-only combobox. A native top-layer popover avoids sidebar clipping and OS picker colours. */
export function WorkspaceSelector({ options, value, onChange, compact = false }: { options: readonly WorkspaceOption[]; value: string; onChange: (id: string) => void; compact?: boolean }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = options.find(option => option.id === value)
  const disabled = options.length === 0 || (!compact && options.length === 1)
  const positionMenu = useCallback(() => {
    const button = trigger.current, panel = menu.current
    if (!button || !panel) return
    const bounds = button.getBoundingClientRect()
    if (button.closest('[inert]') || bounds.bottom < 0 || bounds.top > innerHeight || bounds.right < 0 || bounds.left > innerWidth) { panel.hidePopover(); setOpen(false); return }
    const gutter = 8
    const width = Math.min(Math.max(bounds.width, 268), innerWidth - gutter * 2)
    const below = innerHeight - bounds.bottom - gutter * 2, above = bounds.top - gutter * 2
    const upwards = below < 130 && above > below
    const height = Math.min(320, Math.max(44, upwards ? above : below))
    panel.style.width = `${width}px`
    panel.style.maxHeight = `${height}px`
    panel.style.left = `${Math.max(gutter, Math.min(bounds.left, innerWidth - width - gutter))}px`
    panel.style.top = `${upwards ? Math.max(gutter, bounds.top - gutter - Math.min(panel.scrollHeight || options.length * 48 + 12, height)) : bounds.bottom + gutter}px`
  }, [options.length])
  const close = useCallback((restoreFocus = false) => {
    menu.current?.hidePopover()
    setOpen(false)
    search.current.text = ''
    if (restoreFocus) trigger.current?.focus()
  }, [])
  function show(index = Math.max(0, options.findIndex(option => option.id === value))) {
    if (disabled || !menu.current) return
    setActive(index)
    search.current.text = ''
    positionMenu()
    menu.current.showPopover()
    positionMenu()
    setOpen(true)
  }
  function choose(index: number) {
    const option = options[index]
    if (!option) return
    close(true)
    if (option.id !== value) onChange(option.id)
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    const key = event.key
    if (key === 'Tab') { if (open) close(); return }
    if (key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation(); close(true) }; return }
    if (event.altKey && key === 'ArrowUp') { event.preventDefault(); close(true); return }
    if (key === 'Enter' || key === ' ') { event.preventDefault(); if (open) choose(active); else show(); return }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) show()
      else setActive(index => (index + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
      return
    }
    if (key === 'Home' || key === 'End') { event.preventDefault(); const next = key === 'Home' ? 0 : options.length - 1; if (!open) show(next); else setActive(next); return }
    if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || !key.trim()) return
    event.preventDefault()
    const now = Date.now()
    const text = now - search.current.at < 700 ? search.current.text + key.toLocaleLowerCase() : key.toLocaleLowerCase()
    search.current = { text, at: now }
    const order = [...options.keys()].map(index => (active + 1 + index) % options.length)
    const next = order.find(index => options[index].name.toLocaleLowerCase().startsWith(text)) ?? order.find(index => options[index].name.toLocaleLowerCase().startsWith(key.toLocaleLowerCase()))
    if (next !== undefined) { if (!open) show(next); else setActive(next); search.current = { text, at: now } }
  }
  useEffect(() => {
    if (!open) return
    let frame = 0
    const reposition = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(positionMenu) }
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close() }
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true) } }
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) reposition() }
    const observer = new ResizeObserver(reposition)
    if (trigger.current) observer.observe(trigger.current)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', reposition)
    return () => {
      cancelAnimationFrame(frame); observer.disconnect()
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, positionMenu, close])
  useEffect(() => { if (disabled && open) menu.current?.hidePopover() }, [disabled, open])
  useEffect(() => { if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active, open, id])
  return <div className="workspace-switcher workspace-select" ref={root}>
    <button ref={trigger} className="workspace-select-trigger" type="button" role="combobox" aria-label="Switch workspace" aria-describedby={`${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && options.length ? `${id}-option-${Math.min(active, options.length - 1)}` : undefined} data-workspace-id={value} data-sidebar-tooltip={compact && selected ? `Switch workspace · ${selected.name}` : undefined} disabled={disabled} title={compact ? undefined : selected?.name || 'No assigned workspace'} onClick={() => open ? close(true) : show()} onKeyDown={keyDown}>
      <span className="workspace-avatar workspace-trigger-avatar" aria-hidden="true">{selected?.name.slice(0, 1) || '?'}</span>
      <span className="workspace-select-label" id={`${id}-value`}>{selected?.name || 'No assigned workspace'}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    <div ref={menu} id={`${id}-list`} className="workspace-select-menu" popover="manual" role="listbox" aria-label="Available workspaces" onToggle={event => setOpen(event.currentTarget.matches(':popover-open'))}>
      {options.map((option, index) => <div id={`${id}-option-${index}`} key={option.id} role="option" aria-label={option.name} aria-selected={option.id === value} data-workspace-id={option.id} data-active={active === index} className="workspace-select-option" onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span className="workspace-option-avatar" aria-hidden="true">{option.name.slice(0, 1)}</span><span>{option.name}</span>{option.id === value && <Check size={16} aria-hidden="true" />}
      </div>)}
    </div>
  </div>
}
