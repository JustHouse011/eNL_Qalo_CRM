import { refineIdentityFixtures } from './identityPreview'
import { presentProductCopy } from './productCopy'
import type { DemoData } from '../data/demoData'
import { agents, roles, teams, workspaces, initiatives, products, orders, deliveries, refunds, notifications, channels, createMockData } from '../data/mockCatalog'
import { loadWorkspaceStore, scopeWorkspaceData, validateWorkspaceStore, WORKSPACE_STORAGE_KEY, type PersistenceState, type WorkspaceStorage } from './workspaceMigration'
import { canInWorkspace, QALO_WORKSPACE_ID, type WorkspaceData, type WorkspaceStore } from './workspaceTypes'
import { manageWorkspace, platformPreview, type ManagementCommand } from './workspaceManagement'
import { initializeEnlStore } from './enlWorkspace'

export interface SupportService {
  referenceData(workspaceId?: string): { agents: typeof agents; roles: typeof roles; teams: typeof teams; workspaces: typeof workspaces; initiatives: typeof initiatives; products: typeof products; orders: typeof orders; deliveries: typeof deliveries; refunds: typeof refunds; notifications: typeof notifications; channels: typeof channels }
  read(workspaceId?: string): Promise<WorkspaceData>
  update(change: (current: DemoData) => DemoData, workspaceId?: string, actorId?: string): Promise<WorkspaceData>
  reset(workspaceId?: string): Promise<WorkspaceData>
  readWorkspace(workspaceId: string, actorId?: string): Promise<WorkspaceData>
  updateWorkspace(workspaceId: string, change: (current: DemoData) => DemoData, actorId?: string): Promise<WorkspaceData>
  registry(): WorkspaceStore
  manage(actorId: string, command: ManagementCommand): void
  initializeIdentity(): void
  initializeEnl(actorId: string): string
  persistenceState(): PersistenceState
  selectWorkspace(workspaceId: string, actorId?: string): void
  subscribe(listener: () => void, workspaceId?: string): () => void
  notifyStorageChange(): void
}

