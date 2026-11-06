import { useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkspaceProvider, useWorkspace } from '../../src/features/WorkspaceContext'
import { useDemo } from '../../src/lib/demoStore'
import { supportService } from '../../src/lib/supportService'
import { workspaceQueryKey } from '../../src/lib/workspaceTypes'

/** Served by Vite in the browser test only; never imported by the application. */
export function mountWorkspaceHookHarness() {
  const client = new QueryClient()
  const state: {
    service: typeof supportService
    client: QueryClient
    key: typeof workspaceQueryKey
    root?: Root
    current?: ReturnType<typeof useDemo> & { workspaceId: string }
  } = { service: supportService, client, key: workspaceQueryKey }
  function Harness() {
    const { workspaceId } = useWorkspace()
    const demo = useDemo()
    useEffect(() => { state.current = { ...demo, workspaceId } }, [demo, workspaceId])
    return null
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  state.root = root
  root.render(<QueryClientProvider client={client}><WorkspaceProvider><Harness /></WorkspaceProvider></QueryClientProvider>)
  return state
}
