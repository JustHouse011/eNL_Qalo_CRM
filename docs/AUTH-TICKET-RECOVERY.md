# Auth/ticket recovery and urgent logo hotfix

Actual project: `C:\Users\Bongani Nombamba\OneDrive - eNL Mutual Bank\New folder\Qalo Web Portal`. File writes, Node v24.21.0, npm 11.19.0 and Vite execution were verified. The active development app is `http://localhost:5180`; HTTP 200 responses from its `/src/features/Records.tsx` and `/src/features/AuthLayout.tsx` contain the new rendered implementation. A built preview was also checked on `http://localhost:5188`.

## Implemented files and code

- `src/features/AuthLayout.tsx` (new): the shared approved split-screen shell, preserving brand-specific artwork and white form panel.
- `src/features/DemoAccess.tsx`, `src/features/PasswordRecovery.tsx`: all six branded auth routes use that shell. Demo credentials, simulated OTP, permissions and unavailable real recovery behaviour remain intact. OTP copy explicitly states no email is sent.
- `src/features/Records.tsx`: replaces the active ticket editor layout with a queue, centre description/timeline/reply/internal-note composer, and right properties/recent-activity panel. Auto-selection, scoped filtering, selection URLs, CSV export and actions use the existing ticket service. Save/status/assignment/department/due-date/resolution actions, linked conversation return links and draft handling are preserved. No separate application is created for eNL.
- `src/App.css`: scoped three-column grid, independently scrolling panels, glass/theme styling and tablet/mobile layouts. Old editor-layout markup is removed from the active ticket component.
- `src/lib/retailData.ts`: one-line JSON import attribute correction so existing Node ticket-service tests can import the workspace modules. No retail behaviour is redesigned.
- `tests/browser/ticket-operations.spec.ts`: existing activity assertion scoped to the recent-activity region; obsolete availability selector aligned with the existing control's actual accessible name.
- `tests/browser/ticket-workspace.spec.ts` (new): both brands' six auth routes, ticket panel geometry, edits, lifecycle, replies/notes, refresh persistence, CSV, themes, mobile and page errors.
- `public/branding/qalo-white.svg`, `public/branding/enl-white.svg` (new): white transparent derivatives of the official native vector originals. Original paths/viewBox/proportions are retained; only paint colours change. Original coloured assets remain untouched.
- `src/features/LoginArtwork.tsx`, `src/features/Login.css`: consume the white SVGs; remove the logo row's backing colour, border, shadow and padding. Preserve 24px desktop / 20px mobile gaps, image contain sizing, artwork, photographs, animation and form behaviour. No CSS filters are used.

`src/App.tsx` already routes all six authentication pages correctly. `/tickets` uses `Tickets` directly for Qalo and `BankingTickets` → the same `Tickets` component for eNL. Those existing routes were exercised rather than replaced.

## Verification

- 10 visible Edge checks passed on the actual port-5180 app: six existing login checks, two unavailable-recovery checks and two full auth/ticket workspace journeys. All six branded authentication routes were opened and captured; demo OTP/login/logout remain working.
- All seven existing ticket-operation scenarios have passing verification: five passed in the first completed run and two passed after updating obsolete test selectors. Includes idempotence, permitted transitions, assignment/department eligibility, foreign-reference rejection, captured workspace, reload persistence, mobile and conversation return links.
- 10 additional production-preview checks passed against the built application on port 5188 before the urgent paint-only logo correction.
- After the hotfix, both sign-in pages were checked again in visible Edge: every painted logo pixel was white, backgrounds contained transparent pixels, backing panel/shadow/padding were absent, desktop/mobile gaps were retained, no horizontal overflow occurred, and complete simulated OTP/login/logout passed for both brands.
- Final `npm run build`: passed (includes TypeScript and catalogue prebuild). Existing large-bundle advisory remains. Lint passed with the same five pre-existing warnings.
- Screenshots: `test-results/recovered-{qalo,enl}-{signin,forgot-password,reset-password}.png`, `recovered-{qalo,enl}-tickets-{desktop,dark,mobile}.png`, and `white-logos-{qalo,enl}-{desktop,mobile}.png`. Screenshots are ignored local evidence, not committed build artifacts.

Real staff password recovery/email delivery still requires an integrated backend/provider; no real reset email or real password change is claimed. Ticket replies remain saved demonstration records, not external deliveries. Frontend demo roles/workspace guards are preserved and are not production identity security.

The urgent request authorises publishing the reviewed application changes with message `fix(auth): white transparent logos and CRM UI updates`. No temporary scripts, build output, environment credentials or unrelated changes are part of this commit. Existing public-publication approval is retained. No manual Vercel deployment is performed; the existing Git integration may deploy automatically.
