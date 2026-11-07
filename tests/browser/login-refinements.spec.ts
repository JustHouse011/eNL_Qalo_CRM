import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

for (const brand of ['qalo', 'enl']) test(`${brand}: purple artwork, official branding and independently floating masked photographs`, async ({ page }) => {
  test.setTimeout(90000); page.setDefaultNavigationTimeout(90000)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1083, height: 768 })
  await page.goto(`/${brand}/signin`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('img', { name: 'Qalo Ya Afrika', exact: true })).toHaveCount(1)
  await expect(page.getByRole('img', { name: 'eNL Mutual Bank', exact: true })).toHaveCount(brand === 'enl' ? 1 : 0)
  await expect(page.locator('.mosaic-photo')).toHaveCount(4)
  await expect(page.locator('.login-photo-float')).toHaveCount(4)
  for (const image of await page.locator('.login-shell img').all()) await expect.poll(() => image.evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true)
  const palette = await page.locator('.login-page').evaluate(el => {
    const s = getComputedStyle(el)
    return ['--login-bg', '--login-art', '--login-violet', '--login-leaf'].map(name => s.getPropertyValue(name).trim())
  })
  for (const hex of palette) {
    const [r,g,b] = [1,3,5].map(start => parseInt(hex.slice(start, start + 2),16))
    expect(r).toBeGreaterThan(g); expect(b).toBeGreaterThan(g); expect(r/b).toBeGreaterThan(.6)
  }
  const panel = page.locator('.login-panel')
  await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.getByRole('heading', { name: 'Welcome back.', exact: true })).toBeVisible()
  const originalPanel = await panel.boundingBox(), originalMasks = await page.locator('.mosaic-photo').evaluateAll(elements => elements.map(el => ({ left:(el as HTMLElement).offsetLeft,top:(el as HTMLElement).offsetTop,width:(el as HTMLElement).offsetWidth,height:(el as HTMLElement).offsetHeight })))
  mkdirSync('test-results',{recursive:true})
  await page.screenshot({path:`test-results/login-refined-${brand}-desktop.png`,animations:'disabled'})
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addStyleTag({content:'.login-shell,.login-content,.mosaic-photo {animation:none!important}'})
  const movements = await page.locator('.login-photo-float').evaluateAll(elements => elements.map(el => {
    const animation = el.getAnimations()[0]!
    animation.pause(); animation.currentTime=0
    const before=getComputedStyle(el).transform
    animation.currentTime=Number(animation.effect!.getTiming().duration)/2
    return { duration:animation.effect!.getTiming().duration,before,after:getComputedStyle(el).transform }
  }))
  expect(new Set(movements.map(m=>m.duration)).size).toBe(4)
  for (const m of movements) { expect(Number(m.duration)).toBeGreaterThanOrEqual(6000);expect(Number(m.duration)).toBeLessThanOrEqual(12000);expect(m.after).not.toBe(m.before) }
  expect(await panel.boundingBox()).toEqual(originalPanel)
  expect(await page.locator('.mosaic-photo').evaluateAll(elements => elements.map(el => ({left:(el as HTMLElement).offsetLeft,top:(el as HTMLElement).offsetTop,width:(el as HTMLElement).offsetWidth,height:(el as HTMLElement).offsetHeight})))).toEqual(originalMasks)
  await page.getByLabel('Email address',{exact:true}).fill('typing@example.invalid')
  await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('typing@example.invalid')
  await page.emulateMedia({reducedMotion:'reduce'})
  for (const photo of await page.locator('.login-photo-float').all()) await expect(photo).toHaveCSS('animation-name','none')
  await page.setViewportSize({width:390,height:844})
  await expect(page.getByRole('img',{name:'Qalo Ya Afrika',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/login-refined-${brand}-mobile.png`,animations:'disabled'})
  expect(errors).toEqual([])
})
