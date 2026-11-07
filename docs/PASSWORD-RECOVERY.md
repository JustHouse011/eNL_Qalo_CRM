# Staff password recovery — pending backend integration

## Current status

This repository has no persistent staff identity/session service or email transport. `src/lib/supabase.ts` explicitly disables production clients; the Supabase package being installed does not configure Supabase Auth. The historical `server/` code is not an active staff identity backend. No real reset email has been sent, no real password has been changed, and no real expiration, token replay, old-password rejection or disabled-account enforcement has been verified.

Recovery UI and a fail-closed integration client are implemented. Keep `VITE_STAFF_PASSWORD_RECOVERY_ENABLED=false` (the default). Both recovery pages explicitly state that recovery is unavailable and disable submission. They do not simulate email delivery or update browser-local passwords. Do not enable this flag until the actual staff authentication backend, session guards and email transport are integrated and tested together.

## Files and routes

- `src/features/DemoAccess.tsx`: replaces Contact Support with the right-aligned Forgot password link immediately below the password field. Production credential submission reports that secure sign-in integration is pending.
- `src/features/PasswordRecovery.tsx`: shared branded forgot/reset forms, neutral confirmation only after server acceptance, show/hide controls, password-policy guidance, matching/length validation, failure and success states, and brand-specific return links. No registration or automatic sign-in.
- `src/lib/passwordRecovery.ts`: opt-in same-origin JSON integration contract with timeouts, no caching, no ambient cookies and no raw server-error display. Rejects HTML fallback responses and malformed success payloads.
- `src/App.tsx`: `/qalo/forgot-password`, `/enl/forgot-password`, `/qalo/reset-password`, `/enl/reset-password`.
- `src/features/Login.css`: discreet recovery link and form notice/guidance styles; existing artwork/animation code is unchanged.
- `src/lib/demoAuth.ts`: hardcoded demo credential verification is development-only; default password is removed from the production branch. Local development sign-in remains unchanged.
- `index.html`: no-referrer policy, including before recovery-page JavaScript loads.
- `.env.example`: public opt-in flag, no provider credentials.
- `tests/browser/password-recovery*.spec.ts`: default-disabled UI and mocked integration-contract coverage.

The dual artwork logos, primary purple design, fields/buttons, animations and workspace membership records remain intact. No data migrations, account provisioning, role changes or membership changes are performed.

## Required same-origin backend contract

Requests are JSON POSTs to `/api/staff-auth/recovery/{request,validate,complete}`. Responses must be JSON and include `Cache-Control: no-store`. The Vercel SPA fallback currently returns HTML for unimplemented API paths; the client rejects that response, rather than claiming a reset email was sent. The frontend does not contain an implementation of these endpoints.

1. `request`: `{email, brand}` where brand is `qalo` or `enl`. Return HTTP 202 `{accepted:true}` for both known and unknown addresses, including suspended accounts. Response timing must not disclose account existence. Enqueue email only for eligible administrator-provisioned staff. Generate the token server-side with a CSPRNG (at least 256 bits), store only its secure digest with account ID, brand, purpose and expiry, and deliver it using the configured transactional provider. Do not create an account. Build links from a configured HTTPS origin and allowlisted branded path, never from an untrusted Host or client-supplied redirect.
2. Link format: `https://<approved-origin>/<brand>/reset-password#token=<opaque-token>`. The fragment is not sent to the HTTP server. The reset component removes the fragment/query from the address bar and retains the token only in mounted React state. Reloading after scrubbing requires opening the email link again. No reset token is generated, logged, stored in localStorage/sessionStorage, or included in API URLs by the client. Do not attach analytics/session replay to recovery pages or log request bodies. Configure no-referrer and no-store headers at the backend/hosting layer too.
3. `validate`: `{token, brand}`. Verify the digest, purpose, expiry, unused state, intended brand, staff account status and authorised workspace membership server-side. Return `{valid:true,policy:{minLength:<integer>,maxLength:<integer>}}` only for eligible tokens. This check must be non-consuming/idempotent; React may repeat it. The policy must be the same approved policy used for staff sign-in/password changes. No identity or membership information is returned. The UI supports policy lengths from 8 to 1024; agree the actual policy with the identity service. The browser's validation is only a convenience, never enforcement.
4. `complete`: `{token,password,brand}`. Repeat all token/account/membership checks. Atomically consume the token and update the password hash through the chosen identity provider. Simultaneous submissions must permit exactly one success. Enforce the real password policy, compromised-password checks and provider hashing requirements on the server. Reject expired/used links with HTTP 400 or 410. On success return `{updated:true}`; do not create a login session. Invalidate other sessions/refresh tokens and outstanding recovery tokens according to the organisation's approved policy, and send a password-change notification without the password/token.
5. Rate-limit all three endpoints server-side, including per-account/per-token and per-source protections. Return 429 without revealing account existence. Do not rely on disabled buttons for abuse prevention. Enforce HTTPS, JSON content type, trusted same-origin Origin/Fetch Metadata checks, request-size limits, and restrictive CORS. These endpoints use the reset token as proof and must not require or establish an ambient login cookie; the client sends `credentials: omit`. If the selected provider requires cookies/CSRF or another link format, implement and security-review that adapter explicitly before enabling the flag.

