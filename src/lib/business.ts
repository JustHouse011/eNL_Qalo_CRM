export type BusinessArea = 'community' | 'store' | 'general'
export type AreaFilter = 'all' | BusinessArea
export const areaLabels: Record<AreaFilter, string> = { all: 'All business areas', community: 'Community Investment', store: 'Qalo Store', general: 'Platform & Technical Help' }
export const categories: Record<BusinessArea, string[]> = {
  community: ['Registration and onboarding', 'Co-operative and stokvel participation', 'OWN THE BANK enquiries', 'OWN SPAZA SHOPS enquiries', 'SME application, vetting and listing', 'Required documents', 'Contribution records and reconciliation', 'Statements and reporting access', 'Member communications', 'Complaints and escalation'],
  store: ['Product and merchandise enquiries', 'Orders and checkout', 'Payment enquiries', 'Delivery tracking', 'Returns, refunds and exchanges', 'Damaged, incorrect or missing items'],
  general: ['Account access', 'Technical support', 'Contact details and preferences'],
}
export const defaultQueues = [
  { name: 'Member Support', area: 'community' }, { name: 'Co-operative & Stokvel Support', area: 'community' }, { name: 'SME Support', area: 'community' }, { name: 'Initiative Enquiries', area: 'community' }, { name: 'Contribution & Reporting Enquiries', area: 'community' }, { name: 'Complaints', area: 'community' },
  { name: 'Product Enquiries', area: 'store' }, { name: 'Orders & Payments', area: 'store' }, { name: 'Deliveries', area: 'store' }, { name: 'Returns, Refunds & Exchanges', area: 'store' }, { name: 'Technical Support', area: 'general' },
] as const
export const defaultWorkflows = [
  { id: 'participation', name: 'Community participation support', area: 'community' as BusinessArea, stages: ['New enquiry', 'Contacted', 'Awaiting documents', 'Under review', 'Referred to responsible team', 'Support completed'] },
  { id: 'sme', name: 'SME vetting and listing support', area: 'community' as BusinessArea, stages: ['New enquiry', 'Information requested', 'Documents received', 'Referred for vetting', 'Awaiting outcome', 'Support completed'] },
  { id: 'retail', name: 'Qalo Store support', area: 'store' as BusinessArea, stages: ['New request', 'Investigating', 'Awaiting customer/provider', 'Action confirmed', 'Resolved'] },
]
export function matchesArea(record: { businessArea?: BusinessArea }, filter: AreaFilter) { return filter === 'all' || (record.businessArea || 'general') === filter }
export function defaultQueue(area: BusinessArea, category: string) {
  if (area === 'store') return /Delivery/.test(category) ? 'Deliveries' : /Returns|Damaged/.test(category) ? 'Returns, Refunds & Exchanges' : /Product/.test(category) ? 'Product Enquiries' : 'Orders & Payments'
  if (area === 'general') return 'Technical Support'
  if (/SME/.test(category)) return 'SME Support'
  if (/OWN/.test(category)) return 'Initiative Enquiries'
  if (/Contribution|reporting/.test(category)) return 'Contribution & Reporting Enquiries'
  if (/Complaints/.test(category)) return 'Complaints'
  if (/stokvel/.test(category)) return 'Co-operative & Stokvel Support'
  return 'Member Support'
}
export const participantTypes = ['Individual / prospective member', 'Co-operative representative', 'Stokvel representative', 'SME representative', 'Store customer']
export const officialLinks = { home: 'https://www.qaloyaafrika.co.za/', about: 'https://www.qaloyaafrika.co.za/about', store: 'https://www.qaloyaafrika.co.za/store', bank: 'https://www.qaloyaafrika.co.za/investments/own-the-bank', spaza: 'https://www.qaloyaafrika.co.za/investments/own-spaza-shop', sme: 'https://www.qaloyaafrika.co.za/partners/smes', cooperative: 'https://www.qaloyaafrika.co.za/partners/cooperatives', roles: 'https://www.qaloyaafrika.co.za/roles', contact: 'https://www.qaloyaafrika.co.za/contact' }
export function safeOfficialUrl(value?: string) { try { const url = new URL(value || ''); return url.protocol === 'https:' && url.hostname === 'www.qaloyaafrika.co.za' ? url.href : undefined } catch { return undefined } }
