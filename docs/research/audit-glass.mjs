import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const root = new URL('./glass/', import.meta.url)
await mkdir(root, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
const results = []
const routes = ['overview','inbox','visitors','retail','tickets','contacts','pipeline','knowledge','saved-replies','integrations','automations','ai-assist','team','reports','activities','feedback','widget','settings','chat','help','live','live-chat','signin','customer-preview']
for (const theme of process.argv.includes('--light-only') ? ['light'] : ['light','dark']) {
  await page.goto('http://localhost:5174/inbox')
  await page.evaluate(t => localStorage.setItem('qalo-theme', t), theme)
  for (const route of process.argv.includes('--contrast-only') ? [] : routes) {
    await page.goto(`http://localhost:5174/${route}`)
    await page.locator('h1').first().waitFor()
    // Standalone support screens inherit the global dark palette; exercise their light token scope too.
    if (theme === 'light') await page.locator('.app-shell.standalone').evaluateAll(es => es.forEach(e => e.classList.add('theme-light')))
    await page.screenshot({ path: new URL(`${theme}-${route}.png`, root).pathname.replace(/%20/g, ' ').replace(/^\/(\w:)/, '$1') })
    results.push(await page.evaluate(({theme,route}) => ({ theme, route, overflow: document.documentElement.scrollWidth > innerWidth,
      panels: [...document.querySelectorAll('.glass-panel,.record-card,.settings-menu')].slice(0,8).map(e => ({type:e.className,background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter})) }), {theme,route}))
  }
  await page.goto('http://localhost:5174/inbox')
  await page.getByRole('button', {name:'Profile menu',exact:true}).click()
  await page.screenshot({ path: new URL(`${theme}-profile.png`,root).pathname.replace(/%20/g, ' ').replace(/^\/(\w:)/,'$1') })
  await page.getByRole('button', {name:'Profile menu',exact:true}).click()
  await page.getByRole('button', {name:'Ticket',exact:true}).click()
  await page.getByRole('dialog').waitFor()
  await page.screenshot({ path: new URL(`${theme}-dialog.png`,root).pathname.replace(/%20/g, ' ').replace(/^\/(\w:)/,'$1') })
  await page.keyboard.press('Escape')
  await page.goto('http://localhost:5174/reports')
  await page.locator('.report-date-trigger').first().click()
  await page.screenshot({ path: new URL(`${theme}-calendar.png`,root).pathname.replace(/%20/g, ' ').replace(/^\/(\w:)/,'$1') })
  await page.goto('http://localhost:5174/inbox')
  // Probe actual rendered glass against the page gradient using empty, token-labelled swatches.
  await page.locator('.conversation-panel').waitFor({ state: 'visible' })
  await page.evaluate(() => {
    for (const [index, cls] of ['glass-nav','glass-content','glass-overlay'].entries()) {
      const e = document.createElement('div'); e.className = cls; e.dataset.contrastProbe = cls
      Object.assign(e.style, {position:'fixed', left:`${300+index*320}px`, top:'150px', width:'280px',height:'160px',zIndex:'9999'})
      document.querySelector('.app-shell').append(e)
    }
  })
  const probes = await page.locator('[data-contrast-probe]').evaluateAll(es => es.map(e => {const s=getComputedStyle(e),r=e.getBoundingClientRect(); return {type:e.className,x:r.x+140,y:r.y+80,colors:['--text','--muted','--muted-2','--accent'].map(t=>({token:t,color:s.getPropertyValue(t).trim()}))}}))
  const pixels = (await page.screenshot()).toString('base64')
  const contrast = await page.evaluate(async ({pixels,probes}) => {
    const img=new Image(); img.src=`data:image/png;base64,${pixels}`; await img.decode()
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0)
    const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
    return probes.flatMap(p=>{const bg=[...ctx.getImageData(p.x,p.y,1,1).data];return p.colors.map(c=>{ctx.fillStyle=c.color;ctx.fillRect(0,0,1,1);const fg=[...ctx.getImageData(0,0,1,1).data];const a=lum(bg),b=lum(fg);return {surface:p.type,token:c.token,background:bg.slice(0,3),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}})})
  },{pixels,probes})
  results.push({theme,contrast})
}
for (const width of [390,768]) {
  await page.setViewportSize({width,height:844});await page.goto('http://localhost:5174/inbox')
  await page.screenshot({path:new URL(`mobile-${width}.png`,root).pathname.replace(/%20/g, ' ').replace(/^\/(\w:)/,'$1')})
  results.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)})
}
await writeFile(new URL(process.argv.includes('--contrast-only') ? 'contrast-audit.json' : 'audit.json',root),JSON.stringify({results,errors},null,2))
console.log(JSON.stringify({screens:results.filter(r=>r.route).length,errors,overflow:results.filter(r=>r.overflow),contrast:results.filter(r=>r.contrast)},null,2))
await browser.close()
