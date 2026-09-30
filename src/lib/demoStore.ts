import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type { DemoData } from '../data/demoData'
import { supportService } from './supportService'
const key = ['demo-workspace']
export const changeDemo = supportService.update
export function useDemo() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: key, queryFn: () => supportService.read() })
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(0)
  useEffect(() => supportService.subscribe(() => { void client.invalidateQueries({ queryKey: key }) }), [client])
  const setData = useCallback((update: DemoData | ((current: DemoData) => DemoData)) => {
    setSaveError(''); setPending(n => n + 1)
    return supportService.update(current => typeof update === 'function' ? update(current) : structuredClone(update))
      .then(data => { client.setQueryData(key, data); return true })
      .catch(error => { setSaveError(error.message || 'Save failed. Please retry.'); return false })
      .finally(() => setPending(n => n - 1))
  }, [client])
  return { ...query, setData, saveError, saving: pending > 0 }
}
