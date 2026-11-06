import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { dayKey } from '../lib/reporting'
const dateKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
const monthKey = (value: string) => value.slice(0, 7)
const monthDate = (value: string) => { const [year, month] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, 1, 12)) }
const displayDate = (value: string) => new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`))

export function ReportDatePicker({ id, label, value, min, max, onChange }: { id: string; label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  const today = dayKey(new Date())
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(monthKey(value || today))
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const month = monthDate(visibleMonth)
  const year = month.getUTCFullYear()
  const monthNumber = month.getUTCMonth() + 1
  const monthTitle = new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(month)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const days = Array.from({ length: 42 }, (_, index) => dateKey(new Date(Date.UTC(year, monthNumber - 1, 1 - firstWeekday + index, 12))))
  const todayDisabled = (!!min && today < min) || (!!max && today > max)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => { if (!pickerRef.current?.contains(event.target as Node)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  function shiftMonth(amount: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12))
    setVisibleMonth(dateKey(next).slice(0, 7))
  }

  function choose(date: string) {
    onChange(date)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div className="report-date-field">
    <span className="report-date-label" id={`${id}-label`}>{label}</span>
    <div className="report-date-picker" ref={pickerRef}>
      <button ref={triggerRef} id={`${id}-trigger`} className="report-date-trigger" type="button" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setVisibleMonth(monthKey(value || today)); setOpen(current => !current) }}>
        <span id={`${id}-value`}>{value ? displayDate(value) : 'yyyy/mm/dd'}</span><CalendarDays size={16} aria-hidden="true" />
      </button>
      {open && <div className={`report-date-popover${value ? ' has-value' : ''}`} role="dialog" aria-label={`${label} date picker`}>
        <div className="report-calendar-header"><button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button><strong>{monthTitle}</strong><button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button></div>
        <div className="report-calendar-weekdays" aria-hidden="true">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="report-calendar-days">{days.map(date => {
          const outsideMonth = monthKey(date) !== visibleMonth
          const disabled = (!!min && date < min) || (!!max && date > max)
          const accessibleDate = new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
          return <button key={date} type="button" className={`report-calendar-day${outsideMonth ? ' outside-month' : ''}${date === value ? ' selected' : ''}${date === today ? ' today' : ''}`} aria-label={accessibleDate} aria-pressed={date === value} aria-current={date === today ? 'date' : undefined} disabled={disabled} onClick={() => choose(date)}>{Number(date.slice(-2))}</button>
        })}</div>
        <div className="report-calendar-actions"><button type="button" onClick={() => choose('')}>Clear</button><button type="button" disabled={todayDisabled} onClick={() => choose(today)}>Today</button></div>
      </div>}
    </div>
  </div>
}
