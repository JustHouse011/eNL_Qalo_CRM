import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { DemoAccessProvider } from '../../src/features/DemoAccess'
import { WorkspaceProvider } from '../../src/features/WorkspaceContext'
import { LiveVisitorsDashboard } from '../../src/features/LiveVisitorsDashboard'
import { visitorRepository, type VisitorRepository } from '../../src/lib/visitorRepository'

/** Browser-test-only adapter; never imported by the app or its production entry point. */
export function mountVisitorHarness() {
  type Mode = 'loading' | 'error' | 'empty'
  let mode: Mode = 'loading'
  let release: (() => void) | undefined
  const listeners = new Set<() => void>()
  const source: VisitorRepository = {
    async read(workspaceId, actorId, signal) {
      if (mode === 'loading') await new Promise<void>((resolve, reject) => {
        const abort = () => reject(new DOMException('Read cancelled', 'AbortError'))
        signal.addEventListener('abort', abort, { once: true })
        release = () => { signal.removeEventListener('abort', abort); resolve() }
      })
      signal.throwIfAborted()
      if (mode === 'error') throw new Error('Tracking connection interrupted')
      const base = await visitorRepository.read(workspaceId, actorId, signal)
      return { ...base, sessions: [], conversations: [], pageViews: [], tracking: { ...base.tracking, state: 'connected', presence: true, visitors: true, pageViews: true } }
    },
    subscribe(_id, changed) { listeners.add(changed); return () => { listeners.delete(changed) } },
  }
  const original = document.getElementById('root')!
  original.style.display = 'none'
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const client = new QueryClient()
  root.render(<QueryClientProvider client={client}><BrowserRouter><DemoAccessProvider><WorkspaceProvider><div className="app-shell theme-light"><LiveVisitorsDashboard repository={source} /></div></WorkspaceProvider></DemoAccessProvider></BrowserRouter></QueryClientProvider>)
  return {
    set(next: Mode) { mode = next; release?.() },
    subscriptions() { return listeners.size },
    unmount() { root.unmount(); client.clear(); host.remove(); original.style.display = '' },
  }
}
