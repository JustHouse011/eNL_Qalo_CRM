# Branded staff sign-in

## Routes and behavior

- Qalo: `/qalo/signin`
- eNL: `/enl/signin`
- Legacy `/signin`: replaces the URL with the appropriate branded route using an explicit workspace query parameter, then the existing active workspace preference, with Qalo as fallback.
- Logout now returns directly to the current workspace's branded route. The existing signed-out session marker, cache cleanup, private-route guard, browser restore handling and no-data-deletion behavior remain intact.
- Existing credential verification, code preview, OTP expiry/resend/verification, developer fixture identity rules and RBAC are preserved. Successful OTP verification selects the requested workspace through the existing permission-checked service before setting the identity and navigating to Overview. A staff member cannot gain eNL membership by entering its login URL.
- There are no new credentials, authentication providers, registration/social sign-in controls or nonfunctional recovery links. The development account-switch control was removed from the sign-in presentation; the existing development session utility remains available directly for testing.

## Reference composition

One shared form and artwork component reproduce the supplied reference's centered rounded shell, roughly 60/40 artwork/form split, approximately 84% viewport width, deep background, deliberately positioned leaves, circles and quarter circles, four circular photographic masks, lower-left glass information card and clean white form surface. Branding changes logo, navy/charcoal background, purple/indigo accents, copy, photography arrangement and destination. Existing organisation logos are used without distortion.

Mobile uses a compact artwork header and a full-width white form, larger input text/touch targets and a scrollable document for OTP/short viewport needs. The old full-page photograph, translucent purple overlay, underlined-only fields and exclusive CSS were removed from the active rendering path. The earlier image asset is retained as an existing project resource, but the sign-in page no longer requests it.

Animations use CSS transforms/opacity: slow shape float, gradient-layer movement, a 48-second accent orbit, breathing ambient glow, staggered entrance and circular image reveal. Form transitions do not move layout. Reduced-motion preferences disable animation/transition; no animation library or timer loop was introduced. Failed images expose the underlying gradient mask rather than an external broken-image dependency.

## Running-application evidence

The existing Vite process points into this project's `node_modules/vite` and runs with `--host localhost --port 5180 --strictPort`. Requests to `http://localhost:5180/src/App.tsx` return the current branded route and logout implementation with `Cache-Control: no-cache`.

Visible Edge browser tests used the **existing server on port 5180**, rather than a separate test server, and captured both brands at 1083×768 (reference), 1440×1000, 820×1000 and 390×844. Screenshots were inspected and spacing corrected to avoid logo/heading and mobile copy/photo overlap. Art proportions, loaded images, form fields, overflow and reduced-motion behavior are asserted.

The Chrome CRM tab observed during investigation pointed to the published Vercel `/overview`, not localhost. The published HTML referenced `/assets/index-DOJCDjLd.js`, which still contained `Additional banking indicators` and `agent-mini` and lacked `/qalo/signin`. That is an older deployment, not a failure of the current local JSX to update. GitHub delivery is part of this request; no manual Vercel deployment is performed.

## Photography and licensing

The following Pexels photographs are downloaded into `public/login/` and served locally; no third-party image host is contacted by the running sign-in page. They are decorative stock models, not representations of actual bank customers, employees or endorsements. Their geographic location/nationality is not asserted. They provide diverse workplace imagery suitable for the intended customer-support setting; they are not verified South African location shoots.

| Local file | Source |
|---|---|
| `team.jpg` | [Business Partners Having a Meeting at the Office](https://www.pexels.com/photo/business-partners-having-a-meeting-at-the-office-7433848/) |
| `support.jpg` | [Selective Focus Photo of a Woman Wearing a Black Headset — Mikhail Nilov](https://www.pexels.com/photo/selective-focus-photo-of-a-woman-wearing-a-black-headset-7682346/) |
| `portrait.jpg` | [Content Black Woman in Formal Clothes Standing with Arms Crossed](https://www.pexels.com/photo/content-black-woman-in-formal-clothes-standing-with-arms-crossed-5668766/) |
| `collaboration.jpg` | [A Group of People Having a Meeting in the Office](https://www.pexels.com/photo/a-group-of-people-having-a-meeting-in-the-office-6592746/) |

[Pexels license](https://www.pexels.com/legal-pages/license/) permits free personal/commercial use and modification. Photographs are used in composed masks, not sold as unaltered copies. Download URLs use the matching `images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg` endpoint with a 720px compression parameter. The four files total approximately 171KB. Source/licensing pages were checked during implementation.

## Main files

- `src/features/DemoAccess.tsx`: shared branded form and permission-checked workspace landing, retaining OTP/session handlers.
- `src/features/LoginArtwork.tsx`, `src/features/Login.css`: geometric composition, masks, animations and responsive presentation.
- `src/lib/loginBranding.ts`: brand configuration and sign-in path helper.
- `src/App.tsx`: branded routes, intentional legacy redirect and branded logout destination.
- `src/App.css`, `src/index.css`, `src/glass.css`: removal of superseded login-only styles.
- `public/login/*.jpg`: licensed local imagery.
- `tests/browser/login-redesign.spec.ts`: visual, animation, authentication, routing and membership checks.
- `tests/browser/sidebar-logout.spec.ts`: updated expected branded destinations.

Previously requested local transfer and dashboard/logout changes are retained and included in the GitHub delivery, so the repository contains the complete reviewed application. See `CONVERSATION-TRANSFER.md` and `DASHBOARD-LOGOUT.md` for those file lists and integration boundaries.

## Limitations

Authentication remains the existing browser-local staff demonstration, including its locally previewed OTP; this is not production identity security or email delivery. Real backend integration remains outside this redesign. No manual Vercel deployment is part of the request. Screenshots and temporary verification configuration are ignored local artifacts, not repository assets.

## Validation

- Visible-browser checks against the existing `localhost:5180` Vite process: **6 login checks passed**, covering both layouts at reference/desktop/tablet/mobile dimensions, all local images, input count, password visibility, reduced/normal motion, typing, invalid credentials, code verification/resend, workspace landing, logout and private-route behavior.
- Latest live-server regression run: **2 passed**, verifying the signed-out restricted fixture cannot enter eNL via its URL and preserving the two-session Inbox transfer/queue/notification/conflict behavior.
- Final production-preview run: **12 passed**, covering the six login checks, five dashboard/logout checks and dashboard metric/date semantics. Authenticated Inbox navigation is verified for both organisations. The development-only membership fixture portion runs on the actual development server rather than pretending it exists in the production build.
- `npm run build`: passed, including TypeScript. The existing large-bundle advisory remains.
- `npm run lint`: passed with five pre-existing React warnings and no new warnings.
- `git diff --cached --check`: passed. Exact staged source/assets were scanned; no private keys, service tokens or excluded environment/build files were staged. The existing public demo credential fixture is unchanged.
- Screenshots reviewed: `test-results/login-{qalo,enl}-reference.png`, `login-{qalo,enl}-1440.png`, `login-{qalo,enl}-820.png` and `login-{qalo,enl}-390.png`.
