import { selectWorkspace } from '../helpers/workspaceSelector'
import { test, expect, type Page } from '@playwright/test'
import { createSupportService } from '../../src/lib/supportService'
import { createConversationSupport, appendSimulated, conversationState } from '../../src/lib/conversationLifecycle'
import { createBankingSupport, applyBankingAssistant } from '../../src/lib/bankingSupport'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'

// Exercise the accessible motion preference; existing visual suites retain their own settings.
test.use({ reducedMotion: 'reduce' })

function fixture() {
  const values = new Map<string, string>()
  const service = createSupportService(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }))
  service.initializeEnl(platformPreview.id)
  return { service, support: createConversationSupport(service), bank: createBankingSupport(service) }
}

test('explicit conversation transitions, retry idempotence and resolved takeover guards', async () => {
  const { service, support, bank } = fixture()
  const id = await bank.start(ENL_WORKSPACE_ID, 'Journey Visitor', 'journey@example.invalid', 'General app help')
  const get = async () => (await service.readWorkspace(ENL_WORKSPACE_ID)).conversations.find(c => c.id === id)!
  expect((await get()).history.filter(e => e.type).map(e => e.to)).toEqual(['new', 'ai'])
  await expect(support.reply(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', 'Premature reply')).rejects.toThrow('Take over')
  await support.requestHuman(ENL_WORKSPACE_ID, id)
  const requested = await get()
  await support.requestHuman(ENL_WORKSPACE_ID, id)
  expect(await get()).toEqual(requested)
  expect(requested).toMatchObject({ status: 'waiting', handling: 'waiting', assignee: null, assigneeId: null })
  await support.takeover(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')
  const taken = await get()
  await support.takeover(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')
  expect(await get()).toEqual(taken)
  await support.reply(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', 'Human response', false, 'retry-agent')
  await support.reply(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', 'Human response', false, 'retry-agent')
  await support.customerMessage(ENL_WORKSPACE_ID, id, 'Customer reply', 'retry-customer', () => 'Must not appear')
  await support.customerMessage(ENL_WORKSPACE_ID, id, 'Customer reply', 'retry-customer', () => 'Must not appear')
  expect((await get()).messages.filter(m => m.id === 'retry-agent')).toHaveLength(1)
  expect((await get()).messages.filter(m => m.id === 'retry-customer')).toHaveLength(1)
  expect((await get()).messages.some(m => m.text === 'Must not appear')).toBe(false)
  await support.reply(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', 'Private context', true)
  await support.resolve(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')
  await expect(support.takeover(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')).rejects.toThrow('Reopen')
  await expect(support.returnToAi(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')).rejects.toThrow('Reopen')
  await expect(support.reply(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', 'Cannot reply')).rejects.toThrow('Reopen')
  await support.resolve(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', true)
  expect(await get()).toMatchObject({ lifecycle: 'reopened', handling: 'human', status: 'open' })
  await support.returnToAi(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')
  expect(await get()).toMatchObject({ lifecycle: 'ai', handling: 'ai', assignee: null, assigneeId: null })
  await support.customerMessage(ENL_WORKSPACE_ID, id, 'Another question', 'ai-customer', () => 'Allowed simulated reply')
  expect((await get()).messages.at(-1)).toMatchObject({ text: 'Allowed simulated reply', simulated: true })
  expect((await get()).history.filter(e => e.type).every(e => !Number.isNaN(Date.parse(e.when)))).toBe(true)
  expect((await service.readWorkspace(ENL_WORKSPACE_ID)).notifications!.some(n => n.title === 'Conversation reopening' && n.conversationId === id)).toBe(true)
})

test('active memberships, stable assignments, department/priority events and workspace isolation', async () => {
  const { service, support, bank } = fixture()
  const before = await service.readWorkspace(QALO_WORKSPACE_ID)
  const id = await bank.start(ENL_WORKSPACE_ID, 'Isolation Visitor', 'isolation@example.invalid', 'General enquiry')
  await expect(support.takeover(ENL_WORKSPACE_ID, id, 'user-agent-3')).rejects.toThrow('membership')
  await expect(support.takeover(QALO_WORKSPACE_ID, id, 'user-agent-1')).rejects.toThrow('not found')
  await support.update(ENL_WORKSPACE_ID, id, 'user-enl-supervisor-demo', { assignee: 'Demo Zanele Mokoena', department: 'Digital Banking Support', priority: 'high' })
  const data = await service.readWorkspace(ENL_WORKSPACE_ID)
  const c = data.conversations.find(c => c.id === id)!
  expect(c.assigneeId).toBe(data.agents.find(a => a.name === c.assignee)!.id)
  expect(c.departmentId).toBe(data.departments.find(d => d.name === c.department)!.id)
  expect(c.history.map(e => e.type)).toEqual(expect.arrayContaining(['assignment', 'routing', 'priority']))
  await expect(support.update(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', { assignee: 'Tumo Likotsi' })).rejects.toThrow('Active agent')
  await support.update(ENL_WORKSPACE_ID, id, 'user-enl-supervisor-demo', { assignee: null })
  expect((await service.readWorkspace(ENL_WORKSPACE_ID)).conversations.find(c => c.id === id)).toMatchObject({ assignee: null, assigneeId: null, handling: 'waiting' })
  expect(await service.readWorkspace(QALO_WORKSPACE_ID)).toEqual(before)
  service.manage(platformPreview.id, { kind: 'member', workspaceId: ENL_WORKSPACE_ID, userId: 'user-enl-agent-demo', role: 'agent', status: 'inactive' })
  await expect(support.takeover(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')).rejects.toThrow('membership')
})

test('delayed AI reply rechecks ownership; disabled and urgent cases cannot return to AI', async () => {
  const { service, support, bank } = fixture()
  const id = await bank.start(ENL_WORKSPACE_ID, 'Race Visitor', 'race@example.invalid', 'General enquiry')
  await support.takeover(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')
  await service.updateWorkspace(ENL_WORKSPACE_ID, d => appendSimulated(d, id, [{ id: 'delayed-ai', kind: 'agent', author: 'Assistant', text: 'Stale response', time: new Date().toISOString() }]))
  expect((await service.readWorkspace(ENL_WORKSPACE_ID)).conversations.find(c => c.id === id)!.messages.some(m => m.id === 'delayed-ai')).toBe(false)
  await service.updateWorkspace(ENL_WORKSPACE_ID, d => applyBankingAssistant(d, { ...d.assistant!, enabled: false }))
  await expect(support.returnToAi(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')).rejects.toThrow('disabled')
  await service.updateWorkspace(ENL_WORKSPACE_ID, d => applyBankingAssistant(d, { ...d.assistant!, enabled: true }))
  await support.update(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo', { priority: 'urgent' })
  await expect(support.returnToAi(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')).rejects.toThrow('human support')
  await support.resolve(ENL_WORKSPACE_ID, id, 'user-enl-agent-demo')
  await support.customerMessage(ENL_WORKSPACE_ID, id, 'Customer reopens', 'reopen-id')
  const c = (await service.readWorkspace(ENL_WORKSPACE_ID)).conversations.find(c => c.id === id)!
  expect(conversationState(c)).toBe('reopened')
  expect(c.resolvedAt).toBeUndefined()
  expect(c.resolutionEvents).toHaveLength(1)
})

async function profile(page: Page, role: string) {
  const previous = page.url()
  const id = ({ Admin: 'user-agent-1', Supervisor: 'user-agent-2', Agent: 'user-agent-3', 'Platform Super Admin': 'user-agent-1' } as Record<string, string>)[role] || role.replace('user:', '')
  await page.goto('/dev/session')
  await page.getByLabel('Preview identity').selectOption(id)
  await page.getByRole('button', { name: 'Start mock session' }).click()
  await page.goto(previous)
}

for (const banking of [false, true]) {
  test(`${banking ? 'eNL' : 'Qalo'} customer journey: request, takeover, note, reply, resolve and reopen`, async ({ page, context }) => {
    await page.goto('/inbox')
    page.on('dialog', d => d.accept())
    if (banking) {
      await profile(page, 'Platform Super Admin')
      await selectWorkspace(page, ENL_WORKSPACE_ID)
      await page.evaluate(() => { const key = 'qalo-workspaces-v2'; const store = JSON.parse(localStorage.getItem(key)!); store.snapshots['workspace-enl-mutual-bank'].settings.operatingHours.enabled = false; localStorage.setItem(key, JSON.stringify(store)) })
    }
    const customer = await context.newPage()
    const name = banking ? 'Demo Operational Visitor' : 'Operational Qalo Visitor'
    await customer.goto(banking ? '/enl-preview' : '/chat')
    if (banking) {
      await customer.getByRole('button', { name: 'Open eNL chat' }).click()
      await customer.getByLabel('Fictional name').fill(name)
      await customer.getByLabel('Demo email').fill('operational@example.invalid')
      await customer.getByLabel('General support question').fill('General app support please')
      await customer.getByRole('button', { name: 'Start demo conversation' }).click()
    } else {
      await customer.getByLabel('Your name').fill(name)
      await customer.getByLabel('Email', { exact: true }).fill('operational@example.invalid')
      await customer.getByLabel('Message', { exact: true }).fill('General support please')
      await customer.getByRole('button', { name: 'Send message' }).click()
    }
    await expect(customer.getByText(/Simulated/).first()).toBeVisible()
    await customer.getByRole('button', { name: 'Request human agent' }).click()
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await expect(page.getByLabel('Write a customer reply')).toBeDisabled()
    await page.getByRole('button', { name: banking ? 'Take over' : 'Assign to me', exact: false }).click()
    await expect(page.getByLabel('Write a customer reply')).toBeEnabled()
    await page.getByLabel('Write a customer reply').fill('A human is reviewing your fictional request.')
    await page.getByRole('button', { name: 'Send reply', exact: true }).click()
    await expect(customer.getByText('A human is reviewing your fictional request.')).toBeVisible()
    await page.getByRole('button', { name: 'Reply', exact: true }).click()
    await page.getByLabel('Write an internal note').fill('Private operational context')
    await page.getByRole('button', { name: 'Add internal note' }).click()
    await expect(page.getByText('Private operational context', { exact: true })).toBeVisible()
    await expect(customer.getByText('Private operational context')).toHaveCount(0)
    const simulatedBefore = await customer.getByText(/Simulated/).count()
    await customer.getByLabel(banking ? 'Support message' : 'Message', { exact: true }).fill('Customer follow-up after takeover')
    await customer.getByRole('button', { name: 'Send message' }).click()
    await expect(page.locator('.message-bubble').getByText('Customer follow-up after takeover', { exact: true })).toBeVisible()
    expect(await customer.getByText(/Simulated/).count()).toBe(simulatedBefore)
    await page.getByRole('button', { name: 'Resolve', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible()
    await expect(page.getByLabel('Assignee', { exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Reopen', exact: true }).click()
    await expect(page.locator('.banking-badge')).toHaveText('Reopened')

  })
}

for (const banking of [false, true]) {
  test(`${banking ? 'eNL' : 'Qalo'} persisted lifecycle, notes, customer session and workspace switching`, async ({ page, context }) => {
    const { service, support, bank } = fixture()
    service.initializeIdentity()
    const workspaceId = banking ? ENL_WORKSPACE_ID : QALO_WORKSPACE_ID
    const id = banking ? await bank.start(workspaceId, 'Persistence Visitor', 'persistence@example.invalid', 'General enquiry') : 'conv-1'
    await support.takeover(workspaceId, id, 'user-agent-1')
    await support.reply(workspaceId, id, 'user-agent-1', 'Persistent operational human reply')
    await support.reply(workspaceId, id, 'user-agent-1', 'Persistent private operational note', true)
    await support.resolve(workspaceId, id, 'user-agent-1')
    await support.resolve(workspaceId, id, 'user-agent-1', true)
    service.selectWorkspace(workspaceId, 'user-agent-1')
    const raw = JSON.stringify(service.registry())
    await context.addInitScript(({ raw, workspaceId, id, banking }) => {
      if (!localStorage.getItem('qalo-workspaces-v2')) localStorage.setItem('qalo-workspaces-v2', raw)
      sessionStorage.setItem('qalo-profile-preview', 'user:user-agent-1')
      sessionStorage.setItem(banking ? `banking-widget:${workspaceId}` : 'qalo-demo-chat', id)
    }, { raw, workspaceId, id, banking })
    await page.goto(`/inbox?conversation=${encodeURIComponent(id)}`)
    await expect(page.locator('.banking-badge')).toHaveText('Reopened')
    await expect(page.locator('.note-message')).toContainText('Persistent private operational note')
    await page.getByRole('tab', { name: banking ? 'My Conversations' : 'Mine', exact: true }).click()
    await expect(page.locator('.conversation-row').filter({ hasText: 'Persistent private operational note' })).toHaveCount(1)
    await page.getByRole('tab', { name: banking ? 'All Conversations' : 'All', exact: true }).click()
    await expect(page.getByLabel('Handling state filter')).toHaveCount(0)
    await page.getByRole('button', { name: 'Conversation filters', exact: true }).click()
    await page.getByLabel('Handling state filter').selectOption('reopened')
    await expect(page.locator('.conversation-row')).toHaveCount(1)
    await page.getByLabel('Handling state filter').selectOption('all')
    await page.getByLabel('Search conversations', { exact: true }).fill('Persistent operational human reply')
    await expect(page.locator('.conversation-row')).toHaveCount(1)
    await page.getByLabel('Search conversations', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Conversation filters', exact: true }).click()
    await expect(page.getByLabel('Handling state filter')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.message-bubble').getByText('Persistent operational human reply', { exact: true })).toBeVisible()
    await expect(page.locator('.note-message')).toContainText('Persistent private operational note')
    const customer = await context.newPage()
    await customer.goto(banking ? '/enl-preview' : '/chat')
    if (banking) await customer.getByRole('button', { name: 'Open eNL chat' }).click()
    await expect(customer.getByText('Persistent operational human reply', { exact: true })).toBeVisible()
    await expect(customer.getByText('Persistent private operational note', { exact: true })).toHaveCount(0)
    page.on('dialog', d => d.accept())
    await selectWorkspace(page, banking ? QALO_WORKSPACE_ID : ENL_WORKSPACE_ID)
    await expect(page.getByText('Persistent operational human reply', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Persistent private operational note', { exact: true })).toHaveCount(0)
    await customer.reload()
    if (banking) await customer.getByRole('button', { name: 'Open eNL chat' }).click()
    await expect(customer.getByText('Persistent operational human reply', { exact: true })).toBeVisible()
  })
}

test('floating Qalo widget suppresses its pending timer after takeover and restores its session', async ({ page, context }) => {
  await page.goto('/customer-preview')
  await page.getByRole('button', { name: 'Open support chat' }).click()
  await page.getByRole('button', { name: 'General & Technical Support', exact: true }).click()
  const agent = await context.newPage()
  await agent.goto('/inbox')
  await agent.getByRole('button', { name: /Website Visitor/ }).click()
  await expect(agent.getByLabel('Write a customer reply')).toBeDisabled()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 60_000))
  await page.getByLabel('Your message').fill('A pending fictional question')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await page.clock.runFor(100)
  await agent.getByRole('button', { name: 'Assign to me', exact: true }).click()
  await page.clock.fastForward(1500)
  await page.clock.resume()
  await expect(page.getByRole('log').getByText(/Which page are you using/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Request human agent' })).toBeDisabled()
  await page.reload()
  await page.getByRole('button', { name: 'Open support chat' }).click()
  await expect(page.getByRole('log').getByText('A pending fictional question', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request human agent' })).toBeDisabled()
})
