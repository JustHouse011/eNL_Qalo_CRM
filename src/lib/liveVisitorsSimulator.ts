import type { VisitorRepository } from './visitorRepository'
import type { VisitorDataset } from './visitorAnalytics'
import { createVisitorFixtures, advanceVisitorFixtures } from './liveVisitorsFixtures'
import { dayKey } from './reporting'

type Scheduler = { every: (tick: () => void, milliseconds: number) => unknown; cancel: (id: unknown) => void; visible: () => boolean; onVisibility: (changed: () => void) => () => void; now: () => number }
const browserScheduler: Scheduler = {
  every: (tick, ms) => globalThis.setInterval(tick, ms),
  cancel: id => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  visible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  onVisibility(changed) { if (typeof document === 'undefined') return () => {}; document.addEventListener('visibilitychange', changed); return () => document.removeEventListener('visibilitychange', changed) },
  now: () => Date.now(),
}
/** In-memory only. This module has no persistence, mutation, analytics-write or network API. */
export function createVisitorSimulator(authorize: (workspaceId: string, actorId: string) => void, scheduler: Scheduler = browserScheduler): VisitorRepository {
  type State = { data: VisitorDataset; frame: number; listeners: Set<() => void>; timer?: unknown; stopVisibility?: () => void }
  const states = new Map<string, State>()
  function state(id: string) {
    let item = states.get(id)
    if (!item) { item = { data: createVisitorFixtures(id, scheduler.now()), frame: 0, listeners: new Set() }; states.set(id, item) }
    return item
  }
  function configure(id: string, item: State) {
    if (item.timer !== undefined) { scheduler.cancel(item.timer); item.timer = undefined }
    if (!item.listeners.size || item.data.simulation?.paused || !scheduler.visible()) return
    item.timer = scheduler.every(() => {
      const now = scheduler.now()
      item.data = dayKey(new Date(item.data.asOf!)) !== dayKey(new Date(now)) ? createVisitorFixtures(id, now) : advanceVisitorFixtures(item.data, ++item.frame, now)
      for (const listener of item.listeners) listener()
    }, 6000)
  }
  return {
    async read(workspaceId, actorId, signal) {
      signal.throwIfAborted(); authorize(workspaceId, actorId); signal.throwIfAborted()
      return structuredClone(state(workspaceId).data)
    },
    subscribe(id, listener) {
      const item = state(id); item.listeners.add(listener)
      if (!item.stopVisibility) item.stopVisibility = scheduler.onVisibility(() => configure(id, item))
      configure(id, item)
      return () => {
        item.listeners.delete(listener)
        if (item.listeners.size) return
        if (item.timer !== undefined) scheduler.cancel(item.timer)
        item.stopVisibility?.(); states.delete(id)
      }
    },
    setPaused(id, paused) {
      const item = state(id); item.data.simulation = { paused }; configure(id, item)
      for (const listener of item.listeners) listener()
    },
  }
}
