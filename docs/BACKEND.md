# Current product presentation (supersedes earlier UI terminology)

**Phase 4B update:** [TICKET-OPERATIONS.md](TICKET-OPERATIONS.md) records workspace-bound ticket commands, explicit transitions, activity events, stable assignment IDs, simulated agent profiles and department eligibility. Exact simulated-presence labels are required and supersede the earlier blanket presentation-copy policy. Existing local storage and backups are retained; no provider integration is added.

**Phase 4A update:** [OPERATIONAL-WORKFLOWS.md](OPERATIONAL-WORKFLOWS.md) records the operational audit and shared local conversation/takeover commands. Explicit simulated-AI labels are now required and supersede the earlier blanket presentation-copy policy where applicable. This phase adds no backend/provider integration; ticket/team expansion and later subphases remain pending approval.

**Phase 3 update:** [ENL-WORKSPACE.md](ENL-WORKSPACE.md) describes the independent eNL fixture, banking department taxonomy, local assistant/widget simulation and authorization limitations. No bank, AI provider or external service is connected.

**Workspace foundation update:** Phase 1 now persists a version-2 multi-workspace envelope under `qalo-workspaces-v2`, with only `workspace-qalo` initialized. The original `qalo-frontend-demo-v1` key is retained and verified backups precede migration. Service operations and React Query keys can be explicitly workspace-scoped. See [WORKSPACE-FOUNDATION.md](WORKSPACE-FOUNDATION.md) for the current models, migration, recovery and limitations. Historical single-snapshot descriptions below are superseded by that document where they discuss storage or cache architecture. Phase 2 now adds local workspace management, membership controls and permission-based UI; see [WORKSPACE-MANAGEMENT.md](WORKSPACE-MANAGEMENT.md). Authentication and backend enforcement remain unimplemented.

The user-facing application uses natural product language. The removal of demo/mock/simulation disclaimers is a presentation change only. **There is still no real authentication, backend, external messaging, AI provider, payment processing or production integration.** All fixtures and local services remain fictional and frontend-only. Do not infer implemented backend capabilities from the finished interface.

- Sign-in compares the entered email/password with a single client-side account (`bongani.nombamba@enlbank.co.za` / `12345678` initially), then creates an in-memory six-digit code shown in an Email preview. No email is delivered. Codes expire after five minutes; resend replaces the prior code. This is not authentication: the default credential is bundled in client JavaScript, no session or token is created, and credentials/codes are not sent to a service. A changed password is stored only as a salted PBKDF2 digest in browser localStorage; this remains client-controlled. Replace credential verification, OTP delivery/verification, and Security password management with server-side identity/session/email APIs before production. Switch account remains a separate profile-preview control.
- Messages show **Saved**, not Delivered. Automatic replies remain deterministic local fixtures. Attachment references contain filenames only; no file bytes leave the browser.
- Every channel starts **Not configured**. Channel setup stores only a display name and non-secret account/page reference in local workspace settings. The UI says **Configuration saved** and **Connection not verified**; no provider authentication or network request occurs. Edit and disconnect update local state only.
- Payment fixtures and the known legacy Paid (simulated) value display **Awaiting verification**. Refund actions only set **Review requested**; they never alter payment, delivery or fulfilment state. Existing fictional delivery statuses are retained.
- Team and visitor invitations remain **drafts**. AI suggestions require review. These workflows never dispatch external requests.
- Product reset controls were removed. In `npm run dev`, use the browser console: `await window.qaloDev.resetDemoData()`. `src/lib/devTools.ts` is loaded only behind `import.meta.env.DEV`; the hook is absent from the static production build. Display preferences remain intact. The service reset method is for development only and must not map to a production endpoint.
- `src/lib/presentationCopy.ts` migrates known legacy fixture strings, including persisted canned messages and article content. It preserves IDs, relationships, user edits and legitimate business wording. A presentationVersion marker is retained on the next save to avoid repeat processing. Existing local storage keys and schema remain unchanged; no data reset or migration to a server occurs.

