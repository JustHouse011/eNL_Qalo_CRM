# Dashboard cleanup and sidebar logout

## Dashboard

Both `/overview` routes now use the existing shared OverviewDashboard directly. The eNL-only Additional banking indicators accordion, its metrics, enquiry/agent cards, surrounding container and related styles/export-only additions were removed. The complete banking disclaimer is removed without replacement. Qalo's existing dashboard footnote remains unchanged. Shared KPI cards, chart/date controls, breakdowns, workload and main export are retained. Banking Reports & Analytics remains available with its separate metrics, views and export.

## Sidebar and logout

The sidebar's avatar/name/availability/three-dot footer is replaced by a shared Log Out button. The top-bar profile and availability controls remain. Navigation order and the workspace selector are unchanged. Flex layout separates the scrolling navigation from the fixed-height footer. Desktop collapse and tablet rail show the icon with accessible name and native tooltip; mobile navigation shows icon and label. Styling uses the existing purple/glass tokens, light/dark colors, focus indication and reduced-motion support.

Sidebar Log Out and the top-bar Sign Out use the same action in the existing DemoAccess provider. It persists the existing `qalo-profile-preview=signed-out` session marker, clears the developer identity preference and updates the active identity. The marker is intentionally retained: removing it would restore the prototype's default review account after reload. A failed session-storage write restores the previous preference and reports an accessible error without claiming success.

The protected route guard runs before workspace data hooks mount. Role-keyed workspace providers discard old session metadata and subscriptions. Signed-out sign-in/protected routes do not subscribe to workspace records. Public support routes can still initialize their existing workspace catalogue. Logout cancels queries, clears the TanStack Query cache and unmounts staff views, open forms, composer state and visitor subscriptions. A `pageshow` listener rechecks the signed-out marker and clears stale query data when an older document is restored from the browser's Back/Forward cache. Delayed data writes cannot repopulate cache through an unmounted useDemo hook. Actual mock workspace records, memberships, settings, preferences and password configuration are not deleted.

The follow-up login redesign now provides `/qalo/signin` and `/enl/signin`. Logout chooses the current workspace's branded route through the shared path helper. Legacy `/signin` remains a valid redirect, including old workspace query parameters. The existing active-workspace preference is retained for sign-in, and protected routes opened directly or via browser Back return to the appropriate branded sign-in while the signed-out marker exists. Normal demo credential and code verification are unchanged. See `LOGIN-REDESIGN.md` for route and visual details.

## Files

- `src/App.tsx`: protected-view boundary, session-keyed workspace provider, shared logout operation, sidebar button and common overview route.
- `src/features/DemoAccess.tsx`: central signOut action and verified session marker.
- `src/lib/storage.ts`: preference writes report whether browser persistence succeeded.
- `src/lib/demoStore.ts`: prevents detached view writes from repopulating query cache.
- `src/features/WorkspaceContext.tsx`: avoids staff catalogue subscriptions on logged-out private routes.
- `src/features/SidebarLogout.css`: bottom footer/button, responsive, theme and motion styling; open mobile navigation sits above its scrim so pointer input reaches the button and links.
- `src/features/BankingOperations.tsx`: removes banking overview supplement and unreachable overview branches; preserves reports.
- `src/features/OverviewDashboard.tsx` and `.css`: removes supplement plumbing, styling and eNL disclaimer.
- `src/index.css`, `src/App.css`, `src/design-foundation.css`, `src/glass.css`, `src/theme.css`: removes obsolete profile-footer and hidden help-card styles while retaining shared text-link styling.
- `tests/browser/sidebar-logout.spec.ts`: dashboard, session, theme, layout and error-path checks.

## Limitations

The existing authentication is a browser-local demo with tab-scoped sessionStorage, not a server-authenticated session. There are no real access/refresh tokens or authentication-provider sign-out calls to revoke. Initial review-account behavior is unchanged. This work does not introduce a provider or claim server security. Logout requires writable session storage so refresh cannot silently restore the old demo identity; failure is reported rather than hidden. No records are cleared, and nothing is pushed or deployed.

## Validation results

- Development browser checks: **4 passed** for eNL cleanup/Qalo preservation, both workspace logout flows, navigation scrolling, desktop collapse, tablet/mobile layout, themes, unchanged mock snapshots, session preference clearing, refresh/Back/direct-route guards, real demo credential/code re-authentication and storage failure handling.
- Production preview browser checks against the final `dist` build: **5 passed**, repeating those checks and verifying the restored-page `pageshow` session check.
- Relevant regressions: **2 passed** for dashboard metrics/date semantics and the two-session Inbox transfer/queue/notification/ownership/conflict flow.
- `npm run build`: passed, including TypeScript. The existing large-bundle advisory remains.
- `npm run lint`: passed with the same five existing React warnings and no new warnings.
- `git diff --check`: passed.
- Visually reviewed the cleaned eNL dark dashboard/sidebar and the corrected light mobile navigation. Generated screenshots are ignored under `test-results/logout-*.png`.
