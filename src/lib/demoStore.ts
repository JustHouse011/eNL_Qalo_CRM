import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoData } from '../data/demoData'
import { supportService } from './supportService'
import { useWorkspace } from '../features/WorkspaceContext'
import { workspaceQueryKey } from './workspaceTypes'
export const changeDemo = supportService.update
export function useDemo(pinnedWorkspaceId?: string) {
  const { workspaceId: selectedId, registry, error: workspaceError, actorId, can } = useWorkspace()
  const workspaceId = pinnedWorkspaceId || selectedId
  const allowed = !!pinnedWorkspaceId || can(actorId, 'view')
  const key = workspaceQueryKey(workspaceId)
  const client = useQueryClient()
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const query = useQuery({ queryKey: key, queryFn: () => supportService.readWorkspace(workspaceId, pinnedWorkspaceId ? undefined : actorId), enabled: !!registry && !workspaceError && allowed })
  type WriteStatus = { error: string; pending: number }
  const [statuses, setStatuses] = useState<Record<string, WriteStatus>>({})
  const updateStatus = useCallback((id: string, change: (status: WriteStatus) => WriteStatus) => {
    setStatuses(current => ({ ...current, [id]: change(current[id] || { error: '', pending: 0 }) }))
  }, [])
  useEffect(() => supportService.subscribe(() => { void client.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId), exact: true }) }, workspaceId), [client, workspaceId])
  const setData = useCallback((update: DemoData | ((current: DemoData) => DemoData)) => {
    updateStatus(workspaceId, status => ({ error: '', pending: status.pending + 1 }))
    return supportService.updateWorkspace(workspaceId, current => typeof update === 'function' ? update(current) : structuredClone(update), pinnedWorkspaceId ? undefined : actorId)
      .then(data => { if (active.current) client.setQueryData(workspaceQueryKey(workspaceId), data); return true })
      .catch(error => { updateStatus(workspaceId, status => ({ ...status, error: error instanceof Error ? error.message : 'Save failed. Please retry.' })); return false })
      .finally(() => updateStatus(workspaceId, status => ({ ...status, pending: status.pending - 1 })))
  }, [client, workspaceId, pinnedWorkspaceId, actorId, updateStatus])
  const status = statuses[workspaceId]
  return { ...query, data: allowed ? query.data : undefined, error: workspaceError ? new Error(workspaceError) : query.error, setData, saveError: status?.error || '', saving: (status?.pending || 0) > 0 }
}
