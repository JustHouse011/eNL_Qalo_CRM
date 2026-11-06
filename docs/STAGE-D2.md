# Stage D2 — Qalo and eNL Overview dashboards

## A. Implementation summary

Both Overview routes use one shared, data-driven dashboard composition matching the supplied HTML: a compact heading/control row, four prominent primary KPIs, six secondary metrics, full-width support activity and a two-column grid of four insights. The approved D1 shell, typography foundation, theme preference, ambient lighting and mobile drawer are unchanged. Reports and operational modules remain available; this stage does not begin D3.

## B. Files modified

- `src/App.tsx`: route the Qalo Overview to the shared dashboard; no shell, permission or data changes.
- `src/features/BankingOperations.tsx`: route eNL Overview through the same component; preserve its existing analytics/CSV indicators as clearly marked all-time details. Keep the Reports route and its views intact.
- `src/features/SupportReports.tsx`: import the extracted date picker; preserve the Reports screen, calculation and export behavior.
- `src/features/ReportDatePicker.tsx`: extract the existing accessible calendar without changing its behavior, for reuse in Overview and Reports.
- `src/features/OverviewDashboard.tsx`: shared controls, KPI presentation, charts, empty states, legends, channel volume, workload and CSV action.
- `src/features/OverviewDashboard.css`: dashboard-only glass composition, responsive grids, workspace accents and motion.
- `src/lib/dashboardSummary.ts`: read-only presentation selectors over already scoped data, existing activity aggregation and safe CSV serialization. No record writes or backend queries.
- `tests/browser/dashboard.spec.ts`: calculation/event/CSV tests, five-width four-theme/workspace captures, date/preset/export/data-integrity and isolation checks.
- `tests/browser/workspace.spec.ts`: update the business-scope test's selectors for the new Overview markup, retaining the same scope, persistence and 30-day row-count assertions.
- `docs/STAGE-D2.md`: this report.

Existing uncommitted/untracked work was preserved. Pre-edit files are retained under `.local-data/d2-review/baseline`. `src/design-foundation.css` hashes match before/after this stage. Prior D1 screenshots were preserved under `.local-data/d1-review/d2/d1-shell-baseline` before regression tests refreshed their usual artifacts.

## C. Visual fidelity

The actual reference was read from `C:/Users/nomba/OneDrive/Pictures/glassmorphic_support_dashboard.html` and compared with browser captures. The dashboard uses the reference's four-card hierarchy, featured purple conversation card, small six-metric row, 24px card/panel corners, 16/24px grid gaps, full-width activity, doughnut plus legend, ranked gradient bars, channel indicators and avatar workload list. Existing scope controls remain in the approved D1 bar. Date controls, presets and export are compact at desktop and wrap on small screens.

Intentional differences: Inter 300/400; approved workspace branding; additional truthful scope labels; actual recorded data and unavailable states; existing Recharts rather than Chart.js. The sample's decorative chart-state toggle is not reproduced because it would manufacture a chart state. Actual date selection supplies the empty/data states.

## D. Qalo dashboard mapping

- Primary: open conversations; unassigned open conversations; average elapsed minutes from the first customer message to the first recorded `agent`-kind reply; mean recorded satisfaction from valid 1–5 ratings.
- Secondary: waiting conversations, resolved conversations, urgent/escalated conversations, mean recorded resolution duration, conversation document-wait flags, and all-time scoped open-ticket backlog.
- Activity: reuse `aggregateCases` and Johannesburg `dayKey`; creation counts and distinct resolution events retain their existing attribution.
- Doughnut: existing Community Investment, Qalo Store and Platform & Technical Help business areas.
- Categories/channels: existing conversation taxonomy and recorded channels only, without claiming an external integration is live.
- Workload: open conversations assigned to active workspace agents, plus unassigned and other workspace assignments. No other workspace's directory is read.

The current Qalo fixtures are dated 30 September 2026. With the current 22 October review date, the default last-seven-day activity can honestly be empty while all-date KPI values remain populated. A separate 30-day capture demonstrates the populated chart without changing records.

## E. eNL dashboard mapping

Uses the same four/six/panel components. Primary and most secondary KPIs retain conversation-based meanings. Awaiting documents counts existing banking cases whose status is `Awaiting Documents`, within the selected creation range; this distinction is disclosed beside the range controls. The doughnut uses the existing support departments, never Qalo retail categories.

No satisfaction values exist in the current banking conversations: the card says `Not recorded`, with no invented stars or score. Recorded response messages include the existing virtual-assistant/agent-kind classification; no claim is made that all replies are human.

Existing total/active/AI/human conversation counts, support-case/application/ticket counts, simulated agent availability, response average, overdue support-case indicator and recent enquiries remain under **Additional banking indicators · all dates**. These are not substituted into unrelated primary metrics. Their values remain all-time in the current workspace/department scope and are exported with an explicit all-dates prefix.

Purple `#652D8D`, white, charcoal and grey foundations are preserved. Existing `#B59BD3` and derived chart tones are implementation accents, not a claim of independently verified official brand colors. The dashboard adds no banking balances, account numbers, transactions or payment behavior.

## F. Typography

D1's Inter Light 300 and Regular 400 remain the sole UI weights. No font dependency, family or weight was added. Chart text and tooltip styling explicitly use Inter 400 and inherit the approved typography. Browser tests inspect computed dashboard text styles in both workspaces/themes at all required widths.

