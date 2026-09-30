# Product polish verification

The current copy pass removes implementation labels from login, navigation, profiles, messages, fixture content, visitors, integrations, AI, retail, tickets, knowledge, automations, settings and the widget. Technical limitations remain documented in BACKEND.md. Older results below describe the prior frontend scope and are historical.

Browser checks cover all application routes (including compatibility routes and not-found), visible text, form values, accessible labels, tooltips, settings tabs, dialogs, notification preferences, widget appearance/hours, integration save state, and legacy fixture migration. Configuration coverage includes persistence across refresh, cancellation, invalid hours and channel references, local previews, and routing behavior. Business wording such as "sample fabric order" is deliberately preserved. Network assertions reject API and external-service requests. Integrations remain Configuration saved / Connection not verified; payment remains Awaiting verification, invitations remain drafts and refunds remain Review requested. Reset has no UI control and is exercised through the development-only console hook.

# Verification — standalone mock frontend

## Commands

- `npm run build`: TypeScript validation and static Vite production build.
- `npm run lint`: frontend/repository lint checks.
- `npm test` or `npm run test:e2e`: Playwright frontend suite; starts Vite automatically on 127.0.0.1:5187.
- To verify compiled static assets in PowerShell: build first, then `$env:QALO_PREVIEW='1'; npm run test:e2e`. The same tests use `vite preview`, which has no demo API or database middleware.
- `npm run test:legacy-backend` is an explicitly historical backend test command, not a requirement for frontend review.

## Coverage

Browser tests exercise customer and agent messages, deterministic replies displayed as ordinary messages, note visibility, assignment/transfer, case resolution, ticket conversion, linked records, persistence, contact/CSV validation, knowledge publication, saved-reply composer behavior, editable routing rules, application stages, business-area isolation, report date ranges/CSV exports, AI response previews, channel setup with non-secret references, retail refund-review requests, profile switching, development-only reset and disabled browser storage. Existing responsive checks cover 390, 768 and 1440 px. Network assertions reject API and external requests during local configuration flows.

## Scope limits

These checks validate frontend behavior only. Customer note filtering is presentation logic, not authorization. Browser tabs use localStorage notifications and last-writer-wins writes. All records, visitors, orders, payment statuses, AI, invitations and connection states are fictional. Files are validated as metadata but not uploaded. Historical backend tests do not certify a production service.

The build currently emits a bundle-size advisory for the chart-heavy application. Lint emits React lifecycle/fast-refresh advisories; neither blocks the static prototype. Exact run results are reported with delivery.

## Latest verified result (30 September 2026)

Production build passed. All 17 browser tests passed against the local Vite app, including persistence/cancel/validation previews, routing, no-API/external-request assertions and browser-storage denial. Responsive checks passed at 390/768/1440 px. Lint completed with zero errors; remaining warnings are listed with the current run. Build emitted a non-blocking bundle-size advisory.