No provider SDK is assumed. If Supabase/Firebase/another provider is selected later, use its documented recovery, token verification, password update and session revocation APIs through an appropriate adapter; do not translate this contract into frontend-generated tokens or reuse the demo password store.

## Demo/live separation and remaining security work

Local `npm run dev` retains the existing browser-local credential/OTP fixture for testing. Password recovery never calls `saveDemoPassword`, `setRole`, account creation or workspace selectors. Production builds no longer verify the hardcoded local demo credentials or generate the demo email preview through credential submission; they report pending staff sign-in integration. This intentionally changes production sign-in availability to meet the requirement not to ship demo credentials.

The rest of the CRM remains the existing frontend prototype, including its browser-controlled session presentation and default fixture identity. Hiding demo credentials does NOT make its route guards/RBAC a secure staff-only boundary. Before a secure staff release, replace these with real backend session verification and authorisation for every data operation. A password reset must never reactivate a suspended account, change roles/memberships, duplicate an employee across workspaces or restore access revoked by an administrator.

## Verification scope

Browser contract tests mock HTTP responses; they prove UI/client behaviour only. They do not prove server-side rate limiting, secure token generation, atomic replay prevention, real email delivery, session revocation or password hashing. Required integration acceptance remains: deliver a reset email to an authorised test mailbox, follow it, change a real test staff password, reject the old password, accept the new one, reject replay/expiry/concurrent attempts, retain workspace roles/memberships and deny suspended accounts. There is no test mailbox/backend available in this repository.

Security reference: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Validation results and reproduction

- Existing local Vite app (`http://localhost:5180`), visible Edge: **8 passed**, including both branded login/OTP/logout/RBAC regressions and both disabled recovery flows.
- Opt-in API contract tests: **5 passed** with mocked endpoints only, including neutral request responses, native email validation, server-provided policy, mismatched passwords, show/hide, success without authentication, rejected expired/reused links, 429 and HTML fallback. Opening a second fragment link in the same tab is handled and tested.
- Normal production preview: seven checks passed initially; the normal-motion check expected the old demo credential error. Its expected message was updated for the intentional production sign-in block and rerun separately. No product change was required for that assertion.
- Additional visible Edge checks: both brands, light/dark preferences, desktop/mobile reset pages, preserved dual logos, no horizontal overflow and no page errors.
- TypeScript/production build passed. Lint passed with the same five pre-existing warnings. Existing bundle-size advisory remains.
- Production JS scan: no exact hardcoded demo password literal or demo login email. A digit sequence inside a dependency's identifier alphabet is not a bundled credential.

Reproduce default-disabled UI and login checks: `npx playwright test --config playwright.recovery.config.ts`. For production checks set `QALO_PREVIEW=1` after `npm run build`. For the mocked contract suite set `QALO_RECOVERY_CONTRACT=1` and run the same configuration without `QALO_PREVIEW`. The latter starts an isolated development server with the public recovery flag enabled; test mocks are not installed in the application or normal deployment. The API adapter remains disabled in `.env.example`.

Git preparation includes `.env.example`, `index.html`, `src/App.tsx`, `src/features/DemoAccess.tsx`, `src/features/Login.css`, `src/features/PasswordRecovery.tsx`, `src/lib/demoAuth.ts`, `src/lib/passwordRecovery.ts`, `playwright.recovery.config.ts`, `tests/browser/login-redesign.spec.ts`, the two password-recovery browser suites, this document and `docs/BACKEND.md`. No secrets, real customer records or provider credentials are added. Unrelated local scratch files remain excluded.

No push/deployment is part of this preparation: this repository's Git integration automatically deploys Vercel on push, while this request explicitly withholds deployment. Existing public-publication approval is retained, but no live authentication changes should be released as a working secure recovery feature before the real integration acceptance above.

Final production normal-motion rerun: **1 passed**. Together with the seven successful production checks, all eight production scenarios now have passing verification.