/** Commands bind to explicit workspace IDs; compatibility calls always target Qalo. */
export function createSupportService(getStorage: () => WorkspaceStorage | null): SupportService {
  let memory: WorkspaceStore | undefined
  let state: PersistenceState = 'memory'
  const listeners = new Set<{ listener: () => void; workspaceId?: string }>()
  function storage() { try { return getStorage() } catch { return null } }
  function readStore() {
    if (!memory || state !== 'memory') {
      const target = storage()
      if (memory && !target) throw new Error('Browser storage is unavailable. Your loaded data has been retained; reload to retry.')
      if (memory && state === 'persistent' && target?.getItem(WORKSPACE_STORAGE_KEY) === null) throw new Error('Workspace data needs recovery: the current store was removed. The loaded data and legacy backups have not been reset.')
      const loaded = loadWorkspaceStore(target)
      if (memory && loaded.state === 'memory') throw new Error('Browser storage could not be read. Your loaded data has been retained; reload to retry.')
      memory = loaded.store; state = loaded.state
    }
    return presentProductCopy(structuredClone(memory))
  }
  function notify(workspaceId?: string) { for (const subscription of listeners) if (!workspaceId || !subscription.workspaceId || subscription.workspaceId === workspaceId) subscription.listener() }
  function commit(store: WorkspaceStore, workspaceId?: string) {
    validateWorkspaceStore(store)
    if (state === 'migration-pending') throw new Error('Migration backup could not be saved. Free browser storage and reload before making changes. Your original data is retained.')
    if (state === 'persistent') {
      const target = storage()
      if (!target) throw new Error('Browser storage is unavailable. Changes were not saved; reload to retry.')
      target.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(store))
    }
    memory = structuredClone(store)
    notify(workspaceId)
  }
  function snapshot(store: WorkspaceStore, id: string) {
    if (!Object.hasOwn(store.snapshots, id)) throw new Error(`Workspace ${id} was not found`)
    return store.snapshots[id]
  }
  function requireWorkspaceAccess(store: WorkspaceStore, workspaceId: string, actorId: string | undefined, capability: 'view' | 'reply') {
    if (actorId === undefined) return
    const workspace = store.workspaces.find(item => item.id === workspaceId && item.status === 'active')
    const actor = actorId === platformPreview.id ? platformPreview : store.users.find(user => user.id === actorId)
    if (!workspace || !canInWorkspace(actor, workspace, store.memberships, capability)) throw new Error('This user cannot access the workspace.')
  }
  const service: SupportService = {
    referenceData(workspaceId = QALO_WORKSPACE_ID) {
      const qalo = workspaceId === QALO_WORKSPACE_ID
      return structuredClone({ agents: qalo ? agents : [], roles, teams: qalo ? teams : [], workspaces: qalo ? workspaces : [], initiatives: qalo ? initiatives : [], products: qalo ? products : [], orders: qalo ? orders : [], deliveries: qalo ? deliveries : [], refunds: qalo ? refunds : [], notifications: qalo ? notifications : [], channels })
    },
    registry() { return readStore() },
    manage(actorId, command) { commit(manageWorkspace(readStore(), actorId, command)) },
    initializeEnl(actorId) { const result = initializeEnlStore(readStore(), actorId); if (result.created) commit(result.store); return result.workspaceId },
    initializeIdentity() { const original = readStore(); const refined = refineIdentityFixtures(original); if (refined !== original) commit(refined) },
    persistenceState() { return state },
    selectWorkspace(workspaceId, actorId) {
      const store = readStore()
      snapshot(store, workspaceId)
      if (actorId && !canInWorkspace(actorId === platformPreview.id ? platformPreview : store.users.find(u => u.id === actorId), store.workspaces.find(w => w.id === workspaceId), store.memberships, 'view')) throw new Error('This user is not assigned to the workspace')
      if (store.workspaces.find(workspace => workspace.id === workspaceId)?.status !== 'active') throw new Error('This workspace is inactive')
      store.activeWorkspaceId = workspaceId
      commit(store)
    },
    async read(workspaceId = QALO_WORKSPACE_ID) { return snapshot(readStore(), workspaceId) },
    async readWorkspace(workspaceId, actorId) {
      const store = readStore()
      requireWorkspaceAccess(store, workspaceId, actorId, 'view')
      return snapshot(store, workspaceId)
    },
    async update(change, workspaceId = QALO_WORKSPACE_ID, actorId) {
      const store = readStore()
      if (store.workspaces.find(workspace => workspace.id === workspaceId)?.status !== 'active') throw new Error('This workspace is inactive or missing')
      requireWorkspaceAccess(store, workspaceId, actorId, 'reply')
      const previous = snapshot(store, workspaceId)
      const next = change(structuredClone(previous))
      next.conversations = next.conversations.map(c => {
        const contact = next.contacts.find(p => p.id === c.contactId)
        const old = previous.contacts.find(p => p.id === c.contactId)
        return contact && old && (contact.name !== old.name || contact.email !== old.email) ? { ...c, customer: contact.name, email: contact.email, initials: contact.name.split(/\s+/).map(n => n[0]).join('').slice(0, 2), messages: c.messages.map(m => m.kind === 'customer' ? { ...m, author: contact.name } : m) } : c
      })
      next.contacts = next.contacts.map(c => ({ ...c, conversations: next.conversations.filter(item => item.contactId === c.id).length }))
      next.tickets = next.tickets.map(t => { const c = next.conversations.find(c => c.id === t.conversationId); return c ? { ...t, customer: c.customer, contactId: c.contactId } : t })
      const scoped = scopeWorkspaceData(next, workspaceId)
      store.snapshots[workspaceId] = scoped
      store.workspaces = store.workspaces.map(workspace => workspace.id === workspaceId ? { ...workspace, settings: scoped.settings!, updatedAt: new Date().toISOString() } : workspace)
      commit(store, workspaceId)
      return structuredClone(scoped)
    },
    async updateWorkspace(workspaceId, change, actorId) { return service.update(change, workspaceId, actorId) },
    async reset(workspaceId = QALO_WORKSPACE_ID) {
      if (workspaceId !== QALO_WORKSPACE_ID) throw new Error('No seed is available for this workspace')
      return service.update(() => createMockData(), workspaceId)
    },
    subscribe(listener, workspaceId) { const subscription = { listener, workspaceId }; listeners.add(subscription); return () => { listeners.delete(subscription) } },
    notifyStorageChange() { notify() },
  }
  return service
}
export const supportService = createSupportService(() => window.localStorage)
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.key === WORKSPACE_STORAGE_KEY || event.key === null) supportService.notifyStorageChange() })
