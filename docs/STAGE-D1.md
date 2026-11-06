# Stage D1 — shared glass foundation and application shell

## A. Implementation summary

Stage D1 only. The existing React shell now follows the supplied HTML's floating layout: a 256px sidebar with a 12px outer gutter, a separate rounded header, translucent glass, soft shadows and three ambient gradient orbs. Existing CRM modules, data, roles, routes and workspace switching remain in place. Dashboard grids and module compositions are deferred to D2–D5.

## B. Files modified in this stage

- `package.json`, `package-lock.json`: locally served `@fontsource/inter` assets, licensed under SIL OFL 1.1.
- `src/main.tsx`: load Latin Inter 300 and 400 only, then the final foundation stylesheet.
- `src/App.tsx`: decorative ambient layer; header search positioning; mobile drawer semantics, focus containment, dismissal and animation visibility cleanup. No permission/data changes.
- `src/index.css`, `src/App.css`: normalize legacy font families, numeric weights and font shorthands to Inter 300/400.
- `src/features/CustomerPreview.css`, `src/features/SupportWidget.css`: typography normalization only, preserving public preview/widget styling and behavior.
- `src/design-foundation.css`: central typography, tokens, both themes, shell styling, overlays, ambient motion, responsive rules and fallbacks.
- `tests/browser/design-foundation.spec.ts`: browser typography, theme, geometry, branding, overflow, reduced motion, drawer focus and saved-theme checks; review screenshots.
- `tests/browser/stage0a.spec.ts`: update two exact legacy solid-white background assertions to the approved D1 light background; add exact eNL brand-color assertions, retaining all navigation/overflow/theme checks.
- `docs/STAGE-D1.md`: this stage report.

Existing uncommitted and untracked work was preserved. A pre-edit CSS/shell snapshot is retained in `.local-data/d1-baseline`; generated artifacts and temporary runner configuration are under ignored `.local-data/d1-review`.

## C. Reference fidelity

Source: `C:/Users/nomba/OneDrive/Pictures/glassmorphic_support_dashboard.html`.

Matches its 12px floating gutter, 256px sidebar, 24px sidebar corners, rounded separate top navigation, left-aligned desktop search, purple active-navigation gradient, 16px glass blur and layered ambient lighting. Uses the approved brand values in place of the sample's generic purple/blue/pink palette, and preserves official logos and existing functional controls. The existing business-scope controls remain present. This is a D1 shell comparison, not a claim that the dashboard composition already matches the reference.

Offline reference captures used locally compiled Tailwind utilities. Reference scripts and network requests were blocked; external icon/font/image assets and Chart.js canvases are absent in those comparison captures. The production app does not import the HTML or its CDN scripts.

## D. Typography verification

Only Inter Light 300 and Regular 400 are imported. Font synthesis is disabled. Existing DM Sans/Manrope declarations and heavier weight/shorthand declarations were normalized. Supporting descriptions use 300; headings, controls, navigation, important values, SVG/chart labels and table headers use 400. Icon stroke widths and official vector logo artwork were preserved.

Static source scanning found no remaining unapproved CSS family or font-weight declarations. Browser tests inspect visible computed styles, load the actual Inter faces, and cover overview labels/charts plus login, personal profile and platform administration. The build emits only the 300/400 Latin font assets (WOFF2 with WOFF fallback).

## E. Theme verification

Light: frosted white glass over a soft neutral background with workspace-colored ambient lighting.
Dark: deep near-black background, translucent dark panels, readable light text and restrained purple lighting.

The existing saved `qalo-theme` preference remains in use. Theme switching is available at mobile widths, and reload persistence is tested. Opaque fallback surfaces are provided for browsers without backdrop blur and for reduced-transparency preferences. Existing dense reading surfaces remain opaque enough for agent work.

## F. Workspace verification

Qalo retains `#933F98`, `#8CCDAB`, `#3EAD53`, `#FBBF16`, `#DE752E`, its logo, routes, terminology and mock records. eNL retains `#652D8D`, white/charcoal/light-grey foundations, existing approved assets and the existing `#B59BD3` accent. D1 explicitly overrides the old eNL rules that disabled glass on the shared shell, without rewriting banking modules.

