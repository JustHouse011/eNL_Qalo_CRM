# Shared CRM directory

The `/contacts` route now uses the same directory implementation in Qalo Ya Afrika and eNL Mutual Bank. Existing navigation and workspace switching remain in place. eNL exposes Customers, Contacts and Organisations; Qalo uses Contacts and Organisations. Customers and Contacts share the existing contact identity model, rather than creating duplicate people.

## Files and components

- `src/features/CrmDirectory.tsx` and `.css`: shared directory, profile inspection, interaction history, activity timeline, contact and organisation forms, CSV actions, filters, sorting and pagination.
- `src/features/DirectoryFlyout.tsx`: content-bounded left panel, backdrop, resize handling, dismissal and focus restoration.
- `src/features/DirectoryRowActions.tsx`: accessible themed actions menu using the browser's existing popover support.
- `src/lib/crmDirectory.ts`: workspace-scoped relationships, actual recorded activity, filtering, validation and CSV parsing.
- `src/lib/directoryFixtures.ts`: additive fictional development records.
- `src/lib/runtimeMode.ts`: shared development-only fixture flag, also consumed by `liveVisitorsData.ts` without changing visitor mode behavior.
- `src/data/demoData.ts`: optional directory fixture version marker.
- `src/App.tsx`: shared route integration.
- `src/features/Records.tsx`: compatibility export of the shared Contacts directory; existing ticket implementation retained.
- `src/features/BankingOperations.tsx`: removes the duplicate banking customer implementation.
- `tests/browser/crm-directory.spec.ts`: model and browser coverage.
- `playwright.config.ts`: uses installed Microsoft Edge on Windows when available, with the normal Playwright browser fallback elsewhere.

## Functionality

Compact horizontal records include available names, email/reference, classification, source status, last recorded interaction, linked people and assigned agent. Search is debounced. Type, status, business area/department, interaction date range, custom dates, clear filters, sorting and bounded pagination operate on the current workspace snapshot. History uses recorded conversation, note, ticket and banking enquiry activity.

Details have Overview, Activity and Related Records sections. Linked organisations and people open in the same panel. Existing conversations and tickets retain their routes. Ticket creation uses the existing scoped ticket service and permissions.

Create/edit forms preserve the contact identity model, case-insensitive email uniqueness, required fields, organisation links and existing contact preferences. Organisation edits keep linked contact display names synchronized. CSV import preserves the existing three-column format and rejects duplicates atomically; export protects spreadsheet formula cells.

## Panel behavior

The panel enters from the left in 350 ms, with opacity and reduced-motion support. Its clipping viewport begins at the main content boundary; the desktop sidebar stays visible and interactive. Details use a 520 px panel and forms 560 px, constrained to available screen width. A content-only backdrop, Escape, close button, browser navigation and outside click dismiss the panel. Unsaved forms ask before discarding. Focus returns to the opening control. Detail tabs support arrow keys, Home and End. Mobile navigation temporarily hides the panel while the main content is inert.

Both themes use existing glass and dropdown tokens. No additional UI or animation dependency was added. Workspace/actor remounting closes stale panels, and scoped services preserve existing permission checks.

## Data boundaries and limitations

This repository currently uses browser-local mock snapshots, not a live CRM backend. Pagination and filtering therefore run locally. No database migration, deployment or new backend integration was performed.

With `VITE_CRM_DEMO_MODE=true` in development, the existing Qalo and eNL snapshots receive 18 fictional people, three organisations and 12 linked conversations each, once. Existing records are retained. These additions use the existing local snapshot writer, never a live database. They remain in that browser's mock snapshot after reload or after turning the flag off; production builds do not seed them. A discreet Demo Data label appears while the development fixture mode is active.

The model has no contact phone, job title, street address, organisation industry, designated primary contact or record creation/modification audit trail. Those fields and events are not fabricated. The first recorded interaction is explicitly labelled as an interaction, not a customer creation date. Financial balances and account identifiers are not introduced. Existing source records without recorded timestamps show “Not recorded.”

## Validation

- Directory checks: **4 passed**.
- Coverage includes both workspaces, contact/customer and organisation relationships, activity, light/dark screenshots, create/edit, duplicate validation, CSV import/export, search, status filter, sorting, pagination, keyboard tab navigation, focus return, Escape, outside click, browser Back, responsive screenshots and workspace/role isolation.
- Visual review: Qalo and eNL panels in both themes; mobile contact panel at 390 px; tablet organisation directory at 900 px.
- Existing workspace dropdown theme checks: **4 passed**, including contrast, both workspaces, keyboard behavior, responsive positioning and restricted workspace availability. See `DROPDOWN-THEMES.md`.