Configuration currently shares the persisted `DemoData` snapshot under the existing `qalo-frontend-demo-v1` key. `DemoData.settings` uses the typed `WorkspaceSettings` shape from `src/lib/workspaceSettings.ts` for operating hours, notification preferences, routing enablement, assignment mode/default assignee and non-secret integration references. Widget appearance/hours, AI response guidance, queues, routing rules and saved replies remain typed fields on that same workspace snapshot. `supportService.update()` is still a browser-local reducer; it is not an API client. The customer chat routing example, operating-hours status, notification preference filtering and response preview are deterministic local behavior. They do not send real messages, invoke an AI provider, or contact an external channel.

The proposed endpoint, realtime, authorization, attachment and business contracts below remain requirements for the backend engineer, not implemented or approved infrastructure.

# Backend handover — frontend scope

This document supersedes previous backend setup instructions. The current deliverable is a standalone frontend with fictional data throughout. Authentication, databases, realtime transport, integrations and production services belong to a separate backend engineer. No backend vendor, database schema, deployment architecture or provider has been agreed. Historical server and Supabase code is inactive reference material only.

## Replacement boundary

`src/lib/supportService.ts` defines `SupportService` and the active browser implementation. `useDemo` consumes that interface through React Query. Components receive typed `DemoData` and update callbacks; they do not fetch API endpoints. `referenceData()` supplies typed agents, roles, teams, workspace, initiatives, retail catalog, deliveries, refunds, notifications and channel options. `read/update/reset/subscribe` operate on the mock workspace snapshot. `update` currently accepts a pure state reducer: do not serialize this function to a server. An API adapter should translate state changes to explicit resource commands or replace the hook internals with domain mutations while retaining component props. Demo reset must never map to a production deletion endpoint.

Domain shapes: `src/data/demoData.ts` (`Conversation`, `Message`, `DemoTicket`, `DemoData` and `SupportContext`). Reference shapes are inferred from `src/data/mockCatalog.ts` and exposed in `SupportService.referenceData`. `src/lib/contracts.ts` specifies draft transport types: `ListQuery`, `Page<T>`, `ApiError`, `SendMessage`, `Attachment`, `RealtimeEvent`, `BackendContract`. These contracts describe frontend needs, not an approved API.

## Mock capability inventory

| Capability | Current simulation | Replacement requirement |
| --- | --- | --- |
| Sign-in, sign-out entry, roles | Local email/password check plus in-memory OTP displayed in an Email preview; no email is delivered; password can be created/changed in Security and only its salted digest persists locally | Session lifecycle, credential verification, server-side OTP generation/storage, email delivery and verification, rate limiting, password reset/change, identity lookup, server authorization and membership |
| Workspace/team | One workspace, three agents, team, role preview, invitation preview | Workspace/team/member listing, invitations and audited role changes |
| Conversations/messages | Local messages, deterministic fictional reply, assignment, transfer, notes, resolve/reopen, transcript download | Conversation commands, delivery receipts, ownership checks, append-only audit |
| Visitors/customer widget | Fictional visitors, invitation feedback, same-origin browser chat, greeting/color/position preview | Visitor consent, identity, presence, embed origin validation, widget configuration |
| Contacts/organisations | Editable records, relationship selection, validated CSV import/export | Resource CRUD, deduplication and verified relationships |
| Applications/initiatives | Support workflow stages, document checklist flags, linked organisations | Authoritative application/document state, permitted transitions, initiative catalog |
| Store/products/deliveries/refunds | Fictional catalog and related order context; simulated payment state, no money movement | Authorized commerce reads; separately authorized refund/payment commands if approved |
| Tickets | Creation, edit, case linking, replies and private notes | Ticket CRUD, concurrency control, notification dispatch |
| Activities | Local follow-up tasks and completion | Task CRUD, scheduling and reminders |
| Knowledge/saved replies | Local editing, publication flag, search, votes, reusable text | Revisioned content, approval workflow, scoped public reads |
| Feedback | Seed rating and customer rating after resolution | Validated feedback submission and aggregation |
| Automations | Editable local rules; routing can be enabled/disabled; matching rules set a destination/priority and can add a local acknowledgement/follow-up; local run history | Audited server rule evaluation, ordering, retries and idempotency |
| Notifications | Saved local preferences filter the in-app fixture list; preview notifications are local UI only; read state is temporary | User-scoped notification feed, preference CRUD and read receipts |
| Reports | Totals/charts derived from conversations, tickets and ratings; CSV download | Equivalent server aggregates with defined timezone and date semantics |
| AI | Deterministic selected-article suggestion; no model request | Permission-aware context, approved sources, review before send, provider decision |
| Uploads | MIME/5 MB validation, filename in draft; file bytes never uploaded | Signed upload lifecycle, scanning, attachment authorization and expiry |
| Channel/payment integrations | Non-secret channel references are saved locally as Configuration saved; external connection remains not verified | Backend-owned provider adapters, secret storage, explicit authorization/connect flow, webhook verification and delivery status |

