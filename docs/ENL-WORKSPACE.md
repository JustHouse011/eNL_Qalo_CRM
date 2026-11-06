# Phase 3: eNL Mutual Bank frontend workspace

## Opening the workspace

Open Profile menu, choose **Platform Super Admin** under Switch account, then choose **eNL Mutual Bank** in the workspace selector. The three fictional eNL profiles are also available in Switch account. They belong to eNL only; Qalo users are not automatically granted eNL membership.

Customer preview: `/enl-preview`. The selected staff workspace does not change the workspace associated with this preview or an existing widget session. Qalo customer chat/help and its floating widget retain their Qalo service boundary.

## Configuration

| Property | Value |
| --- | --- |
| Initial stable ID | `workspace-enl-mutual-bank` |
| Slug | `enl-mutual-bank` |
| Name | eNL Mutual Bank |
| Type | Banking / Financial Services |
| Description | Digital customer support and AI assistance workspace for eNL Mutual Bank. |
| Primary / secondary | `#652D8D` / `#B59BD3` |
| Assistant | eNL Virtual Assistant |
| Tagline | Banking you for a purpose |
| Logo | Initials/name placeholder; no approved eNL logo was found in the project |

No official bank departments, product terms or policies are asserted. The supplied product names are used as enquiry labels only. No real account, transaction, credential, identity or card information is seeded.

## Initialization and persistence

`SupportService.initializeEnl(actorId)` delegates to `initializeEnlStore`, which uses the existing Phase 2 `manageWorkspace` creation command with a reserved stable ID. It builds the independent fixture in a detached store and commits the validated envelope once. Normal workspace creation retains UUID-generated IDs. Only the frontend Platform Super Admin role can initialize eNL.

`WorkspaceProvider` invokes this authorized setup once on application boot after the Phase 1 store has loaded. Migration-pending stores are not extended: the verified legacy backup and migration commit must succeed first. Browser memory-only mode also supports eNL, with the existing page-lifetime persistence limitation.

An existing `enl-mutual-bank` slug is authoritative. Initialization does not change its ID, metadata, inactive status, members, records, edits or configuration, and does not reseed deleted records. A pre-existing manually created workspace with that slug is preserved rather than silently converted or overwritten; it needs a reviewed configuration/import if it does not already have the banking dataset. A reserved-ID collision with another slug fails safely.

The version-2 envelope and storage key remain unchanged. Legacy keys, migration backups, existing Qalo snapshots and other workspaces are retained. Optional banking fields extend the existing data models; banking configuration and source/department ownership are validated. Nothing reads `.env.local` for this phase or connects a provider.

## Dataset and modules

| Records | Initial fixture |
| --- | --- |
| Customers / conversations | 10 fictional customers and 10 independent conversations |
| Handling | 3 AI Handling, 3 Waiting for Agent, 2 Human Handling, 2 Resolved |
| Tickets | 6: 4 open, 2 resolved, with conversation/customer/department references and activity |
| Agents / memberships | 3 fictional eNL users: Workspace Admin, Supervisor, Support Agent; active memberships and online fixture presence |
| Departments | 7 proposed demo queues, with stable workspace-owned IDs |
| Articles | 7 unpublished generic drafts, all requiring review |
| Notifications | 3 initial workspace-owned waiting-customer notifications |
| Configuration | Independent assistant, widget, operating hours, routing and notification preferences |

Proposed departments: General Enquiries, Personal Banking, Business Banking, Digital Banking Support, Cards and Payments, Complaints and Disputes, Fraud and Security. Qalo keeps its Community Investment / Qalo Store / technical configuration. Banking uses department IDs and banking categories in the UI; the legacy `general` area value remains an internal compatibility field.

Enquiries cover Becha, Nala, Temo, Pusha, Owner, mobile banking, cards, general questions, complaints and fraud. Contacts use `Demo` names and `example.invalid` addresses. Customer status, related conversations and ticket history reuse the contact module. Tickets reuse the existing creation/editing/reply/resolution module, with eNL agent/department selections and local edit activity.

The eNL overview/reports derive total/active/AI/human conversations, open/resolved tickets, online agent fixture presence, average first response time, recent history and volume/trend tables from the selected workspace records. Ticket trends show update dates and current resolved status; they are not an immutable event ledger. Online presence is fixture data rather than a live availability service.

## Assistant and widget behavior

