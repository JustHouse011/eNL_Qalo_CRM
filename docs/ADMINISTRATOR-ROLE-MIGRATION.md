# Administrator role migration — Stage A1

## A. Existing role audit

The previous model stored `platformRole: platform-super-admin | null` on users and `workspace-admin`, `supervisor`, `support-agent` (plus a partly supported viewer) on memberships. `canInWorkspace` granted the platform bypass before checking identity status; identities had no status field. Workspace selection duplicated permission filtering in the context, shell and management page. The old validator rejected viewer memberships.

Definitions and persistence: `workspaceTypes.ts`, `workspaceMigration.ts`, `supportService.ts`. Fixture creation/refinement: `identityPreview.ts`, `enlWorkspace.ts`. Management: `workspaceManagement.ts`. Consumers: `WorkspaceContext.tsx`, `App.tsx`, `Identity.tsx`, `Workspaces.tsx`, `conversationLifecycle.ts`, `ticketSupport.ts`. Session compatibility: `DemoAccess.tsx`. Browser tests contained legacy account aliases and assumptions that Bongani lacked global access before identity refinement.

Historical docs (including IDENTITY-ACCESS and D1/D2 reports) are retained as historical stage records. Legacy identifiers now appear only in compatibility parsing, review provenance, and compatibility tests. Operational snapshot agent titles (`Admin`, `Supervisor`, `Agent`) and the old mock catalog are retained as data projections, not permission authorities. They will need account/UI label reconciliation in A2.

The pre-existing dirty working tree was inspected and preserved. A pre-edit snapshot of src/tests/docs and Git status is under ignored `.local-data/administrator-a1/baseline`.

## B. New role hierarchy

| Identifier | Display | Scope |
| --- | --- | --- |
| `administrator` | Administrator | Global; all existing and future workspaces |
| `supervisor` | Supervisor | Assigned workspaces; operational oversight |
| `agent` | Support Agent | Assigned workspaces; support operations |
| `viewer` | Viewer / Auditor | Assigned workspaces; existing read-only interfaces |

Users carry a canonical role and active/inactive/suspended status. Membership roles exclude `administrator`: workspace commands cannot grant a global role. For non-administrators the workspace membership remains the authority for scoped capabilities; the user role is not an additional grant.

## C. Permission mapping

`isAdministrator` requires both canonical administrator role and active identity status. `canInWorkspace` remains the single capability authority. `getAccessibleWorkspaces` delegates to it and is used by context, shell selector and workspace management. Administrators require no memberships and automatically see future workspace additions. Inactive workspaces remain available for administrative management, but are excluded from the switcher; existing service restrictions prevent opening/writing inactive workspaces. Administrators may access platform management even with no selected workspace.

Supervisors keep view/reply/manage-support. Agents keep view/reply. Viewers keep view only. Non-administrators cannot manage platform, workspace settings or memberships, cannot self-assign access, and cannot bypass inactive workspace or identity status restrictions. Existing restrictive route mappings remain unchanged, including report restrictions for viewers.

The former last-workspace-administrator membership check is retired: removing Bongani's workspace membership does not demote the global identity. There is no global role mutation command in A1. Global self-demotion/last-active-Administrator assignment safeguards remain A2 work.

## D. Mock identity migration

- Bongani (`user-agent-1`): canonical Administrator, same ID and personal storage. Existing memberships are retained as scoped records but do not grant or limit global access.
- Phindile (`user-agent-2`): agent, existing Qalo and eNL assignments retained.
- Tumo (`user-agent-3`): agent, Qalo only; any legacy non-Qalo assignments are retained as inactive.
- Demo Naledi Dube (`user-enl-admin-demo`): former workspace administrator, restricted to supervisor, flagged for explicit access review. Not promoted globally.
- Demo Kabelo Maseko: workspace supervisor. Demo Zanele Mokoena: workspace agent. Other existing identities remain present; ambiguous roles are retained with provenance and review flags.

