import { bankingCatalogue, enlProductUrl, productAvailability, productImages, type ProductDraft } from './bankingCatalogue'
import { ENL_SLUG } from './enlWorkspace'
import { validateBankingCredentials } from './bankingSupport'
import { supportService } from './supportService'
import { platformPreview } from './workspaceManagement'
import { canInWorkspace } from './workspaceTypes'

export async function saveBankingProduct(workspaceId: string, actorId: string, productId: string, previousRevision: string | undefined, draft: Pick<ProductDraft, 'content' | 'availability' | 'review'>) {
  return supportService.updateWorkspace(workspaceId, current => {
    const store = supportService.registry()
    const workspace = store.workspaces.find(w => w.id === workspaceId)
    const actor = actorId === platformPreview.id ? platformPreview : store.users.find(user => user.id === actorId)
    if (workspace?.slug !== ENL_SLUG || workspace.supportMode !== 'banking' || !canInWorkspace(actor, workspace, store.memberships, 'manage-workspace')) {
      throw new Error('You do not have permission to manage this catalogue.')
    }
    if (supportService.persistenceState() !== 'persistent') throw new Error('Browser storage is unavailable. The product was not saved.')
    if (!bankingCatalogue.some(product => product.id === productId)) throw new Error('Product was not found.')
    if (current.bankingProductDrafts?.[productId]?.revision !== previousRevision) throw new Error('This product changed in another session. Close and reopen the editor to review the latest draft.')
    const { content, availability, review } = structuredClone(draft)
    if (!content.name.trim() || !content.summary.trim()) throw new Error('Enter a product name and a short description.')
    if (!productAvailability.includes(availability) || !productImages.includes(content.image) || !['draft', 'requires-review'].includes(review)) throw new Error('Select a valid availability, image and review status.')
    if ([content.officialUrl, content.termsUrl].some(url => url && !enlProductUrl(url))) throw new Error('Use an HTTPS link on the official eNL domain.')
    if (content.faqs.length > 20 || content.faqs.some(faq => !faq.question.trim() || !faq.answer.trim() || faq.question.length > 200 || faq.answer.length > 2000)) throw new Error('Each FAQ needs a question and answer. Up to 20 FAQs can be saved.')
    for (const [field, value] of Object.entries(content)) {
      if (typeof value !== 'string') continue
      if (value.length > (field === 'name' ? 120 : field === 'summary' ? 320 : 4000)) throw new Error('One or more product fields are too long.')
      if (!field.endsWith('Url') && field !== 'image') validateBankingCredentials(value)
    }
    for (const faq of content.faqs) { validateBankingCredentials(faq.question); validateBankingCredentials(faq.answer) }
    return { ...current, bankingProductDrafts: { ...current.bankingProductDrafts, [productId]: { content, availability, review, actorId, revision: crypto.randomUUID(), updatedAt: new Date().toISOString() } } }
  })
}