## Proposed HTTP contracts

All paths below are proposals under `/api/workspaces/:workspaceId`, except session endpoints. Resource IDs are opaque strings. Dates should be ISO 8601 UTC. Names are display fields; production assignment should use agent IDs. Snapshot data currently duplicates customer names and order context for rendering; authoritative resources should be normalized by ID in the adapter.

| Method/path | Request | Response |
| --- | --- | --- |
| POST `/api/session`; DELETE `/api/session`; GET `/api/me` | Authentication scheme to agree; never trust a requested role | Session summary `{userId, displayName, memberships: {workspaceId, role}[]}` |
| POST `/api/auth/email-otp/request`; POST `/api/auth/email-otp/verify` | Request `{email}`; verify `{challengeId,code}`. Server owns expiry, attempt limits, resend cooldown, code hashing and email delivery | Request returns `{challengeId,maskedDestination,expiresAt}`; verify returns the authenticated session summary only after a valid code |
| GET `/api/workspaces` | `ListQuery` | `Page<Workspace>` from reference shape |
| GET `/agents`, `/teams`, `/roles` | `ListQuery` | Paged corresponding reference shapes |
| POST `/invitations` | `{firstName,surname,email,role}` | `{id,status}`; delivery must be server-owned |
| PATCH `/agents/:id` | `{role?,teamId?,availability?}` | Updated agent |
| GET/POST `/conversations` | `ListQuery` / new customer enquiry fields from `Conversation` | `Page<Conversation>` / `Conversation` |
| PATCH `/conversations/:id` | Editable `Partial<Conversation>` plus expected revision; reject immutable fields | Updated `Conversation` and revision |
| GET/POST `/conversations/:id/messages` | `ListQuery` / `SendMessage` | `Page<Message>` / `Message` with server timestamp/delivery |
| POST `/conversations/:id/assignment` | `{agentId: string|null, teamId?: string, revision:number}` | Updated conversation |
| POST `/conversations/:id/status` | `{status:'open'|'waiting'|'resolved', revision:number}` | Updated conversation with resolution event |
| GET/POST/PATCH `/tickets[/id]` | `ListQuery` / editable `DemoTicket` fields | Page or saved `DemoTicket` |
| POST `/tickets/:id/replies` | `{text,private,clientRequestId}` | Ticket reply shape from `DemoTicket.replies` |
| GET/POST/PATCH `/contacts[/id]`, `/organisations[/id]` | List query / respective `DemoData` entity fields | Page or saved entity |
| GET/POST/PATCH `/applications[/id]`, `/activities[/id]` | List query / `DemoData.applications/tasks` fields | Page or saved entity |
| GET `/initiatives`, `/products`, `/orders`, `/deliveries`, `/refunds` | List query plus contactId/orderId as appropriate | Paged corresponding reference shapes |
| GET/POST/PATCH `/articles[/id]`, `/saved-replies[/id]` | List query / respective `DemoData` fields | Page or saved entity |
| POST `/feedback` | `{conversationId,rating:1|2|3|4|5}` | `{id,conversationId,rating,createdAt}` |
| POST `/articles/:id/votes` | `{helpful:boolean}` | `{helpful:number,unhelpful:number}` |
| GET/POST/PATCH `/automations[/id]`; GET `/automation-runs` | List query / `DemoData.rules` fields | Page or saved rule / run history |
| GET `/notifications`; PATCH `/notifications/:id` | List query / `{read:true}` | Page or notification including read timestamp |
| GET `/reports` | `{businessArea?,from?,to?,timezone?,groupBy?}` | `{metrics, daily:{date,newCases,resolved}[], areas, categories, workload}`; match reporting selectors |
| GET/PUT `/settings` | `WorkspaceSettings` (`operatingHours`, `notifications`, `routingEnabled`, `assignmentMode`, `defaultAssignee`) plus expected revision | Persisted settings and revision; validate timezone, hours, membership and queue/agent IDs |
| GET/PUT `/widget`, `/ai-settings`, `/queues`, `/workflows` | Corresponding typed configuration fields from `DemoData` | Saved configuration and revision |
| GET/PUT `/integrations/:id/configuration`; POST `/integrations/:id/connect`; DELETE `/integrations/:id/connection` | Non-secret display/reference fields; explicit provider authorization is a separate user action | Configuration state must remain distinct from authentication state, e.g. `{configuration:'saved', connection:'not_verified'}` until provider verification succeeds; never expose provider secrets |
| POST `/ai/suggestions` | `{conversationId,sourceIds}` | `{id,text,sourceIds,requiresReview:true}` |
| POST `/attachments`; POST `/attachments/:id/complete` | File metadata / completion reference | Attachment and upload target / scanned attachment |

