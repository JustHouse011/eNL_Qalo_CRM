# Qalo retail management

Local page: `http://localhost:5180/retail` (Products: `?tab=products`). The existing `/returns` route opens the Refunds tab. No commit, push or deployment is part of this request.

## Delivered interface

The existing Qalo sidebar, top navigation, workspace switcher, department/business-area filters and route permissions remain intact. Orders & Products now provides four URL-addressable tabs without application reloads; clickable record-derived KPIs; order/customer/product search; payment, delivery, refund, date, category and stock filters; sorting; pagination; product grid/list views; theme-aware status badges; and a responsive right-side details drawer.

The drawer is portalled into the existing application shell and measured against the content viewport, so it does not cover the sidebar. It supports Escape, outside-click dismissal, focus restoration, a keyboard focus loop and independent scrolling. Tabs support arrow keys, Home and End. Existing light/dark tokens, Inter typography, glass surfaces and purple accents are used. Hover, gallery, tab and drawer motion respect reduced motion.

## Actual local image inventory

All 12 supplied directories were inspected recursively. All 65 usable files are PNGs, readable locally; no OneDrive hydration failures were encountered. Exact filenames (including double spaces and ampersands), pixel dimensions, byte sizes, SHA-256 hashes, source URLs and preview URLs are recorded in `src/data/productManifest.json`. Images range from 1049 to 5000 pixels wide and 1156 to 5000 pixels high. There are no byte-identical duplicates; visually related colour/logo/front/back designs are intentionally retained.

| Source category | Usable PNG images |
|---|---:|
| Aprons | 1 |
| Bucket Hats | 13 |
| Caps | 7 |
| Golf Shirts | 16 |
| Leggings | 6 |
| Seamless Jackets | 3 |
| Shawl | 3 |
| Socks | 2 |
| Sweat Pants | 4 |
| Sweaters | 3 |
| Tie | 1 |
| Unisex Bags | 6 |
| **Total** | **65** |

`Sweaters/500 Sweater-Recovered.psd` is an editable Photoshop source, not a browser image. It is retained unchanged locally, excluded from Git by `.gitignore`, excluded from the catalogue and omitted from production output. No source photographs were renamed, overwritten or deleted. No replacement images were downloaded.

All supplied images were visually reviewed in `test-results/product-contact-sheet.png`. They include branded product design/rendering views. Catalogue names use visible/supplied design identifiers and neutral garment names. Golf Shirts retains the user's folder taxonomy, but crew-neck shirt images are named Shirt rather than claiming they are collared golf shirts. Jacket records do not assert seamless construction, material or waterproofing. Sizes/materials are not invented. Colour references come from filenames and are explicitly not verified variant availability.

The originals total **376,446,952 bytes**. **65 WebP previews total 1,563,258 bytes**, generated at up to 720px using the original local files. Originals remain available; the interface requests the small previews with root-relative, hashed URLs and lazy image loading. `object-fit: contain` preserves proportions. Failed images render a branded placeholder, and an empty category receives a placeholder product. No runtime Windows paths, external image hosts or browser filesystem discovery are used.

## Catalogue and data behaviour

There are **34 product records** and **32 demo orders**. Related brand/garment views are grouped into product galleries, rather than assuming one photo per category. Products have deterministic IDs/SKUs, synthetic ZAR prices and stock, and explicit `synthetic: true` metadata. Orders reference product IDs and keep quantity and historical unit price; names/photos are not independently copied into each order. Stock and pricing are not verified inventory or supplier facts.

Legacy order references, customers, conversation IDs, departments, recorded payment/delivery status and tracking references are retained for linked support orders. Existing tote/jacket fixture descriptions are mapped to a matching supplied product category for the demonstration catalogue; this is illustrative enrichment, not a verified supplier SKU match. Remaining orders use fictional South African customers, locations, dates, payment states and delivery events. Synthetic tracking is labelled explicitly and never linked to a real courier site. Only recorded demo milestones appear in timelines; no future milestones are presented as completed.

Data is derived deterministically until the first edit. Delivery/refund edits persist the additive `DemoData.retail` version-1 state through the existing workspace `setData`/support-service mechanism and `qalo-workspaces-v2` storage. Existing data, migrations and backups are retained. Validation rejects malformed retail records without resetting the store. Reloading preserves changes. No new storage namespace, database, payment provider or inventory integration is introduced.

