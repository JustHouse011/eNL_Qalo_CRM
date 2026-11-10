import { expect, test, type Locator } from '@playwright/test'
import { selectWorkspace } from '../helpers/workspaceSelector'
import { ENL_WORKSPACE_ID } from '../../src/lib/workspaceTypes'

test.use({ actionTimeout: 12000 })

async function expectUnderline(field: Locator) {
  await expect(field).toBeVisible()
  for (const side of ['top', 'left', 'right']) await expect(field).toHaveCSS(`border-${side}-width`, '0px')
  await expect(field).toHaveCSS('border-bottom-width', '1px')
  await expect(field).toHaveCSS('border-radius', '0px')
}

async function expectTokenColor(field: Locator, token: string) {
  expect(await field.evaluate((control, tokenName) => {
    const swatch = document.createElement('span')
    swatch.style.color = `var(${tokenName})`
    control.parentElement!.append(swatch)
    const sameColor = getComputedStyle(control).borderBottomColor === getComputedStyle(swatch).color
    swatch.remove()
    return sameColor
  }, token)).toBe(true)
}

test('shared CRM fields preserve search, date validation and picker surfaces across themes', async ({ page }) => {
  test.setTimeout(120000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/reports')
  const search = page.getByRole('textbox', { name: 'Search inbox', exact: true })
  const searchGroup = page.locator('.global-search')
  await expectUnderline(searchGroup)
  await expect(search).toHaveCSS('border-bottom-width', '0px')
  const shortcut = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'
  await page.keyboard.press(shortcut)
  await expect(search).toBeFocused()
  await expectTokenColor(searchGroup, '--crm-control-accent')
  const before = (await searchGroup.boundingBox())!.height
  await search.fill('Help')
  await expect(page).toHaveURL(/\/inbox$/)
  expect((await searchGroup.boundingBox())!.height).toBe(before)
  await search.clear()

  await page.goto('/reports')
  const dateRange = page.getByRole('combobox', { name: 'Date range', exact: true })
  await expectUnderline(dateRange)
  await expect(dateRange).toHaveCSS('background-image', /data:image\/svg\+xml/)
  await dateRange.selectOption('custom')
  const from = page.getByLabel('From', { exact: true })
  const to = page.getByLabel('To', { exact: true })
  await expectUnderline(from)
  await from.fill('2026-11-11')
  await to.fill('2026-11-01')
  await expect(from).toHaveAttribute('aria-invalid', 'true')
  await expect(from).toHaveAccessibleDescription(/From must be on or before To/)
  await expectTokenColor(from, '--error-text')
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await page.goto('/overview')
  const calendarTrigger = page.locator('.report-date-trigger').first()
  await expectUnderline(calendarTrigger)
  await calendarTrigger.click()
  const calendar = page.getByRole('dialog', { name: /From date picker/ })
  await expect(calendar).toBeVisible()
  await expect(calendar).toHaveCSS('border-top-width', '1px')
  await calendar.getByRole('button', { name: 'Today', exact: true }).click()

  page.once('dialog', dialog => dialog.accept())
  const switcher = page.getByRole('combobox', { name: 'Switch workspace', exact: true })
  await expectUnderline(switcher)
  await selectWorkspace(page, ENL_WORKSPACE_ID)
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.goto('/reports')
  await expectUnderline(dateRange)
  await dateRange.focus()
  await expectTokenColor(dateRange, '--crm-control-accent')
  await page.setViewportSize({ width: 390, height: 844 })
  await searchGroup.click()
  await expect(search).toBeFocused()
  await search.fill('card')
  await expect(page).toHaveURL(/\/inbox$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

test('directory and agent drawers show validation, disabled and editable form states', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/contacts')
  const searchGroup = page.locator('.crm-search')
  await expectUnderline(searchGroup)
  const search = page.getByRole('textbox', { name: 'Search contacts' })
  await search.fill('nonexistent directory query')
  await expect(page.getByText(/No records match/i)).toBeVisible()
  await search.clear()
  await page.getByRole('button', { name: 'New contact' }).click()
  const drawer = page.getByRole('dialog')
  const name = drawer.getByRole('textbox', { name: 'Full name', exact: true })
  await expectUnderline(name)
  await drawer.getByRole('button', { name: 'Save contact' }).click()
  await expect(name).toHaveAccessibleDescription(/name/i)
  await expectTokenColor(name, '--error-text')
  await name.fill('Form Design Example')
  await drawer.getByRole('combobox', { name: 'Linked organisation' }).selectOption({ index: 1 })
  const organisation = drawer.getByRole('textbox', { name: 'Organisation name', exact: true })
  await expect(organisation).toBeDisabled()
  await expectUnderline(organisation)
  await expect(organisation).toHaveCSS('cursor', 'not-allowed')
  page.once('dialog', dialog => dialog.accept())
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(drawer).toBeHidden()

  await page.goto('/team')
  await page.getByRole('button', { name: 'Add Agent', exact: true }).click()
  await expectUnderline(drawer.getByRole('textbox', { name: 'Full name', exact: true }))
  await expectUnderline(drawer.getByRole('combobox', { name: 'Qalo Ya Afrika role' }))
  const access = drawer.getByRole('checkbox', { name: 'Qalo Ya Afrika', exact: true })
  await expect(access).toBeChecked()
  await expect(access).toHaveCSS('appearance', 'auto')
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.goto('/qalo/signin')
  const login = page.getByLabel('Email address', { exact: true }).locator('..')
  await expectUnderline(login)
  await expect(page.locator('.crm-forms')).toHaveCount(0)
})