Collection contracts use `Page<T>={items,nextCursor,total}`. Proposed default limit 25, maximum 100, opaque cursor; confirm limits with backend. `ListQuery` defines search, business area, status, assignee, inclusive from/to, sort and direction. Confirm case folding, timezone, searchable fields, stable tie-break IDs and authorization before implementing. Lists must not expose resources outside the session's memberships. Total is the filtered count. Empty results are successful responses.

## Realtime and state

Expected events: `conversation.updated`, `message.created`, `ticket.updated`, `notification.created`, `presence.changed`, `integration.updated`. Envelope includes event ID, workspace, entity ID, monotonic revision, timestamp and typed payload for that entity. Confirm transport; no WebSocket/provider is assumed. Clients should deduplicate, ignore stale revisions, recover with cursor/refetch after reconnect, and show reconnecting state. Never publish notes into customer subscriptions. Local storage events currently synchronize same-origin tabs; they are neither reliable realtime nor authorization.

React Query supplies loading/error states. Writes show saving state and errors; form validation handles missing input, invalid CSV, duplicate contact email and unsupported attachment types. Future API adapter must preserve drafts on failure, expose retryable `ApiError`, handle offline/403/404/409/429 states, and avoid optimistic success messages until commands succeed. Some presentational forms currently assume an immediate successful local save; review their callbacks during API migration. Use idempotency keys for sends, invitations, payment and refund commands. Define conflict handling rather than blindly retrying state reducers.

## Access and attachment expectations

Admin previews connection controls; Supervisor and Agent can review support workflows. This is a provisional UI distinction. Backend must agree an explicit permission matrix for viewing, replying, transferring, publishing, exporting, inviting and changing settings. Customers should access only their conversations and published articles; internal notes require separate server-side filtering. Authentication strategy, session expiry, CSRF/CORS and workspace isolation are backend decisions.

Attachment prototype accepts JPEG, PNG and PDF up to 5 MB and records the filename in the composer. Production needs metadata creation, authorized upload URL, upload completion, malware scan/rejection, authorized download URL, retention and deletion. Confirm file limits, content validation, quotas, note attachment privacy and storage provider. Never treat a filename as proof of upload.

## Business decisions awaiting confirmation

Confirm department ownership, role permissions, application stages and approvals, required documents, consent/retention, escalation rules, response targets, refund/payment authority, order provider and permitted data, AI sources/provider, delivery provider contracts, channel policies and webhook behavior. OWN SPAZA SHOPS participation is Community Investment; merchandise is Retail. Resolving support is not approval of an application, investment, payment, dispatch or refund. Do not infer financial performance from support activity.

## Demo persistence and reset

`qalo-frontend-demo-v1` holds fictional records in localStorage, with an in-memory fallback. Same-origin tabs are last-writer-wins. `qalo-demo-chat` in sessionStorage tracks customer selection. Theme, business area and reduced-motion have separate preference keys. The development-only `window.qaloDev.resetDemoData()` console action restores seed records, clears current chat selection and reloads, clearing temporary connection/AI/notification/role state. Display preferences remain. No migration from historical local SQLite, IndexedDB or live services occurs. Static reference catalog is regenerated from code. The client makes no backend requests for credentials; the default demonstration password remains bundled in frontend JavaScript, while a changed password is stored only as a local salted digest.
