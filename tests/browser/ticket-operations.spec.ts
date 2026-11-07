import { test, expect } from '@playwright/test'
import { createSupportService } from '../../src/lib/supportService'
import { createTicketSupport, ticketState } from '../../src/lib/ticketSupport'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
import { QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'

test.use({ reducedMotion: 'reduce' })
function fixture() {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const service = createSupportService(() => storage)
  service.initializeEnl(platformPreview.id)
  return { service, support: createTicketSupport(service), storage }
}
test('ticket creation, idempotence, transitions, event provenance and reload', async () => {
  const { service, support, storage } = fixture(), workspace = QALO_WORKSPACE_ID, actor = 'user-agent-1'
  const id = await support.create(workspace, actor, { subject: 'Follow up', conversationId: 'conv-1', resolvedAt: '1900-01-01', closedAt: '1900-01-01' }, 'create-retry')
  expect(await support.create(workspace, actor, { subject: 'Follow up', conversationId: 'conv-1' }, 'create-retry')).toBe(id)
  const get = () => service.registry().snapshots[workspace].tickets.find(t => t.id === id)!
  expect(get()).toMatchObject({ workspaceId: workspace, conversationId: 'conv-1', customer: 'Lerato Mokoena', status: 'New' })
  expect(get().resolvedAt).toBeUndefined()
  expect(get().closedAt).toBeUndefined()
  await expect(support.edit(workspace, actor, id, { status: 'Closed' })).rejects.toThrow('Cannot transition')
  await support.edit(workspace, actor, id, { status: 'In Progress', priority: 'urgent' })
  await support.edit(workspace, actor, id, { status: 'Escalated' })
  await support.note(workspace, actor, id, 'Internal evidence', 'note-retry')
  await support.note(workspace, actor, id, 'Internal evidence', 'note-retry')
  await support.edit(workspace, actor, id, { status: 'Resolved', resolution: 'Customer confirmed' })
  expect(get().resolvedAt).toBeTruthy()
  await support.edit(workspace, actor, id, { status: 'Closed' })
  await expect(support.edit(workspace, actor, id, { subject: 'Forbidden edit' })).rejects.toThrow('Reopen')
  await support.edit(workspace, actor, id, { status: 'Reopened' })
  expect(get().resolvedAt).toBeUndefined()
  expect(get().replies).toHaveLength(1)
  const events = get().activity!
  expect(events.map(e => e.type)).toEqual(expect.arrayContaining(['created', 'priority-changed', 'escalated', 'resolved', 'reopened', 'internal-note']))
  expect(new Set(events.map(e => e.id)).size).toBe(events.length)
  for (const event of events) expect(event).toMatchObject({ workspaceId: workspace, ticketId: id, actorId: actor })
  const reloaded = createSupportService(() => storage)
  expect(reloaded.registry().snapshots[workspace].tickets.find(t => t.id === id)).toEqual(get())
  expect(ticketState({ ...get(), status: 'Pending' })).toBe('Pending Customer')
})
test('department eligibility, simulated presence, foreign references and captured workspace', async () => {
  const { service, support } = fixture(), actor = platformPreview.id, workspace = QALO_WORKSPACE_ID
  const qalo = service.registry().snapshots[workspace], bank = service.registry().snapshots[ENL_WORKSPACE_ID]
  const agent = qalo.agents[0], department = qalo.departments[0]
  const id = await support.create(workspace, actor, { subject: 'Routing', customer: qalo.contacts[0].name, contactId: qalo.contacts[0].id, departmentId: department.id, assigneeId: agent.id }, 'routing')
  await expect(support.edit(workspace, actor, id, { assigneeId: bank.agents[0].id })).rejects.toThrow('Agent')
  await expect(support.edit(workspace, actor, id, { departmentId: bank.departments[0].id })).rejects.toThrow('Department')
  await expect(support.create(workspace, actor, { subject: 'Foreign', conversationId: bank.conversations[0].id }, 'foreign')).rejects.toThrow('Conversation')
  await expect(support.create(workspace, actor, { subject: 'Foreign', customer: 'Foreign', contactId: bank.contacts[0].id }, 'foreign-customer')).rejects.toThrow('Customer')
  await support.agent(workspace, actor, agent.id, 'offline', [department.id])
  await expect(support.create(workspace, actor, { subject: 'Offline assignment', customer: 'Customer', departmentId: department.id, assigneeId: agent.id }, 'offline')).rejects.toThrow('unavailable')
  await support.agent(workspace, actor, agent.id, 'away', [department.id])
  await support.edit(workspace, actor, id, { assigneeId: agent.id })
  await support.agent(workspace, actor, agent.id, 'online', [])
  await expect(support.create(workspace, actor, { subject: 'Ineligible assignment', customer: 'Customer', departmentId: department.id, assigneeId: agent.id }, 'ineligible')).rejects.toThrow('ineligible')
  const other = qalo.agents[1]
  await support.edit(workspace, actor, id, { assigneeId: other.id })
  const before = JSON.stringify(service.registry().snapshots[ENL_WORKSPACE_ID])
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const pending = gate.then(() => support.edit(workspace, actor, id, { priority: 'high' }))
  service.selectWorkspace(ENL_WORKSPACE_ID, actor)
  release()
  await pending
  expect(JSON.stringify(service.registry().snapshots[ENL_WORKSPACE_ID])).toBe(before)
  expect(service.registry().snapshots[workspace].tickets.find(t => t.id === id)?.activity?.some(e => e.type === 'reassigned')).toBe(true)
  await expect(support.agent(workspace, 'user-agent-3', agent.id, 'online', [])).rejects.toThrow('role')
})
test('ticket editor persists lifecycle, notes and simulated agent profile', async ({ page }) => {
  await page.goto('/tickets')
  await page.getByRole('button', { name: 'New ticket', exact: true }).click()
  await page.getByLabel('Subject', { exact: true }).fill('Lifecycle browser journey')
  await page.getByLabel('Ticket status', { exact: true }).selectOption('Escalated')
  await page.getByRole('button', { name: 'Save ticket', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Ticket saved')
  await page.reload()
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('Lifecycle browser journey')
  await expect(page.getByRole('region', { name: 'Recent ticket activity', exact: true }).getByText('escalated', { exact: true })).toBeVisible()
  await page.getByLabel('Ticket reply', { exact: true }).fill('Staff-only ticket note')
  await page.getByRole('button', { name: 'Save reply', exact: true }).click()
  await expect(page.getByText('Staff-only ticket note', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /^(Agents|Agents & Departments)$/, exact: true }).click()
  await page.getByRole('button', { name: 'View Bongani Nombamba' }).click()
  await page.getByRole('combobox', { name: 'availability', exact: true }).selectOption('offline')
  await page.reload()
  await expect(page.getByRole('cell', { name: 'offline', exact: true })).toBeVisible()
})

test('bank ticket lifecycle preserves Qalo and rejects foreign ticket edits', async () => {
  const { service, support } = fixture(), actor = 'user-enl-agent-demo'
  const before = JSON.stringify(service.registry().snapshots[QALO_WORKSPACE_ID])
  const bank = service.registry().snapshots[ENL_WORKSPACE_ID], source = bank.conversations[0]
  const id = await support.create(ENL_WORKSPACE_ID, actor, { subject: 'Bank support follow up', conversationId: source.id, departmentId: source.departmentId }, 'bank-create')
  await support.edit(ENL_WORKSPACE_ID, actor, id, { status: 'Resolved', resolution: 'Local follow up complete' })
  await support.edit(ENL_WORKSPACE_ID, actor, id, { status: 'Reopened' })
  await expect(support.edit(QALO_WORKSPACE_ID, platformPreview.id, id, { priority: 'urgent' })).rejects.toThrow('Ticket not found')
  await expect(support.edit(ENL_WORKSPACE_ID, 'user-agent-3', id, { priority: 'urgent' })).rejects.toThrow('role')
  expect(JSON.stringify(service.registry().snapshots[QALO_WORKSPACE_ID])).toBe(before)
  expect(service.registry().snapshots[ENL_WORKSPACE_ID].tickets.find(t => t.id === id)).toMatchObject({ status: 'Reopened', contactId: source.contactId, conversationId: source.id })
})

test('legacy content and offline historical assignment survive unrelated edits', async () => {
  const { service, support } = fixture(), workspace = QALO_WORKSPACE_ID, actor = 'user-agent-1'
  const snapshot = service.registry().snapshots[workspace], ticket = snapshot.tickets[0], agent = snapshot.agents.find(a => a.id === ticket.assigneeId)!
  const existing = ticket.replies
  await support.agent(workspace, actor, agent.id, 'offline', snapshot.departments.map(d => d.id))
  await support.edit(workspace, actor, ticket.id, { description: 'Existing case updated while owner is offline' })
  const updated = service.registry().snapshots[workspace].tickets.find(t => t.id === ticket.id)!
  expect(updated.assigneeId).toBe(ticket.assigneeId)
  expect(updated.replies).toEqual(existing)
  expect(updated.createdAt).toBe(ticket.createdAt)
  expect(updated.activity?.map(e => e.type)).toEqual(['edited'])
  const supervisor = snapshot.agents[1], assigned = snapshot.tickets.find(t => t.assigneeId === supervisor.id)!
  service.manage(platformPreview.id, { kind: 'member', workspaceId: workspace, userId: supervisor.userId, role: 'supervisor', status: 'inactive' })
  await support.edit(workspace, actor, assigned.id, { description: 'Historical ownership retained' })
  expect(service.registry().snapshots[workspace].tickets.find(t => t.id === assigned.id)?.assigneeId).toBe(supervisor.id)
  await expect(support.create(workspace, actor, { subject: 'Inactive assignment', customer: 'Customer', assigneeId: supervisor.id }, 'inactive')).rejects.toThrow('Agent')
})

test('ticket details and team profiles remain usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/tickets?ticket=T-2048')
  await expect(page.getByLabel('Subject', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/team')
  await page.getByRole('button', { name: 'View Bongani Nombamba' }).click()
  await expect(page.getByRole('combobox', { name: 'availability', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('conversation ticket dialog preserves context, navigates and exposes the return link', async ({ page }) => {
  await page.goto('/inbox?conversation=conv-1')
  await expect(page.getByRole('button', { name: 'Create Ticket', exact: true })).toBeVisible()
  const before = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-qalo']
    return { count: data.tickets.length, source: data.conversations.find((c: { id: string }) => c.id === 'conv-1') }
  })
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click()
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue(`Follow-up for ${before.source.customer}`)
  await expect(page.getByLabel('Ticket category', { exact: true })).toHaveValue(before.source.category)
  await page.getByLabel('Subject', { exact: true }).fill('Focused conversation follow-up')
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click()
  await expect(page).toHaveURL(/\/tickets\?ticket=/)
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('Focused conversation follow-up')
  const saved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-qalo']
    return { count: data.tickets.length, ticket: data.tickets.find((t: { subject: string }) => t.subject === 'Focused conversation follow-up') }
  })
  expect(saved.count).toBe(before.count + 1)
  expect(saved.ticket).toMatchObject({ workspaceId: QALO_WORKSPACE_ID, conversationId: before.source.id, contactId: before.source.contactId, customer: before.source.customer, category: before.source.category, departmentId: before.source.departmentId, assigneeId: before.source.assigneeId })
  await page.reload()
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('Focused conversation follow-up')
  await page.getByText(`Linked conversation: ${before.source.customer}`, { exact: true }).click()
  await page.getByRole('link', { name: 'Open conversation', exact: true }).click()
  await expect(page.locator('a.ticket-link').filter({ hasText: 'Focused conversation follow-up' })).toHaveAttribute('href', `/tickets?ticket=${saved.ticket.id}`)
})
