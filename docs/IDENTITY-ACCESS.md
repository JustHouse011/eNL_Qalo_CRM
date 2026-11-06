# Identity and workspace access frontend refinement

This stage uses fictional local fixtures only. It adds no authentication, migrations, Supabase accounts, email delivery or server authorization.

## Review

Run the Vite development server and open `/dev/session` to select a fictional user. This route and the login link to it are gated by `import.meta.env.DEV`. Normal profile menus contain no identity selector. `/signin` remains the shared mock login; its code preview is simulated, not delivered email or real MFA.

| Fixture | Qalo | eNL | Platform Administration |
| --- | --- | --- | --- |
| Bongani Nombamba | Workspace Admin | Workspace Admin | Yes, Super Admin |
| Phindile Khumalo | Support Agent | Support Agent | No |
| Tumo Likotsi | Support Agent | None | No |

Existing fixture IDs are reused. Workspace and actor changes remount transient workspace state. Data caches and saves remain scoped to workspace IDs. A one-workspace selector is disabled. The central permission model gates navigation and direct CRM routes. Viewers receive the overview and account/access interfaces; operational editing routes require reply permission. Existing workspace administration remains the membership editor for permitted administrators.

Profile edits and personal preferences use per-user local keys. Initials provide a local avatar. Language is English only. Security actions are disabled pending authentication integration. Invitations save a local draft or simulated pending record after review, without creating users or sending email. Audit History is explicitly local invitation history, not an authoritative audit log.

## Files in this refinement

- `src/App.tsx`: menu, routes, permission visibility, transient resets, identity display and preferences.
- `src/features/ConfigurationEditors.tsx`: retire the existing simulated password-success workflow in workspace settings.
- `src/features/DemoAccess.tsx`: development-only session selection link and persistent mock sign-out.
- `src/features/Identity.tsx`, `src/features/Identity.css`: account, security, access, preferences and platform screens; isolated developer preview.
- `src/features/WorkspaceContext.tsx`: normalize legacy platform preview sessions to Bongani.
- `src/lib/identityPreview.ts`: central route capability mapping, retaining the existing identity fixtures.
- `tests/browser/identity.spec.ts`: identity/access matrix, workspace isolation, responsiveness, invitation and sign-out checks.
- `tests/browser/{workspace-management,enl-workspace,conversation-lifecycle,product-copy,mock-scope}.spec.ts`: migrate legacy account-selector tests to developer preview and current access behavior.

Existing uncommitted changes in these and other files were preserved.

## Backend requirements

Real authentication and session invalidation; identity/profile storage; verified password, MFA and session operations; server-side workspace permissions and tenant isolation; invitation tokens and verified email delivery; durable audit records; protected platform settings; production notification delivery and localization. Frontend checks and browser storage are not a security boundary.

Stop here for visual review and explicit approval. No deployment, GitHub push or next stage is authorized by this refinement.

## Validation result

- TypeScript and production build passed; lint passed with existing warnings.
- Full browser pass: 93 passed, 8 failures investigated. The affected tests included old account-switching/role assumptions, the retired password-success workflow, required login disclosure, and clock timing.
- Focused final-code checks: 13 passed; the remaining eNL fixture still had only one workspace. Its setup was corrected to assign and sign in as Bongani, then both persisted-lifecycle tests passed (2/2).
- Together these runs cover all 102 current browser cases, including the additional personal-profile/preference isolation test. This is combined full-suite and focused verification, not a claim of a single clean full-suite run.
- All six identity tests passed, including the access matrix, direct-route permissions, workspace reset/branding boundaries, responsive profile, local invitations, sign-out and per-user preference isolation.
- No remaining known failure from the inspected runs. Existing lint warnings and the production chunk-size warning remain.
