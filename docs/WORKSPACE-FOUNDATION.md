# Phase 1: multi-workspace frontend foundation

Phase 3 is documented in [ENL-WORKSPACE.md](ENL-WORKSPACE.md); it now adds the independent eNL banking fixture and scoped frontend modules. Earlier phase descriptions below are historical.
This document records Phase 1. [Phase 2 workspace management](WORKSPACE-MANAGEMENT.md) now adds management screens, membership controls and the switcher on top of this foundation.

This phase adds tenant-aware local data infrastructure to the existing Qalo frontend. It creates only `workspace-qalo`. Workspace management, a visible switcher, full permission-based UI and eNL fixtures belong to later phases. No external service, deployment or live website is involved.

## Models and service boundary

`src/lib/workspaceTypes.ts` defines `Workspace`, `WorkspaceMembership`, `WorkspaceOwned`, `WorkspaceUser`, `WorkspaceData`, `WorkspaceStore` and frontend capability helpers. Platform Super Admin is a user-level role. Workspace Admin, Supervisor and Support Agent are membership roles. The initial three Qalo agents receive stable user IDs and active memberships; no platform super administrator is granted automatically.

`WorkspaceData` requires ownership on persisted entity collections, including nested messages/history/documents and ticket replies. Existing `DemoData` remains the compatible UI draft shape. The persistence boundary adds ownership to new drafts and rejects records explicitly owned by another workspace. Configured widgets and AI guidance receive independent IDs and workspace ownership.

`SupportService.readWorkspace(id)` and `updateWorkspace(id, reducer)` operate on an explicit snapshot. Reads return detached copies. Updates keep existing contact/conversation/ticket synchronization and normalize ownership before validating and committing. A missing or inactive workspace cannot be updated. The reducer is synchronous local application logic, not a transport payload.

`read`, `update` and `reset` retain compatibility defaults that always target Qalo; they never look up a mutable active workspace. This keeps Qalo-only customer widget helpers safe while those experiences await later workspace-aware UI work. Static reference catalogs remain Qalo-only and return empty tenant-specific arrays when asked for another workspace. Their full migration into editable tenant catalogs is later work.

Assignments retain display names for existing forms and gain `assigneeId`; departments gain stable IDs with `departmentId` links. Messages gain `conversationId`. Unknown legacy assignee names remain intact with a null ID rather than being mapped to the wrong agent. Existing unresolved legacy links are retained; migration does not delete or invent replacement business records.

New entity IDs are generated once and retained through subsequent edits. Queue renames retain department identity and update linked conversation, ticket and rule labels. Departments with the same name in different business areas have separate IDs.

## React state and cache

`WorkspaceProvider` sits inside the existing router and QueryClient provider. It exposes the registry, current ID, membership-aware selection and capability checks without adding navigation or changing styles. It subscribes to local changes and same-origin storage events.

`useDemo` uses `['demo-workspace', workspaceId]`. Its query function, subscription and mutation callback capture the workspace ID. A callback retained before a switch writes and caches its result under its original ID. Invalidation is exact and workspace-specific. Existing routes and component props are preserved.

Queries wait for the registry to resolve before reading a workspace. Saving and error state are also indexed by workspace, so completion of an older operation cannot show a different workspace's saving indicator or error.

Capability checks are frontend presentation helpers. Real authentication, server authorization, tenant isolation and database row-level security (where applicable) remain required before production. Local state can be edited by a browser user; none of these helpers provide security.

## Storage and migration

The new key is `qalo-workspaces-v2`, with this envelope:

```ts
{
  version: 2,
  activeWorkspaceId: 'workspace-qalo',
  workspaces: [...],
  users: [...],
  memberships: [...],
  snapshots: { 'workspace-qalo': workspaceData }
}
```

On first read:

1. If the new key exists, parse and validate it. It is authoritative; stale legacy data never replaces it automatically.
2. Otherwise, read `qalo-frontend-demo-v1`. With no legacy key, initialize the existing Qalo seed.
3. Validate the legacy structure and IDs, add ownership and stable relationship fields, merge missing settings defaults, and validate the new envelope. Existing entity IDs, records, custom content and unknown extension fields remain. The existing exact-match presentation migration is retained for known old fixture strings; it does not broadly rewrite user-authored wording.
4. Save the exact original legacy string to `qalo-frontend-demo-v1-backup` and read it back before writing the new key. If a different backup already exists, keep it and create a suffixed backup instead.
5. Save and verify the new envelope. Keep the original legacy key and every backup. No silent reset or cleanup occurs.

Malformed data, unsupported versions, duplicate IDs, invalid memberships and mismatched ownership produce a recovery error. They are not overwritten with seeds. When a readable legacy snapshot cannot be backed up or committed, reads remain available but writes are blocked (`migration-pending`). Free storage and reload to retry.