Existing inactive/suspended identities remain denied, including Bongani. The compatibility migration changes user/membership metadata only; it does not rewrite snapshots, customer records, tickets, assignments, dashboard inputs or personal profiles. Existing one-time identity fixture initialization continues for fresh installations; already refined stores skip it as before.

Fixture initialization also preserves existing inactive memberships; it does not reactivate them while applying the approved role names. Missing initial approved assignments can still be added on fresh fixture initialization.

Fixture refinement resolves approved IDs first. A same-name identity under a different ID, with the approved ID missing, is retained and flagged for review rather than duplicated or elevated by name alone.

## E. Compatibility handling

The workspace store stays version 2, with additive `administratorRoleVersion: 1`. Existing stores without that marker are validated, cloned and normalized once. Canonical stores are validated strictly, including viewer roles, user status and absence of active legacy platform roles. Unsupported future role-model versions fail closed.

| Legacy value/context | Mapping |
| --- | --- |
| Approved Bongani identity | `administrator`; preserve status |
| `support-agent` membership/user | `agent` |
| `supervisor` / `viewer` membership | Preserve |
| Other `workspace-admin` | Scoped supervisor, `legacyRole`, `accessReviewRequired`; no global grant |
| Other legacy platform role / unknown user role | Viewer and review flag; suspend active or statusless identity, retain already inactive/suspended status |
| Unknown membership role | Inactive viewer, original role retained, review flag |
| Administrator in a membership | Inactive viewer pending review; global authority comes from user role only |

The original serialized store is verified under `qalo-administrator-a1-backup` before replacement. Conflicting backup contents receive a unique suffix. The replacement is read back for verification. Backup/write failures retain the source and expose the existing migration-pending state, blocking service mutations. Existing legacy/recovery backups remain in place; explicit recovery also normalizes role metadata. No unrelated storage is cleared.

Selected workspace IDs, IDs/names, unknown record fields, snapshots and per-user profile/preferences keys are preserved. Context falls back to the first permitted active workspace if a saved selection is unauthorized. No missing membership is invented by the compatibility pass; the approved fixture initialization still supplies initial agent assignments on fresh installs.

Saved development aliases (`Admin`, `Platform Super Admin`, `Supervisor`, `Agent`) resolve only to existing fixture IDs through `previewIdentity`; permissions come from the current registry identity and status. The historical `user:platform-preview` alias also maps to Bongani, never to the internal initializer actor. Both profile-preview and developer-login preferences use this adapter. Invalid saved aliases fail closed to sign-in (or an explicit developer-preference error), rather than falling back to Administrator. Fresh mock sessions retain the existing Bongani default. `/dev/session` and the sign-in link retain their existing DEV gating. Normal profile menus do not gain identity switching.

## F. Files changed

- `src/lib/workspaceTypes.ts`: canonical types, status-aware capabilities and central workspace selector.
- `src/lib/administratorRoles.ts`: compatibility normalization and developer identity alias adapter.
- `src/lib/workspaceMigration.ts`: strict canonical validation, verified role backup/write, fresh/recovery normalization.
- `src/lib/identityPreview.ts`, `src/lib/enlWorkspace.ts`: canonical identity/membership fixtures.
- `src/lib/workspaceManagement.ts`: active Administrator checks, canonical scoped membership commands; remove obsolete workspace-admin invariant.
- `src/lib/conversationLifecycle.ts`: Administrator selector in the existing actor resolution.
- `src/features/WorkspaceContext.tsx`, `src/App.tsx`: central workspace access and canonical role checks.
- `src/features/DemoAccess.tsx`: identity-only session type and legacy session alias normalization; session strings no longer act as roles.
- `src/features/Settings.tsx`: central permission checks in the older alternate settings component.
- `src/features/Workspaces.tsx`, `src/features/Identity.tsx`: minimal adapters to compile and operate with canonical scoped roles and permission checks; no screen redesign.
- `tests/browser/administrator-roles.spec.ts`: global/no-membership/future access, identity status, scoped restrictions, migration retention/backup failure, aliases and browser guards.
- `tests/browser/{identity,workspace-foundation,workspace-management,enl-workspace,conversation-lifecycle,ticket-operations}.spec.ts`: update affected role assumptions, retaining isolation and lifecycle assertions; establish the foreign-write test baseline after one-time role normalization.
- `docs/ADMINISTRATOR-ROLE-MIGRATION.md`: this A1 report.

