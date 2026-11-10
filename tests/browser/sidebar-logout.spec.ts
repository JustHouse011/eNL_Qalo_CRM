import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { selectWorkspace } from '../helpers/workspaceSelector'
import { QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'

test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(90000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  page.on('dialog', d => d.accept())
})

test('banking extras and disclaimer are removed while both core dashboards and reports remain', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/overview', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.dashboard-kpi')).toHaveCount(4)
  await expect(page.locator('.dashboard-footnote')).toContainText('Support records in the current workspace')
  await selectWorkspace(page, ENL_WORKSPACE_ID)
  await expect(page.locator('.overview-dashboard.dashboard-bank')).toBeVisible()
  await expect(page.getByText(/Additional banking indicators/i)).toHaveCount(0)
  await expect(page.getByText(/Banking support records only/)).toHaveCount(0)
  await expect(page.locator('.dashboard-extra,.dashboard-footnote')).toHaveCount(0)
  await expect(page.locator('.dashboard-kpi')).toHaveCount(4)
  await expect(page.getByRole('heading', { name: 'Agent workload', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '30 days', exact: true }).click()
  await page.getByRole('button', { name: 'Clear date filters', exact: true }).click()
  await page.goto('/reports', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Reports & Analytics', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export report', exact: true })).toBeVisible()
})

for (const workspace of [QALO_WORKSPACE_ID, ENL_WORKSPACE_ID]) test(`persistent sidebar logout clears session and blocks reload, Back and direct access: ${workspace}`, async ({ page }) => {
  test.setTimeout(180000)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/inbox', { waitUntil: 'domcontentloaded' })
  await page.goto('/overview', { waitUntil: 'domcontentloaded' })
  if (workspace === ENL_WORKSPACE_ID) await selectWorkspace(page, workspace)
  const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' }), logout = sidebar.getByRole('button', { name: 'Log Out', exact: true })
  await expect(logout).toBeVisible(); await expect(sidebar.locator('.agent-mini')).toHaveCount(0)
  const y = (await logout.boundingBox())!.y
  await page.getByRole('navigation', { name: 'Main navigation' }).evaluate(el => { el.scrollTop = el.scrollHeight })
  await page.locator('.overview-dashboard').evaluate(el => { el.scrollTop = el.scrollHeight })
  expect((await logout.boundingBox())!.y).toBeCloseTo(y, 0)
  const side = (await sidebar.boundingBox())!, button = (await logout.boundingBox())!
  expect(button.y + button.height).toBeLessThan(side.y + side.height)
  expect(side.y + side.height - button.y - button.height).toBeLessThan(25)
  mkdirSync('test-results', { recursive: true })
  for (const theme of ['dark', 'light']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true }); if (await toggle.count()) await toggle.click()
    await page.screenshot({ path: `test-results/logout-${workspace}-${theme}.png`, animations: 'disabled' })
  }
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await logout.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Log Out')
  await expect(logout.locator('span')).toBeHidden()
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots)
  await logout.click()
  await expect(page).toHaveURL(new RegExp(workspace === ENL_WORKSPACE_ID ? '/enl/signin$' : '/qalo/signin$'))
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible()
  await expect(sidebar).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('qalo-profile-preview'))).toBe('signed-out')
  expect(await page.evaluate(() => sessionStorage.getItem('qalo-developer-user'))).toBeNull()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qalo-workspaces-v2')!).snapshots)).toEqual(before)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(sidebar).toHaveCount(0)
  await page.goBack({ waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/(?:qalo|enl)\/signin/)
  await page.goto('/inbox', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/(?:qalo|enl)\/signin/); await expect(sidebar).toHaveCount(0)
  await page.getByLabel('Email address', { exact: true }).fill('bongani.nombamba@enlbank.co.za')
  await page.getByLabel('Password', { exact: true }).fill('12345678')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  const code = await page.getByTestId('email-preview-code').innerText()
  await page.getByRole('textbox', { name: 'One-time code', exact: true }).fill(code)
  await page.getByRole('button', { name: 'Verify code', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Switch workspace', exact: true })).toHaveAttribute('data-workspace-id', workspace)
  expect(errors).toEqual([])
})

test('mobile and tablet logout stays accessible; storage errors do not falsely sign out', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/overview', { waitUntil: 'domcontentloaded' })
  await page.setViewportSize({ width: 900, height: 900 })
  const logout = page.getByRole('button', { name: 'Log Out', exact: true })
  await expect(logout).toBeVisible(); await expect(logout.locator('span')).toBeHidden()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(logout).toBeVisible(); await expect(logout.locator('span')).toBeVisible()
  const b = (await logout.boundingBox())!; expect(b.y + b.height).toBeLessThanOrEqual(844)
  await page.getByRole('navigation', { name: 'Main navigation' }).evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect(logout).toBeVisible()
  await page.screenshot({ path: 'test-results/logout-mobile.png', animations: 'disabled' })
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage && key === 'qalo-profile-preview' && value === 'signed-out') throw new Error('Blocked storage')
      return original.call(this, key, value)
    }
  })
  await logout.click()
  await expect(page.getByRole('alert')).toContainText('Sign-out could not be saved')
  await expect(logout).toBeEnabled(); await expect(page).toHaveURL(/\/overview$/)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await page.getByRole('button', { name: 'Log Out', exact: true }).click()
  await expect(page).toHaveURL(/\/(?:qalo|enl)\/signin$/)
})

test('restored browser pages recheck the signed-out session marker', async ({ page }) => {
  await page.goto('/inbox', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Log Out', exact: true })).toBeVisible()
  await page.evaluate(() => {
    sessionStorage.setItem('qalo-profile-preview', 'signed-out')
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await expect(page).toHaveURL(/\/(?:qalo|enl)\/signin/)
  await expect(page.getByRole('complementary', { name: 'Workspace navigation' })).toHaveCount(0)
})
