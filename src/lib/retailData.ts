import manifest from '../data/productManifest.json' with { type: 'json' }
import type { DemoData } from '../data/demoData'
export type RetailProduct={id:string;synthetic:true;name:string;category:string;sku:string;price:number;stock:number;images:typeof manifest.images;colours:string[]}
export type PaymentStatus='Awaiting Verification'|'Paid'|'Failed'|'Refunded'
export type DeliveryStatus='Processing'|'Dispatched'|'In Transit'|'Delivered'|'Delivery Exception'
export type RefundStatus='Requested'|'Under Review'|'Approved'|'Declined'
export type RetailOrder={id:string;synthetic:true;workspaceId:string;customer:string;location:string;conversationId:string|null;departmentId:string|null;productId:string;quantity:number;unitPrice:number;createdAt:string;payment:PaymentStatus;delivery:DeliveryStatus;tracking:string;courier:string;events:{id:string;label:string;at:string}[]}
export type RetailRefund={id:string;synthetic:true;workspaceId:string;orderId:string;reason:string;status:RefundStatus;requestedAt:string;requestedBy:string}
export type RetailState={version:1;synthetic:true;orders:RetailOrder[];refunds:RetailRefund[]}
const prices:Record<string,number>={'Aprons':180,'Bucket Hats':195,'Caps':165,'Golf Shirts':350,'Leggings':360,'Seamless Jackets':650,'Shawl':285,'Socks':95,'Sweat Pants':450,'Sweaters':520,'Tie':185,'Unisex Bags':395}
const singular:Record<string,string>={'Aprons':'Apron','Bucket Hats':'Bucket Hat','Caps':'Cap','Golf Shirts':'Shirt','Leggings':'Leggings','Seamless Jackets':'Jacket','Shawl':'Shawl','Socks':'Socks','Sweat Pants':'Sweat Pants','Sweaters':'Sweater','Tie':'Tie','Unisex Bags':'Bag'}
const groups=new Map<string,typeof manifest.images>()
for(const image of manifest.images){const file=image.file.split('/').at(-1)!.toLowerCase();const brand=file.includes('enl')?'eNL':file.includes('qalo')||file==='front.png'?'Qalo':/500/.test(file)?'500 design':'';const kind=file.includes('golf')&&image.category==='Golf Shirts'?'Golf Shirt':singular[image.category];const extra=file.includes('duo colour')?' · Duo colour':'';const name=`${brand} ${kind}${extra}`.trim();const key=image.category+'|'+name;groups.set(key,[...(groups.get(key)||[]),image])}
export const retailProducts:RetailProduct[]=[...groups].map(([key,images],i)=>({id:`qya-product-${images[0]!.sha256.slice(0,12)}`,synthetic:true,name:key.split('|')[1]!,category:images[0]!.category,sku:`QYA-${images[0]!.sha256.slice(0,6).toUpperCase()}`,price:prices[images[0]!.category]!+(i%3)*20,stock:i%11===0?0:i%5===0?4:18+(i*7)%64,images:[...images].sort((a,b)=>Number(!/front/i.test(a.file))-Number(!/front/i.test(b.file))),colours:['Black','White','Green','Orange','Purple'].filter(colour=>images.some(image=>image.file.toLowerCase().includes(colour.toLowerCase())))}))
for(const category of manifest.categories)if(!retailProducts.some(p=>p.category===category))retailProducts.push({id:'qya-unavailable-'+category.toLowerCase().replaceAll(' ','-'),synthetic:true,name:singular[category]+' — image unavailable',category,sku:'QYA-UNAVAILABLE-'+category.slice(0,3).toUpperCase(),price:prices[category]!,stock:0,images:[],colours:[]})
export const productCategories=manifest.categories
export const currency=(value:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(value)
export const stockLabel=(stock:number)=>stock===0?'Out of Stock':stock<=5?'Low Stock':'In Stock'
export function seedRetail(data:DemoData):RetailState {
  const legacy=[...new Map(data.conversations.filter(c=>c.businessArea==='store'&&c.order).map(c=>[c.order!.reference,c])).values()]
  const names=['Thandi Mokoena','Sipho Dlamini','Lerato Molefe','Ayanda Nkosi','Nomsa Khumalo','Kabelo Maseko','Zanele Ndlovu','Bongiwe Zulu','Mandla Gumede','Naledi Masango','Sibusiso Mthembu','Palesa Radebe','Tshepo Mahlangu','Nandi Cele','Lungile Buthelezi','Simphiwe Mokoena','Karabo Sithole','Mpho Tshabalala','Buhle Vilakazi','Themba Madonsela','Nokuthula Dube','Lebo Motsoeneng','Lindiwe Nene','Siyabonga Mkhize','Nkosana Zwane','Boitumelo Phiri','Andile Ngcobo','Sanele Shabalala','Nobuhle Mabuza','Kgomotso Mashile','Vuyo Gqoboka','Tumi Molefe']
  const cities=['Johannesburg, Gauteng','Cape Town, Western Cape','Durban, KwaZulu-Natal','Pretoria, Gauteng','Polokwane, Limpopo','Mbombela, Mpumalanga','Bloemfontein, Free State','Gqeberha, Eastern Cape']
  const stages:DeliveryStatus[]=['Processing','Dispatched','In Transit','Delivered','Delivery Exception']
  const orders:RetailOrder[]=Array.from({length:32},(_,i)=>{
    const c=legacy[i];const reference=c?.order?.reference || `QYA-26-${String(i+1).padStart(4,'0')}`
    const product=c?retailProducts.find(p=>p.name.startsWith('Qalo')&&p.category===(c.order!.items.join(' ').toLowerCase().includes('jacket')?'Seamless Jackets':'Unisex Bags'))||retailProducts.find(p=>p.category===(c.order!.items.join(' ').toLowerCase().includes('jacket')?'Seamless Jackets':'Unisex Bags'))!:retailProducts[(i*7)%retailProducts.length]!
    const createdAt=c?.createdAt||new Date(Date.UTC(2026,10,4-i,8,30)).toISOString()
    const legacyPayment=c?.order?.payment||''
    const payment:PaymentStatus=c?(/^paid$/i.test(legacyPayment)?'Paid':/^failed$/i.test(legacyPayment)?'Failed':/^refunded$/i.test(legacyPayment)?'Refunded':'Awaiting Verification'):i%13===9?'Failed':i%7===0?'Awaiting Verification':i===12?'Refunded':'Paid'
    const legacyDelivery=c?.order?.fulfilment||''
    const delivery:DeliveryStatus=c?(stages.find(s=>s.toLowerCase()===legacyDelivery.toLowerCase())||'Processing'):payment==='Failed'||payment==='Awaiting Verification'?'Processing':payment==='Refunded'?'Delivered':stages[i%5]!
    const milestones=delivery==='Delivery Exception'?['Order received','Processing','Dispatched','In Transit','Delivery Exception']:['Order received','Processing',...(delivery==='Processing'?[]:delivery==='Dispatched'?['Dispatched']:delivery==='In Transit'?['Dispatched','In Transit']:['Dispatched','In Transit','Delivered'])]
    return {id:reference,synthetic:true,workspaceId:'workspace-qalo',customer:c?.customer||names[i]!,location:c?.location||cities[i%cities.length]!,conversationId:c?.id||null,departmentId:c?.departmentId||legacy[i%Math.max(1,legacy.length)]?.departmentId||null,productId:product.id,quantity:c?1:1+i%3,unitPrice:product.price,createdAt,payment,delivery,tracking:c?.order?.tracking||`DEMO-QYA-${String(i+1).padStart(6,'0')}`,courier:i%3===0?'Unassigned':'Qalo delivery partner (demo)',events:c?[{id:reference+'-received',label:'Order received',at:createdAt},{id:reference+'-recorded',label:delivery,at:c.updatedAt}]:milestones.map((label,n)=>({id:`${reference}-event-${n}`,label,at:new Date(Date.parse(createdAt)+n*3600000).toISOString()}))}
  })
  const refunds:RetailRefund[]=orders.filter((_,i)=>i===1||i===4||i===8||i===12||i===17||i===23).map((o,i)=>({id:`QYA-RF-${String(i+1).padStart(4,'0')}`,synthetic:true,workspaceId:'workspace-qalo',orderId:o.id,reason:['Item quality enquiry','Incorrect item received','Size exchange enquiry'][i%3]!,status:(o.payment==='Refunded'?'Approved':i===1?'Under Review':i===4?'Declined':'Requested') as RefundStatus,requestedAt:new Date(Date.parse(o.createdAt)+5*3600000).toISOString(),requestedBy:'fixture'}))
  return {version:1,synthetic:true,orders,refunds}
}
function legacyRefundStatus(data:DemoData,order:RetailOrder):RefundStatus|'None'{const value=data.conversations.find(c=>c.id===order.conversationId)?.order?.request||'';return /under review/i.test(value)?'Under Review':/review requested|requested/i.test(value)?'Requested':/^approved$/i.test(value)?'Approved':/^declined$/i.test(value)?'Declined':'None'}
export function getRetailState(data:DemoData):RetailState {const state=data.retail||seedRetail(data);const missing=state.orders.filter(o=>!state.refunds.some(r=>r.orderId===o.id)&&legacyRefundStatus(data,o)!=='None').map(o=>({id:'QYA-RF-LEGACY-'+o.id,synthetic:true as const,workspaceId:'workspace-qalo',orderId:o.id,reason:'Existing support refund review',status:legacyRefundStatus(data,o) as RefundStatus,requestedAt:o.createdAt,requestedBy:'legacy-support'}));return {...state,refunds:[...state.refunds,...missing]}}
export function refundStatus(data:DemoData,order:RetailOrder,state:RetailState):RefundStatus|'None'{return legacyRefundStatus(data,order)!=='None'?legacyRefundStatus(data,order):state.refunds.find(r=>r.orderId===order.id)?.status||'None'}
export function requestRetailRefund(data:DemoData,orderId:string,actorId:string,reason:string):DemoData {
  const state=getRetailState(data);const order=state.orders.find(o=>o.id===orderId)
  if(!order)throw Error('Order no longer exists.')
  if(!['Paid','Awaiting Verification'].includes(order.payment))throw Error('This payment record cannot enter refund review.')
  if(refundStatus(data,order,state)!=='None')throw Error('A refund review already exists for this order.')
  if(!reason.trim())throw Error('Enter a reason for the review.')
  const at=new Date().toISOString();const refund:RetailRefund={id:`QYA-RF-${order.id}`,synthetic:true,workspaceId:'workspace-qalo',orderId:order.id,reason:reason.trim(),status:'Requested',requestedAt:at,requestedBy:actorId}
  return {...data,retail:{...state,refunds:[refund,...state.refunds],orders:state.orders.map(o=>o.id===order.id?{...o,events:[...o.events,{id:`${refund.id}-requested`,label:'Refund review requested',at}]}:o)},conversations:data.conversations.map(c=>c.id===order.conversationId&&c.order?{...c,order:{...c.order,request:'Review requested'}}:c)}
}
export function updateRetailDelivery(data:DemoData,orderId:string,next:DeliveryStatus,actorId:string):DemoData {
  const state=getRetailState(data);const order=state.orders.find(o=>o.id===orderId)
  if(!order||order.payment!=='Paid')throw Error('Delivery updates require a paid demo order.')
  const allowed:Record<DeliveryStatus,DeliveryStatus[]>={Processing:['Dispatched'],Dispatched:['In Transit','Delivery Exception'],'In Transit':['Delivered','Delivery Exception'],Delivered:[],'Delivery Exception':['In Transit']}
  if(!allowed[order.delivery].includes(next))throw Error('This delivery transition is not available.')
  const at=new Date().toISOString()
  return {...data,retail:{...state,orders:state.orders.map(o=>o.id===orderId?{...o,delivery:next,events:[...o.events,{id:`${orderId}-${crypto.randomUUID()}`,label:next,at}]}:o)},conversations:data.conversations.map(c=>c.id===order.conversationId&&c.order?{...c,order:{...c.order,fulfilment:next},history:[...c.history,{id:crypto.randomUUID(),title:`Demo delivery: ${next}`,detail:`Recorded by ${actorId}`,when:at}]}:c)}
}

export function validateRetailState(value:unknown){
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
 const bad=()=>{throw Error('Retail demo records are invalid. Existing workspace data has been retained.')}
 if(!object(value)||value.version!==1||value.synthetic!==true||!Array.isArray(value.orders)||!Array.isArray(value.refunds))return bad()
 const ids=new Set<string>()
 for(const order of value.orders){if(!object(order)||typeof order.id!=='string'||ids.has(order.id)||order.workspaceId!=='workspace-qalo'||order.synthetic!==true||typeof order.productId!=='string'||!Number.isInteger(order.quantity)||Number(order.quantity)<1||typeof order.unitPrice!=='number'||!Number.isFinite(order.unitPrice)||order.unitPrice<0||typeof order.createdAt!=='string'||!Number.isFinite(Date.parse(order.createdAt))||!['Awaiting Verification','Paid','Failed','Refunded'].includes(String(order.payment))||!['Processing','Dispatched','In Transit','Delivered','Delivery Exception'].includes(String(order.delivery))||!Array.isArray(order.events))return bad();ids.add(order.id)}
 const reviews=new Set<string>();for(const refund of value.refunds){if(!object(refund)||typeof refund.orderId!=='string'||!ids.has(refund.orderId)||reviews.has(refund.orderId)||refund.workspaceId!=='workspace-qalo'||refund.synthetic!==true||!['Requested','Under Review','Approved','Declined'].includes(String(refund.status)))return bad();reviews.add(refund.orderId)}
}
