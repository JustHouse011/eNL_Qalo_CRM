// Run locally after adding images; generated WebP files travel with the catalogue.
import fs from 'node:fs'
import {chromium} from '@playwright/test'
const manifest=JSON.parse(fs.readFileSync('src/data/productManifest.json','utf8'))
fs.mkdirSync('public/products/_previews',{recursive:true})
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})})
try{const page=await browser.newPage();await page.goto('about:blank');for(const image of manifest.images){const target='public'+image.url;if(fs.existsSync(target))continue;const result=await page.evaluate(async url=>{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');const scale=Math.min(1,720/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/webp',.85).split(',')[1]},'data:image/png;base64,'+fs.readFileSync('public/products/'+image.file).toString('base64'));fs.writeFileSync(target,Buffer.from(result,'base64'))}console.log(`Prepared ${manifest.images.length} local product previews`)}finally{await browser.close()}
