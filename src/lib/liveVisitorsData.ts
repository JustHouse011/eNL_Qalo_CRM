import { visitorRepository, assertVisitorAccess, type VisitorRepository } from './visitorRepository'
import { createVisitorSimulator } from './liveVisitorsSimulator'
import { visitorFixtureProfiles } from './liveVisitorsFixtures'
import { supportService } from './supportService'
import { crmDemoMode } from './runtimeMode'

// Production builds always use the recorded/live adapter, regardless of a developer's local env file.
export const visitorDemoMode = crmDemoMode
const simulation = visitorDemoMode ? createVisitorSimulator((workspaceId, actorId) => assertVisitorAccess(supportService, workspaceId, actorId)) : null
export function visitorSourceFor(workspaceId: string): VisitorRepository {
  return simulation && Object.hasOwn(visitorFixtureProfiles, workspaceId) ? simulation : visitorRepository
}
