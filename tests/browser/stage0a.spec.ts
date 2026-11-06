import { selectWorkspace } from '../helpers/workspaceSelector'
import { test, expect, type Page } from '@playwright/test'
import { createSupportService } from '../../src/lib/supportService'
import { addBankingFrontendFixtures } from '../../src/lib/bankingFixtures'
import { bankingProducts, proposedBankingDepartments, workspaceExperience } from '../../src/lib/workspaceExperience'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
import { QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'

async function openBank(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('qalo-profile-preview', 'Platform Super Admin'))
  await page.goto('/overview')
  page.on('dialog', d => d.accept())
  await selectWorkspace(page, ENL_WORKSPACE_ID)
  await expect(page.locator('.crumb-workspace')).toHaveText('eNL Mutual Bank')
}

test('Stage 0A additive fixtures preserve edited data, ownership and deletion intent', async () => {
  const values = new Map<string, string>()
  const service = createSupportService(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }))
  const qalo = await service.readWorkspace(QALO_WORKSPACE_ID)
  service.initializeEnl(platformPreview.id)
  const seeded = service.registry()
  expect(await service.readWorkspace(QALO_WORKSPACE_ID)).toEqual(qalo)
  expect(seeded.snapshots[ENL_WORKSPACE_ID].bankingCases).toHaveLength(18)
  expect(seeded.snapshots[ENL_WORKSPACE_ID].departments.map(d => d.name)).toEqual(expect.arrayContaining(proposedBankingDepartments))
  expect(seeded.snapshots[ENL_WORKSPACE_ID].bankingCases?.filter(c => c.kind === 'application').map(c => c.product)).toEqual([...bankingProducts])
  const old = structuredClone(seeded)
  delete old.snapshots[ENL_WORKSPACE_ID].bankingFrontendVersion
  delete old.snapshots[ENL_WORKSPACE_ID].bankingCases
  old.snapshots[ENL_WORKSPACE_ID].contacts[0].name = 'Preserved custom demo identity'
  old.snapshots[ENL_WORKSPACE_ID].conversations[0].messages[0].text = 'Preserved user-authored support text'
  const upgraded = addBankingFrontendFixtures(old, ENL_WORKSPACE_ID)
  expect(upgraded.changed).toBe(true)
  expect(upgraded.store.snapshots[ENL_WORKSPACE_ID].contacts).toEqual(old.snapshots[ENL_WORKSPACE_ID].contacts)
  expect(upgraded.store.snapshots[ENL_WORKSPACE_ID].conversations).toEqual(old.snapshots[ENL_WORKSPACE_ID].conversations)
  expect(upgraded.store.snapshots[QALO_WORKSPACE_ID]).toEqual(qalo)
  await service.updateWorkspace(ENL_WORKSPACE_ID, d => ({ ...d, bankingCases: [] }))
  service.initializeEnl(platformPreview.id)
  expect((await service.readWorkspace(ENL_WORKSPACE_ID)).bankingCases).toEqual([])
  const before = await service.readWorkspace(ENL_WORKSPACE_ID)
  await expect(service.updateWorkspace(ENL_WORKSPACE_ID, d => ({ ...d, bankingCases: [{ ...seeded.snapshots[ENL_WORKSPACE_ID].bankingCases![0], customerId: qalo.contacts[0].id }] }))).rejects.toThrow(/foreign relationship/)
  expect(await service.readWorkspace(ENL_WORKSPACE_ID)).toEqual(before)
  const config = workspaceExperience(seeded.workspaces.find(w => w.id === ENL_WORKSPACE_ID))
  expect(config.routes).not.toContain('/retail')
  expect(config.routes).toContain('/complaints')
})

