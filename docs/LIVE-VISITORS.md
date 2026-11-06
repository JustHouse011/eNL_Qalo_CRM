# Live Visitors dashboard

The `/visitors` route now uses `LiveVisitorsDashboard` for both Qalo and eNL. The existing header, sidebar, workspace switcher, business controls and permissions are retained. The chart and four statistics cards sit above a full-width Visitor History panel; there is no updates, news or promotional panel. Nothing is deployed.

## Local demonstration data (latest requested configuration)

The follow-up brief explicitly authorizes isolated demonstration analytics. `VITE_CRM_DEMO_MODE=true` is enabled in the developer's ignored `.env.local`; `.env.example` documents the opt-in with a default of `false`. **The flag is effective only on the Vite development server. Production builds always select the recorded-data adapter**, even if the local flag was set while building. To review the existing recorded-data behaviour locally, set the flag to `false` and reload after Vite restarts. There is no silent fallback from an unavailable source to fixture data.

`liveVisitorsData.ts` selects the source. `liveVisitorsFixtures.ts` generates separate datasets by workspace ID; `liveVisitorsSimulator.ts` owns an in-memory, deterministic activity stream. Fixture conversations, page views and sessions never merge with supportService snapshots or real analytics. Fixture IDs cannot navigate into the CRM Inbox: their conversation previews remain inside the visitor drawer. The small `Demo Data` badge is intentional under the latest brief; visitor names never contain `Demo Visitor`.

Initial Qalo metrics are 18 active visitors, 247 unique visitors today, 683 page views, 32 answered/4 missed chats, 91.5% positive feedback, 68.2% engagement and 96.4% availability. Initial eNL metrics are 34, 518, 1,246, 76/8, 94.2%, 73.6% and 98.1%, respectively. These totals derive from generated, scoped records and timestamps, not independent overrides. Today has 264 Qalo sessions with 180 engaged, and 530 eNL sessions with 390 engaged; repeat sessions share visitor identity keys. Feedback is 43 positive of 47 Qalo ratings, and 49 of 52 eNL ratings. Availability is calculated from explicit illustrative intervals. Seven days of history provide 1,428 Qalo session rows and 3,166 eNL session rows, rendered through bounded pagination.

Every six seconds, when subscribed and visible, seeded movement adjusts presence by at most one visitor, refreshes activity, adds a page-view event, and occasionally records a fixture-only agent reply. Pause/Resume freezes or continues this stream. A hidden page pauses timers; leaving the page or switching workspace cancels timers, removes visibility listeners and releases that workspace's simulator state. Returning starts a fresh, consistent dataset. Crossing midnight resets the illustrative day safely. The rolling 30-minute series retains its history and always ends at the displayed active visitor count. Historical ranges use generated hourly observations; custom dates outside the seven-day fixture coverage remain empty.

Charts animate range changes and updates while respecting both system and application reduced-motion settings. Desktop, dark, light, tablet and phone screenshots are retained under `test-results/live-visitors-populated-*.png`. Production source limitations below still apply whenever demonstration mode is disabled; simulated events are not verified external realtime traffic.

## Data and infrastructure audit

The active application uses `supportService`, browser local storage, React Query and same-origin storage notifications. `docs/BACKEND.md` and the README identify `server/` and `supabase/` as inactive historical code. Saved integration references do not establish provider connectivity. No authenticated visitor API, Tawk.to analytics feed, database presence stream, server heartbeat or first-party public page-view collector is wired into the running application.

With demonstration mode disabled, no visitor sessions, activity events, timestamps, page views or percentage values are generated. Existing visitor and conversation records remain intact. Legacy visitor names such as `Demo Visitor 1` are displayed as `Visitor 1`; record IDs and relationships remain unchanged. Existing invitation-draft preparation remains available in the details drawer.

`visitorRepository.ts` is the read/subscription boundary. Its current adapter reads only the requested workspace, checks the existing visitors-route permission (`reply`), checks active workspace membership through the existing permission model, handles abort signals, and subscribes to changes for that workspace only. A workspace mismatch is rejected before rendering. Query keys contain both workspace and actor IDs. Changing workspace unmounts the old page, detaches its subscription, cancels observed reads, resets filters/drawer selection, and loads a separate cache entry; late results cannot populate the new workspace's query. There is no previous-data placeholder.

