import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { selectWorkspace } from '../helpers/workspaceSelector'
import { createSupportService } from '../../src/lib/supportService'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { ENL_WORKSPACE_ID, QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'
import { scopeWorkspaceData, validateWorkspaceStore } from '../../src/lib/workspaceMigration'
import { agentReport, filterReport, presetRange, previousReportRange, reportMetrics, reportSource, reportTrend, validRange, type ReportFilters } from '../../src/lib/reportDashboard'

const filter: ReportFilters = { area: 'all', department: '', channel: '', agent: '', category: '', product: '' }
const range = { from: '2026-10-01', to: '2026-10-03' }
const administrator = 'user-agent-1'
test.use({ actionTimeout: 12000 })

function fixture() {
  const storage = new Map<string, string>()
  const service = createSupportService(() => ({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }))
  service.initializeEnl(platformPreview.id)
  service.initializeIdentity()
  const store = service.registry()
  const qalo = store.snapshots[QALO_WORKSPACE_ID]
  const agent = qalo.agents.find(item => item.userId === administrator)!
  const community = qalo.departments.find(item => item.area === 'community')!
  const retail = qalo.departments.find(item => item.area === 'store')!
  const resolvedAt = '2026-10-03T07:00:00+02:00'
  const closed = {
    id: 'report-closed-ticket', reference: 'QALO-REPORT-101', workspaceId: QALO_WORKSPACE_ID,
    subject: 'QA reporting fixture', customer: qalo.contacts[0].name, status: 'Resolved' as const, priority: 'normal' as const,
    createdAt: '2026-10-01T00:15:00+02:00', updated: resolvedAt, resolvedAt, resolutionEvents: [resolvedAt, '2026-10-04T07:00:00+02:00'],
    category: 'Reporting fixture', businessArea: 'community' as const, assignee: agent.name, assigneeId: agent.id,
    department: community.name, departmentId: community.id,
    activity: [
      { id: 'report-evt-1', workspaceId: QALO_WORKSPACE_ID, ticketId: 'report-closed-ticket', actorId: administrator, timestamp: resolvedAt, type: 'status-changed', metadata: { to: 'Resolved' } },
      { id: 'report-evt-2', workspaceId: QALO_WORKSPACE_ID, ticketId: 'report-closed-ticket', actorId: administrator, timestamp: resolvedAt, type: 'resolved', metadata: {} },
    ],
  }
  const open = { ...closed, id: 'report-open-ticket', reference: 'QALO-REPORT-102', status: 'Escalated' as const, createdAt: '2026-10-02T09:00:00+02:00', businessArea: 'store' as const,
    department: retail.name, departmentId: retail.id, assignee: 'Unassigned', assigneeId: null, resolvedAt: undefined, resolutionEvents: [], activity: [] }
  const older = { ...open, id: 'report-prior-ticket', reference: 'QALO-REPORT-099', createdAt: '2026-09-28T08:00:00+02:00', status: 'Open' as const }
  qalo.tickets.push(closed, open, older)
  qalo.conversations.push({
    ...qalo.conversations[0], id: 'report-conversation', workspaceId: QALO_WORKSPACE_ID, channel: 'Email', category: 'Reporting fixture',
    department: community.name, departmentId: community.id, assignee: agent.name, assigneeId: agent.id, createdAt: '2026-10-01T09:00:00+02:00', satisfaction: 4,
    messages: [
      { id: 'report-message-late', time: '2026-10-01T09:20:00+02:00', author: agent.name, kind: 'agent', text: 'Staff reply' },
      { id: 'report-message-question', time: '2026-10-01T09:00:00+02:00', author: 'Test visitor', kind: 'customer', text: 'Question' },
      { id: 'report-message-bot', time: '2026-10-01T09:01:00+02:00', author: 'Virtual Assistant', kind: 'agent', text: 'Automated reply' },
      { id: 'report-message-failed', time: '2026-10-01T09:02:00+02:00', author: agent.name, kind: 'agent', delivery: 'failed', text: 'Undelivered reply' },
      { id: 'report-message-answer', time: '2026-10-01T09:08:00+02:00', author: agent.name, kind: 'agent', delivery: 'sent', text: 'Staff reply' },
    ],
  })
  store.snapshots[QALO_WORKSPACE_ID] = scopeWorkspaceData(qalo, QALO_WORKSPACE_ID)
  validateWorkspaceStore(store)
  return { store, agent, community, retail }
}

test('report calculations reconcile dates, events, filters and current workload', () => {
  const { store, agent, community, retail } = fixture()
  const source = reportSource(store, QALO_WORKSPACE_ID, administrator)!
  const bank = reportSource(store, ENL_WORKSPACE_ID, administrator)!
  expect(bank.records.some(record => record.reference.startsWith('QALO-REPORT'))).toBe(false)
  expect(source.records.some(record => record.kind === 'complaint')).toBe(false)
  const records = filterReport(source, filter)
  const tickets = records.filter(record => record.kind === 'ticket')
  const requests = records.filter(record => record.kind === 'conversation')
  const current = reportMetrics(tickets, requests, range)
  expect(current.cohort.map(record => record.reference)).toEqual(['QALO-REPORT-101', 'QALO-REPORT-102'])
  expect(current.resolutions.map(record => record.reference)).toEqual(['QALO-REPORT-101'])
  expect(previousReportRange(range)).toEqual({ from: '2026-09-28', to: '2026-09-30' })
  expect(reportMetrics(tickets, requests, previousReportRange(range)).cohort).toHaveLength(1)
  expect(current.response).toBe(8)
  expect(current.satisfaction).toBe(4)
  expect(reportMetrics([], [], range).satisfaction).toBeUndefined()
  expect(reportTrend(tickets, range).map(({ created, resolved }) => [created, resolved])).toEqual([[1, 0], [1, 0], [0, 1]])
  expect(reportTrend(tickets, { ...range, to: '2026-10-04' }).map(bucket => bucket.resolved)).toEqual([0, 0, 1, 0])
  expect(reportTrend(tickets, { from: '2026-10-01', to: '2026-11-12' })[0].to).toBe('2026-10-07')
  expect(reportTrend(tickets, { from: '2026-09-15', to: '2027-01-30' })[0].to).toBe('2026-09-30')
  expect(presetRange('last-month', '2024-03-20')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  expect(validRange({ from: '2026-02-30', to: '2026-03-04' })).toBe(false)
  expect(filterReport(source, { ...filter, department: community.id, area: 'community', agent: agent.id }).some(record => record.reference === 'QALO-REPORT-101')).toBe(true)
  expect(filterReport(source, { ...filter, department: retail.id, area: 'community' })).toHaveLength(0)
  expect(filterReport(source, { ...filter, channel: 'Email' }).every(record => record.channel === 'Email')).toBe(true)
  const row = agentReport(source.agents, current.cohort, current.requests).find(row => row.agent.id === agent.id)!
  expect([row.assigned, row.resolved, row.open, row.rate, row.response, row.satisfaction]).toEqual([1, 1, 0, 1, 8, 4])
})

test('report reads fail closed for unauthorised workspaces and departments', () => {
  const { store, community, retail } = fixture()
  const snapshot = store.snapshots[QALO_WORKSPACE_ID]
  const member = store.memberships.find(item => item.workspaceId === QALO_WORKSPACE_ID && item.userId === 'user-agent-2')!
  expect(reportSource(store, QALO_WORKSPACE_ID, member.userId)).toBeUndefined()
  member.role = 'supervisor'
  snapshot.agents.find(item => item.userId === member.userId)!.departmentIds = [community.id]
  const scoped = reportSource(store, QALO_WORKSPACE_ID, member.userId)!
  expect(scoped.departments.map(item => item.id)).toEqual([community.id])
  expect(scoped.records.every(record => record.departmentId === community.id)).toBe(true)
  expect(filterReport(scoped, { ...filter, department: retail.id })).toEqual([])
  expect(reportSource(store, ENL_WORKSPACE_ID, member.userId)).toBeUndefined()
  member.status = 'inactive'
  expect(reportSource(store, QALO_WORKSPACE_ID, member.userId)).toBeUndefined()
})

async function customRange(page: Page) {
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('custom')
  await page.getByLabel('From', { exact: true }).fill(range.from)
  await page.getByLabel('To', { exact: true }).fill(range.to)
}

test('Qalo dashboard filters actual records and opens scoped drill-downs', async ({ page }) => {
  test.setTimeout(120000)
  const { store, agent, community } = fixture()
  await page.addInitScript(data => {
    if (!localStorage.getItem('qalo-workspaces-v2')) localStorage.setItem('qalo-workspaces-v2', JSON.stringify(data))
  }, store)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible()
  await customRange(page)
  const total = page.locator('.analytics-kpi').filter({ hasText: 'Total Tickets' })
  await expect(total.locator('strong')).toHaveText('2')
  await expect(total).toContainText('vs. 1')
  await expect(page.locator('.analytics-kpi').filter({ hasText: 'Resolved Tickets' }).locator('strong')).toHaveText('1')
  await expect(page.locator('.analytics-kpi').filter({ hasText: 'Average Response Time' }).locator('strong')).toHaveText('8.0 min')
  await expect(page.locator('.analytics-kpi').filter({ hasText: 'Customer Satisfaction' }).locator('strong')).toHaveText('4.0 / 5')
  await expect(page.getByRole('region', { name: 'Resolution Performance' })).toContainText('50%')
  const trend = page.getByRole('region', { name: 'Ticket Volume Trend' })
  await trend.locator('.recharts-wrapper').hover()
  await expect(trend.locator('.recharts-tooltip-wrapper')).toContainText('Created')
  await total.hover()
  await page.screenshot({ path: 'test-results/reports-qalo-desktop.png', animations: 'disabled' })

  await page.getByRole('combobox', { name: 'Business area', exact: true }).selectOption('community')
  await expect(total.locator('strong')).toHaveText('1')
  await page.getByRole('combobox', { name: 'Department', exact: true }).selectOption(community.id)
  await page.getByRole('combobox', { name: 'Agent', exact: true }).selectOption(agent.id)
  await total.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: 'QALO-REPORT-101' })).toHaveAttribute('href', '/tickets?ticket=report-closed-ticket')
  await expect(dialog.getByText('QALO-REPORT-102')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close report details' }).click()
  await trend.getByText('View trend data').click()
  await trend.getByRole('button', { name: '2026-10-03' }).click()
  await expect(dialog.getByRole('link', { name: 'QALO-REPORT-101' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('Email')
  await expect(total.locator('strong')).toHaveText('0')
  await expect(trend.getByText(/No dated activity/)).toBeVisible()
  await page.getByLabel('From', { exact: true }).fill('2026-10-05')
  await expect(page.getByRole('alert')).toContainText('Enter a valid date range')
  await expect(page.getByRole('button', { name: 'Export report', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await expect(page.getByRole('combobox', { name: 'Business area', exact: true })).toHaveValue('all')
  await expect(page.getByRole('combobox', { name: 'Department', exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Export report', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

test('eNL tabs, scoped export, agent search and workspace RBAC', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/reports')
  page.on('dialog', dialog => dialog.accept())
  await selectWorkspace(page, ENL_WORKSPACE_ID)
  await expect(page.getByRole('tab', { name: 'Support Performance' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Ticket Volume Trend' })).toBeVisible()
  await expect(page.getByText('No rating data', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Business area', exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/reports-enl-desktop.png', animations: 'disabled' })

  await page.getByRole('tab', { name: 'Ticket Reports' }).click()
  await expect(page.getByRole('heading', { name: 'Priority Distribution' })).toBeVisible()
  await page.getByRole('tab', { name: 'Complaints' }).click()
  await page.getByRole('combobox', { name: 'Support category', exact: true }).selectOption('Card dispute')
  await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption('Nala Account')
  await expect(page.getByRole('heading', { name: 'Complaint Volume Trend' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export report', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^enl-mutual-bank-complaints-\d{4}-\d\d-\d\d-to-\d{4}-\d\d-\d\d\.csv$/)
  const csv = await readFile((await file.path())!, 'utf8')
  expect(csv).toContain('"Support category","Card dispute"')
  expect(csv).toContain('"Product","Nala Account"')
  expect(csv).toContain('"Open Investigations","1"')
  expect(csv).not.toContain('Qalo Ya Afrika')
  expect(csv).not.toMatch(/example\.invalid|Card replacement dispute/)
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await page.getByRole('tab', { name: 'Agent Performance' }).click()
  await page.getByLabel('Search report agents').fill('Bongani')
  await expect(page.getByRole('rowheader', { name: /Bongani Nombamba/ })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: /Phindile Khumalo/ })).toHaveCount(0)
  const table = page.getByRole('region', { name: 'Agent Performance', exact: true })
  await table.getByRole('button', { name: 'Resolved', exact: true }).click()
  await expect(table.getByRole('columnheader', { name: 'Resolved' })).toHaveAttribute('aria-sort', 'descending')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('tab', { name: 'Agent Performance' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/reports-enl-mobile-dark.png', animations: 'disabled' })
  expect(errors).toEqual([])

  await page.goto('/dev/session')
  await page.getByRole('combobox', { name: 'Account', exact: true }).selectOption('user-agent-2')
  await page.getByRole('button', { name: 'Start session' }).click()
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export report', exact: true })).toHaveCount(0)
})
