import { selectWorkspace } from '../helpers/workspaceSelector'
import { existsSync, mkdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { createSupportService } from '../../src/lib/supportService'
import { createVisitorRepository } from '../../src/lib/visitorRepository'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'
import { presentProductCopy } from '../../src/lib/productCopy'
import { uniqueSessions, visitorChange, visitorHistory, visitorRange, visitorStatus, visitorSummary, visitorTimeline, type VisitorDataset, type VisitorSession } from '../../src/lib/visitorAnalytics'
import { createMockData } from '../../src/data/mockCatalog'
import type { DemoData } from '../../src/data/demoData'

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
if (process.platform === 'win32' && existsSync(edge)) test.use({ launchOptions: { executablePath: edge } })
const now = Date.parse('2026-11-06T12:00:00+02:00')
function session(id: string, overrides: Partial<VisitorSession> = {}): VisitorSession {
  return { id, workspaceId: QALO_WORKSPACE_ID, sessionId: id, visitorKey: id, name: `Visitor ${id}`, location: 'Johannesburg', page: '/help', source: 'Direct', activity: 'Page viewed', status: 'Active', firstSeenAt: new Date(now - 60000).toISOString(), lastSeenAt: new Date(now).toISOString(), ...overrides }
}
function dataset(): VisitorDataset {
  const conversation = structuredClone(createMockData().conversations[0])
  Object.assign(conversation, { workspaceId: QALO_WORKSPACE_ID, createdAt: new Date(now - 60000).toISOString() })
  conversation.messages = [{ id: 'customer', author: 'Visitor', kind: 'customer', time: new Date(now - 50000).toISOString(), text: 'Please help' }, { id: 'reply', author: 'Agent', kind: 'agent', delivery: 'sent', time: new Date(now - 40000).toISOString(), text: 'I can help' }]
  return { workspaceId: QALO_WORKSPACE_ID, agentNames: ['Agent'], sessions: [session('one')], conversations: [conversation], pageViews: [{ id: 'page-1', workspaceId: QALO_WORKSPACE_ID, sessionId: 'one', visitorKey: 'one', page: '/help', at: new Date(now).toISOString() }], tracking: { state: 'connected', presence: true, visitors: true, pageViews: true, inactivityMs: 120000 } }
}
test('analytics deduplicate visits and events, use comparable periods and never treat pending chats as missed', () => {
  const data = dataset()
  data.sessions.push(session('one', { lastSeenAt: new Date(now - 1000).toISOString() }), session('second-tab', { visitorKey: 'one' }), session('foreign', { workspaceId: ENL_WORKSPACE_ID }))
  data.pageViews.push({ ...data.pageViews[0] }, { ...data.pageViews[0], id: 'foreign-page', workspaceId: ENL_WORKSPACE_ID })
  const pending = { ...data.conversations[0], id: 'pending', status: 'waiting' as const, messages: [data.conversations[0].messages[0]], history: [] }
  data.conversations.push(pending, { ...data.conversations[0] })
  expect(uniqueSessions(data.sessions, QALO_WORKSPACE_ID)).toHaveLength(2)
  const summary = visitorSummary(data, now)
  expect(summary).toMatchObject({ active: 1, visitors: 1, pageViews: 1, chats: { answered: 1, missed: 0 }, availability: null, sentiment: null })
  expect(visitorChange(1, 0)).toBeNull(); expect(visitorChange(0, 0)).toBe(0); expect(visitorChange(2, 4)).toBe(-50)
  data.conversations.push({ ...pending, id: 'missed', history: [{ id: 'missed-event', title: 'Missed', detail: '', when: new Date(now).toISOString(), type: 'conversation-missed' }] })
  expect(visitorSummary(data, now).chats.missed).toBe(1)
  expect(visitorTimeline(data, visitorRange('live', now)).at(-1)?.visitors).toBe(1)
  expect(visitorTimeline(data, visitorRange('custom', now, '2020-01-01', '2030-01-01')).length).toBeLessThanOrEqual(241)
})
test('presence expires, unavailable tracking differs from connected zero, and no percentages are invented', () => {
  const data = dataset()
  expect(visitorStatus(data.sessions[0], data, now + 120001)).toBe('offline')
  expect(visitorStatus({ ...data.sessions[0], endedAt: new Date(now).toISOString() }, data, now)).toBe('offline')
  data.sessions[0].conversationId = data.conversations[0].id
  expect(visitorStatus(data.sessions[0], data, now)).toBe('in-chat')
  data.sessions = []
  expect(visitorSummary(data, now).active).toBe(0)
  expect(visitorTimeline(data, visitorRange('live', now)).every(p => p.visitors === 0)).toBe(true)
  data.tracking = { ...data.tracking, state: 'unavailable', visitors: false, pageViews: false, presence: false }
  expect(visitorSummary(data, now)).toMatchObject({ active: null, visitors: null, pageViews: null, engagement: null })
  expect(visitorTimeline(data, visitorRange('live', now))).toEqual([])
})
test('history combines search, status, dates and sorting with bounded pagination', () => {
  const data = dataset()
  data.sessions = Array.from({ length: 61 }, (_, i) => session(String(i), { name: `Visitor ${String(i).padStart(2, '0')}`, lastSeenAt: new Date(now - i * 1000).toISOString() }))
  const query = { search: '', status: 'all', sort: 'recent' as const, page: 2, pageSize: 10 }
  expect(visitorHistory(data, query, now)).toMatchObject({ total: 61, page: 2, pages: 7, rows: expect.any(Array) })
  expect(visitorHistory(data, { ...query, search: 'Visitor 12', status: 'online' }, now).rows[0].name).toBe('Visitor 12')
  expect(visitorHistory(data, { ...query, sort: 'name', page: 1 }, now).rows[0].name).toBe('Visitor 00')
  expect(visitorHistory(data, { ...query, from: now - 4000, to: now }, now).total).toBe(5)
  expect(visitorHistory(data, { ...query, pageSize: 10000 }, now).pageSize).toBe(50)
  expect(presentProductCopy('Demo Visitor 1')).toBe('Visitor 1')
  expect(presentProductCopy('Demo Visitor 84A2')).toBe('Visitor 84A2')
})
test('repository enforces existing permissions, isolates workspaces and cleans up subscriptions and aborted reads', async () => {
  const values = new Map<string, string>()
  const service = createSupportService(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }))
  service.initializeEnl(platformPreview.id); service.initializeIdentity()
  const source = createVisitorRepository(service)
  const signal = new AbortController().signal
  const qalo = await source.read(QALO_WORKSPACE_ID, 'user-agent-1', signal)
  const bank = await source.read(ENL_WORKSPACE_ID, 'user-agent-1', signal)
  expect(qalo.sessions.every(s => s.workspaceId === QALO_WORKSPACE_ID)).toBe(true)
  expect(bank.sessions.every(s => s.workspaceId === ENL_WORKSPACE_ID)).toBe(true)
  expect(bank.sessions.some(s => qalo.sessions.some(v => v.id === s.id))).toBe(false)
  expect(bank.tracking.state).toBe('unavailable')
  await expect(source.read(ENL_WORKSPACE_ID, 'user-agent-3', signal)).rejects.toThrow('access')
  await expect(source.read(QALO_WORKSPACE_ID, 'missing-user', signal)).rejects.toThrow('access')
  const controller = new AbortController(); controller.abort()
  await expect(source.read(QALO_WORKSPACE_ID, 'user-agent-1', controller.signal)).rejects.toThrow()
  let changes = 0
  const stop = source.subscribe(QALO_WORKSPACE_ID, () => changes++)
  await service.updateWorkspace(ENL_WORKSPACE_ID, d => d); expect(changes).toBe(0)
  await service.updateWorkspace(QALO_WORKSPACE_ID, d => d); expect(changes).toBe(1)
  stop(); await service.updateWorkspace(QALO_WORKSPACE_ID, d => d); expect(changes).toBe(1)
})

