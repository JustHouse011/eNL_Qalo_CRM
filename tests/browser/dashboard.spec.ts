import { selectWorkspace } from '../helpers/workspaceSelector'
import { test, expect, type Page } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createMockData } from '../../src/data/mockCatalog'
import { dashboardSummary, dashboardActivity, dashboardCsv } from '../../src/lib/dashboardSummary'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
const artifacts = resolve('.local-data/d1-review/d2')

test('dashboard metrics preserve creation ranges, recorded durations, missing ratings and all-time backlog', () => {
  const data = createMockData()
  data.conversations = data.conversations.slice(0, 3).map((c, i) => ({ ...c, createdAt: `2026-10-0${i + 1}T08:00:00Z`, status: i === 2 ? 'resolved' : 'open', resolvedAt: i === 2 ? '2026-10-03T10:00:00Z' : undefined, satisfaction: undefined, assignee: i === 1 ? null : 'Assigned colleague', assigneeId: null, messages: [{ id: `c${i}`, author: 'Customer', text: 'Question', kind: 'customer', time: `2026-10-0${i + 1}T08:00:00Z` }, { id: `a${i}`, author: 'Colleague', text: 'Reply', kind: 'agent', time: `2026-10-0${i + 1}T09:00:00Z` }] }))
  const before = structuredClone(data)
  const all = dashboardSummary(data, '', '', false, [], [])
  const filtered = dashboardSummary(data, '2026-10-02', '2026-10-03', false, [], [])
  expect(filtered.records).toHaveLength(2)
  expect(filtered.open).toBe(1); expect(filtered.unassigned).toBe(1)
  expect(filtered.response).toBe(60); expect(filtered.resolution).toBe(120)
  expect(filtered.satisfaction).toBeNull(); expect(filtered.ratingCount).toBe(0)
  expect(filtered.backlog).toBe(all.backlog)
  const empty = dashboardSummary(data, '2027-01-01', '', false, [], [])
  expect(empty.open).toBe(0); expect(empty.response).toBeNull(); expect(empty.resolution).toBeNull()
  expect(data).toEqual(before)
})
test('activity retains resolution events for conversations created outside the creation filter', () => {
  const data = createMockData(); const c = data.conversations[0]
  const result = dashboardActivity([{ ...c, createdAt: '2026-09-01T08:00:00Z', resolvedAt: '2026-10-02T08:00:00Z', resolutionEvents: ['2026-10-02T08:00:00Z'] }], '2026-10-01', '2026-10-03')
  expect(result.records).toHaveLength(0)
  expect(result.days).toHaveLength(3)
  expect(result.days[1]).toEqual({ date: '2026-10-02', newCases: 0, resolved: 1 })
})
async function switchWorkspace(page: Page, id: string, width: number) {
  if (width <= 820) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await selectWorkspace(page, id)
  if (await page.getByRole('dialog', { name: 'Workspace navigation' }).count()) await page.keyboard.press('Escape')
}
for (const width of [390, 768, 900, 1440, 1920]) {
  test(`D2 reference composition, themes and typography at ${width}px in both workspaces`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 }); await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/overview'); page.on('dialog', d => d.accept()); await mkdir(artifacts, { recursive: true })
    for (const [workspace, id] of [['qalo', 'workspace-qalo'], ['enl', ENL_WORKSPACE_ID]]) {
      await switchWorkspace(page, id, width)
      await expect(page.locator('.dashboard-primary-grid > article')).toHaveCount(4)
      await expect(page.locator('.dashboard-secondary-grid > article')).toHaveCount(6)
      await expect(page.locator('.dashboard-insights-grid > section')).toHaveCount(4)
      if (workspace === 'enl') {
        await expect(page.locator('.dashboard-kpi').filter({ hasText: 'Satisfaction' })).toContainText('Not recorded')
        await expect(page.locator('.dashboard-area-legend')).not.toContainText('Qalo Store')
        await expect(page.getByRole('heading', { name: 'Enquiries by support department' })).toBeVisible()
      }
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('.app-shell').getAttribute('class'))!.includes('theme-light') !== (theme === 'light')) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const columns = await page.locator('.dashboard-primary-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
        expect(columns).toBe(width <= 600 ? 1 : width <= 1250 ? 2 : 4)
        const violations = await page.locator('.overview-dashboard').evaluate(el => Array.from(el.querySelectorAll('*')).filter(n => n.getClientRects().length).flatMap(n => { const s = getComputedStyle(n); return s.fontFamily.startsWith('Inter') && ['300','400'].includes(s.fontWeight) ? [] : [{ node:n.tagName, family:s.fontFamily, weight:s.fontWeight }] }))
        expect(violations).toEqual([])
        await expect(page.locator('.dashboard-kpi').first()).toHaveCSS('animation-name', 'none')
        await page.locator('.overview-dashboard').evaluate(el => { el.scrollTop = 0 })
        await page.screenshot({ path: resolve(artifacts, `${workspace}-${theme}-${width}.png`) })
        if (workspace === 'qalo' && theme === 'light' && width === 1440) {
          await page.getByRole('button', { name: '30 days', exact: true }).click()
          await page.screenshot({ path: resolve(artifacts, 'qalo-light-1440-30days.png') })
          await page.getByRole('button', { name: 'Clear date filters' }).click()
        }
        if (width === 1440 || width === 390) {
          const dashboard = page.locator('.overview-dashboard')
          await dashboard.evaluate(el => { el.scrollTop = el.scrollHeight })
          await page.screenshot({ path: resolve(artifacts, `${workspace}-${theme}-${width}-insights.png`) })
          await dashboard.evaluate(el => { el.scrollTop = 0 })
        }
      }
    }
  })
}
test('D2 presets, creation scope, accessible empty states and CSV export preserve underlying records', async ({ page }) => {
  await page.goto('/overview')
  const initial = await page.evaluate(() => localStorage.getItem('qalo-workspaces-v2'))
  await page.getByRole('button', { name: '30 days', exact: true }).click()
  await page.getByText('View activity data', { exact: true }).click()
  await expect(page.locator('.dashboard-data tbody tr')).toHaveCount(30)
  await page.getByRole('button', { name: '7 days', exact: true }).click()
  await expect(page.locator('.dashboard-data tbody tr')).toHaveCount(7)
  await expect(page.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Clear date filters' }).click()
  const backlog = await page.getByRole('article', { name: 'Ticket backlog (all dates)', exact: true }).locator('strong').textContent()
  await page.getByRole('button', { name: /^From / }).click()
  const picker = page.getByRole('dialog', { name: 'From date picker' })
  await picker.getByRole('button', { name: 'Next month' }).click()
  const futureLabel = await page.evaluate(() => { const d = new Date(); const next = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 15, 12)); return new Intl.DateTimeFormat('en-ZA', { timeZone:'UTC', weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(next) })
  await picker.getByRole('button', { name: futureLabel, exact: true }).click()
  await expect(page.getByRole('article', { name: 'Open conversations', exact: true }).locator('strong')).toHaveText('0')
  await expect(page.getByRole('article', { name: 'First response time', exact: true })).toContainText('Not recorded')
  await expect(page.getByRole('article', { name: 'Ticket backlog (all dates)', exact: true }).locator('strong')).toHaveText(backlog!)
  await expect(page.getByText('No support activity in this date range.', { exact: true })).toBeVisible()
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export report', exact: true }).click()
  const file = await download; expect(file.suggestedFilename()).toBe('support-report.csv')
  const csv = await readFile((await file.path())!, 'utf8')
  expect(csv).toContain('"Open conversations","0"'); expect(csv).toContain('Not recorded'); expect(csv).toContain('Ticket backlog (all dates)')
  expect(await page.evaluate(() => localStorage.getItem('qalo-workspaces-v2'))).toBe(initial)
})
test('D2 workspace switch resets date controls and maintains eNL export and scoped agents', async ({ page }) => {
  await page.goto('/overview'); page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: '30 days', exact: true }).click()
  await switchWorkspace(page, ENL_WORKSPACE_ID, 1280)
  await expect(page.getByRole('button', { name: '30 days', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.dashboard-workload')).not.toContainText('Tumo Likotsi')
  await page.getByRole('button', { name: /^From / }).click()
  await expect(page.getByRole('dialog', { name: 'From date picker' })).toBeVisible(); await page.keyboard.press('Escape')
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export banking report', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('enl-support-report.csv')
  await page.getByLabel('Department filter').selectOption(`${ENL_WORKSPACE_ID}:department:6`)
  await expect(page.locator('.dashboard-donut-total strong')).toHaveText('1')
})


test('dashboard CSV escapes quotes, newlines and whitespace-prefixed spreadsheet formulas', () => {
  const csv = dashboardCsv([['Category', 'Count'], [' =HYPERLINK("https://example.invalid")', 1], ['\t+SUM(1,2)', 2], ['Normal, label', 3]])
  expect(csv).toContain('"\' =HYPERLINK(""https://example.invalid"")"')
  expect(csv).toContain('"\'\t+SUM(1,2)"')
  expect(csv).toContain('"Normal, label","3"')
})
