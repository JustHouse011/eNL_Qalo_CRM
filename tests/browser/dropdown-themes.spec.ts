import { existsSync, mkdirSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { selectWorkspace } from '../helpers/workspaceSelector'
import { QALO_WORKSPACE_ID } from '../../src/lib/workspaceTypes'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
if (process.platform === 'win32' && existsSync(edge)) test.use({ launchOptions: { executablePath: edge } })
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
})
async function theme(page: Page, mode: 'dark' | 'light') {
  const button = page.getByRole('button', { name: `Switch to ${mode} theme`, exact: true })
  if (await button.count()) await button.click()
  await expect(page.locator('.app-shell').first()).toHaveClass(mode === 'light' ? /theme-light/ : /^(?!.*theme-light)/)
}
function contrast(text: number[], background: number[]) {
  const luminance = (rgb: number[]) => rgb.slice(0, 3).reduce((sum, value, index) => { const v = value / 255; return sum + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index] }, 0)
  const a = luminance(text), b = luminance(background)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}
async function menuColours(page: Page) {
  return page.locator('.workspace-select-menu:popover-open').evaluate(panel => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')!
    const colour = (text: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = text; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data] }
    const background = colour(getComputedStyle(panel).backgroundColor)
    return { background, options: [...panel.querySelectorAll('[role=option]')].map(option => { const style = getComputedStyle(option), own = colour(style.backgroundColor); return { text: option.getAttribute('aria-label'), colour: colour(style.color), background: own[3] ? own : background, disabled: option.getAttribute('aria-disabled') } }) }
  })
}
test('workspace popup is opaque, readable and selected in both themes and both workspaces', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  const combo = page.getByRole('combobox', { name: 'Switch workspace', exact: true })
  await expect(combo).toBeVisible()
  mkdirSync('test-results', { recursive: true })
  for (const mode of ['dark', 'light'] as const) {
    await theme(page, mode)
    for (const [id, name] of [[QALO_WORKSPACE_ID, 'Qalo Ya Afrika'], [ENL_WORKSPACE_ID, 'eNL Mutual Bank']]) {
      if (await combo.getAttribute('data-workspace-id') !== id) await selectWorkspace(page, id)
      await expect(combo).toHaveAttribute('data-workspace-id', id)
      await combo.click()
      await expect(page.getByRole('listbox', { name: 'Available workspaces' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Qalo Ya Afrika', exact: true })).toBeVisible()
      await expect(page.getByRole('option', { name: 'eNL Mutual Bank', exact: true })).toBeVisible()
      await expect(page.getByRole('option', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
      const colours = await menuColours(page)
      expect(colours.background[3]).toBe(255)
      expect(colours.options).toHaveLength(2)
      for (const option of colours.options) { expect(contrast(option.colour, option.background), `${mode} ${option.text}`).toBeGreaterThanOrEqual(4.5); expect(option.disabled).not.toBe('true') }
      const other = page.getByRole('option', { name: name === 'Qalo Ya Afrika' ? 'eNL Mutual Bank' : 'Qalo Ya Afrika', exact: true })
      await other.hover()
      await expect(other).toHaveAttribute('data-active', 'true')
      const hovered = await menuColours(page)
      for (const option of hovered.options) expect(contrast(option.colour, option.background)).toBeGreaterThanOrEqual(4.5)
      const box = (await page.getByRole('listbox').boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(1440)
      expect(await page.getByRole('listbox').evaluate(panel => { const box = panel.getBoundingClientRect(); return panel.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) })).toBe(true)
      await page.screenshot({ path: `test-results/workspace-selector-${mode}-${id}.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      await expect(combo).toHaveAttribute('aria-expanded', 'false')
      await expect(combo).toBeFocused()
    }
  }
  expect(errors).toEqual([])
})
test('keyboard selection, cancellation, typeahead, Tab and outside dismissal preserve switching behaviour', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/inbox?conversation=conv-1', { waitUntil: 'domcontentloaded' })
  const combo = page.getByRole('combobox', { name: 'Switch workspace', exact: true })
  const reply = page.getByLabel('Write a customer reply')
  await reply.fill('Keep this unsent Qalo reply')
  await combo.focus(); await page.keyboard.press('Space')
  await expect(combo).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('End')
  expect(await combo.evaluate(button => document.getElementById(button.getAttribute('aria-activedescendant')!)?.getAttribute('data-workspace-id'))).toBe(ENL_WORKSPACE_ID)
  page.once('dialog', dialog => dialog.dismiss())
  await page.keyboard.press('Enter')
  await expect(reply).toHaveValue('Keep this unsent Qalo reply')
  await expect(combo).toHaveAttribute('data-workspace-id', QALO_WORKSPACE_ID)
  await combo.press('ArrowDown'); await page.keyboard.press('ArrowDown')
  page.once('dialog', dialog => dialog.accept())
  await page.keyboard.press('Space')
  await expect(combo).toHaveAttribute('data-workspace-id', ENL_WORKSPACE_ID)
  await expect(page).toHaveURL(/\/inbox$/)
  await combo.focus(); await page.keyboard.press('q')
  page.once('dialog', dialog => dialog.accept())
  await page.keyboard.press('Enter')
  await expect(combo).toHaveAttribute('data-workspace-id', QALO_WORKSPACE_ID)
  await expect(reply).toHaveValue('')
  await combo.click(); await page.keyboard.press('Home'); await page.keyboard.press('Escape')
  await expect(combo).toBeFocused()
  await combo.click(); await page.keyboard.press('Tab')
  await expect(combo).toHaveAttribute('aria-expanded', 'false')
  await combo.click(); await page.getByLabel('Write a customer reply').click()
  await expect(combo).toHaveAttribute('aria-expanded', 'false')
  await expect(reply).toBeFocused()
})
test('native dropdown colours are shared by department, business, dashboard, inbox, visitors and settings filters', async ({ page }) => {
  test.setTimeout(150000)
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  for (const mode of ['dark', 'light'] as const) {
    await theme(page, mode)
    for (const route of ['/visitors', '/inbox', '/overview', '/widget', '/settings']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('h1').first()).toBeVisible()
      const styles = await page.locator('.app-shell select').evaluateAll(selects => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d')!
        const rgba = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data] }
        return selects.filter(select => select.getClientRects().length).map(select => ({ scheme: getComputedStyle(select).colorScheme, label: select.getAttribute('aria-label'), options: [...select.querySelectorAll('option:not(:disabled)')].map(option => ({ colour: rgba(getComputedStyle(option).color), background: rgba(getComputedStyle(option).backgroundColor) })) }))
      })
      expect(styles.length, route).toBeGreaterThan(0)
      for (const select of styles) {
        expect(select.scheme, `${route} ${select.label}`).toBe(mode)
        for (const option of select.options) { expect(option.background[3], `${route} ${select.label}`).toBe(255); expect(contrast(option.colour, option.background), `${route} ${select.label}`).toBeGreaterThanOrEqual(4.5) }
      }
    }
  }
})
test('compact and mobile popup stays within the viewport and permissions still filter workspaces', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await theme(page, 'dark')
  const combo = page.getByRole('combobox', { name: 'Switch workspace', exact: true })
  await page.setViewportSize({ width: 900, height: 900 })
  await combo.click()
  await expect(page.getByRole('option', { name: 'eNL Mutual Bank', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/workspace-selector-compact.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await combo.click()
  await expect(page.getByRole('option', { name: 'eNL Mutual Bank', exact: true })).toBeVisible()
  const bounds = (await page.getByRole('listbox').boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/workspace-selector-mobile.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/dev/session', { waitUntil: 'domcontentloaded' })
  await page.getByRole('combobox', { name: 'Account', exact: true }).selectOption('user-enl-refiloe-demo')
  await page.getByRole('button', { name: 'Start session', exact: true }).click()
  await page.goto('/visitors', { waitUntil: 'domcontentloaded' })
  await expect(combo).toBeDisabled()
  await expect(combo).toHaveAttribute('data-workspace-id', ENL_WORKSPACE_ID)
  await expect(page.locator('.workspace-select-option')).toHaveCount(1)
  await expect(page.locator('.workspace-select-option')).toHaveAttribute('data-workspace-id', ENL_WORKSPACE_ID)
})