The banking assistant panel supports enable/disable, persona/instructions, reviewed knowledge selection, escalation/fraud departments and a test conversation. Disabling the assistant moves AI cases into local Waiting for Agent state. Settings save through the captured workspace query/mutation boundary. Editing persona/instructions stores configuration; no language model executes them.

Deterministic local responses offer general support, app-navigation guidance, ticket/human-request guidance and a basic demo summary. Safety rules take precedence over editable configuration. Responses never supply product fees, interest rates, limits, eligibility or policies; never request secrets or full card numbers; and never claim banking access/actions or successful live transfer. Credential-like assignments and long number sequences are rejected before widget messages are saved. This is a basic frontend guard, not production data-loss prevention.

Knowledge starts unpublished. Banking publication requires an explicit review flag, and only Workspace Admin/Supervisor or Platform Super Admin can edit/review it. Source checkboxes require published content reviewed for demo use. This flag is a local permission/content-review simulation, not proof of official banking approval. All official product information still requires approved source material and review before real use.

The mock website/widget supports open/close, Escape and focus return, independent branding, local AI replies, local human requests, history, new conversations and offline ticket creation. Its session ID uses `banking-widget:<workspaceId>` in session storage. Internal notes are excluded from public history. Human requests change local queue state and create eNL notifications; an authorized active eNL agent can take over in the existing inbox. Platform preview takeover uses an active eNL fixture agent. Human replies appear in the preview via the existing same-origin storage subscription. No live message or transfer occurs.

## Files changed in Phase 3

| Area | Files |
| --- | --- |
| New seed and local banking commands | `src/lib/enlWorkspace.ts`, `src/lib/bankingSupport.ts` |
| New UI and taxonomy | `src/features/BankingWorkspace.tsx`, `src/features/BankingWorkspace.css`, `src/features/workspaceTaxonomy.ts` |
| Existing models/persistence/service | `src/data/demoData.ts`, `src/lib/workspaceTypes.ts`, `src/lib/workspaceMigration.ts`, `src/lib/workspaceManagement.ts`, `src/lib/supportService.ts` |
| Existing provider/shell | `src/features/WorkspaceContext.tsx`, `src/features/DemoAccess.tsx`, `src/features/BusinessArea.tsx`, `src/App.tsx` |
| Reused modules | `src/features/Records.tsx`, `src/features/Knowledge.tsx`, `src/features/ConfigurationEditors.tsx`, `src/features/SupportContext.tsx`, `src/features/Pipelines.tsx`, `src/features/Retail.tsx`, `src/features/CustomerChat.tsx` |
| Tests | `tests/browser/enl-workspace.spec.ts`, `tests/browser/workspace-management.spec.ts` (expected platform workspace count includes eNL) |
| Documentation | `docs/ENL-WORKSPACE.md`, `docs/BACKEND.md`, foundation/management handoff links |

Earlier uncommitted Phase 1/2 changes remain preserved.

## Validation and remaining work

The eNL suite covers creation, stable ownership, idempotence, modified Qalo and backup preservation, dashboard metrics, department filtering, customer/knowledge isolation, banking safety, membership permissions, assistant settings, reviewed sources, ticket editing/resolution, offline/mobile widget behavior, sessions, takeover, branding, switching and reload. Existing foundation tests exercise captured asynchronous writes, exact cache isolation and draft reset across workspaces.

| Validation | Result |
| --- | --- |
| TypeScript (`tsc -b`) | Passed independently and in the production build |
| Full browser suite (`npm test`) | 60 passed, including all 8 eNL tests and existing Qalo/workspace tests |
| Local legacy backend suite | 13 passed; no external service used |
| Production build | Passed; existing bundle-size warning remains |
| Lint | Passed with 5 existing warnings |
| Whitespace/error check (`git diff --check`) | Passed |

No requested automated check was left unrun. No test timeout, assertion strength or TypeScript configuration is weakened.

All permissions, users, assistant responses and banking content are frontend simulations. Browser storage remains last-writer-wins across tabs and subject to quota; public previews contain fictional local data and have no authentication. There is no Supabase, Firebase, OpenAI or Tawk.to integration, live website edit, push or deployment.

Remaining work before production: authenticated user sessions, server-enforced tenant authorization, durable/concurrent storage, verified banking content and real content-review controls, secure public widget sessions, provider integrations when authorized, proper event-ledger analytics/live presence and production-grade sensitive-data controls. These are outside Phase 3. The frontend registry, banking department taxonomy, scoped modules and adapter boundary are ready for the Phase 4 handoff.
