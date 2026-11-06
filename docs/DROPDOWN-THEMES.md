# Workspace selector and dropdown themes

The workspace selector was a native select whose options inherited a translucent `--field-surface` colour. Native popup rendering and hover highlighting are partly controlled by the browser/OS. The selector now uses an owned, themed select-only combobox and top-layer popover, so both workspace names, hover and selected states render consistently in the application palette.

## Files

- `src/features/WorkspaceSelector.tsx`: shared workspace control, accessible listbox/options, selected checkmark, keyboard arrows, Home/End, Enter/Space selection, typeahead, Escape/Tab dismissal, outside-click handling, focus return, viewport positioning, resize handling and scrollable options. The native Popover API prevents clipping by the glass sidebar; no library was added.
- `src/dropdowns.css`: theme tokens, opaque popup/option surfaces, explicit native `color-scheme`, readable native option colours and selected/hover states, and desktop/compact/mobile workspace-control styling. Department, business-area, inbox, visitors, settings and other native selects share this palette without changing their behaviour or layouts.
- `src/main.tsx`: loads the shared dropdown styles after existing theme rules.
- `src/App.tsx`: replaces the native workspace select with the shared control. The existing available-workspace list, confirmation, context selection and navigation callback remain unchanged. Workspace IDs, authentication and permissions are not modified.
- `tests/browser/dropdown-themes.spec.ts`: focused contrast, keyboard, cancellation, outside-click, native-filter palette, responsive positioning and permission tests.
- `tests/helpers/workspaceSelector.ts` and workspace-switching tests: migrate implementation-specific native `selectOption` calls/count assertions to the new user-facing control. Existing test intentions and business assertions are retained.

## Behaviour and verification

The popup inherits the theme of its own application shell even while promoted to the browser top layer. Its background is opaque, with a subtle border/shadow, rounded corners, Inter typography, selected-row tint/checkmark and separate focus/hover treatment. All authorised options use the same readable text colour. The current workspace is never styled as disabled just because it is selected. The trigger is disabled only when the original available-workspace list has fewer than two entries; unauthorised workspaces remain excluded by the existing model.

Four focused browser tests passed. They verify both Qalo/eNL options in both themes, at least 4.5:1 measured text contrast in normal/selected/hover states, opaque popup surfaces, keyboard use and cancellation preserving unsent replies, no clipping, compact/mobile bounds, Escape retaining mobile navigation, and the single-workspace agent's unchanged restricted options. Shared native palettes were audited across visitors, inbox, overview, widget and settings pages in both themes. Native controls retain browser/OS interaction conventions; the workspace popup's complete appearance is application-owned.

Screenshots were inspected at desktop and mobile sizes, including `test-results/workspace-selector-dark-workspace-qalo.png`, `workspace-selector-light-workspace-enl-mutual-bank.png`, `workspace-selector-compact.png` and `workspace-selector-mobile.png`.

TypeScript and production build passed. The project's lint script passed with the same five existing React warnings in unrelated effects/date/session code; no selector or dropdown warnings were added. No deployment was performed.
