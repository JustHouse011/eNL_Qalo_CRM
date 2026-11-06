# Stage D3.1A — shared live-chat Inbox

## 1. Baseline audit

Branch: main; extensive existing modified/untracked work retained. Pre-edit sources, tests, docs and Git status are preserved under ignored `.local-data/d3-1a/baseline`. D1/D2 reports were read. Administrator A1 is implemented; its later stages remain unapproved and are outside this task. CW1 widget work was interrupted before any application edits; widget settings are outside D3.1A.

Both workspaces already share `InboxWorkspace`, `MessageBubble` and `Detail` in App.tsx, with workspace-specific fields in SupportContext.tsx and taxonomy hooks. Workspace-scoped service commands, conversation lifecycle, mock snapshots and existing permission selectors remain the behavioral authority. Message ordering, filtering, assignment/takeover, resolution, transcript export, notes, saved replies, attachment references and Create Ticket already work. Attachments are local text references with MIME/5 MB checks, not uploads. The New conversation action opens the existing customer preview, not a fabricated compose flow.

Baseline CSS uses three narrow columns even around 900px, small text, two top toolbars, a top-only Ticket action, long undifferentiated details, and a mobile tab strip. No dedicated Transfer Chat workflow exists; changing assignee through the existing details field remains supported. Native widget conversations are the intended use, but existing legacy Email-labelled records must remain intact.

## 2. Design interpretation

All four supplied screenshots were inspected. Adopt compact queue rows with distinct selection, a dominant timeline, structured details, an anchored composer and a bottom support-action area. Preserve D1 navigation rather than adding the screenshots' second Inbox navigation rail. Do not copy green branding, flags, customer identities/contact information, email-specific controls, unsupported integrations or banking claims from the references.

## 3. Files changed

- `src/App.tsx`: shared Inbox markup, docked/drawer details behavior, selected-row/focus handling, date grouping, message-state presentation and bottom ticket action. Existing callbacks and lifecycle commands remain unchanged.
- `src/features/InboxWorkspace.css`: Inbox-only layout, reading surfaces, responsive behavior, compact controls and motion fallbacks.
- `src/main.tsx`: load the scoped Inbox stylesheet after the D1 foundation.
- `tests/browser/inbox-layout.spec.ts`: eight targeted layout, theme, viewport, focus, scrolling, safe-content and functionality checks; review captures.
- `tests/browser/workspace.spec.ts`, `tests/browser/ticket-operations.spec.ts`: change only the existing Ticket button locator to its new visible/accessibility label, Create Ticket; retain all behavioral assertions.
- `docs/STAGE-D3-1A.md`: this report.

No application edits from the interrupted CW1 audit were made. No dependencies, role architecture, business fixtures, widget settings, public widget implementation, service commands, D1 stylesheet or D2 dashboard files changed.

The baseline comparison confirms only these seven stage files differ. D1 foundation SHA-256 remains `01f4b5c805d6e8390f9fb93e9c16c4eae1c5d3fe94314fd789b4fdf0875a20bd`.

## 4. Shared Inbox architecture

Retain the existing shared Inbox and behavioral callbacks; add only Inbox-scoped presentation and responsive details disclosure. Preserve service/data architecture. Details remain docked at wide widths and become a native modal drawer at narrower widths, with native focus containment and Escape dismissal. Mobile follows list → chat → details.

## 5. Qalo verification

Qalo branding and purple remain in the unchanged shell. The shared queue shows initials, name, latest content, time, unread counts, handling, priority and assignment/tag context. The selected conversation uses the existing scoped data and callbacks. Customer information, support context, Community Investment fields, order/return context, organisation, references, tags, activity, linked tickets, preferences and approved-article links remain available through the existing SupportContext component and details fields.

No phone field is invented: it is absent from the current contact model. No mock conversations or orders are rewritten by the redesign. Existing Email-labelled legacy records remain visible with their original metadata; the new layout does not add email-client features.

## 6. eNL verification

