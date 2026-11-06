# Phase 2: workspace management

Phase 3 is documented in [ENL-WORKSPACE.md](ENL-WORKSPACE.md); it now adds the independent eNL banking fixture and scoped frontend modules. Earlier phase descriptions below are historical.
Phase 2 extends the [Phase 1 foundation](WORKSPACE-FOUNDATION.md). The default installation still initializes only Qalo. Other workspaces are created explicitly through the interface; no eNL workspace or external integration is introduced.

## Architecture

`workspaceManagement.ts` defines typed management commands and a detached store reducer. `supportService.manage(actorId, command)` reads the latest version-2 registry, checks frontend capabilities, validates the command and commits the whole validated envelope through the existing persistence boundary. Commands carry their target workspace ID. Creation generates independent workspace, membership and agent IDs with empty support collections and generic local configuration. It never clones Qalo records, catalogs or departments.

The existing `qalo-workspaces-v2` schema and migration remain unchanged. Legacy data and verified backups remain untouched. Failed writes surface errors; migration-pending stores remain read-only. Deactivation retains snapshots, memberships, settings and relationship IDs. Removing a membership retains the user and historical agent identity so support history can still resolve assignments.

`WorkspaceProvider` resolves the active account against memberships and available active workspaces. An unavailable saved selection falls back to the first permitted active workspace; no assigned workspaces produces an empty state. Explicit selections persist in the registry. The account preview is remembered in session storage. Selecting a workspace rechecks the latest registry in the service.

React Query retains `['demo-workspace', workspaceId]` keys, exact invalidation and callbacks bound to their originating workspace. The workspace view remounts when the workspace ID changes, clearing conversation selection, open editors, reply drafts and component-local state. Switching requires confirmation; cancellation retains the draft. Old conversation query parameters are removed. Changing account within the same permitted workspace preserves the existing profile menu behavior. Public Qalo chat/help reads are explicitly pinned to Qalo, as are the existing widget compatibility commands.

## Routes and controls

- `/workspaces`: cards/list, search, status filter, member counts, creation dates, create/edit/open/settings/status actions.
- `/workspaces/:workspaceId` and `/workspaces/:workspaceId/settings`: general information, branding, configuration, derived record counts, timestamps and memberships.
- Create/edit use a native modal dialog with browser focus trapping, Escape and focus restoration. Fields validate names, unique lowercase slugs, organisation type, six-digit colours and approved logo choices.
- Configuration includes operating hours/timezone/days/offline greeting, routing, assignment mode and notifications. Existing selected-workspace settings remain available and require workspace-management capability.
- Membership controls add existing users or fictional users, edit roles, toggle active status and remove memberships with confirmation. Assigned workspaces are shown. The reducer protects the final active workspace administrator from removal, demotion or deactivation.
- The sidebar selector lists permitted active workspaces. Branding uses scoped theme variables, existing logo assets or initials. Qalo retains its default palette, glass panels, animated borders and light/dark appearance. Tenant-specific agent choices and retail/reference catalogs are scoped.

## Frontend permission preview

These permissions are **simulated frontend permissions, not authentication or backend security**. Every browser user can select a profile or edit local data. Before production, replace this with authenticated sessions and server-enforced tenant authorization.

The original three profiles keep their existing user IDs and memberships. The explicit **Platform Super Admin** account preview is a virtual user-level role; it does not add platform privileges to existing users or use a workspace membership role.

| Action | Platform Super Admin | Workspace Admin | Supervisor / Support Agent |
| --- | --- | --- | --- |
| Create workspace | Yes | No | No |
| Activate/deactivate workspace | Yes | No | No |
| Edit metadata, settings and members | All workspaces | Own active memberships | No |
| Open/switch workspace | Any active workspace | Assigned active workspace | Assigned active workspace |

Inactive workspaces remain visible to their assigned users for information, but ordinary members cannot open or manage them. Platform administrators can inspect and reactivate them. Low-level compatibility reads and reducers remain local infrastructure, not a secure API.

## Files changed in Phase 2

| Area | Files |
| --- | --- |
| Management commands | `src/lib/workspaceManagement.ts` (new), `src/lib/supportService.ts`, `src/lib/workspaceTypes.ts` |
| Management UI | `src/features/Workspaces.tsx` and `src/features/Workspaces.css` (new), `src/App.tsx`, `src/theme.css` |
| Account, selection and cache | `src/features/DemoAccess.tsx`, `src/features/WorkspaceContext.tsx`, `src/lib/demoStore.ts` |
| Existing scoped views | `src/features/ConfigurationEditors.tsx`, `src/features/Retail.tsx`, `src/features/SupportContext.tsx`, `src/features/CustomerChat.tsx` |
| Tests | `tests/browser/workspace-management.spec.ts` (new) |
| Documentation | `docs/WORKSPACE-MANAGEMENT.md` (new), `docs/WORKSPACE-FOUNDATION.md`, `docs/BACKEND.md` |

Other uncommitted Phase 1 foundation files remain part of the existing work and were preserved.

## Validation and limitations

Tests cover clean/modified legacy migration, recovery, independent creation, duplicate slugs, metadata, permissions, memberships, last-admin protection, status preservation, cache isolation, delayed writes, browser reload, branding, draft reset, filters and native dialog focus at desktop/tablet/mobile sizes.

Final validation on 2026-10-08:

| Check | Result |
| --- | --- |
| `tsc -b` | Passed independently and as part of the production build |
| `npm.cmd run lint` | Passed with the same five pre-existing React warnings |
| `npm.cmd run build` | Passed; existing large-chunk warning remains (approximately 894 kB minified entry chunk) |
| `npm.cmd test` | All 52 tests passed in the final full run, including nine new Phase 2 tests |
| `npm.cmd run test:legacy-backend` | All 13 existing local tests passed; no external backend was contacted |
| `git diff --check` | Passed |

The initial regression run exposed an account-menu reset that was corrected before the final full run. New narrow-layout checks also led to explicit dialog focus restoration and accessible filter names. No tests were skipped. Migration and preservation tests use isolated clean and modified fixtures; they do not inspect the user’s personal browser profile.

Known limitations inherited from Phase 1: browser storage only, whole-envelope last-writer-wins concurrency between tabs, storage quota constraints and no authenticated identity. New workspaces use the existing shared business-area taxonomy and component structures; tenant-specific business taxonomies/catalog editing and public tenant URLs are later work. Public Qalo previews remain intentionally Qalo-only. Activity uses record counts and the workspace updated timestamp; it is not an immutable audit log. Only approved bundled logos or initials are supported. Custom branding contrast remains the workspace administrator’s responsibility.

The legacy Team invitation dialog continues to prepare an invitation draft; actual local membership changes are made through workspace details. There is no email delivery, provider connection, AI execution, push or deployment in this phase.

Phase 3 can build on this registry, empty workspace initialization, memberships, management commands and scoped UI. Phase 2 stops here; no eNL data is seeded.
