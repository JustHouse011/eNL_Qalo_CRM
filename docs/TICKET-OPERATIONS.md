# Phase 4B: ticket management and agent operations

Phase 4B extends the existing local service, workspace provider and React Query cache. No provider, authentication, push or deployment is introduced. Phase 4C remains outside this change.

## Lifecycle and preservation

Ticket states are New, Open, In Progress, Pending Customer, Escalated, Resolved, Reopened and Closed. The stored legacy Pending value is retained and interpreted as Pending Customer. Existing records and legacy replies remain; historical creation timestamps and events are not invented.

`ticketSupport.ts` defines an explicit transition table. New/Open can enter active handling, escalation or resolution; active handling can wait, escalate or resolve; resolved records can reopen or close; closed records must reopen before editing. Commands reject invalid transitions, foreign references and unauthorized actors before committing. Resolution and closure timestamps are recorded for performed transitions.

| Current state | Allowed next states |
| --- | --- |
| New | Open, In Progress, Escalated, Resolved |
| Open | In Progress, Pending Customer, Escalated, Resolved |
| In Progress | Pending Customer, Escalated, Resolved |
| Pending Customer | In Progress, Escalated, Resolved |
| Escalated | In Progress, Pending Customer, Resolved |
| Resolved | Reopened, Closed |
| Reopened | In Progress, Pending Customer, Escalated, Resolved |
| Closed | Reopened |

Creation carries a retained request ID for retry protection. Notes deduplicate by caller-supplied ID. Events carry UUID, workspace ID, ticket ID, actor ID, ISO timestamp, type and metadata. Creation, assignments, priority/department changes, status transitions, escalation, resolution, reopening, closure, support edits and notes record actual actions. Legacy history is displayed separately.

The conversation dialog captures its originating workspace and conversation, prefills subject/category/priority/department/eligible assignment, copies customer context and description, prevents duplicate submission and navigates to the created ticket. Filters are cleared so a changed department cannot hide the result. Completion from an unmounted workspace cannot redirect the current view. Ticket query parameters and inbox links provide navigation in both directions. Workspace changes retain the existing confirmed remount/draft-clearing behavior. Commands use fresh snapshots and invalidate the existing workspace query through service subscriptions.

## Agents and departments

The existing Team route now opens profiles, persists simulated online/away/offline availability and department membership IDs, and derives conversation/ticket/department workloads. Staff can manage their own simulated presence; department membership management requires support-management capability. Invitations remain local drafts; actual workspace membership changes use the existing workspace management screen.

Ticket selectors use own-workspace departments and active agents; foreign IDs, offline agents and agents outside a declared department membership are ineligible for new assignments. Away agents remain assignable: availability is a simulated indicator, not a staffing guarantee. Legacy agents without department memberships retain unrestricted eligibility; this is explicitly labeled, rather than fabricating membership history. Existing assignment names remain display-compatible while service commands use stable IDs.

Qalo retains business areas and gains a department filter. eNL retains its banking taxonomy. Legacy assignments remain historical even if their agents become unavailable.

## Files changed in 4B

- `src/lib/ticketSupport.ts`: ticket and simulated agent commands, eligibility and transition helpers.
- `src/data/demoData.ts`, `src/lib/workspaceTypes.ts`: additive ticket lifecycle/event/profile fields.
- `src/features/Records.tsx`: existing ticket list/detail/forms connected to commands.
- `src/features/AgentOperations.tsx`, `src/App.tsx`: profiles, workloads, conversation creation and navigation.
- `src/features/BusinessArea.tsx`: Qalo department filtering.
- `src/lib/workspaceMigration.ts`: validate optional events/memberships/presence and retain stable ticket relationship IDs.
- `src/lib/conversationLifecycle.ts`, `src/features/CustomerChat.tsx`: availability-aware takeover/assignment and local automatic routing.
- `src/lib/bankingSupport.ts`: atomic offline ticket creation event with the fictional customer actor reference.
- `src/features/SupportContext.tsx`, `src/features/SupportReports.tsx`, `src/features/BankingWorkspace.tsx`: direct ticket links, closed-ticket backlog exclusion and honest simulated dashboard presence labeling.
- `src/theme.css`: ticket fieldset inherits the existing form layout without a browser-default border.
- `tests/browser/ticket-operations.spec.ts`: command, isolation and browser coverage.
- `tests/browser/workspace.spec.ts`: preserves the existing journey assertions and follows the required new ticket navigation back to its source conversation.
- `tests/browser/enl-workspace.spec.ts`: verifies the selected assignment name and persisted stable ID.
- `tests/browser/product-copy.spec.ts`: retains the original copy/network restrictions with exact verified exceptions for required simulated-presence labels, including their CSS-uppercase rendering.
- This document and backend/operational handoff links.

