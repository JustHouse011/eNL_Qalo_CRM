import { areaLabels, categories, defaultQueue, participantTypes, type BusinessArea } from '../lib/business'
import { bankingCategories, bankingKnowledgeCategories } from '../lib/enlWorkspace'
import { bankingSupportCategories } from '../lib/workspaceExperience'
import { useWorkspace } from './WorkspaceContext'

export function useWorkspaceTaxonomy(pinnedWorkspaceId?: string) {
  const { registry, workspaceId: selectedId } = useWorkspace()
  const workspaceId = pinnedWorkspaceId || selectedId
  const banking = registry?.workspaces.find(w => w.id === workspaceId)?.supportMode === 'banking'
  return {
    banking,
    areaLabels: banking ? { ...areaLabels, all: 'All support departments', general: 'Banking Support' } : areaLabels,
    categories: banking ? { community: [...bankingCategories, ...bankingSupportCategories], store: [...bankingCategories, ...bankingSupportCategories], general: [...bankingCategories, ...bankingSupportCategories] } : categories,
    knowledgeCategories: banking ? bankingKnowledgeCategories : undefined,
    participantTypes: banking ? ['Customer', 'business enquiry', 'visitor'] : participantTypes,
    areaOptions: banking ? ['general'] : ['community', 'store', 'general'],
    defaultQueue: (area: BusinessArea, category: string) => banking ? registry?.snapshots[workspaceId].departments.find(d => /fraud/i.test(category) ? d.name === 'Fraud and Security' : /complaint/i.test(category) ? d.name === 'Complaints and Disputes' : /mobile/i.test(category) ? d.name === 'Digital Banking Support' : /card/i.test(category) ? d.name === 'Cards and Payments' : d.name === 'General Enquiries')?.name || 'General Enquiries' : defaultQueue(area, category),
  }
}
