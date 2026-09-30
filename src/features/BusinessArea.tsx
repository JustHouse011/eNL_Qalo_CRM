import { localPreferences } from '../lib/storage'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { areaLabels, type AreaFilter, type BusinessArea, categories } from '../lib/business'
const AreaContext = createContext<{ area: AreaFilter; setArea: (area: AreaFilter) => void }>({ area: 'all', setArea: () => {} })
export function BusinessProvider({ children }: { children: ReactNode }) {
  const [area, setValue] = useState<AreaFilter>(() => { const stored = localPreferences.getItem('qalo-business-area'); return stored && stored in areaLabels ? stored as AreaFilter : 'all' })
  const setArea = useCallback((next: AreaFilter) => { setValue(next); localPreferences.setItem('qalo-business-area', next) }, [])
  return <AreaContext.Provider value={{ area, setArea }}>{children}</AreaContext.Provider>
}
// Shared scope is a local preference, never a substitute for server permissions.
// eslint-disable-next-line react-refresh/only-export-components
export function useBusinessArea() { return useContext(AreaContext) }
export function BusinessFilter() {
  const { area, setArea } = useBusinessArea()
  return <label className="business-filter">Business area<select aria-label="Business area filter" value={area} onChange={e => setArea(e.target.value as AreaFilter)}>{Object.entries(areaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
}
export function AreaFields({ area, category, onChange }: { area: BusinessArea; category: string; onChange: (area: BusinessArea, category: string) => void }) {
  return <div className="form-grid"><label>Business area<select aria-label="Business area" value={area} onChange={e => { const a = e.target.value as BusinessArea; onChange(a, categories[a][0]) }}>{Object.entries(areaLabels).filter(([v]) => v !== 'all').map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>Enquiry category<select aria-label="Enquiry category" value={category} onChange={e => onChange(area, e.target.value)}>{Array.from(new Set([category, ...categories[area]])).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></label></div>
}