The same Inbox consumes the banking taxonomy, departments, records and established purple/logo. It keeps banking safety text and existing support categories without adding credentials, account balances, transaction controls or real banking actions. The existing virtual-assistant label/simulation metadata remain. Qalo retail context is not shown in banking conversations. An eNL-specific form-border override was corrected within the Inbox scope so the search and composer match the shared presentation.

## 7. Light/dark themes and typography

All new styling uses D1 tokens and workspace variables. Glass outer panels surround more opaque reading/composer surfaces; outgoing replies use a restrained workspace tint, and private notes retain their separate label and warning edge. Existing theme persistence and both branding palettes remain.

Only Inter 300/400 remain in use. The new browser matrix inspects visible computed font families and weights in every workspace/theme/width combination. No font, icon, animation or other dependency was added. Sender avatar initials now derive from the recorded sender rather than always displaying BN. Missing delivery metadata says Recorded message rather than implying an ongoing send; recorded sent messages say Saved locally.

## 8. Responsive verification

Target widths are 390, 768, 900, 1440 and 1920px. Both the initial eight-case layout run and the final regression run passed all twenty width/workspace/theme combinations. Final captures include the visual refinements.

- 1440/1920: queue approximately 270–310px, details approximately 280–320px, flexible dominant chat. Details can be collapsed to increase chat space.
- 900: queue and chat remain side by side; details open as a modal drawer.
- 390/768: list → selected chat → requested details, with explicit back actions and the retained bottom panel navigation. D1's navigation drawer is unchanged.
- The composer and bottom support actions stay outside the scrolling timeline. Queue, messages and details scroll independently. Small-height rules reduce secondary spacing, and safe-area padding supports mobile browser insets.

Browser checks cover a 390×600 reduced-height viewport, not a physical on-screen keyboard or device-specific safe-area certification. Safari/Firefox and physical-device review remain separate limitations.

## 9. Preserved functionality

Selection, newest-first sorting, all six queue filters, search, priority/handling filters, conversation history, incoming/outgoing content order, saved replies, reply/note mode, Enter/Shift+Enter behavior, 4000-character limit, attachment-reference validation, send errors, takeover, assignment, resolution/reopening, AI-return restrictions, transcript export, Create Ticket, related links, workspace switching and persistence retain their existing callbacks/commands.

Date separators are presentation-only; messages are mapped in their original order. Existing activity stays in the details panel. The bottom Create Ticket control calls the original ticket dialog; ticket statuses, creation/linking logic and lifecycle are unchanged.

## 10. Accessibility findings

Named queue/message scroll regions are keyboard-focusable. Selection uses aria-current, filters/saved replies expose expanded state, and icon controls retain explicit labels. Mobile selection moves focus into the chat heading. The details drawer uses native modal behavior for focus containment and background inertness, closes with Escape/backdrop/visible close control, and returns focus. A close control is also present when no conversation is selected. Wide-screen details are exposed as a complementary pane and remain independently scrollable.

Focus outlines, long-name truncation, long-message wrapping, readable text surfaces and larger mobile controls were checked. Device, personal and saved reduced-motion preferences suppress selection/drawer animation and smooth message scrolling. This is a Chromium-focused accessibility review, not formal WCAG certification or a full screen-reader audit.

Calculated default-token contrast pairs: light reading text 14.49:1, dark reading text 15.06:1, white Create Ticket text on Qalo purple 6.17:1 and on eNL purple 9.08:1. Actual translucent composites vary; these calculations do not constitute an all-platform contrast certification.

## 11. Security findings

Existing frontend role/capability and workspace guards remain authoritative; no new access grants or alternate role system was added. Tag inputs/removal and the relocated ticket action explicitly respect reply capability. The existing service layer still scopes mutations. The new long-content test verifies that HTML-like message text stays escaped and creates no img element.

No unsafe HTML rendering, new transport, backend/Supabase work, external messaging, new personal-data fields or live integrations were introduced. Reference screenshot identities, emails, phone numbers, WhatsApp notification content and banking claims were not copied into fixtures or production assets. Frontend permissions/local storage remain prototype checks, not server authorization.

