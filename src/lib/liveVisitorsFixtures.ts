import type { Conversation } from '../data/demoData'
import { ENL_WORKSPACE_ID } from './enlWorkspace'
import { QALO_WORKSPACE_ID } from './workspaceTypes'
import { dayKey } from './reporting'
import type { VisitorDataset, VisitorSession } from './visitorAnalytics'

export const visitorFixtureProfiles = {
  [QALO_WORKSPACE_ID]: { live: 18, unique: [149, 172, 181, 208, 223, 231, 247], todaySessions: 264, pageViews: 683, engaged: 180, answered: 32, missed: 4, positive: 43, ratings: 47, availability: .964, agents: ['Bongani Nombamba', 'Phindile Khumalo', 'Tumo Likotsi'], pages: ['/', '/#about', '/#partners', '/#contact', '/help', '/chat'], samples: [8, 11, 9, 15, 12, 16, 18] },
  [ENL_WORKSPACE_ID]: { live: 34, unique: [372, 399, 415, 457, 489, 504, 518], todaySessions: 530, pageViews: 1246, engaged: 390, answered: 76, missed: 8, positive: 49, ratings: 52, availability: .981, agents: ['Naledi Dube', 'Kabelo Maseko', 'Zanele Mokoena'], pages: ['/', '/accounts/becha', '/accounts/nala', '/accounts/temo', '/savings', '/business', '/contact', '/support'], samples: [17, 22, 20, 28, 25, 31, 34] },
} as const
const names = ['Lerato Molefe', 'Sipho Maseko', 'Ayesha Khan', 'Thabo Dlamini', 'Nomsa Nkosi', 'Zanele Mokoena', 'Karabo Sithole', 'Nandi Jacobs', 'Themba Naidoo', 'Lindiwe Peters', 'Amina Hassan', 'Kabelo Ndlovu', 'Mpho Mokoena', 'Emma Williams', 'James Moyo', 'Naledi Tau', 'Grace Mutiso', 'David Daniels', 'Fatima Ismail', 'Palesa Dube', 'Buhle Zulu', 'Andile Nkomo', 'Sarah Adams', 'Tumelo Modise', 'Yusuf Omar', 'Megan Brown', 'Neo Mofokeng', 'Sizwe Khumalo', 'Anele Gwala', 'Michael Smith', 'Keabetswe Radebe', 'Chloe Johnson', 'Sibongile Nene', 'Bongiwe Sibiya', 'Kgomotso Motaung', 'Tshepo Mabena', 'Tendai Chirwa', 'Mary Otieno', 'Olivia Wilson', 'Tumi Motsoeneng']
const places = [ ['South Africa', 'ZA', 'Johannesburg'], ['South Africa', 'ZA', 'Cape Town'], ['South Africa', 'ZA', 'Durban'], ['South Africa', 'ZA', 'Pretoria'], ['South Africa', 'ZA', 'Gqeberha'], ['South Africa', 'ZA', 'Bloemfontein'], ['Namibia', 'NA', 'Windhoek'], ['Kenya', 'KE', 'Nairobi'], ['United Kingdom', 'GB', 'London'], ['Botswana', 'BW', 'Gaborone'], ['United States', 'US', 'Atlanta'], ['South Africa', 'ZA', 'Polokwane'] ]
const iso = (time: number) => new Date(time).toISOString()
export function createVisitorFixtures(workspaceId: string, now: number): VisitorDataset {
  const profile = visitorFixtureProfiles[workspaceId as keyof typeof visitorFixtureProfiles]
  if (!profile) throw new Error('Visitor fixtures are not configured for this workspace.')
  const start = Date.parse(`${dayKey(new Date(now))}T00:00:00+02:00`)
  const elapsed = Math.max(1, now - start)
  const result: VisitorDataset = { workspaceId, mode: 'fixture', asOf: now, agentNames: [...profile.agents], simulation: { paused: false }, sessions: [], conversations: [], pageViews: [], presenceSeries: [], agentAvailability: [], tracking: { state: 'connected', presence: true, visitors: true, pageViews: true, inactivityMs: 120000 } }
  for (let ago = 0; ago < 7; ago++) {
    const dayStart = start - ago * 86400000
    // Historical periods end at the same elapsed time for valid comparisons.
    const span = ago === 0 ? elapsed : 86399000
    const unique = profile.unique[6 - ago]
    const count = ago === 0 ? profile.todaySessions : unique
    const pageCount = ago === 0 ? profile.pageViews : Math.round(unique * (workspaceId === QALO_WORKSPACE_ID ? 2.66 : 2.38))
    const sessions: VisitorSession[] = []
    for (let i = 0; i < count; i++) {
      const identity = i % unique
      const [country, countryCode, location] = places[(identity + (workspaceId === ENL_WORKSPACE_ID ? 2 : 0)) % places.length]
      const at = ago === 0 && i < profile.live ? Math.max(dayStart + 1, now - (3 + i % 24) * 60000) : dayStart + Math.floor(span * (.02 + .78 * (i + 1) / count))
      const last = Math.min(dayStart + span, at + (3 + identity % 24) * 60000)
      const active = ago === 0 && i < profile.live
      const id = `${workspaceId}:visit:${dayKey(new Date(dayStart))}:${i}`
      const phone = identity % 3 !== 0
      const visitor: VisitorSession = { id, sessionId: id, workspaceId, visitorKey: `${workspaceId}:person:${identity}`, name: identity % 7 === 0 ? `Visitor ${workspaceId === ENL_WORKSPACE_ID ? 'E' : 'Q'}${String(identity + 101).padStart(4, '0')}` : names[identity % names.length], country, countryCode, location, page: profile.pages[identity % profile.pages.length], source: ['Direct', 'Search', 'Social', 'Referral'][identity % 4], referrer: identity % 4 === 0 ? 'Direct visit' : identity % 4 === 1 ? 'Search engine' : identity % 4 === 2 ? 'Social link' : 'Partner referral', activity: 'Browsing support information', status: active ? 'Online' : 'Offline', firstSeenAt: iso(at), lastSeenAt: iso(active ? now : last), endedAt: active ? undefined : iso(last), device: phone ? 'Mobile' : 'Desktop', browser: phone ? identity % 2 ? 'Safari' : 'Chrome' : identity % 2 ? 'Edge' : 'Chrome', operatingSystem: phone ? identity % 2 ? 'iOS' : 'Android' : 'Windows' }
      sessions.push(visitor); result.sessions.push(visitor)
    }
    for (let i = 0; i < pageCount; i++) {
      const session = sessions[i % sessions.length]
      const first = Date.parse(session.firstSeenAt!), last = Date.parse(session.lastSeenAt!)
      const round = Math.floor(i / sessions.length), rounds = Math.ceil(pageCount / sessions.length)
      const at = Math.min(last, first + (last - first) * round / Math.max(1, rounds - 1))
      result.pageViews.push({ id: `${workspaceId}:view:${ago}:${i}`, workspaceId, sessionId: session.sessionId!, visitorKey: session.visitorKey!, page: profile.pages[(i + round) % profile.pages.length], at: iso(at) })
      session.page = profile.pages[(i + round) % profile.pages.length]
    }
    const answerCount = ago === 0 ? profile.answered : Math.max(2, profile.answered - ago * 3)
    const missedCount = ago === 0 ? profile.missed : Math.max(1, profile.missed - ago % 3)
    const engagementCount = ago === 0 ? profile.engaged : Math.min(sessions.length, answerCount + missedCount + 12)
    for (let i = 0; i < engagementCount; i++) {
      const visitor = sessions[i]
      const id = `${workspaceId}:preview-chat:${ago}:${i}`
      const answered = i < answerCount
      // Rated conversations can be resolved by the assistant without a human answer.
      const rated = ago === 0 && i < profile.ratings
      const missed = !answered && !rated && i < Math.max(answerCount, ago === 0 ? profile.ratings : 0) + missedCount
      const at = Date.parse(visitor.firstSeenAt!)
      const messages: Conversation['messages'] = [{ id: `${id}:question`, workspaceId, conversationId: id, author: visitor.name, kind: 'customer', time: iso(at), text: 'Could you help me find the right information on your website?' }]
      if (answered || rated) messages.push({ id: `${id}:response`, workspaceId, conversationId: id, author: answered ? profile.agents[i % profile.agents.length] : 'Virtual Assistant', kind: 'agent', simulated: !answered, delivery: 'sent', time: iso(Math.min(now, at + 90000)), text: 'Welcome. I can help you find the right support information.' })
      const conversation: Conversation = { id, workspaceId, customer: visitor.name, email: `visitor-${i}@example.invalid`, initials: visitor.name.split(' ').map(n => n[0]).slice(0, 2).join(''), tone: 'sage', location: visitor.location, channel: 'Website', status: answered || rated || missed ? 'resolved' : 'waiting', handling: answered ? 'human' : 'waiting', priority: 'normal', assignee: profile.agents[i % profile.agents.length], department: 'Customer Support', tags: [], unread: 0, createdAt: iso(at), updatedAt: iso(Math.min(now, at + 90000)), messages, history: missed ? [{ id: `${id}:missed`, type: 'conversation-missed', title: 'Conversation missed', detail: 'Visitor left before a response', when: iso(at + 120000) }] : [{ id: `${id}:started`, title: 'Conversation started', detail: 'Website enquiry', when: iso(at) }], satisfaction: rated ? i < profile.positive ? 5 : 3 : undefined }
      visitor.conversationId = id
      result.conversations.push(conversation)
    }
    // Keep a few current visitors actively in a conversation.
    if (ago === 0) for (let i = 0; i < (workspaceId === ENL_WORKSPACE_ID ? 6 : 3); i++) result.conversations.find(c => c.id === sessions[i].conversationId)!.status = 'open'
  }
  for (const agent of profile.agents) {
    const split = start + elapsed * profile.availability
    result.agentAvailability!.push({ id: `${agent}:available`, workspaceId, agentId: agent, from: iso(start), to: iso(split), available: true }, { id: `${agent}:away`, workspaceId, agentId: agent, from: iso(split), to: iso(now), available: false })
  }
  // Hourly history plus a minute-resolution rolling half-hour. Both are deterministic.
  for (let at = start - 6 * 86400000; at < now - 1800000; at += 3600000) {
    const phase = (at - start) / 3600000
    const level = Math.max(2, Math.round(profile.live * (.5 + .25 * Math.sin(phase / 3)) + 3 * Math.sin(phase * 1.7)))
    result.presenceSeries!.push({ at, visitors: level })
  }
  for (let minute = 0; minute <= 30; minute++) {
    const segment = Math.min(5, Math.floor(minute / 5)), progress = (minute - segment * 5) / 5
    result.presenceSeries!.push({ at: now - (30 - minute) * 60000, visitors: Math.round(profile.samples[segment] + (profile.samples[segment + 1] - profile.samples[segment]) * progress) })
  }
  return result
}

