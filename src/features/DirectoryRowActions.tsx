import { useId, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'

export function DirectoryRowActions({ name, view, edit }: { name: string; view: () => void; edit?: () => void }) {
  const id = useId(), menu = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  function position() {
    const panel = menu.current!, bounds = trigger.current!.getBoundingClientRect()
    panel.style.left = `${Math.max(8, Math.min(bounds.right - 176, innerWidth - 184))}px`
    panel.style.top = `${Math.max(8, Math.min(bounds.bottom + 5, innerHeight - 115))}px`
  }
  function act(action: () => void) { menu.current?.hidePopover(); trigger.current?.focus(); action() }
  return <div className="crm-row-actions" onClick={event => event.stopPropagation()}><button ref={trigger} type="button" className="crm-icon-button" aria-label={`Actions for ${name}`} aria-haspopup="menu" popoverTarget={id} onClick={position}><MoreHorizontal size={17} /></button><div ref={menu} popover="auto" id={id} role="menu" aria-label={`Actions for ${name}`} className="crm-action-menu" onToggle={event => { if (event.currentTarget.matches(':popover-open')) menu.current?.querySelector<HTMLButtonElement>('button')?.focus() }} onKeyDown={event => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); menu.current?.hidePopover(); trigger.current?.focus() }
  }}><button type="button" role="menuitem" onClick={() => act(view)}>View details</button>{edit && <button type="button" role="menuitem" onClick={() => act(edit)}>Edit record</button>}</div></div>
}
