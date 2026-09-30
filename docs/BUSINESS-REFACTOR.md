> Historical business research. Frontend scope and integration requirements are now defined by [BACKEND.md](BACKEND.md) and [FEATURES.md](FEATURES.md). Prior backend setup instructions are superseded.

# Qalo Ya Afrika: two-area support refactor

## Official-site review (30 September 2026)

Reviewed the [homepage](https://www.qaloyaafrika.co.za/), [About](https://www.qaloyaafrika.co.za/about), [Store](https://www.qaloyaafrika.co.za/store), [co-operative](https://www.qaloyaafrika.co.za/partners/cooperatives), [SME](https://www.qaloyaafrika.co.za/partners/smes), [banking partner](https://www.qaloyaafrika.co.za/partners/enl-mutual-bank), [OWN THE BANK](https://www.qaloyaafrika.co.za/investments/own-the-bank), [OWN SPAZA SHOPS](https://www.qaloyaafrika.co.za/investments/own-spaza-shop) and [role clarification](https://www.qaloyaafrika.co.za/roles) content. Several pages are client-rendered and unavailable to the text crawler; their route components were inspected in the site's public `index-1bN-CsVp.js` bundle instead. No authenticated APIs or real customer records were accessed.

The site describes Qalo as a facilitator connecting organised communities and enterprises. Investment decisions remain with the responsible participants; Qalo support is not banking operations. The bank is identified as a partner, not a support department. The two initiative pages provide document-request entry points. The application therefore links to official information and leaves unapproved operating procedures as drafts.

At review time the `/store` route rendered a coming-soon / temporarily-unavailable message. The public bundle also contains custom store, cart, checkout and payment screens. This does **not** establish Shopify, WooCommerce or an available support API. No connector was selected or falsely marked connected. Retail support is retained for product/order/payment/delivery/return/refund enquiries, independently of the OWN SPAZA SHOPS participation workflow.

The official logo was obtained from the site's `/assets/qalo-ya-afrika-logo-BOyfpfJa.png` and stored without modification at `public/qalo-logo.png`. Its public CSS includes mint, teal, purple, orange and yellow brand tokens. Existing emerald support surfaces remain a **proposed application theme**, not an assertion of a signed-off brand guide. Brand defaults and logo location are in `src/lib/branding.ts`; surface tokens are centralised in `src/index.css`.

## Application changes

- One unified inbox with an All / Community Investment / Qalo Store / technical-help filter. The scope applies to conversation lists, cases, articles, pipelines, reports, activities and collected feedback. Contacts remain a shared identity directory across areas.
- Context distinguishes participants, organisations, initiatives, document/support stages and unavailable contribution/reporting records from merchandise order/payment/fulfilment/return context.
- Tickets preserve area, category, organisation, participant link and support reference on conversion. Resolution has no business-approval or payment/refund side effect.
- Three configurable support workflows replace the default sales funnel. Legacy sales records are retained in storage, outside the active workflow view, pending confirmation of their business purpose.
- Overview and reports calculate support metrics and area/category/channel volumes from records. Missing lifecycle/satisfaction data is shown as not recorded. No returns, revenue, balances or funding approvals are invented.
- Knowledge is split by business area. Most seed articles are drafts awaiting approval; the two published examples only guide readers to official information. Saved replies acknowledge support requests without creating policy.
- Demo automation supports area/topic/participant/keyword conditions, routing, acknowledgement and an optional next-day follow-up. Execution records are stored atomically with successful demo runs. Timed and production execution remain incomplete.
- AI configuration saves approved-source selections, tone and area-specific instructions. No provider is connected and no answer, summary or review log is fabricated.
- Customer chat collects area/category/participant type, searches relevant published help and offers demo satisfaction ratings after resolution.

## Persistence and safe upgrades

Demo mutations now go through `/api/demo` to `.local-data/support-demo.sqlite`. The Vite development/preview middleware binds access to loopback and rejects cross-origin writes. Each local demo profile has a UUID preference identifying its server-side demo dataset. GET returns a version; PUT conditionally updates that version. Conflicts are retried with fresh records, preventing lost updates across tabs. Invalid requests fail explicitly; there is no production-to-demo fallback.

Existing IndexedDB demo records are read once and imported only into a fresh demo profile. `upgradeDemo` retains old IDs, conversations, messages, tickets, contacts, edits and legacy sales records. It adds the community examples and new configuration. Old unclassified retail-demo articles are preserved as drafts requiring review. The old IndexedDB database is retained as a recovery archive; new writes go to SQLite. Export or back up that archive before manually removing it. No production records are imported.

The demo service is a local review tool, not a production authentication boundary. Do not use real personal or financial data in it. Static production hosting has no demo API; demo routes display a service error rather than falling back to browser records. Production routes use Supabase exclusively.

## Production migration plan

1. Back up the database and rehearse both migrations on staging with representative records.
2. For an existing deployment, apply only the new `202609300001_business_areas.sql` after confirming the original migration is recorded. For a new project, apply both files in chronological order. Do not rerun the initial schema creation on existing tables.
3. The new transaction adds columns/tables/functions/policies. It does not delete, rename or bulk-reclassify existing business rows. Existing conversations/cases/articles default to `general` / unclassified and must be reviewed by an authorised administrator. Existing article publication flags remain unchanged; audit them against approved policies before launch.
4. Deploy the updated frontend after the migration. New chat uses `start_support_chat`; the original `start_chat` remains available for older clients. If frontend rollback is needed, retain the added columns/tables and revert the client; no destructive down migration is provided.
5. Reclassification/transfer RPCs preserve messages, note visibility and related data, with audit records. Agents can transfer only their assigned cases; supervisors/admins can transfer within their workspace.
6. Ticket inserts inherit classification from their linked conversation. Support pipeline stages live separately from verified business references. The latter permit no authenticated-client writes and restrict reads to supervisors/admins. An authorised integration must supply masked references and verification timestamps; empty tables mean no verified status exists.
7. Configure integration-specific permissions separately from support assignment. Do not expose raw banking/identity identifiers in contact metadata, chat previews or notification payloads.
8. Verify hosted Auth, Realtime, Storage and independent customer/agent sessions after rollout. Local PGlite tests validate SQL logic but cannot certify hosted service behavior.

## Still required from the business

- Approval of queue names, escalation ownership, service hours, response targets and support-workflow stages. Current queue/stage proposals are not verified organisational departments or official approval stages.
- Approved community onboarding, document handling, contributions/reconciliation, report access, communications, complaints and initiative-document wording. No minimum contribution, eligibility, timeline or return is assumed.
- Approved store fulfilment, courier tracking, returns/exchanges, refund, damaged/missing goods and payment-support policies. No inventory, refund entitlement or delivery SLA is assumed.
- A verified store API contract and test credentials, including read scopes for orders/payment/fulfilment and separately authorised retail actions. Do not assume an ecommerce vendor from the visible storefront.
- Authorised Qalo application/reporting/contribution API contracts, account-to-contact matching rules, masked-reference formats and banking escalation boundaries.
- Production Supabase configuration, trusted member provisioning, anonymous-signup abuse controls and integration secrets kept server-side.
- AI provider and approved retrieval/handoff/review controls before suggestions or summaries are enabled.
- Contact-consent/retention procedures and role-specific access rules. Demo preferences are not evidence of legally valid consent.

Outstanding engineering includes customer attachments, typing/read receipts, offline hours/capture, visitor tracking, full production management screens, provider-backed invitations/team chat, timed automations and deployed verified inbound webhooks. These are listed explicitly in the feature matrix.