When browser storage is completely unavailable, the existing memory-only mode remains usable. Such edits last only for the current page lifetime; they cannot be backed up or survive reload. `persistenceState()` reports `persistent`, `memory` or `migration-pending`.

## Explicit recovery

Do not delete the new key to fix an error: doing so can import an older legacy snapshot. Review/export the current key, legacy key and backups first.

`recoverWorkspaceStore(storage, sourceKey)` in `workspaceMigration.ts` is an explicit developer recovery utility, not an automatic fallback or a customer-facing reset control. The caller must select a reviewed legacy or version-2 backup. It validates the source, archives the current new-key string (even when corrupt) under `qalo-workspaces-v2-recovery-backup` or a unique suffix, verifies retained source data, and then writes the validated replacement. Reload the app afterward. Recovery from a legacy backup intentionally restores that backup's point in time; later records remain only in the archived current store.

The application does not add authentication tokens or external provider secrets to these support snapshots. Backups retain the exact existing local content; keep them out of the repository.

## Limitations

- Same-origin tabs remain last-writer-wins. There is no server concurrency control or reliable realtime transport.
- The UI still presents Qalo. Switching infrastructure is for later management and module-scoping work; no eNL workspace or visible workspace selector is added here.
- Existing role-preview UI has not been replaced with a signed-in membership session.
- Existing module-local selection and draft-reset behavior needs review when a visible workspace switcher is introduced.
- Backups consume browser storage. No automatic deletion or retention policy is introduced.
- The existing development reset restores Qalo fixtures in its snapshot only; it does not remove the registry, legacy source or migration backups.

## Validation

Foundation tests in `tests/browser/workspace-foundation.spec.ts` cover clean and edited migration, backup ordering, idempotence, recovery, corruption, quota failure, memory fallback, ownership, scoped reads/writes, stable relationship IDs, capabilities and query-cache isolation. A browser test verifies that legacy private notes, tickets and new post-migration replies survive reload. The existing presentation migration test now constructs its legacy fixture from the new snapshot and explicitly removes the new test-store key before exercising legacy import.

Validation completed on 8 October 2026:

| Check | Result |
| --- | --- |
| `node node_modules/typescript/bin/tsc -b` | Passed; the final production build also runs `tsc -b` |
| `npm.cmd run build` | Passed; existing warning about the main bundle exceeding 500 kB remains |
| `npm.cmd run lint` | Passed with the five existing warnings in DemoAccess, CustomerChat, SupportReports and App; no new warnings |
| `npm.cmd test` | Final run: 42 passed, one existing customer-chat test exceeded its 60-second total budget; all 21 foundation tests passed |
| `npm.cmd test -- --grep 'customer chat, agent reply, note privacy'` | The timed-out case passed in 32 seconds with the original timeout and assertions; all 43 test cases are covered across the full run and this targeted rerun |
| `npm.cmd run test:legacy-backend` | All 13 existing local tests passed; no external service was connected |
| `git diff --check` | Passed |

The earlier full regression run passed all 37 cases then present. The final suite includes 22 existing and 21 new foundation cases. The timeout is an observed timing limitation of the long multi-page browser test; it was not bypassed by changing its timeout or weakening assertions. No requested validation command remains unrun. The source-import hook harness is development-server-only and would be skipped if the optional `QALO_PREVIEW=1` suite were invoked; the requested production build itself was successfully validated.

The successful targeted rerun waited for its temporary Vite server to exit after the test worker had finished. Stopping that identified test-server process allowed Playwright to report `1 passed` and return exit code 0. This cleanup delay is recorded as a test-runner limitation.

## Files changed

| File | Purpose |
| --- | --- |
| `src/lib/workspaceTypes.ts` | Strong models, capability matrix and workspace query keys |
| `src/lib/workspaceMigration.ts` | Normalization, validation, backup, migration and explicit recovery |
| `src/lib/supportService.ts` | Scoped local service, injectable storage and subscriptions |
| `src/lib/demoStore.ts` | Workspace-bound queries, mutations and write status |
| `src/features/WorkspaceContext.tsx` | Registry, active workspace and membership-aware selection |
| `src/data/demoData.ts` | Compatible optional relationship fields on UI drafts |
| `src/lib/workspaceSettings.ts` | Stable default-assignee relationship |
| `src/App.tsx` | Provider integration within the existing shell |
| `tests/browser/workspace-foundation.spec.ts` | Migration, isolation, failure, capability and browser coverage |
| `tests/helpers/workspaceHookHarness.tsx` | Actual hook integration test harness; excluded from the app bundle |
| `tests/browser/product-copy.spec.ts` | Adapt existing legacy fixture setup to the new authoritative store |
| `docs/WORKSPACE-FOUNDATION.md` | Architecture, migration, recovery and limitations |
| `docs/BACKEND.md` | Superseding note for the new frontend persistence boundary |
