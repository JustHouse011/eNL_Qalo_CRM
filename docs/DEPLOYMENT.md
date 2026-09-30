# GitHub and Vercel

This is a Vite + React + TypeScript frontend using npm and the committed package-lock.json. No environment variables, backend services or provider credentials are needed. Deploy the repository root with the Vite framework preset, `npm ci`, `npm run build`, and `dist` output. `vercel.json` provides an index.html fallback for React Router deep links.

Use a Vercel-supported Node version meeting Vite's requirement (22.12+; Node 22 LTS is suitable). The repository's inactive `server/` and `supabase/` folders are historical reference material, not deployed functions. Never add provider secrets to VITE-prefixed variables; these become public browser code.

## Routes and verification

Check `/signin`, `/inbox`, `/settings`, `/overview`, and `/customer-preview`, including a hard refresh on each route. The older standalone customer form is `/chat` and public knowledge is `/help`. Verify logos, the website hero, charts, theme switching, glass animation, and support widget open/minimise/send/end behaviour.

Sign-in and role switching are frontend presentation only, not security boundaries. Customer and agent data persist in localStorage on the same browser/device and origin; they do not sync across devices. A localhost session, Vercel preview URL and production domain each have separate storage. When storage is unavailable, the app uses memory. No real message delivery, financial transactions or external integrations take place.

## Dashboard import if CLI authentication is unavailable

1. Sign in at https://vercel.com/new using your normal account.
2. First check your team's existing projects for one already connected to `JustHouse011/QaloChat`; use that project rather than creating a duplicate.
3. If none exists, import `JustHouse011/QaloChat` and select `main` as the production branch.
4. Keep root directory `./`, framework Vite, install command `npm ci`, build command `npm run build`, output `dist`, and Node 22.x. Leave environment variables empty.
5. Click Deploy, wait for Ready, then run the route and interaction checks above against the production URL.

The configuration is based on https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas .
