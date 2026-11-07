# Applications & Enquiries redesign

Implemented 8 November 2026 for the existing Qalo and eNL CRM routes.

## Changes

- Shared `ApplicationsWorkspace` renders the existing Qalo workflow enquiries and eNL application support cases. No separate case store or service was added.
- Compact header, four data-derived filter cards, searchable/sortable case queue, category and department filters, selected-case details, recorded activity timeline, document checklist, related tickets and internal notes.
- Qalo retains enquiry creation, owner/stage updates and workflow configuration. Optional creation, department, description and history metadata preserves legacy records without fabricating missing dates.
- eNL retains its existing case save handler, assignment, status, priority and validated support notes. No create-application action or external delivery is claimed.
- Uses existing theme tokens and glass surfaces, supports keyboard tabs, light/dark themes and queue-first mobile navigation. Page children retain their intrinsic height so settings cannot overlap the mobile queue.
- Sidebar, top navigation, authentication and workspace switching are unchanged.

## Verification

- Production build, including TypeScript and catalogue preview validation: passed.
- Lint: passed with five existing warnings in CustomerChat, DemoAccess, ReportDatePicker and App.
- Eight application browser scenarios cover legacy preservation, creation, configuration, eNL edits/notes and workspace isolation, filters/sorting/unknown URLs, responsive themes/navigation for both brands and viewer access.
- Adjacent regression checks cover banking navigation and saved cases, the eNL Applications route, and automation routing plus enquiry persistence.
- Initial verification identified and corrected mobile flex shrink overlap and an obsolete creation-form test selector. Affected checks were rerun after correction.
- Screenshots are local review evidence in `test-results/applications-{qalo,enl}-{desktop,dark,mobile-detail}.png`; generated output is excluded from Git.

Records remain browser-local demonstration data. Missing history and downloadable attachments are explicitly represented as unavailable. Existing production bundle-size advisory remains.
