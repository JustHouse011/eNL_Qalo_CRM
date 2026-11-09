import { bankingProducts } from './workspaceExperience'

export const productAvailability = ['Available', 'Coming Soon', 'Temporarily Unavailable'] as const
export type ProductAvailability = typeof productAvailability[number]
export type ProductFaq = { id: string; question: string; answer: string }
export type ProductContent = {
  name: string; summary: string; description: string; customer: string; features: string; benefits: string
  eligibility: string; documents: string; application: string; fees: string; limits: string
  termsUrl: string; officialUrl: string; image: string; faqs: ProductFaq[]; guidance: string
}
export type ProductDraft = {
  content: ProductContent; availability: ProductAvailability; review: 'draft' | 'requires-review'
  revision: string; updatedAt: string; actorId: string
}

type CatalogueProduct = {
  id: string; canonical: string; availability: ProductAvailability; content: ProductContent
}
const [becha, nala, temo, temoSavings, imbewu, pusha, owner] = bankingProducts
const origin = 'https://enlbank.co.za'
function entry(id: string, canonical: string, name: string, image: string, summary: string, features: string, path: string, availability: ProductAvailability = 'Available'): CatalogueProduct {
  return {
    id, canonical, availability,
    content: {
      name, image, summary, description: '', customer: '', features, benefits: '', eligibility: '', documents: '',
      application: '', fees: '', limits: '', termsUrl: '', officialUrl: origin + path,
      guidance: 'Refer to the bank’s current product information for terms and application requirements.',
      faqs: [{ id: `${id}-official-source`, question: 'Where can I confirm the current product information?', answer: 'Use the official eNL product link. Confirm terms and application requirements with the bank before advising a customer.' }],
    },
  }
}

// Keep the original product names used by banking case records. Business variants share the parent relationship.
export const bankingCatalogue = [
  entry('becha', becha, becha, 'Becha.png', 'An account for everyday banking.', 'Everyday banking', '/becha'),
  entry('nala', nala, nala, 'Nala.png', 'A personal account for day to day banking.', 'Personal banking', '/nala'),
  entry('temo', temo, temo, 'Temo Account.png', 'Everyday banking designed for teenagers.', 'Teen banking', '/temo'),
  entry('temo-savings', temoSavings, 'Temo Savings Account', 'Temo Savings.jpeg', 'An account for building savings early.', 'Savings for young customers', '/temo-savings'),
  entry('imbewu-savings', imbewu, 'iMbewu Savings Account', 'Imbewu savings.jpg', 'A savings account for growing savings over time.', 'Personal savings', '/imbewu-savings'),
  entry('pusha-sole', pusha, 'Pusha — Sole Proprietor', 'Sole Proprietor.jpg', 'Business banking for sole proprietors.', 'Sole proprietor banking', '/business-coming-soon', 'Coming Soon'),
  entry('pusha-informal', pusha, 'Pusha — Informal Trader', 'informal trader.jpeg', 'Business banking for informal traders.', 'Informal trader banking', '/business-coming-soon', 'Coming Soon'),
  entry('owner-private', owner, 'Owner — Private Company', 'private company.png', 'Business banking for private companies.', 'Private company banking', '/business-coming-soon', 'Coming Soon'),
  entry('owner-cooperative', owner, 'Owner — Co-operative', 'Co-operative.jpeg', 'Business banking for co-operatives.', 'Co-operative banking', '/business-coming-soon', 'Coming Soon'),
  entry('stokvel', 'Stokvel Account', 'Stokvel Account', 'Stokvel.jpg', 'An account for stokvel groups.', 'Group banking', '/products'),
]
export const productImages = bankingCatalogue.map(product => product.content.image)
export function productImage(name: string) { return `/enl%20products/${encodeURIComponent(name)}` }
export function enlProductUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && ['enlbank.co.za', 'www.enlbank.co.za'].includes(url.hostname) && !url.username && !url.password && !url.port) return url.href
  } catch { /* Empty or invalid URL. */ }
  return undefined
}
