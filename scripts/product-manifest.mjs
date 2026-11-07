import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
const root=path.resolve('public/products')
const categories=['Aprons','Bucket Hats','Caps','Golf Shirts','Leggings','Seamless Jackets','Shawl','Socks','Sweat Pants','Sweaters','Tie','Unisex Bags']
const images=[],unsupported=[],unavailable=[]
for(const category of categories){const dir=path.join(root,category);if(!fs.existsSync(dir)){unavailable.push(dir);continue}const walk=d=>{for(const entry of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const file=path.join(d,entry.name);if(entry.isDirectory()){walk(file);continue}const relative=path.relative(root,file).replaceAll('\\','/');if(!/\.(png|jpe?g|webp|gif|avif)$/i.test(entry.name)){unsupported.push(relative);continue}try{const b=fs.readFileSync(file);if(b.subarray(1,4).toString()!=='PNG')throw Error('Image format needs an explicit decoder before catalogue inclusion');const hash=createHash('sha256').update(b).digest('hex');images.push({id:`photo-${hash.slice(0,16)}`,category,file:relative,originalUrl:'/products/'+relative.split('/').map(encodeURIComponent).join('/'),url:`/products/_previews/${hash.slice(0,16)}.webp`,format:'PNG',width:b.readUInt32BE(16),height:b.readUInt32BE(20),bytes:b.length,sha256:hash})}catch(e){unavailable.push({file:relative,error:e.message})}}};walk(dir)}
if(unavailable.length){console.error('Unavailable images: make OneDrive files available offline before continuing.',JSON.stringify(unavailable));process.exit(1)}
const groups=new Map();for(const image of images){const list=groups.get(image.sha256)||[];list.push(image.file);groups.set(image.sha256,list)}
const manifest={version:1,categories,images,unsupported,duplicates:[...groups.values()].filter(g=>g.length>1),summary:categories.map(category=>({category,usable:images.filter(i=>i.category===category).length})),totalBytes:images.reduce((s,i)=>s+i.bytes,0)}
const output=JSON.stringify(manifest,null,2)+'\n'
if(!fs.existsSync('src/data/productManifest.json')||fs.readFileSync('src/data/productManifest.json','utf8')!==output)fs.writeFileSync('src/data/productManifest.json',output)
console.log(JSON.stringify({images:images.length,summary:manifest.summary,unsupported,duplicates:manifest.duplicates,totalBytes:manifest.totalBytes}))

if(process.argv.includes('--check-previews')){const missing=images.filter(i=>!fs.existsSync('public'+i.url));if(missing.length){console.error('Run npm run catalog:previews to generate local previews for:',missing.map(i=>i.file));process.exit(1)}}