## 12. Test commands and exact results

- Initial `inbox-layout.spec.ts`: **8 passed (3.0 minutes)**, including the five-width matrix, independent scrolling/long content, mobile focus/short viewport/navigation, filters/notes/attachment references and empty states.
- Final relevant regression run: **46 passed (15.6 minutes)**, including all eight new Inbox cases, conversation lifecycle/persistence, identity/access, ticket operations, workspace workflows and D1 shell checks.
- Final TypeScript and production build passed. The existing large-chunk warning remains.
- Repository Oxlint passed with the five existing React warnings. `git diff --check` passes after removing one introduced whitespace-only line.

A preliminary build caught an unclosed JSX dialog wrapper; it was corrected before the first browser run. No browser expectation was relaxed to address that compile error.

```powershell
npx.cmd playwright test tests/browser/inbox-layout.spec.ts --reporter=line
npx.cmd playwright test tests/browser/inbox-layout.spec.ts tests/browser/conversation-lifecycle.spec.ts tests/browser/identity.spec.ts tests/browser/ticket-operations.spec.ts tests/browser/workspace.spec.ts tests/browser/design-foundation.spec.ts --reporter=line
npm.cmd run build
npm.cmd run lint
git diff --check
```

No full browser-suite pass is claimed. Existing tests were not removed; only the two existing test files' ticket-action label locators were updated for the approved visible relocation/label. No behavior or isolation assertion was weakened.

Test discovery reports **133 cases in 15 files**: the 125-case pre-stage baseline plus eight new Inbox cases. Logs and the stage file manifest are retained under `.local-data/d3-1a`. The local user development server returned HTTP 200 at `http://127.0.0.1:5173/inbox`; only the separate validation server was stopped after workers exited.

## 13. Known warnings and limitations

The five existing lint warnings cover DemoAccess component exports, Date calls in CustomerChat/ReportDatePicker, and two App effects. The existing >500 kB production chunk warning remains. No unrelated dependency upgrade or code-splitting project was undertaken.

Existing Windows validation Vite shutdown can linger after workers exit; only identified validation-server processes are stopped to finalize reports. Review screenshots use Chromium with reduced motion and fictional local data. Long/empty-content stress records exist only inside isolated browser-test storage.

Reference interpretation preserves our navigation and functional controls rather than reproducing the screenshots' green branding, second navigation rail, email ticket composer, new organisation/deal actions or unavailable integrations. Native website chat is the purpose; old stored records are preserved.

## 14. Screenshots for visual review

Artifacts live under ignored `.local-data/d3-1a/review`, outside production assets. Naming:

- `{qalo,enl}-{light,dark}-{390,768,900,1440,1920}.png`: selected conversation, composer, support action bar and shared shell.
- `{qalo,enl}-details-{390,768,900,1440,1920}.png`: docked details or modal drawer.
- `long-messages-independent-scrolling.png`: safe long-content/scroll stress case.
- `qalo-mobile-composer-short-viewport.png`: mobile composer at reduced viewport height.

All 32 captures were refreshed by the final layout checks. Representative final Qalo/eNL desktop light/dark, mobile and details captures were opened and visually inspected. The user visual-approval gate remains outstanding.

## 15. D3.1B deferred functionality

The bottom action area reserves a clearly labelled Transfer Chat location, with an explicit unavailable/future note and no enabled placeholder button. D3.1B must define and approve actual transfer behavior, destinations, validation, permissions, audit events and tests. Existing assignee editing remains available; it is not relabelled as a new transfer workflow. No new chat/ticket transfer command or ticket status was implemented.

## 16. Approval boundary

D3.1A implementation, code/security audit, visual inspection and quality checks are complete. Stopped for user visual review and explicit approval. D3.1B, D3.2 and the separate widget-settings project have not started. No deployment, commit or push was performed.
