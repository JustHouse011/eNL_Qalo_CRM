import { selectWorkspace } from '../helpers/workspaceSelector'
import { existsSync, mkdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { createVisitorFixtures, advanceVisitorFixtures } from '../../src/lib/liveVisitorsFixtures'
import { createVisitorSimulator } from '../../src/lib/liveVisitorsSimulator'
import { visitorHistory, visitorRange, visitorSummary, visitorTimeline } from '../../src/lib/visitorAnalytics'
import { QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
if (process.platform === 'win32' && existsSync(edge)) test.use({ launchOptions: { executablePath: edge } })
const now = Date.parse('2026-11-06T14:30:00+02:00')

for (const [workspaceId, live, visitors, views, answered, missed, sentiment, engagement, availability] of [
  [QALO_WORKSPACE_ID, 18, 247, 683, 32, 4, 91.5, 68.2, 96.4],
  [ENL_WORKSPACE_ID, 34, 518, 1246, 76, 8, 94.2, 73.6, 98.1],
] as const) test(`fixture metrics and all chart filters are consistent for ${workspaceId}`, () => {
  const data = createVisitorFixtures(workspaceId, now)
  const summary = visitorSummary(data, now)
  expect(summary).toMatchObject({ active: live, visitors, pageViews: views, chats: { answered, missed } })
  expect(summary.sentiment).toBeCloseTo(sentiment, 1)
  expect(summary.engagement).toBeCloseTo(engagement, 1)
  expect(summary.availability).toBeCloseTo(availability, 1)
  expect(data.sessions.length).toBeGreaterThanOrEqual(40)
  expect(data.sessions.every(s => s.workspaceId === workspaceId && !/demo visitor/i.test(s.name))).toBe(true)
  expect(data.sessions.every(s => s.country && s.device && s.browser && s.operatingSystem && s.firstSeenAt && s.lastSeenAt)).toBe(true)
  for (const range of ['live', '30m', 'hour', 'today', '7days', 'custom'] as const) {
    const points = visitorTimeline(data, visitorRange(range, now, '2026-11-04', '2026-11-06'))
    expect(points.length).toBeGreaterThan(1)
    expect(points.length).toBeLessThanOrEqual(241)
    expect(points.at(-1)!.visitors).toBe(live)
  }
  const updated = advanceVisitorFixtures(data, 1, now + 6000)
  expect(visitorSummary(updated, now + 6000).active).toBe(live + 1)
  expect(visitorSummary(updated, now + 6000).pageViews).toBe(views + 1)
  expect(visitorTimeline(updated, visitorRange('live', now + 6000)).at(-1)!.visitors).toBe(live + 1)
  expect(data.pageViews.length + 1).toBe(updated.pageViews.length)
  const online = visitorHistory(data, { search: '', status: 'online', sort: 'recent', page: 1, pageSize: 50 }, now)
  expect(online.total).toBeGreaterThan(0)
  expect(visitorHistory(data, { search: '', status: 'in-chat', sort: 'recent', page: 1, pageSize: 50 }, now).total).toBeGreaterThan(0)
  const last = visitorHistory(data, { search: '', status: 'all', sort: 'recent', page: 2, pageSize: 10 }, now)
  expect(last.page).toBe(2); expect(last.rows).toHaveLength(10)
})

test('simulator is isolated, deterministic, pausable and releases timers on unsubscribe or hidden pages', async () => {
  let time = now, visible = true, nextId = 0
  const timers = new Map<number, () => void>(), visibility = new Set<() => void>()
  let authorized = 0
  const source = createVisitorSimulator((_id, actor) => { authorized++; if (actor !== 'authorized') throw new Error('Forbidden') }, {
    now: () => time, visible: () => visible,
    every: tick => { const id = ++nextId; timers.set(id, tick); return id }, cancel: id => { timers.delete(id as number) },
    onVisibility: changed => { visibility.add(changed); return () => { visibility.delete(changed) } },
  })
  const signal = new AbortController().signal
  await expect(source.read(ENL_WORKSPACE_ID, 'unauthorized', signal)).rejects.toThrow('Forbidden')
  const initial = await source.read(QALO_WORKSPACE_ID, 'authorized', signal)
  let qaloChanges = 0, bankChanges = 0
  const stopQalo = source.subscribe(QALO_WORKSPACE_ID, () => qaloChanges++)
  const stopBank = source.subscribe(ENL_WORKSPACE_ID, () => bankChanges++)
  expect(timers.size).toBe(2)
  time += 6000; for (const tick of [...timers.values()]) tick()
  expect(qaloChanges).toBe(1); expect(bankChanges).toBe(1)
  const qalo = await source.read(QALO_WORKSPACE_ID, 'authorized', signal)
  const bank = await source.read(ENL_WORKSPACE_ID, 'authorized', signal)
  expect(qalo.sessions.some(s => bank.sessions.some(b => b.id === s.id))).toBe(false)
  source.setPaused!(QALO_WORKSPACE_ID, true); expect(timers.size).toBe(1)
  time += 6000; for (const tick of [...timers.values()]) tick()
  expect((await source.read(QALO_WORKSPACE_ID, 'authorized', signal)).asOf).toBe(qalo.asOf)
  visible = false; for (const changed of visibility) changed(); expect(timers.size).toBe(0)
  visible = true; for (const changed of visibility) changed(); expect(timers.size).toBe(1)
  source.setPaused!(QALO_WORKSPACE_ID, false); expect(timers.size).toBe(2)
  stopQalo(); stopBank(); expect(timers.size).toBe(0); expect(visibility.size).toBe(0)
  const reset = await source.read(QALO_WORKSPACE_ID, 'authorized', signal)
  expect(visitorSummary(reset, reset.asOf!).active).toBe(visitorSummary(initial, initial.asOf!).active)
  expect(authorized).toBeGreaterThan(0)
})

test('populated local dashboard switches workspaces, previews conversations and pauses activity', async ({ page }) => {
  test.setTimeout(180000)
  page.setDefaultNavigationTimeout(60000); page.setDefaultTimeout(20000)
  page.on('dialog', dialog => dialog.accept())
  const failures: string[] = []; page.on('pageerror', error => failures.push(error.message))
  const requests: string[] = []; page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) || !request.url().startsWith('http://127.0.0.1:5187')) requests.push(request.url()) })
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Demo Data', { exact: true })).toBeVisible()
  const storedSnapshots = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots))
  await page.getByRole('button', { name: 'Pause visitor activity simulation' }).click()
  await expect(page.getByRole('button', { name: 'Resume visitor activity simulation' })).toBeVisible()
  await expect(page.locator('.lv-stat-grid')).toContainText('247')
  await expect(page.locator('.lv-stat-grid')).not.toContainText('Unavailable')
  await expect(page.locator('.lv-history tbody tr')).toHaveCount(10)
  await expect(page.locator('.lv-dashboard')).not.toContainText('Demo Visitor')
  for (const value of ['30m', 'hour', 'today', '7days', 'custom', 'live']) {
    await page.getByRole('combobox', { name: 'Visitor activity period', exact: true }).selectOption(value)
    await expect(page.locator('.lv-chart-wrap .recharts-area-curve')).toBeVisible()
  }
  await page.getByRole('combobox', { name: 'Visitor status', exact: true }).selectOption('in-chat')
  await expect(page.locator('.lv-history tbody tr').first()).toBeVisible()
  await page.locator('.lv-visitor-button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Session duration')
  await page.getByText('Conversation preview', { exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('support information')
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Open Conversation' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('combobox', { name: 'Visitor status', exact: true }).selectOption('all')
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/live-visitors-populated-qalo.png', animations: 'disabled', fullPage: true })
  const qaloValue = await page.locator('.lv-live-count > strong').innerText()
  await selectWorkspace(page, ENL_WORKSPACE_ID)
  await expect(page.locator('.lv-dashboard')).toHaveAttribute('data-workspace', ENL_WORKSPACE_ID)
  await expect(page.locator('.lv-stat-grid')).toContainText('518')
  await page.getByRole('button', { name: 'Pause visitor activity simulation' }).click()
  await expect(page.locator('.lv-stat-grid')).toContainText('98.1%')
  expect(await page.locator('.lv-live-count > strong').innerText()).not.toBe(qaloValue)
  await page.screenshot({ path: 'test-results/live-visitors-populated-enl.png', animations: 'disabled', fullPage: true })
  const before = await page.locator('.lv-stat-grid').getByRole('region', { name: 'Page Views', exact: true }).locator('.lv-stat-value strong').innerText()
  await page.getByRole('button', { name: 'Resume visitor activity simulation' }).click()
  await expect(page.locator('.lv-stat-grid').getByRole('region', { name: 'Page Views', exact: true }).locator('.lv-stat-value strong')).not.toHaveText(before, { timeout: 15000 })
  await page.getByRole('button', { name: 'Pause visitor activity simulation' }).click()
  if (await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).count()) await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
  await page.screenshot({ path: 'test-results/live-visitors-populated-dark.png', animations: 'disabled', fullPage: true })
  for (const width of [900, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/live-visitors-populated-${width}.png`, animations: 'disabled', fullPage: true })
  }
  expect(failures).toEqual([]); expect(requests).toEqual([])
  expect(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots))).toBe(storedSnapshots)
})

test('production builds ignore the local demonstration flag', async ({ page }) => {
  test.skip(process.env.QALO_PREVIEW !== '1', 'Runs against the production preview build only')
  page.setDefaultNavigationTimeout(60000)
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Live tracking unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('.lv-demo-indicator')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /visitor activity simulation/ })).toHaveCount(0)
})
