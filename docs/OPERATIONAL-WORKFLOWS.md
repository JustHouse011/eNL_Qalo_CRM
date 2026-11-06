# Phase 4 operational audit and 4A handoff

Phase 4B is now implemented on this foundation; see [TICKET-OPERATIONS.md](TICKET-OPERATIONS.md) for its scope, commands, routing, profiles and validation. The original 4A audit below remains a historical handoff. Phase 4C and 4D remain pending approval.

Scope: inspect the active frontend and complete conversations/human takeover only. Phases 4B (tickets/team), 4C (assistant/knowledge/notification management) and 4D (analytics/final journeys) remain pending approval. Earlier Phase 1–3 records, configuration, legacy keys and migration backups are preserved.

## Audit of the active implementation

| Module | Working before 4A | Gaps and planned subphase |
| --- | --- | --- |
| Shared inbox | Scoped records, search, priority/department/area filters, notes, transcript export, context editing, replies, resolution and ticket conversion | Assignment and status changes used separate reducers; Qalo auto acknowledgement continued after takeover, eNL resolved takeover was allowed, events were inconsistent. Addressed in 4A. Attachment controls save a filename reference only. |
| AI conversations | Deterministic Qalo widget replies; banking-safe eNL replies and four handling states | Delayed Qalo reply needed a fresh ownership check, Qalo standalone chat always acknowledged messages. Addressed in 4A. Full assistant enable/persona/source/reporting parity remains 4C. |
| Human takeover | eNL membership check and assignment; Qalo assign-to-me | Explicit lifecycle, resolved guard, return-to-AI eligibility, timeline and notifications needed. Addressed in 4A. |
| Tickets | Standalone and linked creation, edit/status/priority, replies/private notes, context links; banking agent and department selectors | Complete escalation, consistent activity, permission checks and bidirectional navigation belong to 4B. |
| Customers | Editing, CSV validation/import/export, organisation links and support history | More complete journey integration belongs to 4B/4D; existing records are reused. |
| Team | Scoped directory, workload counts, account previews and workspace membership management | Directory profile action is a toast, invitation is a draft, directory availability/department labels need record-driven management in 4B. |
| Departments | Scoped queues, stable department IDs, creation/edit/rename and routing settings | Full agent-to-department membership and availability-aware assignment belong to 4B. |
| Knowledge | Create/edit, publication, search and public Qalo help; eNL review gate/source eligibility | Consistent draft/review/preview experience and source parity belong to 4C. eNL drafts remain unpublished/unverified. |
| Notifications | Qalo fixture feed, banking waiting events, preference filtering, transient mark-all-read | 4A adds scoped conversation events/takeover notifications. Persistent per-item/user read states and ticket events belong to 4C. |
| Analytics | Qalo timestamp-based reports/exports; eNL derived conversation/ticket totals and trends | Unify AI/human/workload metrics, remove static availability labels and define complete event analytics in 4D. Existing totals continue to consume the same conversation records. |
| Customer widgets | Qalo floating preview and standalone chat; eNL independent preview, local history/offline tickets/human request | 4A connects lifecycle, human requests and reply suppression; Qalo floating session now survives refresh. Final full ticket journey and unified offline behavior remain 4D. |
| Workspace settings | Membership-aware scoped metadata/settings, operating hours, routing/assignment/preferences, theme/branding | Real auth, live presence, provider connections and secure widget sessions remain outside this frontend phase. |

## 4A architecture

`conversationLifecycle.ts` provides explicit workspace-bound commands over the existing local `SupportService`. It validates active workspace/member/agent identities, operates on the latest snapshot, and records ISO-timestamped typed events. Existing `status` and four-state `handling` fields remain compatible; optional `lifecycle` represents New and Reopened explicitly. New is captured as the creation event before local routing; Reopened persists until another handling transition. Old records infer their state without reseeding or rewriting their history.

Customer message IDs and staff reply IDs provide idempotence for retries with the same ID. Takeover and human-request repetitions are idempotent. Assignment keeps one active local owner; AI/waiting states clear both assignment fields. Notes remain private. Resolution disables public human replies and takeover; staff reopen or a customer message records a reopening event. Return to AI rejects resolved, urgent, fraud/security and assistant-disabled cases. Delayed widget replies recheck the latest state at commit time and cannot answer a human-owned/resolved conversation.

Permissions are frontend simulations, not production security. Public preview commands intentionally use fictional browser-local sessions. There is no network delivery, language model, bank access or live agent transfer. Existing Qalo fictional customer acknowledgements after a human reply are retained for compatibility; they are customer fixture messages, not assistant replies.

