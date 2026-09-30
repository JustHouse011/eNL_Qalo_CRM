import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const dir=new URL('./border/',import.meta.url);await mkdir(dir,{recursive:true})
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}})
const results=[];const errors=[];page.on('pageerror',e=>errors.push(e.message))
for(const theme of ['light','dark']) {
  await page.goto('http://localhost:5174/overview');await page.evaluate(t=>localStorage.setItem('qalo-theme',t),theme);await page.reload()
  const card=page.locator('.report-metric').first();await card.waitFor()
  const read=()=>card.evaluate(e=>{const s=getComputedStyle(e),p=getComputedStyle(e,'::before'),r=e.getBoundingClientRect();return {angle:p.getPropertyValue('--qalo-border-angle'),animation:p.animationName,shadow:s.boxShadow,transform:s.transform,rect:[r.x,r.y,r.width,r.height],blur:s.backdropFilter,background:s.backgroundColor,padding:p.padding,pointer:p.pointerEvents}})
  const before=await read();const a=await card.screenshot({path:fileURLToPath(new URL(`${theme}-frame-1.png`,dir))})
  await page.waitForTimeout(1500)
  const b=await card.screenshot({path:fileURLToPath(new URL(`${theme}-frame-2.png`,dir))});const after=await read()
  const pixels=await page.evaluate(async ([a,b])=>{const load=async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return {data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height}};const x=await load(a),y=await load(b);let edge=0,center=0;for(let j=0;j<x.h;j++)for(let i=0;i<x.w;i++){const k=(j*x.w+i)*4;if([0,1,2].some(n=>Math.abs(x.data[k+n]-y.data[k+n])>3)){if(i<4||j<4||i>=x.w-4||j>=x.h-4)edge++;else center++}}return {edge,center}},[a.toString('base64'),b.toString('base64')])
  results.push({theme,before,after,pixels,stationary:JSON.stringify(before.rect)===JSON.stringify(after.rect)&&before.shadow===after.shadow&&before.transform===after.transform})
  await page.screenshot({path:fileURLToPath(new URL(`${theme}-overview.png`,dir))})
  await page.goto('http://localhost:5174/inbox');await page.locator('.chat-panel').waitFor();await page.getByLabel('Write a customer reply').fill('Border review draft')
  await page.getByRole('button',{name:'Ticket',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape')
  results.push({theme,draftPreserved:await page.getByLabel('Write a customer reply').inputValue()==='Border review draft'})
  await page.screenshot({path:fileURLToPath(new URL(`${theme}-inbox.png`,dir))})
  await page.emulateMedia({reducedMotion:'reduce'});results.push({theme,reduced:await page.locator('.chat-panel').evaluate(e=>getComputedStyle(e,'::before').animationName)});await page.emulateMedia({reducedMotion:'no-preference'})
  await page.evaluate(()=>document.documentElement.dataset.gradientMotion='static');results.push({theme,unsupported:await page.locator('.chat-panel').evaluate(e=>getComputedStyle(e,'::before').animationName)})
}
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5174/overview');await page.locator('.report-metric').first().waitFor();await page.screenshot({path:fileURLToPath(new URL('mobile.png',dir))});results.push({mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)})
await writeFile(new URL('verification.json',dir),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));await browser.close()