test('Stage 0A banking navigation, filters, case persistence and workspace route boundaries', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await openBank(page)
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Orders & products', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Returns & Refunds', exact: true })).toHaveCount(0)
  const qalo = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-qalo']))
  await nav.getByRole('link', { name: 'Accounts & Transactions', exact: true }).click()
  await page.getByRole('group', { name: 'Account support views' }).getByRole('button', { name: 'Transaction Enquiries', exact: true }).click()
  await expect(page.locator('.bank-case-list button')).toHaveCount(2)
  await page.getByRole('group', { name: 'Account support views' }).getByRole('button', { name: 'All', exact: true }).click()
  await page.locator('.bank-case-list button').first().click()
  await page.getByLabel('Case status').selectOption('In Progress')
  await page.getByLabel('Resolution / support notes').fill('Fictional support follow-up recorded for review.')
  await page.getByRole('button', { name: 'Save support case', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('saved locally')
  await page.reload()
  await page.locator('.bank-case-list button').first().click()
  await expect(page.getByLabel('Case status')).toHaveValue('In Progress')
  await expect(page.getByLabel('Resolution / support notes')).toHaveValue('Fictional support follow-up recorded for review.')
  await page.getByLabel('Resolution / support notes').fill('PIN: 1234')
  await page.getByRole('button', { name: 'Save support case', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Remove credentials')
  expect(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-qalo']))).toBe(qalo)
  expect(errors).toEqual([])
})

test('Stage 0A product directory and workspace route boundaries', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await openBank(page)
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  const qalo = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-qalo']))
  await nav.getByRole('link', { name: 'Banking Products', exact: true }).click()
  for (const product of bankingProducts) await expect(page.getByRole('button', { name: new RegExp(product) })).toBeVisible()
  await page.getByRole('button', { name: /iMbewu Savings/ }).click()
  await expect(page.getByRole('heading', { name: 'iMbewu Savings', exact: true })).toBeVisible()
  await selectWorkspace(page, QALO_WORKSPACE_ID)
  await expect(page).toHaveURL(/\/overview$/)
  await expect(nav.getByRole('link', { name: 'Orders & products', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Banking Products', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-qalo']))).toBe(qalo)
  await page.goto('/complaints')
  await expect(page).toHaveURL(/\/overview$/)
  expect(errors).toEqual([])
})

for (const [path, heading] of [['/pipeline', 'Applications & Enquiries'], ['/complaints', 'Complaints & Disputes'], ['/contacts', 'Customers'], ['/tickets', 'Support Tickets'], ['/team', 'Agents & Departments'], ['/reports', 'Reports & Analytics'], ['/visitors', 'Live Visitors']]) test('Stage 0A module ' + heading, async ({ page }) => {
  await openBank(page)
  await page.goto(path)
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
})

test('Stage 0A simulated visitors', async ({ page }) => {
  await openBank(page)
  await page.goto('/visitors')
  await expect(page.getByText('These are not genuine realtime website traffic.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Waiting for Agent', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Demo Visitor 2' })).toBeVisible()
})

test('Stage 0A derived charts and report download', async ({ page }) => {
  await openBank(page)
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Application enquiries', exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export banking report' }).click()
  expect((await download).suggestedFilename()).toBe('enl-support-report.csv')
  await page.getByRole('button', { name: 'Complaints', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Complaint trends', exact: true })).toBeVisible()
})

test('Stage 0A banking business-hours preview link', async ({ page }) => {
  await openBank(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Business Hours', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open customer chat' })).toHaveAttribute('href', '/enl-preview')
})

test('Stage 0A notification preview uses banking terminology', async ({ page }) => {
  await openBank(page)
  await page.goto('/settings')
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Notifications', exact: true }).click()
  await page.getByRole('button', { name: 'Send preview notification', exact: true }).click()
  await expect(page.locator('.notification-preview')).toContainText('Banking Support')
  await expect(page.locator('.notification-preview')).not.toContainText('Community Investment')
})

test('Stage 0A banking themes, reduced motion and keyboard navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openBank(page)
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
  await expect(page.locator('.app-shell')).not.toHaveClass(/theme-light/)
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  // D1 replaces the former solid-white shell with the reference's ambient light foundation.
  expect(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(241, 243, 248)')
  expect(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).getPropertyValue('--brand-purple').trim().toLowerCase())).toBe('#652d8d')
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  const products = page.getByRole('navigation').getByRole('link', { name: 'Banking Products', exact: true })
  await products.focus()
  await expect(products).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Banking Products', exact: true })).toBeVisible()
})

test('Stage 0A filtered ticket creation keeps its editor', async ({ page }) => {
  await openBank(page)
  await page.goto('/tickets')
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'My Tickets', exact: true }).click()
  await page.getByRole('button', { name: 'New ticket', exact: true }).click()
  await expect(page.getByLabel('Subject', { exact: true })).toBeVisible()
  await page.getByLabel('Subject', { exact: true }).fill('Stage 0A filtered support ticket')
  await page.getByRole('button', { name: 'Save ticket', exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-enl-mutual-bank'].tickets.some((t: { subject: string }) => t.subject === 'Stage 0A filtered support ticket'))).toBe(true)
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'All Tickets', exact: true }).click()
  await expect(page.getByRole('button', { name: /Stage 0A filtered support ticket/ })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('Stage 0A filtered support ticket')
})

test('Stage 0A published knowledge view can create a draft', async ({ page }) => {
  await openBank(page)
  await page.goto('/knowledge')
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-enl-mutual-bank'].articles.map((a: { id: string }) => a.id))
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Published', exact: true }).click()
  await page.getByRole('button', { name: 'New article', exact: true }).click()
  await expect(page.getByLabel('Article title', { exact: true })).toHaveValue('Untitled article')
  await page.getByLabel('Article title', { exact: true }).fill('Filtered-view banking draft')
  await page.getByLabel('Article body').fill('Fictional support draft. Official product content requires review.')
  await page.getByRole('button', { name: 'Save article', exact: true }).click()
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(page.getByRole('button', { name: /Filtered-view banking draft/ })).toBeVisible()
  const articles = await page.evaluate(() => JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots['workspace-enl-mutual-bank'].articles)
  expect(articles.map((a: { id: string }) => a.id)).toEqual(expect.arrayContaining(original))
  expect(articles.find((a: { title: string }) => a.title === 'Filtered-view banking draft').published).toBe(false)
})

for (const width of [390, 768, 900, 1440]) test(`Stage 0A eNL layout and navigation at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 })
  await openBank(page)
  await expect(page.getByRole('heading', { name: 'eNL support dashboard' })).toBeVisible()
  // D1 replaces the former solid-white shell with the reference's ambient light foundation.
  expect(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(241, 243, 248)')
  expect(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).getPropertyValue('--brand-purple').trim().toLowerCase())).toBe('#652d8d')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (width <= 820) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  const products = page.getByRole('navigation').getByRole('link', { name: 'Banking Products', exact: true })
  await products.scrollIntoViewIfNeeded()
  await products.click()
  await expect(page.getByRole('heading', { name: 'Banking Products', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/stage0a-products-${width}.png`, fullPage: true })
  await page.goto('/complaints')
  await page.locator('.bank-case-list button').first().click()
  await expect(page.getByLabel('Case status')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
