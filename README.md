# Qalo Ya Afrika Support — frontend prototype

Standalone React + TypeScript demonstration for Community Investment and Qalo Store / Retail. All records, access, replies, AI and connections are simulated. No backend, credentials or external accounts are needed.

## Run

```sh
npm install
npm run dev
```

Use the local URL printed by Vite. `/` opens demo sign-in; `/inbox` is directly reviewable. Choose a named workspace profile at sign-in, or use **Switch account** in the profile menu to review Admin, Supervisor and Agent roles. The website and floating support widget are at `/customer-preview`; the standalone customer form is `/chat`; public knowledge is `/help`. Role selection is presentation only, not secure authentication.

```sh
npm run build
npm run preview
npm run lint
npm run test:e2e
```

`dist/` is a standalone static frontend. A static host must serve `index.html` for application routes. No `/api` handler is needed. Node must meet the installed Vite version's engine requirement (Node 22.12+ or current supported equivalent).

## Review

Send a customer enquiry, open the agent inbox in another tab of the same origin, assign or transfer it, reply, add a note, create a ticket, resolve and reopen it. Automatic replies use deterministic fictional content and appear as ordinary messages; the delivery label is Saved, not an external delivery receipt. Customer views omit notes; this is not data security. Review contacts, articles, saved replies, activities, automations, applications, feedback, report ranges, widget appearance and channel setup forms (which stop at Pending activation). Reset is available only in Vite development tooling: open the browser console and run `await window.qaloDev.resetDemoData()`. There is no reset control in the product interface or reset hook in the production build.

Support records persist in `localStorage['qalo-frontend-demo-v1']`; the service uses memory when storage fails. Same-origin tabs receive storage notifications; simultaneous cross-tab writes are last-writer-wins. Theme, reduced-motion and business filter are separate preferences. Chat selection lives in sessionStorage. Roles, connection toggles, notification read state and AI preview are temporary UI state. Reset clears records and current chat selection; display preferences remain.

See [backend handover](docs/BACKEND.md), [feature scope](docs/FEATURES.md), and [verification](docs/VERIFICATION.md). Historical `server/`, `supabase/`, database/channel tests and `.local-data/` are inactive reference artifacts, not dependencies or agreed architecture. Do not deploy them as part of this prototype. `.env` is unnecessary; existing provider configuration is ignored by the frontend.

## Product presentation

The interface intentionally uses finished product language. All frontend/backend limitations remain in this README and docs/BACKEND.md. Removing implementation labels does not enable external services: sign-in and account switching remain presentation state, replies are saved browser records, channel activation remains pending, payments remain awaiting verification, refund requests remain under review, and invitations remain drafts. No credentials are requested.


## Deployment

See [GitHub and Vercel deployment](docs/DEPLOYMENT.md). Vercel configuration is included; no environment variables are required. localStorage belongs to the current browser/device and origin and does not sync across devices.
