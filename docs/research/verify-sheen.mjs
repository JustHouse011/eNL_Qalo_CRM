import { chromium } from 'playwright'
import { mkdir,writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const dir=new URL('./sheen/',import.meta.url);await mkdir(dir,{recursive:true})
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const results=[]
for(const theme of ['light','dark']){
 await page.goto('http://localhost:5174/overview');await page.evaluate(t=>localStorage.setItem('qalo-theme',t),theme);await page.reload();await page.locator('.report-metric').first().waitFor()
 const snap=()=>page.locator('.report-metric').first().evaluate(e=>{const s=getComputedStyle(e),a=getComputedStyle(e,'::after'),r=e.getBoundingClientRect();return {position:a.getPropertyValue('--qalo-light-position'),gradient:a.backgroundImage,pointer:a.pointerEvents,rect:[r.x,r.y,r.width,r.height],shadow:s.boxShadow}})
 const before=await snap();await page.waitForTimeout(1600);const after=await snap();results.push({theme,liveMovement:before.position!==after.position,stationary:JSON.stringify(before.rect)===JSON.stringify(after.rect)&&before.shadow===after.shadow,pointer:after.pointer})
 // Sample the real CSS animation at reproducible phases for visual comparison.
 for(const [phase,time] of [['before',0],['passing',10500]]){
  await page.evaluate(t=>{for(const a of document.getAnimations()) {a.pause();if(a.animationName==='qalo-light-pass')a.currentTime=t}},time)
  await page.screenshot({path:fileURLToPath(new URL(`${theme}-${phase}.png`,dir))})
 }
 await page.emulateMedia({reducedMotion:'reduce'});results.push({theme,reduced:await page.locator('.app-shell').evaluate(e=>({animation:getComputedStyle(e).animationName,light:getComputedStyle(e,'::after').display}))});await page.emulateMedia({reducedMotion:'no-preference'})
}
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5174/inbox');await page.locator('.conversation-panel').waitFor();results.push({mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await writeFile(new URL('results.json',dir),JSON.stringify(results,null,2));console.log(results);await browser.close()