## G. Tests

- Preliminary relevant run: 65 cases, 60 passed and 5 failed. Two tests still expected Bongani to be denied eNL access; denial checks now use Tumo. The foreign-write test now captures its unchanged-store baseline after the authorized one-time role normalization, and explicitly checks that normalization preserves snapshots. Two workspace browser cases timed out and are included in the clean rerun. No permission/isolation expectation was removed to obtain a pass.
- Clean rerun of the same seven relevant spec files: **65 passed (8.8 minutes)**.
- Final focused `administrator-roles.spec.ts` run after tightening inactive-membership retention and malformed saved-session handling: **6 passed (1.5 minutes)**. Includes browser reload after membership removal, suspended-Administrator route denial, invalid saved alias sign-out, ambiguous identity retention, inactive membership retention, verified backups, and current/future workspace access.
- `npm.cmd run build`: TypeScript and production bundle passed after updating the alternate settings component. Existing >500 kB chunk warning remains.
- `npm.cmd run lint`: passed with the five existing React warnings (DemoAccess exports, CustomerChat/ReportDatePicker Date calls, two App effects).
- `git diff --check`: passed; existing line-ending notices are informational.
- Snapshot audit: the D1 foundation hash remains `01f4b5c805d6e8390f9fb93e9c16c4eae1c5d3fe94314fd789b4fdf0875a20bd`. All CSS, dashboard components/calculations, public widgets and business fixture files match the pre-A1 snapshot.

No full-suite pass is claimed. All original 119 browser cases are retained, with six additional role-migration cases (125 total).

Commands executed:

```powershell
npx.cmd playwright test tests/browser/administrator-roles.spec.ts tests/browser/workspace-foundation.spec.ts tests/browser/workspace-management.spec.ts tests/browser/identity.spec.ts tests/browser/enl-workspace.spec.ts tests/browser/conversation-lifecycle.spec.ts tests/browser/ticket-operations.spec.ts --reporter=line
npx.cmd playwright test tests/browser/administrator-roles.spec.ts --reporter=line
npx.cmd playwright test --list
npm.cmd run build
npm.cmd run lint
git diff --check
```

Logs are retained under `.local-data/administrator-a1` (`targeted-tests.log`, `final-tests.log`, `role-final.log`, `test-list.log`). Known Windows validation-server shutdown lingering occurred after test workers exited; only the identified validation Vite processes were stopped to finalize reports. The user development server remained running at `http://127.0.0.1:5173/overview` and returned HTTP 200.

## H. Security limitations

All permissions remain frontend prototype checks over editable local storage. This is not authentication or server-side tenant authorization. Internal fixture initialization still uses an explicit synthetic Administrator actor; normal session aliases do not expose it as a selectable account. Production enforcement, verified sessions, server permissions, invitations and authoritative audit logs remain future backend work. Supabase stays disabled.

## I. Outstanding issues

A2 must update Administration naming/navigation, user management role controls, global-role explanation in My Access, developer labels, and global assignment/self-demotion/last-active-Administrator safeguards. A1 makes only required canonical role/control adapters; it does not introduce global role editing. Some existing account views still describe assigned membership records rather than derived global access. Review flags are persisted metadata, not a newly designed review screen; legacy Naledi/custom workspace administrators need explicit approval for any future global grant.

D1/D2 style files, chart calculations, public widgets, backend, dependencies and business fixtures are outside this change. Existing lint and large-chunk build warnings remain. No database migration, deployment, commit or push is authorized or performed.

## J. Approval status

Stage A1 implementation, architecture/security review and quality checks are complete. Stopped for explicit A1 approval. A2 and A3 have not started. No commit, push, deployment, backend/Supabase change or database migration was performed.
