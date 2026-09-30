# Customer website and support widget

Review `/customer-preview` using the existing Vite development server. Agent routes, including `/inbox` and the original `/chat`, remain available.

## Design reference

Inspected https://www.qaloyaafrika.co.za/ in Chromium on 30 September 2026. The homepage loaded successfully, including its navigation, mint header, gradient hero, interview photograph, investment target cards, service cards and green footer. The text-only web fetch did not render its JavaScript content; browser inspection supplied the reference instead. See `research/customer-reference.png`.

The actual homepage logo and interview image are saved locally as `public/qalo-website-logo.png` and `public/qalo-interview.png`. This preview reproduces the homepage composition with shorter representative copy. The investment figures are public homepage targets, not live results. Registration, store checkout, legal documents, partner detail pages and investment detail pages are not implemented: navigation and calls to action lead to relevant sections of this one-page preview. The store support section is an adaptation, not an exact reproduction of a separate store page. No inaccessible sections were presented as exact matches. No external services or runtime asset requests were added.

## Local behaviour and integration boundary

`SupportWidget.tsx` is independent of the website; import it with its own stylesheet on another page. `SupportWidgetState` types panel visibility, area, lifecycle, messages, draft, typing, unread count and rating. `customerSupport.ts` is the adapter boundary for future server integration.

Support choices create a local inbox conversation as fictional `Website Visitor` (`visitor@example.test`) in the corresponding business area. Customer messages and predefined contextual replies use the existing `supportService`, which persists in browser localStorage with an in-memory fallback. Service subscriptions include agent replies and exclude internal notes. Tabs on the same origin share updates through storage events. There is no authentication, delivery system, live agent connection, investment transaction or order lookup.

Each submitted message gets a predefined area-specific response after 1.25 seconds. Only one response is pending at a time; empty and repeated submissions are blocked. Draft editing remains available while waiting. Enter sends; Shift+Enter inserts a newline; IME composition does not submit.

Minimising preserves the draft and transcript in mounted React state. Incoming agent replies increment the launcher badge while closed. Ending cancels pending replies, resolves the local inbox entry, disables the composer and offers optional 1–5 feedback. Starting again creates a new ID and clean transcript; previous conversations remain in the inbox. Refreshing or leaving the preview resets widget state, while saved inbox records remain. Cross-device delivery and durable customer session restoration require future backend work.

The confirmation uses a native modal dialog with explicit focus wrapping, Escape cancellation and focus restoration. The panel is a non-modal labelled region; Escape minimises it. The message log scrolls independently and follows new messages when near its bottom. The widget observes VisualViewport resize/scroll and safe-area insets to accommodate smaller viewports and virtual keyboards.

## Verification

`tests/browser/customer-preview.spec.ts` covers launcher position while scrolling, closed initial state, keyboard opening, area selection, draft preservation, typing/unread replies, duplicate prevention, cross-tab inbox messages and agent replies, confirmation cancellation/confirmation, rating, clean restart, mobile overflow, multiline entry, modal focus and pending-reply cancellation. Reduced viewport checks approximate keyboard resizing; a physical mobile keyboard is not exercised by desktop Chromium.

Build and lint are run alongside the existing browser regression suite. Review screenshots are in `docs/research/customer-preview-desktop.png` and `customer-preview-mobile.png`.

Final results: production build passed; lint completed with only pre-existing warnings in other components. All 20 existing browser regression tests passed. Both new customer preview tests passed on the final targeted run (22 checks passed across the regression and targeted runs). The unread test uses a controlled clock to guarantee the local reply arrives after minimisation, then resumes time before testing the agent inbox. A bundle-size advisory remains in the build output. The full-page image is `research/customer-preview-page.png`.
