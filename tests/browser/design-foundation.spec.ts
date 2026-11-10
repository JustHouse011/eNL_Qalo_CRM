import { selectWorkspace } from '../helpers/workspaceSelector'
import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
const artifacts = resolve('.local-data/d1-review')
async function typography(page: import('@playwright/test').Page) {
  await page.evaluate(() => Promise.all([document.fonts.load('300 14px Inter'), document.fonts.load('400 14px Inter')]))
  const violations = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').flatMap(el => {
    const style = getComputedStyle(el)
    return style.fontFamily.startsWith('Inter') && ['300', '400'].includes(style.fontWeight) ? [] : [{ tag: el.tagName, class: el.className?.toString(), family: style.fontFamily, weight: style.fontWeight }]
  }))
  expect(violations).toEqual([])
}
for (const width of [390, 768, 900, 1440, 1920]) {
  test(`D1 shell, fonts, themes and workspace branding at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/overview')
    await mkdir(artifacts, { recursive: true })
    page.on('dialog', d => d.accept())
    for (const [workspace, id] of [['qalo', 'workspace-qalo'], ['enl', ENL_WORKSPACE_ID]]) {
      if (width <= 820) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
      await selectWorkspace(page, id)
      // A workspace change remounts the shell and closes the drawer; selecting the current one does not.
      if (await page.getByRole('dialog', { name: 'Workspace navigation' }).count()) await page.keyboard.press('Escape')
      await expect(page.locator('.crumb-workspace')).toContainText(workspace === 'qalo' ? 'Qalo' : 'eNL')
      for (const theme of ['light', 'dark'] as const) {
        const shell = page.locator('.app-shell').first()
        if ((await shell.getAttribute('class'))!.includes('theme-light') !== (theme === 'light')) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
        await typography(page)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const topbar = await page.locator('.topbar').boundingBox()
        expect(topbar!.x).toBeGreaterThan(0)
        expect(topbar!.y).toBeGreaterThan(0)
        await expect(page.getByRole('button', { name: 'Profile menu', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: /Switch to .* theme/ })).toBeVisible()
        if (width > 820) {
          expect((await page.locator('.sidebar').boundingBox())!.x).toBe(12)
          await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeHidden()
        }
        await expect(page.locator('.nav-link.active')).toHaveCSS('background-image', /^linear-gradient/)
        await expect(page.locator('.nav-link.active')).toHaveCSS('color', 'rgb(255, 255, 255)')
        const background = await shell.evaluate(el => getComputedStyle(el).backgroundColor)
        const palette = workspace === 'qalo'
          ? { light: 'rgb(241, 243, 248)', dark: 'rgb(9, 9, 15)' }
          : { light: 'rgb(241, 242, 250)', dark: 'rgb(8, 14, 40)' }
        expect(background).toBe(palette[theme])
        const animations = await page.locator('.glow-orb').evaluateAll(els => els.map(el => getComputedStyle(el).animationName))
        expect(animations).toEqual(['none', 'none', 'none'])
        await page.screenshot({ path: resolve(artifacts, `${workspace}-${theme}-${width}.png`) })
      }
    }
  })
}
test('D1 mobile drawer keyboard focus, profile menu and theme persistence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/overview')
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
  await opener.click()
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' })
  await expect(drawer).toBeVisible()
  await page.screenshot({ path: resolve(artifacts, 'mobile-navigation-390.png') })
  await expect(opener).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Shift+Tab')
  expect(await drawer.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
  await page.getByRole('button', { name: 'Profile menu', exact: true }).click()
  await expect(page.getByRole('button', { name: 'My Access', exact: true })).toBeVisible()
  await expect(page.getByLabel('Switch account')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
  await page.goto('/account/profile'); await typography(page)
  await page.goto('/platform'); await typography(page)
  await page.goto('/signin'); await typography(page)
})

test('D1 ambient motion respects the personal reduced-motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/account/preferences')
  await expect(page.locator('.glow-orb').first()).toHaveCSS('animation-name', 'd1-float')
  await page.getByLabel('Reduced motion', { exact: true }).check()
  await expect(page.locator('.glow-orb').first()).toHaveCSS('animation-name', 'none')
  await page.getByLabel('Reduced motion', { exact: true }).uncheck()
  await expect(page.locator('.glow-orb').first()).toHaveCSS('animation-name', 'd1-float')
  await page.evaluate(() => { document.documentElement.dataset.documentHidden = 'true' })
  await expect(page.locator('.glow-orb').first()).toHaveCSS('animation-play-state', 'paused')
})