test('both workspaces share the functional visitors page in desktop, light, tablet and mobile layouts', async ({ page }) => {
  test.setTimeout(180000)
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000)
  page.on('dialog', d => d.accept())
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/dev/session', { waitUntil: 'domcontentloaded' })
  await page.getByRole('combobox', { name: 'Account', exact: true }).selectOption('user-agent-1')
  await page.getByRole('button', { name: 'Start session', exact: true }).click()
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Live Visitors', level: 1 })).toBeVisible()
  await expect(page.getByText('Live tracking unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('.lv-history tbody tr').first()).toBeVisible()
  await expect(page.locator('.lv-dashboard')).toHaveAttribute('data-workspace', QALO_WORKSPACE_ID)
  if (await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).count()) await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
  await expect(page.locator('.lv-dashboard')).not.toContainText(/demo visitor|latest updates|what.s the latest/i)
  const chart = await page.locator('.lv-chart-panel').boundingBox(), stats = await page.locator('.lv-stat-grid').boundingBox()
  expect(Math.abs(chart!.y - stats!.y)).toBeLessThan(2); expect(Math.abs(chart!.height - stats!.height)).toBeLessThan(2)
  const history = await page.locator('.lv-history').boundingBox()
  expect(history!.width).toBeGreaterThan(chart!.width * 1.9)
  await page.getByLabel('Visitor activity period').selectOption('custom')
  await expect(page.getByLabel('Chart from')).toBeVisible()
  await page.getByLabel('Visitor activity period').selectOption('30m')
  // Test-only records in Playwright's isolated browser profile exercise updates and paging.
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves the browser module by URL.
    const { supportService } = await import('/src/lib/supportService.ts')
    await supportService.updateWorkspace('workspace-qalo', (data: DemoData) => ({ ...data, visitors: [...data.visitors, ...Array.from({ length: 12 }, (_, i) => ({ id: `test-visitor-${i}`, name: `Visitor audit ${String(i).padStart(2, '0')}`, location: 'Johannesburg', page: '/help', source: 'Direct', activity: 'Support enquiry', status: 'Offline', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), country: 'South Africa', countryCode: 'ZA', conversationId: data.conversations[0].id }))] }))
  })
  await expect(page.locator('.lv-history tbody tr')).toHaveCount(10)
  await page.getByRole('button', { name: 'Next visitor page' }).click()
  await expect(page.locator('.lv-pagination')).toContainText('11–14 of 14')
  await page.getByRole('combobox', { name: 'Rows', exact: true }).selectOption('25')
  await expect(page.locator('.lv-history tbody tr')).toHaveCount(14)
  await page.getByRole('combobox', { name: 'History date range', exact: true }).selectOption('today')
  await expect(page.locator('.lv-history tbody tr')).toHaveCount(12)
  await page.getByRole('combobox', { name: 'History date range', exact: true }).selectOption('all')
  await page.getByLabel('Search visitor history').fill('Visitor audit 00')
  await expect(page.locator('.lv-history tbody tr')).toHaveCount(1)
  await page.locator('.lv-visitor-button').first().click()
  await page.getByRole('link', { name: 'Open Conversation', exact: true }).click()
  await expect(page).toHaveURL(/\/inbox\?conversation=/)
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.lv-history tbody tr').first()).toBeVisible()
  const firstName = (await page.locator('.lv-visitor-button').first().innerText()).split('\n').slice(-2)[0]
  const visitorButton = page.locator('.lv-visitor-button').first()
  await visitorButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Visitor overview' })).toBeVisible()
  await page.getByRole('button', { name: 'Prepare invitation', exact: true }).click()
  await expect(page.getByText('Invitation draft prepared')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(visitorButton).toBeFocused()
  await page.getByRole('combobox', { name: 'Visitor status', exact: true }).selectOption('online')
  await expect(page.getByText('No visitors match these filters')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByLabel('Search visitor history').fill('no-such-visitor-qalo')
  await expect(page.getByText('No visitors match these filters')).toBeVisible()
  await page.getByLabel('Search visitor history').fill('')
  await expect(page.locator('.lv-history tbody tr').first()).toBeVisible()
  expect(firstName).toBeTruthy()
  await page.getByLabel('Sort visitor history').selectOption('name')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.locator('.lv-history tbody tr').first()).toBeVisible()
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/live-visitors-qalo-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'More', exact: true }).click()
  await expect(page).toHaveURL(/\/reports$/)
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await selectWorkspace(page, ENL_WORKSPACE_ID)
  await expect(page.locator('.lv-dashboard')).toHaveAttribute('data-workspace', ENL_WORKSPACE_ID)
  await expect(page.locator('.lv-history tbody tr').first()).toBeVisible()
  await expect(page.getByLabel('Search visitor history')).toHaveValue('')
  await expect(page.locator('.lv-dashboard')).not.toContainText(/demo visitor/i)
  await expect(page.locator('.lv-dashboard')).not.toContainText('Visitor audit')
  await page.screenshot({ path: 'test-results/live-visitors-enl-desktop.png', fullPage: true })
  const theme = page.getByRole('button', { name: /Switch to light theme/ })
  if (await theme.count()) await theme.click()
  await page.screenshot({ path: 'test-results/live-visitors-enl-light.png', fullPage: true })
  for (const width of [900, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.lv-history')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/live-visitors-${width}.png`, fullPage: true })
  }
  await page.locator('.lv-visitor-button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(Math.round((await page.getByRole('dialog').boundingBox())!.width)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Close visitor details' }).click()
  expect(errors).toEqual([])
})