The existing inbox now exposes handling-state filters and searches all message text plus support metadata. Its knowledge link stays inside the selected workspace. The new-conversation action opens the appropriate Qalo/eNL preview; other created workspaces have no public preview configured and cannot accidentally start a Qalo conversation through that action.

## Validation

Final validation on 9 October 2026:

| Check | Result |
| --- | --- |
| Independent TypeScript (`tsc -b`) | Passed; also passed in the final production build |
| Full browser suite (`npm test`) | 68 passed in 8.1 minutes; no failures or skips |
| Affected-suite rerun | 23 passed, including all new lifecycle cases and the existing eNL/copy cases |
| Local legacy backend tests | 13 passed; no external backend connected |
| Production build | Passed; existing large-chunk warning remains (936.83 kB minified entry, 269.86 kB gzip) |
| Lint | Passed with the same 5 existing React warnings |
| `git diff --check` | Passed |

Coverage includes transitions, permissions, idempotence, delayed replies, notes, stable assignments, routing/priority events, resolution/reopening, scoped notifications, both 4A customer journeys, full-thread search, state filtering, refresh persistence and workspace switching. Existing migration, backup/recovery, modified-record preservation, real React-hook cache isolation, responsive layouts and Phase 1–3 workflows also passed. No requested check was left unrun. Initial timing and locator/copy compatibility failures were resolved before the final run. Some targeted runs needed cleanup of their identified Vite test server after workers finished; the final full run exited normally.

The eight new tests exercise the reduced-motion preference. Existing visual/browser cases retain their settings. The journey and persistence checks are separate focused cases with the existing 60-second budget; no assertion or timeout is weakened. The delayed-response race loads both pages before pausing the shared browser clock, then resumes it after takeover to verify the real timer cannot reply. Migration/isolation cases use isolated fixtures, not the user's browser profile.

The historical product-copy audit prohibited all simulation wording, conflicting with Phase 4's explicit AI labeling requirement. Its original copy pattern and external-request checks remain intact; only the verified icon control named `Return to simulated AI` is exempted from the attribute audit. Closed filter controls are unmounted, so their hidden options cannot duplicate the visible handling badge. Persistence tests also verify the Mine queue, reopened-state filtering, full-thread search and filter open/close behavior. Platform preview delegates staff commands to the workspace's first active fictional agent; the Mine view uses that same identity.

## Files changed in 4A

| File | Change |
| --- | --- |
| `src/lib/conversationLifecycle.ts` | Shared lifecycle, staff/customer commands, membership checks, typed events, notifications and delayed-response guard |
| `src/data/demoData.ts`, `src/lib/workspaceMigration.ts` | Additive lifecycle/event/simulated-message fields and validation |
| `src/lib/bankingSupport.ts` | Existing banking start/send/request/takeover delegate to shared lifecycle; disabling synchronizes state |
| `src/lib/customerSupport.ts` | Qalo floating widget creation, customer messages, delayed response and resolution use lifecycle helpers |
| `src/App.tsx` | Existing inbox commands, handling indicators, composer/assignment guards and scoped event feed |
| `src/features/CustomerChat.tsx` | Qalo standalone lifecycle, scoped active assignment, simulated responses and human request |
| `src/features/SupportWidget.tsx`, `src/features/SupportWidget.css` | Existing floating widget human request, refreshable session, handling indicator and wrapping toolbar |
| `src/features/BankingWorkspace.tsx` | Existing eNL preview lifecycle/simulation labels and duplicate-submit guard |
| `tests/browser/conversation-lifecycle.spec.ts` | New command and Qalo/eNL journey coverage |
| `tests/browser/customer-preview.spec.ts` | Existing journey now explicitly takes over before replying; original assertions retained |
| `tests/browser/product-copy.spec.ts` | Narrow verified AI-control exception required by the explicit simulation-label requirement; other copy/network checks retained |
| `docs/OPERATIONAL-WORKFLOWS.md`, `docs/BACKEND.md` | Operational audit and 4A handoff |

The working tree also contains the earlier uncommitted Phase 1–3 implementation; those changes are retained.

## Remaining limitations

Local storage remains last-writer-wins across tabs and subject to quota. Message IDs deduplicate a retry only when the caller retains that ID. Legacy timeline timestamps remain as stored; new events use ISO timestamps. Notification read state remains temporary until 4C. Presence and frontend permissions are simulated. Ticket/team expansion, assistant configuration parity, final analytics and ticket-complete customer journeys remain for 4B–4D. No push, deployment, provider integration or storage reset is included.
