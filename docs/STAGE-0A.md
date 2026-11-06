# Stage 0A — Workspace frontend

This stage extends the existing shared React application. Supabase remains disabled; credentials, memberships, chat, visitor presence and records remain local demonstrations. No production service, bank API, financial operation, staff account or website deployment is enabled.

Installed versions verified with `npm ls --depth=0`: React 19.3.0, TypeScript 6.0.3, Vite 8.3.1, React Router 7.18.4, TanStack Query 5.104.0 and Supabase JS 2.117.2. No dependencies were installed or changed.

## Review locally

Open `/inbox`, open **Profile menu**, choose **Platform Super Admin** in **Switch account**, then select **eNL Mutual Bank** in the sidebar. The account switcher is a demonstration, not an access control. Existing Qalo-only and eNL-only profiles continue to filter the local workspace list.

## Configuration and routes

`src/lib/workspaceExperience.ts` defines workspace navigation sections, available routes, terminology, feature flags, dashboard descriptors, products, categories and fixture keys. Icon rendering is separate in `src/features/workspaceIcons.ts`, keeping data initialization independent of React UI dependencies. The shared shell applies the configuration; unsupported workspace routes return to Overview. This is a UI boundary only.

| Route | Qalo | eNL |
| --- | --- | --- |
| `/overview` | Existing overview | Banking dashboard and derived service indicators |
| `/inbox` | Existing shared inbox | Banking categories and conversation views |
| `/visitors` | Existing visitor table | Clearly simulated visitor views |
| `/contacts` | Contacts and organisations | Directory, profiles and interaction history |
| `/retail` | Orders and products | Unavailable |
| `/returns` | Returns and refund review | Unavailable |
| `/account-support` | Unavailable | Account, payment, card and digital support cases |
| `/pipeline` | Existing support pipelines | Fictional banking applications |
| `/complaints` | Unavailable | Complaints, investigations and escalations |
| `/banking-products` | Unavailable | Seven product names and reviewed-content placeholders |
| `/tickets` | Existing ticket engine | Banking ticket views over the same engine |
| `/knowledge` | Existing knowledge base | Categories, drafts and published views |
| `/saved-replies` | Existing reply editor | Six banking draft examples and category views |
| `/team` | Existing team workflow | Agent directory, departments and assignments |
| `/reports` | Existing reports | Record-derived banking charts and CSV export |
| `/integrations` | Existing settings | Website preview, channels and honest connection status |
| `/settings` | Existing settings | Profile, hours, notifications and support configuration |

Shared automations, AI configuration, activities, feedback, widget and workspace management remain accessible. eNL uses its banking assistant and widget configuration while retaining the shared operational tools.

## Implementation files

| Area | Files |
| --- | --- |
| Workspace configuration | `src/lib/workspaceExperience.ts`, `src/features/workspaceIcons.ts` |
| Additive fixtures and validation | `src/lib/bankingFixtures.ts`, `src/lib/enlWorkspace.ts`, `src/lib/workspaceMigration.ts`, `src/data/demoData.ts` |
| Shared shell and theme loading | `src/App.tsx`, `src/main.tsx` |
| Banking views and appearance | `src/features/BankingOperations.tsx`, `src/features/BankingOperations.css` |
| Shared editors and terminology | `src/features/Records.tsx`, `src/features/Retail.tsx`, `src/features/ConfigurationEditors.tsx`, `src/features/workspaceTaxonomy.ts` |
| Verification | `playwright.config.ts`, `tests/browser/stage0a.spec.ts`, existing navigation-selector tests |
| Supplied asset, used unchanged | `public/new logo full colour.svg` |

Existing uncommitted and untracked work is retained. No commits, pushes, deployments, database changes, production account creation or environment-file changes are included.

`BankingAnalytics` is the active banking dashboard/report implementation. The older `BankingDashboard` export in `BankingWorkspace.tsx` is retained as prototype work but is no longer routed. That file continues to supply the existing banking assistant and widget preview.

## Local fixtures and preservation

`bankingFixtures.ts` adds Stage 0A data once, tracked by `bankingFrontendVersion`. It preserves existing workspace metadata, records, memberships, department IDs, transcripts, articles and settings. Missing proposed departments are appended rather than renaming existing queues. The existing banking dataset remains authoritative.

The extension adds 18 fictional support records: seven account-support enquiries, seven applications and four complaints. They link to existing fictional customers and workspace agents/departments. Six saved replies are drafts; three visitor sessions explicitly simulate active, waiting and offline visitors. If no customers remain, the extension does not invent replacement identities. Reloads do not recreate deleted Stage 0A cases.

The existing version-2 browser envelope and legacy backups remain in place. All new records receive workspace ownership through existing normalization. Validation rejects foreign customer, agent and department relationships, invalid case states, and malformed activity history. No SQL migration is involved.

Local case edits preserve activity and escalation history. Credential-like note content is rejected using the existing basic frontend guard; this is not production data-loss prevention. Customer profiles link cases, applications, complaints, conversations and tickets.

Ticket and article view filters apply to record lists while editors retain the full workspace dataset. A ticket created from My Tickets, or a draft created from Published articles, remains editable even before it matches that list's filter. These flows have dedicated regression cases; Qalo retains the default unfiltered editor behavior.

## Branding and limitations

The eNL light appearance uses white, purple `#652D8D`, light grey and charcoal. The supplied `public/new logo full colour.svg` is used as the default sidebar logo without changing its paths or colours. Inspection found only `#662D91` in this SVG; it does not establish a green accent. No official green is invented, and the interface primary remains the specified `#652D8D`. Existing secondary metadata is retained without claiming official approval. Qalo styling and the existing theme toggle remain. Product descriptions and FAQs are explicit placeholders, with no fees, rates, eligibility, balances or transaction execution.

Reports aggregate local records. The illustrated three-day support target is not an official bank SLA. Presence and visitor traffic are simulated. The existing provider status remains unverified. Official eNL assets/content, production authentication, trusted permissions, persistent backend and genuine realtime chat remain later work.

## Validation

`tests/browser/stage0a.spec.ts` covers additive upgrade preservation and idempotence, relationship isolation, banking route restrictions, case editing/reload, sensitive-note rejection, product navigation, derived reports/exports, preview links, notification terminology, themes, reduced motion, keyboard navigation and layouts at 390/768/900/1440 pixels. Existing tests retain their assertions and use the new approved navigation labels where needed.

Playwright launches Vite directly rather than through an npm wrapper. Bulk runner artifacts are written to the dedicated `qalo-web-portal-stage0a-tests` folder under the operating system temporary directory, avoiding OneDrive synchronization of traces. Explicit layout screenshots still go to `test-results`. No timeouts or assertions were weakened. Long new scenarios are split by workflow so that unrelated checks do not consume a single test deadline.

Initial traced runs encountered timeouts on this machine, including browser-context cleanup. A stale `Mine`/`All` selector in the banking lifecycle test was updated to the requested `My Conversations`/`All Conversations` labels. The final regression is run with `--trace=off` to separate diagnostic overhead from behavior; assertions, 60-second limits and screenshots on failure are unchanged. The configuration still permits retained traces for targeted diagnosis.

The supplied Stage 0A attachment ends in section 6 after the white brand colour. Implementation follows the requirements actually supplied; no later attachment sections are assumed.
