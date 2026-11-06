import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'

/** A non-modal, content-bounded flyout. The top-layer clipping viewport never paints over the sidebar. */
export function DirectoryFlyout({ anchor, originRef, title, wide, onClose, children }: { originRef: RefObject<HTMLElement | null>; anchor: RefObject<HTMLDivElement | null>; title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const panel = viewport.current!, shade = backdrop.current!
    const previous = originRef.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const content = anchor.current
    const main = anchor.current?.closest('.main-area')
    let frame = 0
    function position() {
      if (!anchor.current) return
      if (main?.hasAttribute('inert')) { if (panel.matches(':popover-open')) panel.hidePopover(); if (shade.matches(':popover-open')) shade.hidePopover(); return }
      const bounds = anchor.current.getBoundingClientRect()
      const left = Math.max(0, bounds.left), top = Math.max(0, bounds.top)
      for (const element of [panel, shade]) { element.style.left = `${left}px`; element.style.top = `${top}px`; element.style.width = `${Math.min(bounds.width, innerWidth - left - 8)}px`; element.style.height = `${Math.max(0, innerHeight - top - 12)}px` }
      if (!shade.matches(':popover-open')) shade.showPopover()
      if (!panel.matches(':popover-open')) panel.showPopover()
    }
    const reposition = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && panel.matches(':popover-open')) { event.preventDefault(); event.stopPropagation(); onCloseRef.current() } }
    position(); (panel.querySelector<HTMLElement>('[autofocus]') || closeButton.current)?.focus({ preventScroll: true })
    const observer = new ResizeObserver(reposition)
    if (anchor.current) observer.observe(anchor.current)
    const inertObserver = new MutationObserver(reposition)
    if (main) inertObserver.observe(main, { attributes: true, attributeFilter: ['inert'] })
    window.addEventListener('resize', reposition); document.addEventListener('keydown', escape)
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); inertObserver.disconnect()
      window.removeEventListener('resize', reposition); document.removeEventListener('keydown', escape)
      if (panel.matches(':popover-open')) panel.hidePopover(); if (shade.matches(':popover-open')) shade.hidePopover()
      requestAnimationFrame(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true }); else content?.querySelector<HTMLInputElement>('[data-directory-search]')?.focus({ preventScroll: true }) })
    }
  }, [anchor, originRef])
  return <><div ref={backdrop} popover="manual" className="crm-flyout-backdrop" aria-hidden="true" onClick={onClose} /><div ref={viewport} popover="manual" className="crm-flyout-viewport"><section role="dialog" aria-modal="false" aria-label={title} className={`crm-flyout-panel ${wide ? 'crm-flyout-wide' : ''}`}><div className="crm-flyout-topline"><span>{title}</span><button ref={closeButton} type="button" className="crm-icon-button" aria-label="Close record details" onClick={onClose}><X size={19} /></button></div>{children}</section></div></>
}