The existing Bongani/Phindile/Tumo access configurations are unchanged. Workspace switching still remounts transient state and preserves stored records.

## G. Animation verification

Three decorative, pointer-transparent orbs use 18-second transform-only float cycles. Existing registered-property gradient-border animation is reused with workspace-aware accents. Shared hover-lift and content-reveal primitives are available for later stages. Shell controls, focus, dropdown entrances and drawer movement use short transitions.

`prefers-reduced-motion`, the existing local reduced-motion preferences, slow-update displays and reduced transparency are respected. Animation pauses while the document is hidden; event listeners are removed on shell unmount. No Three.js, new animation dependency or continuous JavaScript rendering loop was introduced.

## H. Responsive verification

Browser checks cover 390px mobile, 768px tablet, 900px laptop, 1440px desktop and 1920px large desktop, in both workspaces and themes. The tablet/mobile drawer retains the workspace selector, traps keyboard focus, supports Escape and backdrop dismissal, and makes the obscured page inert. The closed drawer is inert too. Desktop collapse remains available. Screenshots are generated under `.local-data/d1-review`.

## I. Regression results

- 21 relevant browser cases verified across the selected run and focused rerun. The 20-case selected run passed 15 tests and exposed five legacy solid-white visual assertions; after updating the exact background checks and adding eNL brand-color checks, the focused run passed all seven cases, including those five and the final drawer/motion checks.
- All seven D1 cases passed across these runs: both themes and both workspaces at five widths; mobile focus/escape and saved theme; normal motion, personal reduced motion and hidden-document pause.
- The earlier nine-case CRM/identity smoke run also completed with all nine passing.
- Qalo chat/reply/private-note/ticket persistence, the three identity access configurations, workspace switching/reset, personal profile isolation, saved preferences, and Qalo/eNL responsive navigation were covered.
- Static typography audit found no remaining unapproved CSS font families or weights. Calculated shell token contrast pairs are listed below.
- Final TypeScript, production build, lint and whitespace checks all passed. The repository uses Oxlint (`npm run lint`), not ESLint, so no new lint stack was installed.
- A full repository browser-suite run was not performed for this visual stage; no full-suite claim is made.

## J. Security findings

No authentication, authorization, mock-data structure, backend, Supabase or storage architecture changes were made. No reference JavaScript, external CDN dependency, raw HTML injection, new invitation delivery or production-user management was introduced. Tawk.to was not removed. All generated assets are served locally; reference network resources were blocked during comparison capture.

The font installation reported 9 dependency audit findings (2 moderate, 7 high) in the dependency tree. This stage does not apply unrelated dependency upgrades or claim those findings are remediated. Existing production code-splitting and lint warnings are also outside D1's visual scope.

## K. Outstanding issues and limitations

- D2 dashboard/card/chart composition and D3–D5 module-specific styling are intentionally pending approval of D1.
- Existing lint warnings and the >500 kB JavaScript chunk warning remain.
- Browser checks use Chromium; Safari/Firefox and physical low-powered-device performance require separate validation. Calculated token-pair contrasts: light secondary text 6.53:1 and metadata 5.43:1 on `#f1f3f8`; dark secondary text 10.11:1 and metadata 7.74:1 on `#171321`; white active-navigation text 6.17:1 on Qalo purple and 9.08:1 on eNL purple. Actual translucent composites vary; no full-platform WCAG certification is claimed.
- No password-recovery route exists in the current application; D1 adds none.
- The existing Windows test server can linger during shutdown after tests finish. Stopping only the validation server lets the runner complete its report; no application test expectations were relaxed.

## L. Visual approval required

Review Qalo and eNL Overview **shells** in light and dark modes, the desktop collapsed sidebar, mobile/tablet navigation drawer, workspace selector and profile/notification popovers. Dashboard bodies in screenshots remain the existing implementation pending D2.

Representative artifacts: `qalo-light-1440.png`, `qalo-dark-1440.png`, `enl-light-1440.png`, `enl-dark-1440.png`, `qalo-light-390.png`, `enl-dark-390.png`, `mobile-navigation-390.png` under `.local-data/d1-review`.

Stop at D1. No commit, push, deployment or D2 work was performed. Explicit visual approval is required before proceeding.