Refund requests require a reason, retain a stable one-per-order request ID, update the linked conversation's existing `order.request` field, and appear in both order and refund views. Existing support review requests are also surfaced. New requests are always Requested; there is no automatic approval or payment reversal. Paid and Awaiting Verification records can request review; Failed/Refunded records cannot create a new request. A review approval is not treated as a payment event. Total Sales Value sums only demo records marked Paid; it is not a real-time receipt, settlement or bank balance.

Delivery commands follow allowed transitions, record demo activity, preserve payment status and synchronise the existing linked support fulfilment field. Only Paid demo orders can advance delivery through these controls. Existing legacy dispatch records can still be viewed while payment verification is pending.

Mutations re-check the current actor/workspace capability immediately inside the persisted update callback. Existing `/retail` and `/returns` route permission is `reply`; Viewer/Auditor users remain blocked by the unchanged route guard. eNL retains its own dashboard and cannot enter the Qalo retail route or receive these changes. This remains frontend demonstration RBAC, not server-side authentication/authorisation.

## Image/build workflow

- `npm run catalog:scan`: recursively audit supplied categories and regenerate the deterministic manifest; unreadable images cause an explicit failure with affected filenames.
- `npm run catalog:previews`: generate missing local WebP previews from the manifest using the already installed Playwright browser tooling. No Vite server is needed. Existing generated files are reused; originals are read-only.
- `npm run build`: the prebuild audit checks that every manifest preview exists, then TypeScript/Vite build the application. A build plugin copies normal public assets while excluding PSD/PSB source documents. Generated preview files must travel with the project for a clean deployment build; a browser is not required during the production build.

No new package dependency or UI library was added.

## Files changed

- `src/features/Retail.tsx`, `src/features/Retail.css`: complete retail interface and scoped responsive styles.
- `src/lib/retailData.ts`: typed catalogue, deterministic fixtures, relationship/status helpers and local transaction reducers.
- `src/data/demoData.ts`: optional additive retail state type.
- `src/lib/workspaceMigration.ts`: validation of the new optional retail state.
- `src/data/productManifest.json`: exact image inventory and deployable URL mapping.
- `scripts/product-manifest.mjs`, `scripts/product-previews.mjs`: local audit and preview generation.
- `public/products/_previews/*.webp`: 65 small derived previews; all user-supplied originals are unchanged.
- `package.json`, `vite.config.ts`, `.gitignore`: catalogue commands, build audit and browser-asset/source-document handling.
- `tests/browser/retail.spec.ts`: browser coverage for catalogue/gallery, fallback, filters, KPIs, persistence, support linkage, RBAC, workspace isolation and responsive/theme interactions.

## Verification

Verification results are recorded after the final browser/build checks. Screenshots are ignored local artifacts under `test-results/retail-*`; they are not repository product assets. This work does not push, deploy, send messages, process payments or connect a courier.

Final verification:

- **7 visible Edge browser tests passed** against the actual running `http://localhost:5180` application. Coverage includes all four tabs, loaded local images, product gallery changes, image-failure placeholders, grid/list views, stock/category/search/date filters, sorting, pagination, calculated KPI actions, keyboard tab navigation, Escape, drawer/sidebar bounds, dark/light/mobile layouts, delivery persistence, refund deduplication, unchanged payment status, existing support linkage, business/department scope, Viewer route denial and eNL isolation.
- **13 production-preview browser tests passed** against a fresh Vite preview build: seven retail scenarios plus six existing login regressions, including demo credentials, simulated OTP/resend, both workspace landings, logout and protected-route behaviour. The custom developer-identity branch is tested on the visible development app and intentionally not injected into the production preview.
- `npx tsc -b` and `npm run build`: passed. The prebuild inventory verified every generated preview. All 65 previews were copied into production output; the PSD source was excluded while its original remained locally available.
- `npm run lint`: passed with five unchanged pre-existing React warnings. The pre-existing large-JavaScript-bundle advisory remains.
- `git diff --check`: passed. No dependencies, authentication behaviour, workspace IDs, membership logic or unrelated components were redesigned.

Reproduce retail checks with `npx playwright test tests/browser/retail.spec.ts` (default development test server). For production preview, run `npm run build`, set `QALO_PREVIEW=1`, then run `npx playwright test tests/browser/retail.spec.ts tests/browser/login-redesign.spec.ts`.

No unresolved functional blocker was found. This remains a browser-local demonstration with supplied design images and synthetic commerce values, not verified stock, live sales, courier tracking or payment processing. Changes remain uncommitted, unpushed and undeployed for review.