test('loading, connection failure, reconnect, connected zero and subscription cleanup are distinct', async ({ page }) => {
  test.setTimeout(120000)
  page.setDefaultNavigationTimeout(60000)
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.lv-history tbody tr').first()).toBeVisible()
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves this test-only module by URL.
    const { mountVisitorHarness } = await import('/tests/helpers/liveVisitorsHarness.tsx')
    ;(window as unknown as { visitorHarness: ReturnType<typeof mountVisitorHarness> }).visitorHarness = mountVisitorHarness()
  })
  await expect(page.getByRole('status', { name: 'Loading visitor dashboard' })).toBeVisible()
  await page.evaluate(() => (window as unknown as { visitorHarness: { set: (mode: string) => void } }).visitorHarness.set('error'))
  await expect(page.getByRole('heading', { name: 'Visitor data unavailable' })).toBeVisible()
  await page.evaluate(() => (window as unknown as { visitorHarness: { set: (mode: string) => void } }).visitorHarness.set('empty'))
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click()
  await expect(page.getByText('No live visitors right now', { exact: true })).toBeVisible()
  await expect(page.getByText('No visitor history yet', { exact: true })).toBeVisible()
  await expect(page.locator('.lv-live-count > strong:visible')).toHaveText('0')
  await page.getByRole('combobox', { name: 'Visitor activity period', exact: true }).selectOption('7days')
  await expect(page.getByText('No visitor activity in this period')).toBeVisible()
  await page.evaluate(() => (window as unknown as { visitorHarness: { set: (mode: string) => void } }).visitorHarness.set('error'))
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('Connection interrupted. Showing the last loaded records.', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { visitorHarness: { subscriptions: () => number } }).visitorHarness.subscriptions())).toBe(1)
  await page.evaluate(() => (window as unknown as { visitorHarness: { unmount: () => void } }).visitorHarness.unmount())
  expect(await page.evaluate(() => (window as unknown as { visitorHarness: { subscriptions: () => number } }).visitorHarness.subscriptions())).toBe(0)
})
