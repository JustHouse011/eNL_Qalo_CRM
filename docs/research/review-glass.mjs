import { chromium } from 'playwright'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = new URL('./glass/', import.meta.url)
const browser = await chromium.launch()
const page = await browser.newPage({viewport:{width:2000,height:1800}})
for (const theme of process.argv.includes('--checks-only') ? [] : ['light','dark']) {
  const files=(await readdir(root)).filter(n=>n.startsWith(theme+'-')&&n.endsWith('.png')&&!n.includes('sheet'))
  for (let start=0;start<files.length;start+=12) {
    const cards=await Promise.all(files.slice(start,start+12).map(async name=>`<figure><figcaption>${name}</figcaption><img src="data:image/png;base64,${(await readFile(new URL(name,root))).toString('base64')}" /></figure>`))
    await page.setContent(`<style>body{margin:0;background:#87948f;font:18px system-ui;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0;background:#fff}figcaption{padding:6px}img{width:100%;display:block}</style>${cards.join('')}`)
    await page.screenshot({path:fileURLToPath(new URL(`${theme}-sheet-${start}.png`,root)),fullPage:true})
  }
}
for (const theme of ['light','dark']) {
  await page.setViewportSize({width:1440,height:1000})
  await page.goto('http://localhost:5174/inbox')
  await page.evaluate(t=>localStorage.setItem('qalo-theme',t),theme)
  await page.goto('http://localhost:5174/reports')
  await page.locator('.report-charts').scrollIntoViewIfNeeded()
  await page.screenshot({path:fileURLToPath(new URL(`${theme}-charts.png`,root))})
  await page.goto('http://localhost:5174/inbox')
  await page.getByRole('button',{name:/^Notifications/}).click()
  await page.screenshot({path:fileURLToPath(new URL(`${theme}-notifications.png`,root))})
}
await page.goto('http://localhost:5174/inbox')
await page.getByRole('button',{name:'Ticket',exact:true}).click()
console.log('Primary button',await page.locator('.dialog .button-primary').evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor,opacity:getComputedStyle(e).opacity,disabled:e.disabled})))
await page.keyboard.press('Escape')
const css=await readFile(new URL('../../src/glass.css',import.meta.url),'utf8')
await page.addStyleTag({content:css.replace('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))','@supports (display: block)')})
console.log('Fallback',await page.locator('.sidebar,.chat-panel').evaluateAll(es=>es.map(e=>({surface:e.className,bg:getComputedStyle(e).backgroundColor}))))
const cdp=await page.context().newCDPSession(page)
await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'},{name:'prefers-reduced-motion',value:'reduce'}]})
console.log('Reduced transparency/motion',await page.locator('.sidebar,.chat-panel').evaluateAll(es=>es.map(e=>({surface:e.className,blur:getComputedStyle(e).backdropFilter,transition:getComputedStyle(e).transitionDuration}))))
await browser.close()
