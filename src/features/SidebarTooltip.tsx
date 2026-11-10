import { useEffect, useRef, type RefObject } from 'react'

/** Keep tooltips outside the rail's scroll clipping while inheriting its theme. */
export function SidebarTooltip({ sidebar }: { sidebar: RefObject<HTMLElement | null> }) {
  const tooltip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const rail = sidebar.current
    const panel = tooltip.current
    if (!rail || !panel) return

    let anchor: HTMLElement | null = null
    const targetOf = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('[data-sidebar-tooltip]') : null
    const hide = () => {
      if (!anchor) return
      panel.hidePopover()
      anchor = null
    }
    const place = () => {
      if (!anchor) return
      const bounds = anchor.getBoundingClientRect()
      const scrollArea = anchor.closest('.primary-nav')?.getBoundingClientRect()
      if (scrollArea && (bounds.bottom <= scrollArea.top || bounds.top >= scrollArea.bottom)) { hide(); return }
      const height = panel.offsetHeight
      panel.style.left = rail.getBoundingClientRect().right + 8 + 'px'
      panel.style.top = Math.max(6, Math.min(bounds.top + (bounds.height - height) / 2, innerHeight - height - 6)) + 'px'
    }
    const show = (target: HTMLElement) => {
      if (target === anchor || target.matches(':disabled,[aria-expanded=true].workspace-select-trigger')) return
      const label = target.dataset.sidebarTooltip
      if (!label) return
      panel.textContent = label
      panel.showPopover()
      anchor = target
      place()
    }
    function enter(event: PointerEvent | FocusEvent) {
      if (event instanceof PointerEvent && event.pointerType === 'touch') return
      const target = targetOf(event.target)
      if (target) show(target)
    }
    function leave(event: PointerEvent | FocusEvent) {
      if (targetOf(event.target) === anchor && targetOf(event.relatedTarget) !== anchor) hide()
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') hide()
    }

    rail.addEventListener('pointerover', enter)
    rail.addEventListener('pointerout', leave)
    rail.addEventListener('focusin', enter)
    rail.addEventListener('focusout', leave)
    rail.addEventListener('click', hide, true)
    rail.addEventListener('scroll', place, true)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', hide)
    return () => {
      hide()
      rail.removeEventListener('pointerover', enter)
      rail.removeEventListener('pointerout', leave)
      rail.removeEventListener('focusin', enter)
      rail.removeEventListener('focusout', leave)
      rail.removeEventListener('click', hide, true)
      rail.removeEventListener('scroll', place, true)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', hide)
    }
  }, [sidebar])
  return <div ref={tooltip} className="sidebar-tooltip" role="tooltip" popover="manual" />
}