These checks preserve the current application's permissions; they do **not** create server-side security. Browser local storage and client-side roles cannot enforce database/API/realtime tenant isolation. Production tracking needs authenticated server APIs, membership checks, tenant-scoped database policies, authorized subscriptions and retention/consent controls. No such infrastructure is claimed to be working.

## Metric definitions

- **Current visitors:** unique visitor keys among sessions with a server-observed last activity within the adapter's inactivity timeout (default two minutes), no departure, and connected presence capability. Multiple tabs/reconnects with the same visitor key count once. Legacy `Active`, `Browsing`, `Invited` and `Waiting for Agent` strings are not heartbeat evidence. Without presence tracking, the count is unavailable and status is `Not recorded`.
- **Visitors today:** unique visitor keys across sessions beginning in the Johannesburg calendar day. Session IDs deduplicate repeated delivery; stable visitor keys deduplicate refreshes and multiple sessions. Unknown identity/timestamps are excluded rather than inferred from names.
- **Page views:** distinct page-view event IDs in the active workspace and selected calendar period. No counts are extracted from prose such as `Viewed 3 pages`; administrator navigation is never instrumented. There is no new tracking collector.
- **Trend comparison:** elapsed time today against the same elapsed portion of yesterday. A zero baseline with positive current activity displays `No prior comparison`, never infinity or a fabricated percentage. Zero versus zero displays `No change`.
- **Answered chats:** distinct conversation IDs created in the period with a recorded, successful response by a known workspace agent after a customer message, excluding private notes, sending/failed messages, assistant authors and messages flagged as simulated. Conversation transfers do not add another count.
- **Missed chats:** distinct unanswered conversations with an explicit timestamped `conversation-missed` history event. Waiting/pending conversations are excluded. No missed state is inferred from response delay.
- **Positive sentiment:** customer ratings of 4 or 5 divided by all valid 1–5 ratings on conversations created today in the active workspace. No ratings produces `Not recorded`.
- **Engagement:** distinct sessions beginning today linked explicitly to a conversation containing a customer message divided by all distinct sessions beginning today. No tracking capability or session identity produces `Not recorded`.
- **Availability:** requires authoritative timestamped agent availability intervals. Current profile presence toggles cannot establish uptime, so this remains `Not recorded` in recorded-data mode. The demonstration adapter supplies illustrative intervals, clipped to today, deduplicated and protected against overlapping intervals.

Charts in recorded-data mode use server observation intervals from the adapter. Live Now is a rolling 30-minute window; 30-minute, hourly, today, seven-day and custom ranges use appropriate bounded time buckets (at most 241 points). Timelines deduplicate visitor keys. The connected-but-empty state shows a flat zero chart and `No live visitors right now`; absent tracking instead shows `Live tracking unavailable`. The production adapter must supply truthful completeness/coverage for historical ranges and server timestamps; a heartbeat timeout alone is not a durable historical event stream.

## History, responsiveness and accessibility

History preserves legacy records without timestamps under `All dates`; dated filters exclude undated records. Search is debounced and restricted to available visitor IDs, names, location, country and page. Status/date/search/sort controls compose; rows are paginated with 10/25/50 page sizes and preserve filter state between pages. Missing country, device or timestamp values are not guessed. The existing local snapshot service has no paginated backend endpoint: pagination is bounded client-side over the already loaded snapshot. A production history API must implement filtering, ordering and pagination server-side before handling large histories; no unlimited history API request is introduced here.

Visitor names are keyboard-operable drawer buttons; a native modal dialog traps focus, supports Escape and restores focus to its trigger. Only explicit conversation IDs in the same workspace enable Inbox navigation. The drawer shows no new sensitive information. Refresh retries failed reads, React Query retries once and refetches on network reconnection, and failed refreshes preserve a clearly identified last loaded snapshot. Loading skeletons, read errors, absent tracking, empty history and filtered emptiness are distinct states.

Desktop uses two equal upper regions with aligned heights; tablet uses a full-width chart and two-column statistics grid; phone statistics stack. Only the history table scrolls horizontally. Both themes use existing glass, colour and typography tokens. Animations respect system and application reduced-motion preferences. Chart series remain mounted across updates.

## Remaining integration requirements

No Tawk.to public API capabilities have been assumed, and no private Tawk.to dashboard is scraped. An authorized provider/backend must establish which visitor and analytics fields it can actually supply before replacing the repository adapter. External realtime presence, server pagination, server-enforced access control, authoritative availability history, consent-aware page-view capture and complete analytics coverage remain unavailable in the current project. Same-browser updates, cross-tab storage notifications, subscription cleanup and workspace isolation can be verified locally; internet visitor tracking cannot.

