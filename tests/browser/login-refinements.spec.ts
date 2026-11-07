import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

for (const brand of ['qalo', 'enl']) test(`${brand}: dual logos and continuous independent floating photos`, async ({ page }, info) => {
  test.setTimeout(90000)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width:1083, height:768 })
  await page.goto(`/${brand}/signin`, {waitUntil:'networkidle'})
  const brands=page.locator('.login-platform-brands')
  for (const name of ['Qalo Ya Afrika','eNL Mutual Bank']) await expect(brands.getByRole('img',{name,exact:true})).toBeVisible()
  await expect(page.locator('.login-panel img')).toHaveCount(0)
  await expect(page.getByText('STAFF WORKSPACE',{exact:true})).toHaveCount(0)
  await expect(page.locator('.login-panel')).toHaveCSS('background-color','rgb(255, 255, 255)')
  for (const img of await page.locator('.login-shell img').all()) await expect.poll(()=>img.evaluate(el=>(el as HTMLImageElement).naturalWidth>0)).toBe(true)
  const logoBoxes=await brands.locator('img').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}))
  expect(logoBoxes[1]!.x-logoBoxes[0]!.x-logoBoxes[0]!.w).toBeCloseTo(24, 2)
  expect(logoBoxes[1]!.y).toBe(logoBoxes[0]!.y)
  await page.waitForTimeout(1700) // Allow staggered entrances to finish before observing real time.
  const panel=await page.locator('.login-panel').boundingBox()
  const sample=()=>page.locator('.login-photo-motion').evaluateAll(els=>els.map(el=>({transform:getComputedStyle(el).transform,time:el.getAnimations()[0]?.currentTime,duration:el.getAnimations()[0]?.effect?.getTiming().duration})))
  const samples=[await sample()]
  mkdirSync('test-results',{recursive:true})
  const prefix=`test-results/login-dual-${brand}-${info.project.name||'edge'}`
  await page.screenshot({path:`${prefix}-start.png`})
  for(let i=0;i<5;i++){await page.waitForTimeout(3100);samples.push(await sample())}
  await page.screenshot({path:`${prefix}-after-15s.png`})
  for(let i=0;i<4;i++) {
    expect(new Set(samples.map(s=>s[i]!.transform)).size).toBeGreaterThan(3)
    expect(Number(samples.at(-1)![i]!.time)-Number(samples[0]![i]!.time)).toBeGreaterThan(15000)
  }
  expect(new Set(samples[0]!.map(s=>s.duration)).size).toBe(4)
  expect(await page.locator('.login-panel').boundingBox()).toEqual(panel)
  await page.getByLabel('Email address',{exact:true}).fill('typing@example.invalid')
  await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('typing@example.invalid')
  await page.emulateMedia({reducedMotion:'reduce'})
  for(const photo of await page.locator('.login-photo-motion').all()) await expect(photo).toHaveCSS('animation-name','none')
  for(const width of [820,390,320]) {
    await page.setViewportSize({width,height:900})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeVisible()
    await expect(brands.getByRole('img',{name:'eNL Mutual Bank',exact:true})).toBeVisible()
    await page.screenshot({path:`${prefix}-${width}.png`})
  }
  expect(errors).toEqual([])
})
