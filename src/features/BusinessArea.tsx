import { localPreferences } from '../lib/storage'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { areaLabels, type AreaFilter, type BusinessArea, categories } from '../lib/business'
import { useWorkspace } from './WorkspaceContext'
import { useWorkspaceTaxonomy } from './workspaceTaxonomy'
const AreaContext = createContext<{ area: AreaFilter; setArea: (area: AreaFilter) => void; departmentId: string; setDepartmentId: (id: string) => void }>({ area: 'all', setArea: () => {}, departmentId: '', setDepartmentId: () => {} })
const keepBankingArea = (_area: AreaFilter) => {}
export function BusinessProvider({ children }: { children: ReactNode }) {
  const [area, setValue] = useState<AreaFilter>(() => { const stored = localPreferences.getItem('qalo-business-area'); return stored && stored in areaLabels ? stored as AreaFilter : 'all' })
  const setArea = useCallback((next: AreaFilter) => { setValue(next); localPreferences.setItem('qalo-business-area', next) }, [])
  const [departmentId, setDepartmentId] = useState('')
  return <AreaContext.Provider value={{ area, setArea, departmentId, setDepartmentId }}>{children}</AreaContext.Provider>
}
// Shared scope is a local preference, never a substitute for server permissions.
// eslint-disable-next-line react-refresh/only-export-components
export function useBusinessArea() { const context = useContext(AreaContext); const { banking } = useWorkspaceTaxonomy(); return banking ? { ...context, area: 'all' as const, setArea: keepBankingArea } : context }
export function BusinessFilter() {
  const { area, setArea, departmentId, setDepartmentId } = useBusinessArea()
  const { banking } = useWorkspaceTaxonomy()
  const { registry, workspaceId } = useWorkspace()
  if (banking) return <label className="business-filter">Support department<select aria-label="Department filter" value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">All departments</option>{registry?.snapshots[workspaceId]?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
  return <><label className="business-filter">Department<select aria-label="Department filter" value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">All departments</option>{registry?.snapshots[workspaceId]?.departments.filter(d => area === 'all' || d.area === area).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="business-filter">Business area<select aria-label="Business area filter" value={area} onChange={e => { setArea(e.target.value as AreaFilter); setDepartmentId('') }}>{Object.entries(areaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></>
}
export function AreaFields({ area, category, onChange, workspaceId }: { workspaceId?: string; area: BusinessArea; category: string; onChange: (area: BusinessArea, category: string) => void }) {
  const taxonomy = useWorkspaceTaxonomy(workspaceId)
  if (taxonomy.banking) return <label>Banking enquiry category<select aria-label="Banking enquiry category" value={category} onChange={e => onChange('general', e.target.value)}>{Array.from(new Set([category, ...(taxonomy.knowledgeCategories?.includes(category) ? taxonomy.knowledgeCategories : taxonomy.categories.general)])).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></label>
  return <div className="form-grid"><label>Business area<select aria-label="Business area" value={area} onChange={e => { const a = e.target.value as BusinessArea; onChange(a, categories[a][0]) }}>{Object.entries(areaLabels).filter(([v]) => v !== 'all').map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>Enquiry category<select aria-label="Enquiry category" value={category} onChange={e => onChange(area, e.target.value)}>{Array.from(new Set([category, ...categories[area]])).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></label></div>
}
