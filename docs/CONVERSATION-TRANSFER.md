# Conversation transfer

The existing Inbox toolbar now opens one shared Transfer Conversation dialog for Qalo and eNL. It shows customer, conversation ID, workspace, current assignment and status, searchable single-agent selection, recorded presence, actual open assignment counts and an optional internal note. The dialog uses native modal focus handling, Escape, outside-click dismissal, focus return, responsive glass surfaces and theme tokens. Confirmation is disabled without an eligible selection or during a pending/conflicted transfer.

## Files

- `src/lib/conversationTransfer.ts`: eligibility, ownership, version checking, idempotent transfer command and recipient notification.
- `src/features/TransferChatDialog.tsx` and `.css`: shared accessible dialog.
- `src/data/demoData.ts`: structured transfer audit metadata and optional notification recipient.
- `src/lib/conversationLifecycle.ts`: ownership validation for ordinary agent replies and legacy reassignment controls.
- `src/lib/workspaceMigration.ts`: preserves a valid explicit assignee ID during snapshot normalization, including duplicate display names.
- `src/App.tsx`: toolbar integration, reply ownership state and recipient-specific notification/read handling.
- `tests/browser/conversation-transfer.spec.ts`: service and browser coverage.

## Eligibility and permissions

The command finds the conversation by ID in its explicit original workspace. Active workspace, active staff account, explicit active workspace membership with conversation-handling rights, a matching workspace agent profile, department eligibility and recorded non-offline presence are required for recipients. The current assignee is excluded. Administrators are not implicitly added as recipients: they must meet the same explicit membership and agent-profile checks. Email domains and identity names do not determine workspace membership.

An ordinary agent may transfer their assigned conversation. Existing managers/administrators retain their authorised workspace management scope. Global administrative scope never changes recipient workspace requirements. Resolved conversations cannot transfer. The legacy assignment selector also checks the same transfer ownership and recipient rules. Ordinary agents cannot submit public replies to another assigned owner; managers retain their existing authority. Taking over remains an explicit existing action.

## Persistence and audit

Transfers update the existing conversation in the existing browser-local workspace snapshot. Messages, customer identity, conversation ID, workspace and linked tickets are preserved. Existing open/human/reopened state is retained. Waiting or AI handling transitions to open human handling under the existing assignment rule, so the receiving agent can reply. One internal history event records original and receiving agent IDs/names, initiating user, workspace, conversation, timestamp, request ID and note. Notes are not added to public customer messages or transcript exports. The existing staff activity view displays the event.

A version captured when the dialog opens detects conversation edits, closure and newer assignments. Conflicts remain visible until the user reviews the latest state. Eligibility is rechecked inside the command immediately before saving. A request ID makes retry after a successful save idempotent. The dialog uses a synchronous in-flight guard as well as disabled/loading feedback. Browser Web Locks serialize cooperating transfers across same-origin tabs when supported; synchronous command callbacks preserve single-tab atomicity. Failed storage writes do not commit assignment, audit or notification changes.

Existing subscription/query updates refresh assignments and queue filters. The sender's Mine queue loses the assignment, the recipient's gains it, and workspace-wide views retain it. One recipient-specific notification is saved with the conversation link. The existing notification badge/popover respects recipient and notification preferences. Newly received notification IDs remain unread even after marking older items read. There is no new external email/SMS integration.

Presence currently supports online, away and offline; the UI labels recorded online as Available and away as Away. It does not infer a Busy state from workload. Missing presence shows Not recorded. Offline staff are not eligible under the existing assignment policy.

## Integration boundary

This repository is still a browser-local prototype, including its deployed static build. The shared command performs real local persisted reassignment, not a toast-only simulation, and makes no production database writes. It does not claim server-enforced security or cross-device realtime delivery. No active authenticated API, database security layer or server notification service is connected here.

Production integration must enforce actor/session authorization and tenant membership server-side, perform assignment/version comparison, audit and notification inserts in one database transaction, apply row-level tenant security, and deliver authenticated realtime updates. Browser storage notifications synchronize same-origin tabs; browser locks cannot guarantee atomicity against non-cooperating writers or replace a database transaction. Internal history in browser storage is not a security boundary against a user inspecting their own local data.

No deployment or GitHub push is part of this change.

## Validation results

- **8 transfer checks passed**: Qalo and eNL persisted assignment/audit/notification, eligibility exclusions, revoked membership/cross-workspace/closed/conflict/write-failure handling, ownership enforcement, duplicate display-name identity preservation, browser theme/responsive flow, and two-session queue/notification/stale-dialog updates.
- **3 relevant regression checks passed**: lifecycle transitions/retry idempotence, delayed AI response ownership/urgent handling, and stable relationship normalization with legacy name-based assignment.
- Browser checks cover agent search, note persistence without public message insertion, disabled confirmation, Escape, reload persistence, dark/light desktop screenshots and mobile viewport bounds. The two-session test verifies recipient unread notifications after older notifications were marked read, sender reply disabling, receiver reply enabling and conflict disabling after closure in another tab.
- `npm run build`: passed, including TypeScript compilation. Existing large-bundle advisory remains.
- `npm run lint`: passed with the same five pre-existing React warnings; no new lint warnings.
- `git diff --check`: passed.
- Visually reviewed dark desktop and light mobile dialog screenshots under `test-results/transfer-*.png` (ignored generated artifacts).