## Limitations

All identity, capabilities and presence are browser-local simulations. Local storage remains whole-envelope last-writer-wins across tabs and subject to quota. Reply actions save local text only; no customer delivery is implied. Events are not tamper-proof audit records. Existing legacy timestamps remain as stored. Legacy agents without explicit department memberships remain eligible across departments until configured. Removing or deactivating a membership retains historical assignments, but new assignments require an active member. Ticket analytics/event-ledger aggregation, notification read state and assistant/knowledge parity belong to later approved subphases.

## Validation

Final validation on 9 October 2026:

| Check | Result |
| --- | --- |
| Independent TypeScript (`node node_modules/typescript/bin/tsc -b`) | Passed; the final production build also passed TypeScript |
| Lint | Passed with the same five existing React warnings |
| Production build | Passed; existing large-chunk warning remains (951.17 kB minified entry, 273.84 kB gzip) |
| Local legacy backend suite | All 13 passed; no external backend connected |
| Full browser run | All 74 then-present cases ran: 70 passed, four failed, in 19.3 minutes |
| Final affected-suite rerun | 11 of 12 passed, including all six ticket cases then present, eNL ticket/selection/offline checks, conversation permissions and no-workspace recovery |
| Final copy/conversion rerun | Both passed: all-route copy/network audit and the seventh new ticket case, focused conversation conversion/navigation/persistence |
| Whitespace check (`git diff --check`) | Passed |

Across the full run and final reruns, 74 of the 75 current cases have passing results. **One existing two-page Qalo journey remains timed out under its unchanged 60-second budget**, including when run alone. Its trace shows accumulated delays through existing customer chat, replies and notes, with no failed assertion. A passing complete run of this particular long case could not be obtained in this session; validation is therefore not entirely green. Its assertions and timeout have not been weakened. The focused conversion case and existing Qalo/eNL lifecycle/widget cases independently passed the affected workflows.

The initial full run also exposed two corrected compatibility issues: a missing-snapshot read in the new department filter when an account has no active workspace, and changed wording in the existing active-agent error. Their original regression cases now pass. The all-route audit exceeded its budget in the full run and subsequently passed on the final code with its original 120-second budget. Earlier label collisions and ambiguous status feedback were corrected before the final runs.

Coverage includes creation and linked creation, retry protection, assignment/reassignment, availability/department eligibility, foreign reference rejection, escalation/resolution/reopening/closure, invalid transitions, actor/event ownership, internal notes, reload persistence, legacy content/inactive-owner preservation, actual delayed writes after workspace switching, responsive layouts and bidirectional navigation. The existing migration/backup/recovery/cache-isolation and workspace-management suites ran as well. No requested validation command or current test case was left unrun. Fixtures use isolated storage/browser contexts, not the user's browser profile.

Some completed runs required cleanup of their identified temporary Vite process to finish Windows test-server shutdown. No unrelated development server or browser process was stopped. Earlier uncommitted Phase 1-4A changes remain preserved.

## Phase 4C readiness

The workspace-bound commands, ticket events, department memberships and existing scoped cache provide the foundation for Phase 4C. The remaining validation caveat is the long existing Qalo test's timing failure. Persistent notification read state, assistant/knowledge management parity and later analytics/customer journeys remain outside this phase. Implementation stops after Phase 4B; no Phase 4C work, push or deployment has been performed.
