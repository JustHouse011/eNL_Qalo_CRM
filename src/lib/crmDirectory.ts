import type { Conversation, DemoData, DemoTicket } from '../data/demoData'
import type { BankingCase } from './workspaceExperience'
export type Person = DemoData['contacts'][number]
export type Organisation = NonNullable<DemoData['organisations']>[number]
export type EntityKind = 'customers' | 'contacts' | 'organisations'
export type DirectoryRow = {
  id: string; kind: 'person' | 'organisation'; name: string; detail: string; type: string; status: string
  organisation: string; people: Person[]; conversations: Conversation[]; tickets: DemoTicket[]; cases: BankingCase[]
  lastInteraction: string | null; agent: string | null; areas: string[]; departments: string[]
  person?: Person; company?: Organisation
}
export type DirectoryEvent = { id: string; title: string; detail: string; time: string; kind: 'conversation' | 'note' | 'ticket' | 'enquiry'; recordId: string; recordName: string; recordKind: DirectoryRow['kind']; href?: string }
export const recordedTime = (value?: string) => !!value && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value))
const normal = (value: string) => value.trim().toLocaleLowerCase()
const owned = (item: unknown, workspaceId: string) => { const owner = (item as { workspaceId?: string }).workspaceId; return !owner || owner === workspaceId }
const latest = (values: (string | undefined)[]) => values.filter((v): v is string => recordedTime(v)).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null
export function directoryRows(data: DemoData, kind: EntityKind, workspaceId: string): DirectoryRow[] {
  if ((data as { workspaceId?: string }).workspaceId && (data as { workspaceId?: string }).workspaceId !== workspaceId) return []
  const people = data.contacts.filter(c => owned(c, workspaceId)), companies = (data.organisations || []).filter(o => owned(o, workspaceId))
  const records = kind === 'organisations' ? companies : people
  return records.map(record => {
    const person = kind === 'organisations' ? undefined : record as Person
    const company = kind === 'organisations' ? record as Organisation : undefined
    const linked = person ? [person] : people.filter(p => p.organisationId === record.id)
    const ids = new Set(linked.map(p => p.id))
    const conversations = data.conversations.filter(c => {
      if (!owned(c, workspaceId)) return false
      if (company && c.organisationId === company.id) return true
      if (c.contactId) return ids.has(c.contactId)
      return linked.some(p => !!p.email.trim() && normal(p.email) === normal(c.email))
    })
    const conversationIds = new Set(conversations.map(c => c.id))
    const tickets = data.tickets.filter(t => owned(t, workspaceId) && (t.contactId ? ids.has(t.contactId) : t.conversationId ? conversationIds.has(t.conversationId) : linked.some(p => p.name === t.customer && people.filter(c => c.name === p.name).length === 1)))
    const cases = (data.bankingCases || []).filter(c => owned(c, workspaceId) && ids.has(c.customerId))
    const lastInteraction = latest([...conversations.map(c => c.updatedAt), ...conversations.flatMap(c => c.messages.map(m => m.time)), ...tickets.map(t => t.updatedAt || t.updated), ...cases.flatMap(c => [c.createdAt, ...c.history.map(h => h.time)])])
    const recent = [...conversations].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
    return { id: record.id, kind: person ? 'person' : 'organisation', name: record.name, detail: person ? person.email : company!.reference, type: person ? person.participantType || (kind === 'customers' ? 'Customer' : 'Contact') : company!.type, status: person?.customerStatus || 'unrecorded', organisation: person ? companies.find(o => o.id === person.organisationId)?.name || person.organisation : '', people: linked, conversations, tickets, cases, lastInteraction, agent: recent?.assignee || null, areas: [...new Set(conversations.map(c => c.businessArea || 'general'))], departments: [...new Set([...conversations.map(c => c.departmentId || c.department), ...cases.map(c => c.departmentId)])], person, company }
  })
}
export function directoryEvents(row: DirectoryRow): DirectoryEvent[] {
  const base = { recordId: row.id, recordName: row.name, recordKind: row.kind }
  const events: DirectoryEvent[] = []
  for (const c of row.conversations) {
    const history = c.history.filter(h => recordedTime(h.when))
    if (history.length) for (const h of history) events.push({ ...base, id: `conversation:${c.id}:${h.id}`, title: h.title, detail: h.detail, time: h.when, kind: 'conversation', href: `/inbox?conversation=${encodeURIComponent(c.id)}` })
    else if (recordedTime(c.createdAt)) events.push({ ...base, id: `conversation:${c.id}:created`, title: 'Conversation opened', detail: c.category || c.channel, time: c.createdAt, kind: 'conversation', href: `/inbox?conversation=${encodeURIComponent(c.id)}` })
    for (const note of c.messages.filter(m => m.kind === 'note' && recordedTime(m.time))) events.push({ ...base, id: `note:${c.id}:${note.id}`, title: 'Internal note', detail: note.text, time: note.time, kind: 'note' })
  }
  for (const t of row.tickets) {
    const href = `/tickets?ticket=${encodeURIComponent(t.id)}`
    if (t.activity?.length) for (const a of t.activity.filter(a => recordedTime(a.timestamp))) events.push({ ...base, id: `ticket:${t.id}:${a.id}`, title: `Ticket ${a.type.replaceAll('-', ' ')}`, detail: t.subject, time: a.timestamp, kind: 'ticket', href })
    else {
      if (recordedTime(t.createdAt)) events.push({ ...base, id: `ticket:${t.id}:created`, title: 'Ticket created', detail: t.subject, time: t.createdAt!, kind: 'ticket', href })
      if (recordedTime(t.resolvedAt)) events.push({ ...base, id: `ticket:${t.id}:resolved`, title: 'Ticket resolved', detail: t.subject, time: t.resolvedAt!, kind: 'ticket', href })
    }
    for (const note of t.replies || []) if (recordedTime(note.time)) events.push({ ...base, id: `ticket:${t.id}:reply:${note.id}`, title: note.private ? 'Ticket note' : 'Ticket reply', detail: note.text, time: note.time, kind: 'note', href })
  }
  for (const c of row.cases) for (const h of c.history) if (recordedTime(h.time)) events.push({ ...base, id: `enquiry:${c.id}:${h.id}`, title: c.kind === 'complaint' ? 'Complaint activity' : 'Service enquiry', detail: h.detail, time: h.time, kind: 'enquiry', href: c.kind === 'complaint' ? '/complaints' : c.kind === 'application' ? '/pipeline' : '/account-support' })
  return [...new Map(events.map(event => [event.id, event])).values()].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
}
export type DirectoryFilters = { search: string; type: string; status: string; scope: string; banking: boolean; from: string; to: string; sort: string; page: number; pageSize: number }
export function filterDirectory(rows: DirectoryRow[], query: DirectoryFilters) {
  const term = normal(query.search)
  const matches = rows.filter(row => (!term || [row.name, row.id, row.detail, row.type, row.organisation, row.person?.location, row.person?.tag, row.company?.reference].some(value => value && normal(value).includes(term))) && (query.type === 'all' || row.type === query.type) && (query.status === 'all' || row.status === query.status) && (query.scope === 'all' || (query.banking ? row.departments : row.areas).includes(query.scope)) && (!query.from || !!row.lastInteraction && Date.parse(row.lastInteraction) >= Date.parse(`${query.from}T00:00:00+02:00`)) && (!query.to || !!row.lastInteraction && Date.parse(row.lastInteraction) <= Date.parse(`${query.to}T23:59:59.999+02:00`)))
  matches.sort((a, b) => query.sort === 'name' ? a.name.localeCompare(b.name) : query.sort === 'name-desc' ? b.name.localeCompare(a.name) : query.sort === 'status' ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name) : (a.lastInteraction && b.lastInteraction ? Date.parse(b.lastInteraction) - Date.parse(a.lastInteraction) : a.lastInteraction ? -1 : b.lastInteraction ? 1 : 0) || a.name.localeCompare(b.name))
  const pageSize = Math.max(1, Math.min(50, query.pageSize)), pages = Math.max(1, Math.ceil(matches.length / pageSize)), page = Math.max(1, Math.min(query.page, pages))
  return { all: matches, rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pages, pageSize }
}
export function validatePerson(draft: Person, data: DemoData, editing = false) {
  if (!draft.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) throw new Error('Enter a name and a valid email address.')
  if (editing && !data.contacts.some(c => c.id === draft.id)) throw new Error('This contact is no longer available.')
  if (data.contacts.some(c => c.id !== draft.id && normal(c.email) === normal(draft.email))) throw new Error('Email already belongs to another contact')
  if (draft.organisationId && !(data.organisations || []).some(o => o.id === draft.organisationId)) throw new Error('The linked organisation is unavailable in this workspace.')
  return { ...draft, name: draft.name.trim(), email: draft.email.trim(), organisation: data.organisations?.find(o => o.id === draft.organisationId)?.name || draft.organisation }
}
export function parseDirectoryCsv(text: string, data: DemoData): Person[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.shift()?.toLowerCase() !== 'name,email,organisation') throw new Error('Use header: name,email,organisation. This simple importer does not accept quoted or multiline cells.')
  const rows = lines.map(line => line.split(',').map(v => v.trim()))
  if (!rows.length || rows.some(c => c.length !== 3 || c.some(v => v.includes('"')) || !c[0] || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c[1]))) throw new Error('Every row needs a name, valid email, and organisation column. Nothing imported.')
  const emails = [...data.contacts.map(c => normal(c.email)), ...rows.map(c => normal(c[1]))]
  if (new Set(emails).size !== emails.length) throw new Error('Duplicate email found. Nothing imported.')
  return rows.map(([name, email, organisation]) => ({ id: crypto.randomUUID(), name, email, organisation, location: '', conversations: 0, tag: 'Imported' }))
}
