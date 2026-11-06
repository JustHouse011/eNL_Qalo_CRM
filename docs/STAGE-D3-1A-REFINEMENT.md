# D3.1A-R1 — Inbox visual refinement

## Baseline

Read the D3.1A report, shared Inbox markup, scoped stylesheet, D1 tokens, responsive native Details dialog and existing layout/regression tests before editing. Existing modified and untracked work is preserved. Stage baseline copies and Git status are under ignored `.local-data/d3-1a-r1/baseline`.

The existing desktop queue was 270–310px and Details 280–320px. At 1440px the shared shell left the conversation unnecessarily narrow. Details collapse, modal focus handling and draft state already existed; those implementations are retained.

## Changes

- `src/features/InboxWorkspace.css`: desktop queue 260–290px, Details 270–290px, flexible conversation; 160ms grid transition; stronger queue typography and metadata contrast, wrapping operational metadata, clearer message labels/timestamps and 14px desktop message text; distinct opaque composer, input padding and visible send control; denser Details profile and readable form labels.
- `src/App.tsx`: reserved Transfer Chat label explicitly says Coming in D3.1B. No transfer control is enabled.
- `tests/browser/inbox-layout.spec.ts`: retain all prior assertions and add panel upper bounds, expanded conversation width, selected customer/draft retention, collapsed Details captures and mobile queue captures. Review outputs use the existing ignored review directory's `r1` subdirectory.
- `docs/STAGE-D3-1A-REFINEMENT.md`: this report.

At 1440px the target queue/Details widths are approximately 274px each, and at 1920px both cap at 290px. Below 1280px Details uses the existing modal drawer. Below 821px the original queue/chat drill-down remains. D1 shell dimensions, sidebar behavior and D2 dashboard are unchanged.

Measured in Chromium against the local preview, with the original CRM sidebar expanded:

| Viewport | Queue | Conversation | Details | Conversation with Details hidden |
| --- | --- | --- | --- | --- |
| 1440px | 273.6px | 580.8px | 273.6px | 864.4px |
| 1920px | 290px | 1028px | 290px | 1328px |

Closing Details gives its width back to the conversation. Reopening restores the same customer fields and selected conversation. The composer stays mounted, preserving its draft. Native modal focus containment, Escape, backdrop dismissal and focus return are unchanged. Grid/drawer transitions respect system and saved reduced-motion preferences, including the grid container itself.

## Accessibility and security review

Only Inter 300/400 and existing theme tokens/icons are used. Metadata uses the stronger muted token; names use primary text. Existing keyboard focus outlines remain. Queue and messages scroll independently; the composer remains outside the message scroller. Long text wraps without HTML rendering.

All customer/support fields and workspace-specific safeguards remain in the original shared components. No customer data, rendering transport, unsafe HTML, permissions, service command, persistence mechanism, backend, Supabase activation, widget setting or ticket lifecycle changed. Frontend role checks remain prototype controls rather than server authorization.

## Validation and visual review

TypeScript/production build passed (2,575 transformed modules; Vite build 2m49s). Repository lint passed with the same five React warnings. `git diff --check` passed. Existing local preview endpoint `/inbox` on port 5173 returned HTTP 200; an attempted second server exited because the port was already occupied, leaving the existing server unchanged.

The first 60-second regression run was interrupted after several timeouts during severe local execution delays. A fresh run with 180-second case budgets passed the Qalo customer journey, persistence/workspace switching, widget timer, D1 shell/responsive/motion and identity checks before the layout section. The eNL customer journey timed out waiting for its newly created demo visitor to appear in the agent queue; this unresolved result concerns unchanged widget/storage synchronization and is not represented as a pass.

The added draft-retention setup initially tried to type into eNL's waiting conversation, whose reply field is correctly disabled. Layout tests now select an existing Human Handling conversation before entering a draft; they do not change availability or bypass permissions. The earlier running process retained its collected test source, so it was stopped and the remaining layout/ticket/workspace cases started in a fresh process. That run disabled tracing to reduce local I/O, retaining all behavioral/layout assertions and screenshot capture: **25 passed (11.6 minutes)**. Its Windows validation Vite process was stopped only after the worker exited so the final report could complete; the user's preview server was preserved.

Together with the completed lifecycle/D1/identity cases, this accounts for 45 passing unique regression cases and one unresolved eNL journey timeout. This is a split verification record, not a claim that a single full-suite invocation passed. Initial timeout/setup failures remain in the logs. The last visual audit increased inherited assigned-agent badges to 11px, unread counts to 11px and contact values to 12px.

Final capture refresh on the completed stylesheet: **8 passed (5.6 minutes)**, covering all twenty workspace/theme/width combinations, desktop expansion and draft retention, modal focus/Escape, independent scrolling, escaped long content, saved replies, notes, attachment references and empty states. All 40 PNGs were refreshed. Representative final desktop light/dark, collapsed Details, mobile conversation and Details captures were opened and visually reviewed. The validation-only Vite server was stopped after its worker exited to finalize the Windows report.

Final production verification with explicit native exit propagation (`npm.cmd run build; exit $LASTEXITCODE`) passed with exit 0: TypeScript plus Vite, 2,575 modules, CSS 179.24kB and JavaScript 1,052.75kB. The earlier redirected build also generated assets, but PowerShell reported a nonzero wrapper status for native warning output; the explicit-exit verification resolves that ambiguity. Only Inter 300/400 font assets are emitted. The D1 foundation SHA-256 remains `01f4b5c805d6e8390f9fb93e9c16c4eae1c5d3fe94314fd789b4fdf0875a20bd`. A baseline text comparison confirms App.tsx differs only by the reserved transfer label.

Commands: `npm.cmd run build`, `npm.cmd run lint`, `git diff --check`, and the six-file Playwright regression selection used for D3.1A (Inbox layout, conversation lifecycle, identity, ticket operations, workspace and design foundation).

Screenshots: `.local-data/d3-1a/review/r1`; selected conversations at all five widths in both themes/workspaces, Details captures, desktop collapsed Details, mobile queues, long-content stress and reduced-height composer. Desktop examples: `qalo-light-1440.png`, `qalo-dark-1440.png`, `enl-light-1440.png`, `enl-dark-1440.png`, `{qalo,enl}-details-collapsed-1440.png`. Artifacts remain ignored and outside production assets. Logs are under `.local-data/d3-1a-r1`.

Existing warnings: five React lint warnings and the production chunk size warning. Chromium verification does not certify physical mobile keyboards, Safari/Firefox or full screen-reader conformance.

## Approval boundary

D3.1A-R1 visual implementation and review are complete; awaiting explicit user visual approval. Functional validation is not fully green because the eNL visitor-to-agent-queue journey remains unresolved. Its widget/storage synchronization path was not changed by this refinement; no claim is made that the failure is conclusively pre-existing. Investigate that result before full functional sign-off. No D3.1B, Transfer Chat implementation, D3.2, widget changes, commit, push or deployment.