export function advanceVisitorFixtures(data: VisitorDataset, frame: number, now: number): VisitorDataset {
  if (dayKey(new Date(data.asOf!)) !== dayKey(new Date(now))) return createVisitorFixtures(data.workspaceId, now)
  const next = structuredClone(data)
  const profile = visitorFixtureProfiles[data.workspaceId as keyof typeof visitorFixtureProfiles]
  const moves = [0, 1, 0, -1, -1, 0, 1, 1, 0, -1, 0, 1]
  const previous = next.presenceSeries!.at(-1)!.visitors
  const target = Math.max(profile.live - 4, Math.min(profile.live + 4, previous + moves[frame % moves.length]))
  const today = next.sessions.filter(s => dayKey(s.firstSeenAt!) === dayKey(new Date(now)))
  for (let i = 0; i < today.length; i++) {
    if (i < target) { today[i].endedAt = undefined; today[i].lastSeenAt = iso(now); today[i].status = 'Online' }
    else if (!today[i].endedAt) { today[i].endedAt = iso(now); today[i].status = 'Offline' }
  }
  const visitor = today[frame % Math.max(1, target)]
  visitor.page = profile.pages[(frame + 1) % profile.pages.length]
  visitor.activity = `Viewed ${visitor.page}`
  next.pageViews.push({ id: `${data.workspaceId}:tick-view:${frame}`, workspaceId: data.workspaceId, sessionId: visitor.sessionId!, visitorKey: visitor.visitorKey!, page: visitor.page, at: iso(now) })
  if (frame % 5 === 0) {
    const waiting = next.conversations.find(c => dayKey(c.createdAt) === dayKey(new Date(now)) && c.status === 'waiting' && c.messages.every(m => m.kind !== 'agent'))
    if (waiting) { waiting.messages.push({ id: `${waiting.id}:response:${frame}`, author: profile.agents[frame % profile.agents.length], kind: 'agent', delivery: 'sent', time: iso(now), text: 'Thanks for reaching out. I will help with your enquiry.' }); waiting.status = 'open'; waiting.updatedAt = iso(now) }
  }
  // Rebuild measured fixture intervals to keep the illustrative availability ratio stable.
  const start = Date.parse(`${dayKey(new Date(now))}T00:00:00+02:00`)
  for (const interval of next.agentAvailability!) { const split = start + (now - start) * profile.availability; interval.from = iso(interval.available ? start : split); interval.to = iso(interval.available ? split : now) }
  next.presenceSeries!.push({ at: now, visitors: target })
  const history = new Map<number, { at: number; visitors: number }>()
  for (const point of next.presenceSeries!) {
    if (point.at < now - 7 * 86400000) continue
    const bucket = Math.floor(point.at / (point.at < now - 3600000 ? 3600000 : 10000))
    history.set(bucket, point)
  }
  next.presenceSeries = [...history.values()].sort((a, b) => a.at - b.at)
  next.asOf = now
  return next
}
