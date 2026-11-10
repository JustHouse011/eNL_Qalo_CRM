import type { Conversation } from '../data/demoData.ts'
const reportDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })
export function dayKey(value: string | Date) {
 const date = new Date(value)
 if (!Number.isFinite(date.getTime())) return ''
 return reportDayFormatter.format(date)
}
export function period(days: number, end = dayKey(new Date())) {
 return { from: new Date(Date.parse(end + 'T12:00:00Z') - (days - 1) * 86400000).toISOString().slice(0, 10), to: end }
}
export function aggregateCases(input: Conversation[], from: string, to: string) {
 const cases = [...new Map(input.map(c => [c.id, c])).values()]
 const inside = (date: string) => !!date && date >= from && date <= to
 const records = cases.filter(c => inside(dayKey(c.createdAt)))
 const days: { date: string; newCases: number; resolved: number }[] = []
 for (let t = Date.parse(from + 'T12:00:00Z'); t <= Date.parse(to + 'T12:00:00Z'); t += 86400000) days.push({ date: new Date(t).toISOString().slice(0, 10), newCases: 0, resolved: 0 })
 const buckets = new Map(days.map(d => [d.date, d]))
 for (const c of cases) {
  const bucket = buckets.get(dayKey(c.createdAt)); if (bucket) bucket.newCases++
  for (const time of new Set([...(c.resolutionEvents || []), ...(c.resolvedAt ? [c.resolvedAt] : [])])) { const b = buckets.get(dayKey(time)); if (b) b.resolved++ }
 }
 const counts = (field: 'businessArea' | 'category') => Object.entries(records.reduce<Record<string, number>>((all, c) => { const name = (c[field] || (field === 'businessArea' ? 'general' : 'Unclassified')).trim(); all[name] = (all[name] || 0) + 1; return all }, {})).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value || a.name.localeCompare(b.name))
 return { records, days, areas: counts('businessArea'), categories: counts('category').slice(0,5), resolved: days.reduce((n,d)=>n+d.resolved,0) }
}