The supplied attachment contained the written layout specification; no reference screenshot was present. The implementation follows that composition using the existing design system.

## Implementation files

- `src/features/LiveVisitorsDashboard.tsx` and `.css`: shared dashboard, chart, statistics, date controls, search, sortable/paged history, status badges, native details drawer, conversation previews, activity controls and responsive themes.
- `src/lib/visitorAnalytics.ts`: unique-visitor/session/event counting, date windows, trends, presence expiry, chat/feedback/engagement/availability calculations and bounded chart series.
- `src/lib/visitorRepository.ts`: existing recorded-data adapter, permission checks, explicit workspace ownership and abort/subscription boundaries.
- `src/lib/liveVisitorsFixtures.ts`: deterministic, separate Qalo/eNL datasets, matching page events, conversation examples, feedback, availability intervals and chart history.
- `src/lib/liveVisitorsSimulator.ts`: in-memory updates, visibility and pause handling, timer/subscription cleanup and midnight rollover.
- `src/lib/liveVisitorsData.ts`: explicit configuration and development-only source selection.
- `src/App.tsx` and `src/features/BankingOperations.tsx`: both visitor routes now use the same implementation; the previous Qalo table and separate eNL visitors implementation are removed.
- `src/lib/productCopy.ts`: legacy numbered `Demo Visitor` names are displayed without the prefix while preserving IDs and records.
- `.env.example` and ignored `.env.local`: documented opt-in and local activation; no provider credentials are added or changed.
- `tests/browser/live-visitors.spec.ts`, `live-visitors-fixtures.spec.ts` and `tests/helpers/liveVisitorsHarness.tsx`: analytics, permissions, isolation, cleanup, live-source fallback, loading/error/reconnect, empty states, fixture consistency, write isolation, UI interactions, responsive themes and production-mode coverage.
- Existing product-copy/naming audits are adjusted for the newly requested `Demo Data` indicator and the invitation action's location inside the visitor drawer.

## Final validation

- `VITE_CRM_DEMO_MODE=false` with `live-visitors.spec.ts`: **6 passed**. Covers pure analytics, deduplication, expiry, zero/unavailable distinction, composed filters, bounded pagination, permissions, workspace ownership, aborts/subscription cleanup, live-source history updates, Inbox links, drawer focus, search, dates, sorting, refresh, reporting navigation, both workspaces/themes, tablet/mobile overflow, loading/error/reconnect and connected-empty states.
- `VITE_CRM_DEMO_MODE=true` with `live-visitors-fixtures.spec.ts` and `product-naming.spec.ts`: **6 passed, 1 intentionally skipped** (the production-only assertion). Covers exact initial statistics for each workspace, populated time ranges, latest-point/count consistency, controlled activity, timer/visibility cleanup, pause/resume, matching drawer details, safe conversation previews, isolated workspace datasets, responsive layouts and the existing application-wide naming/data-preservation audit.
- Production preview with `QALO_PREVIEW=1` and the demonstration flag still set: **1 passed**. Confirms production renders the recorded-data adapter without the badge or simulation controls. A separate local preview port was used; its temporary configuration and process were removed afterward.
- The populated browser test recorded no external or mutation HTTP requests and verified that the persisted `qalo-workspaces-v2` snapshots were byte-equivalent before and after simulation, filtering, previews and workspace changes. Only the existing workspace selection changes; fixture records remain in memory.
- `npm run build`: **passed**, including TypeScript. Vite retains the existing large-bundle advisory.
- `npm run lint` (the project's Oxlint script): **passed, no errors**. Five existing React warnings remain in `App.tsx`, `CustomerChat.tsx`, `ReportDatePicker.tsx` and `DemoAccess.tsx`. The route audit also observes the existing duplicate `Complaints` key warning in another banking module; the requested visitor implementation introduces no such warning.
- Screenshots for populated Qalo/eNL, dark/light themes, tablet and phone were inspected. The local `/visitors` URL returns HTTP 200. No production deployment or external integration was performed.

Total final targeted results: **13 passed**, plus the intentional development-run skip verified separately in production preview. The local demonstration has no remaining blocker. Real external tracking, provider coverage, server pagination and server-enforced security still require the infrastructure described above when demonstration mode is disabled.
