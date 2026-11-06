import type { Conversation, DemoData } from '../data/demoData'
import { dayKey } from './reporting'

export type VisitorStatus = 'online' | 'offline' | 'in-chat' | 'unknown'
export type VisitorSession = DemoData['visitors'][number] & {
  workspaceId: string
  visitorKey?: string
  sessionId?: string
  country?: string
  countryCode?: string
  firstSeenAt?: string
  lastSeenAt?: string
  endedAt?: string
  conversationId?: string
  device?: string
  browser?: string
  operatingSystem?: string
  referrer?: string
}
export type VisitorPageView = { id: string; workspaceId: string; sessionId: string; visitorKey: string; page: string; at: string }
export type VisitorDataset = {
  mode?: 'workspace' | 'fixture'
  asOf?: number
  agentNames?: string[]
  simulation?: { paused: boolean }
  presenceSeries?: { at: number; visitors: number }[]
  agentAvailability?: { id: string; workspaceId: string; agentId: string; from: string; to: string; available: boolean }[]
  workspaceId: string
  sessions: VisitorSession[]
  conversations: Conversation[]
  pageViews: VisitorPageView[]
  // Only an authoritative adapter may enable these capabilities. Local status strings are not presence evidence.
  tracking: { state: 'connected' | 'unavailable' | 'reconnecting'; presence: boolean; visitors: boolean; pageViews: boolean; inactivityMs: number }
}
export type VisitorTimeRange = 'live' | '30m' | 'hour' | 'today' | '7days' | 'custom'
export type VisitorSort = 'recent' | 'oldest' | 'name' | 'status'
export const visitorStatusLabels: Record<VisitorStatus, string> = { online: 'Online', offline: 'Offline', 'in-chat': 'In Chat', unknown: 'Not recorded' }
export const validTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null
const day = 86400000
const dateStart = (value: string) => Date.parse(`${value}T00:00:00+02:00`)
export function visitorRange(range: VisitorTimeRange, now: number, from = '', to = '') {
  const today = dayKey(new Date(now))
  const end = now
  if (range === 'custom') return { from: dateStart(from), to: dateStart(to) + day - 1 }
  if (range === 'today') return { from: dateStart(today), to: end }
  if (range === '7days') return { from: dateStart(today) - 6 * day, to: end }
  return { from: end - (range === 'hour' ? 3600000 : 1800000), to: end }
}
export function visitorStatus(session: VisitorSession, data: VisitorDataset, now: number): VisitorStatus {
  if (data.tracking.state !== 'connected' || !data.tracking.presence) return 'unknown'
  if (validTime(session.endedAt) !== null) return 'offline'
  const seen = validTime(session.lastSeenAt)
  if (seen === null) return 'unknown'
  if (seen > now + 30000 || now - seen > data.tracking.inactivityMs) return 'offline'
  const conversation = data.conversations.find(c => c.id === session.conversationId)
  return conversation && conversation.status !== 'resolved' ? 'in-chat' : 'online'
}
export function uniqueSessions(input: VisitorSession[], workspaceId: string) {
  const map = new Map<string, VisitorSession>()
  for (const session of input) {
    if (session.workspaceId !== workspaceId) continue
    const key = session.sessionId || session.id
    const previous = map.get(key)
    if (!previous || (validTime(session.lastSeenAt) ?? 0) > (validTime(previous.lastSeenAt) ?? 0)) map.set(key, session)
  }
  return [...map.values()]
}
export function visitorHistory(data: VisitorDataset, query: { search: string; status: string; from?: number; to?: number; sort: VisitorSort; page: number; pageSize: number }, now: number) {
  const search = query.search.trim().toLocaleLowerCase()
  const rows = uniqueSessions(data.sessions, data.workspaceId).filter(session => {
    const time = validTime(session.lastSeenAt)
    if (query.from !== undefined && (time === null || time < query.from)) return false
    if (query.to !== undefined && (time === null || time > query.to)) return false
    if (query.status !== 'all' && visitorStatus(session, data, now) !== query.status) return false
    return !search || [session.id, session.name, session.location, session.country, session.page].some(value => value?.toLocaleLowerCase().includes(search))
  }).sort((a, b) => {
    if (query.sort === 'name') return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    if (query.sort === 'status') return visitorStatusLabels[visitorStatus(a, data, now)].localeCompare(visitorStatusLabels[visitorStatus(b, data, now)]) || a.id.localeCompare(b.id)
    const left = validTime(a.lastSeenAt), right = validTime(b.lastSeenAt)
    if (left === null || right === null) return left === right ? a.id.localeCompare(b.id) : left === null ? 1 : -1
    return (query.sort === 'oldest' ? left - right : right - left) || a.id.localeCompare(b.id)
  })
  const pageSize = Math.min(50, Math.max(1, query.pageSize))
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(pages, Math.max(1, query.page))
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, pages, page, pageSize }
}
// Comparable elapsed portions of today and yesterday; never divide by zero.
export function visitorChange(current: number, previous: number): number | null { return previous > 0 ? (current - previous) / previous * 100 : current === 0 ? 0 : null }
export function visitorSummary(data: VisitorDataset, now: number) {
  const start = dateStart(dayKey(new Date(now)))
  const inPeriod = (at: string | undefined, from: number, to: number) => { const time = validTime(at); return time !== null && time >= from && time <= to }
  const sessions = uniqueSessions(data.sessions, data.workspaceId)
  const events = [...new Map(data.pageViews.filter(e => e.workspaceId === data.workspaceId && validTime(e.at) !== null).map(e => [e.id, e])).values()]
  const records = [...new Map(data.conversations.filter(c => c.workspaceId === data.workspaceId).map(c => [c.id, c])).values()]
  const identities = (from: number, to: number) => new Set(sessions.filter(s => s.visitorKey && inPeriod(s.firstSeenAt, from, to)).map(s => s.visitorKey)).size
  const views = (from: number, to: number) => events.filter(e => inPeriod(e.at, from, to)).length
  const answered = (c: Conversation) => c.messages.some(m => m.kind === 'agent' && !m.simulated && data.agentNames?.includes(m.author) && m.delivery !== 'failed' && m.delivery !== 'sending' && c.messages.some(customer => customer.kind === 'customer' && Date.parse(customer.time) <= Date.parse(m.time)))
  const missed = (c: Conversation) => !answered(c) && c.history.some(h => h.type === 'conversation-missed' && validTime(h.when) !== null)
  const chats = (from: number, to: number) => {
    const period = records.filter(c => inPeriod(c.createdAt, from, to))
    return { answered: period.filter(answered).length, missed: period.filter(missed).length }
  }
  const currentChats = chats(start, now), previousChats = chats(start - day, now - day)
  const ratings = records.filter(c => inPeriod(c.createdAt, start, now)).flatMap(c => typeof c.satisfaction === 'number' && c.satisfaction >= 1 && c.satisfaction <= 5 ? [c.satisfaction] : [])
  const measurable = sessions.filter(s => s.sessionId && inPeriod(s.firstSeenAt, start, now))
  const engaged = measurable.filter(s => records.some(c => c.id === s.conversationId && c.messages.some(m => m.kind === 'customer')))
  return {
    active: data.tracking.state === 'connected' && data.tracking.presence ? new Set(sessions.filter(s => ['online', 'in-chat'].includes(visitorStatus(s, data, now))).map(s => s.visitorKey || s.sessionId || s.id)).size : null,
    visitors: data.tracking.visitors ? identities(start, now) : null,
    visitorsChange: data.tracking.visitors ? visitorChange(identities(start, now), identities(start - day, now - day)) : null,
    pageViews: data.tracking.pageViews ? views(start, now) : null,
    pageViewsChange: data.tracking.pageViews ? visitorChange(views(start, now), views(start - day, now - day)) : null,
    chats: currentChats, answeredChange: visitorChange(currentChats.answered, previousChats.answered), missedChange: visitorChange(currentChats.missed, previousChats.missed),
    sentiment: ratings.length ? ratings.filter(r => r >= 4).length / ratings.length * 100 : null,
    engagement: data.tracking.visitors && measurable.length ? new Set(engaged.map(s => s.sessionId)).size / new Set(measurable.map(s => s.sessionId)).size * 100 : null,
    // No interval-based, authoritative agent availability exists in the current service.
    availability: availabilityPercent(data, start, now),
    days: Array.from({ length: 7 }, (_, index) => {
      const from = start - (6 - index) * day, to = Math.min(now, from + day - 1)
      return { date: dayKey(new Date(from)), visitors: data.tracking.visitors ? identities(from, to) : null, pageViews: data.tracking.pageViews ? views(from, to) : null, ...chats(from, to) }
    }),
  }
}
export function visitorTimeline(data: VisitorDataset, range: { from: number; to: number }) {
  if (!data.tracking.presence || data.tracking.state !== 'connected' || !Number.isFinite(range.from) || range.to < range.from) return []
  const sessions = uniqueSessions(data.sessions, data.workspaceId)
  if (data.mode === 'fixture' && data.presenceSeries) {
    const points = data.presenceSeries.filter(point => point.at >= range.from && point.at <= range.to)
    if (points.length <= 241) return points
    const step = Math.ceil(points.length / 240)
    return points.filter((_, index) => index % step === 0 || index === points.length - 1)
  }
  const span = range.to - range.from
  const step = span <= 3600000 ? 60000 : span <= day ? 3600000 : day
  // Bound custom ranges so the browser never allocates unbounded chart points.
  const interval = Math.max(step, Math.ceil(span / 240 / step) * step)
  return Array.from({ length: Math.min(241, Math.floor(span / interval) + 1) }, (_, i) => {
    const at = range.from + i * interval
    return { at, visitors: new Set(sessions.filter(s => {
      const first = validTime(s.firstSeenAt), last = validTime(s.lastSeenAt)
      const ended = validTime(s.endedAt)
      return first !== null && last !== null && first <= at && at <= Math.min(ended ?? Infinity, last + data.tracking.inactivityMs)
    }).map(s => s.visitorKey || s.sessionId || s.id)).size }
  })
}

function availabilityPercent(data: VisitorDataset, start: number, end: number): number | null {
  const intervals = [...new Map((data.agentAvailability || []).filter(i => i.workspaceId === data.workspaceId).map(i => [i.id, i])).values()]
    .sort((a, b) => a.agentId.localeCompare(b.agentId) || Date.parse(a.from) - Date.parse(b.from))
  const accounted = new Map<string, number>()
  let total = 0, available = 0
  for (const interval of intervals) {
    const from = validTime(interval.from), to = validTime(interval.to)
    if (from === null || to === null) continue
    const duration = Math.max(0, Math.min(end, to) - Math.max(start, from, accounted.get(interval.agentId) || 0))
    total += duration; if (interval.available) available += duration
    accounted.set(interval.agentId, Math.max(accounted.get(interval.agentId) || 0, to))
  }
  return total ? available / total * 100 : null
}
