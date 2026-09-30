import type { DemoData } from '../data/demoData'

// Exact legacy fixture copy only. Never scrub arbitrary user-authored business text.
const replacements: Record<string, string> = {
  'Paid (simulated)': 'Awaiting verification',
  'Review requested (simulated)': 'Review requested',
  'Browsing (simulated)': 'Browsing',
  'Viewed 3 pages · simulated session': 'Viewed 3 pages · Current session',
  'Mock refund routing': 'Refund enquiries',
  'Demo assistant': 'Qalo Support',
  '[Simulated reply] Thank you for the update. Please keep me informed.': 'Thank you for the update. Please keep me informed.',
  '[Simulated reply] We have recorded your enquiry for the support team.': 'We have recorded your enquiry for the support team.',
  'Thanks for contacting Qalo. I am reviewing your fictional order details in this demo.': 'Thanks for contacting Qalo. I am reviewing your order enquiry.',
  'Thank you for contacting Qalo Store support. I can record your enquiry and request verified information. Our order system is not connected.': 'Thank you for contacting Qalo Store support. I will help you follow up on your enquiry.',
  'Fictional content for interface review': 'Editorial review',
  'Not connected': 'Not available',
  'Merchandise details awaiting order connector': 'Item details requested',
  '[Fictional demo guidance] Share your order reference and describe the item or delivery issue. The support team can review the sample order, add a follow-up and track the request. A support case does not authorize a refund.': 'Share your order reference and describe the item or delivery issue. The support team can review your order, add a follow-up and track the request. A support case does not authorize a refund.',
  '[Fictional demo guidance] Tell the support team which initiative interests you and provide your enquiry reference. We can record your question, request a document checklist and track the support stage. This sample guidance does not establish eligibility or an application outcome.': 'Tell the support team which initiative interests you and provide your enquiry reference. We can record your question, request a document checklist and track the support stage. Your support team can help you follow up on the application.',
}
for (let i = 1; i <= 5; i++) replacements[`DEMO-TRACK-${i}`] = `QYA-TRACK-${i}`

export function migratePresentation(data: DemoData): DemoData {
  if (data.presentationVersion === 1) return data
  function visit(value: unknown): unknown {
    if (typeof value === 'string') return replacements[value] ?? value
    if (Array.isArray(value)) return value.map(visit)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]))
    return value
  }
  return { ...visit(data) as DemoData, presentationVersion: 1 }
}