## G. Themes

Qalo/eNL light and dark use the same glass tokens and component layout. The featured card retains readable white text. Chart lines use readable workspace-aware light/dark accents. Unavailable values, captions, stars, legends, tooltips and focus states follow theme tokens. D1's opaque/reduced-transparency fallbacks remain, with dashboard-specific fallbacks too.

## H. Motion

Short staggered card entrances, gentle hover lift, primary-card glow, progress-bar reveal and chart-panel fade are scoped to the dashboard. Existing ambient orbs remain the only background system. Recharts redraw animation is disabled, so filtering does not replay large chart animations. Stable card keys avoid restarting entrances on every data update. Device and personal reduced-motion preferences, slow-update displays and D1 document-hidden animation pauses remain effective.

## I. Responsive verification

Required widths: 390, 768, 900, 1440 and 1920px. Desktop has four primary cards, six secondary cells and two insight columns. Tablet/laptop wraps the primary grid to two columns and secondary grid to three. Mobile uses single-column primary cards, two-column secondary cells and stacked insights. Date controls remain accessible, calendar popovers fit the viewport, and both themes retain the existing mobile drawer.

All five requested widths passed the focused composition/overflow/typography checks for both workspaces and both themes. Desktop/mobile top and lower-insight captures are saved in the review directory.

## J. Functional regression

- Initial focused dashboard run: 9/9 passed, covering five widths, both workspaces/themes, data selectors, resolution-event attribution, date presets, unavailable/empty states, CSV downloads, record immutability and workspace resets.
- Final production build and TypeScript passed. Repository lint passed with the existing warning set; the inherited date-picker purity warning moved with its component. No new memo-dependency warnings remain.
- Full browser suite completed: **119/119 passed in 12.1 minutes**, including all ten D2 cases, all seven D1 cases, identity/access, customer widgets, both workspace analytics/exports, operational modules and local data-preservation checks. No test was skipped or weakened to obtain this result.
- Whitespace checks passed. A separate real-browser hover audit verified both activity tooltip series and Inter 300/400 styling; `tooltip-audit.json` and `qalo-activity-tooltip-1440.png` record the result.

Default KPI scope remains all dates. The activity chart defaults to the existing seven-day window. Selecting a 7/30-day preset applies that same creation range to relevant KPIs, doughnut, categories, channels and workload; resolution events continue to use their event dates. Ticket backlog and the explicitly all-time eNL details stay outside date filtering. Clearing dates restores the default scope. Workspace switches reset transient date controls through the existing shell remount behavior.

Export filenames remain `support-report.csv` and `enl-support-report.csv`. The overview export includes the current workspace, department/business scope, dates, metric values and breakdowns; eNL's legacy indicators are marked all-time. The separate Reports exports remain unchanged. The existing business-scope regression now targets the shared dashboard markup and passed its unchanged persistence, scope-isolation and 30-day activity-row assertions.

## K. Security findings

No raw HTML injection, remote script/font, new dependency, authentication, Supabase, backend/database or permission-model change was introduced. Production reference scripts are not imported. Existing scoped `DemoData`, current workspace departments/agents and central capabilities drive the UI; operational links are hidden when the existing capability is absent.

CSV fields are quoted and spreadsheet formula prefixes are neutralized, including whitespace/tab/newline-prefixed formulas. Selectors are read-only and tests compare the browser's stored registry before/after date filtering/export. No customer records are changed to populate the design.

D1 recorded nine dependency audit findings (two moderate, seven high); there were no dependency changes or unrelated audit fixes in D2. Those previously documented findings and existing frontend-only authorization limitations remain; this stage neither remedies nor claims to replace backend tenant enforcement.

## L. Outstanding limitations

- Satisfaction is unavailable for eNL until ratings exist; no score is manufactured. Empty response/resolution ranges show `Not recorded`.
- Native data semantics classify some existing banking assistant replies as `agent` messages. Response time follows that recorded classification rather than inventing human-only attribution.
- Default Qalo seven-day activity can be empty for the current older fixture timestamps. The 30-day preset exposes actual existing events.
- Only Chromium was automated; other browsers and physical low-powered devices need separate validation. No platform-wide WCAG certification is claimed.
- Existing lint warnings and the >500 kB production JavaScript chunk warning remain. No unrelated dependency or code-splitting changes are included.
- Operational modules, knowledge/management/profile redesigns belong to later stages and were not started.

## M. Visual approval

Review artifacts are under the ignored `.local-data/d1-review/d2/` directory:

- `qalo-light-1440.png`, `qalo-dark-1440.png`.
- `enl-light-1440.png`, `enl-dark-1440.png`.
- `qalo-light-390.png`, `enl-light-390.png` (dark mobile variants also saved).
- `*-insights.png` captures show the lower insight panels.
- `qalo-light-1440-30days.png` shows a populated activity chart using actual fixture dates.
- `qalo-activity-tooltip-1440.png` captures the real hover tooltip with both series.
- Additional 768/900/1920px captures cover both themes/workspaces.

Approve the four/six hierarchy, compact controls, chart/doughnut styling, category/channel bars, workload rows and responsive composition. The application remains available on the user's existing local development server at `http://127.0.0.1:5173/overview`.

Stop after D2. No commit, push, deployment, D3 work, migrations, Supabase activation or authentication change was performed. Explicit visual approval is required before the next stage.
