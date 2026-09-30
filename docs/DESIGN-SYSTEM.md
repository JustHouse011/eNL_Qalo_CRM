# Qalo support visual system

The current palette is supplied by Qalo in the design brief. Exact brand tokens live in `src/theme.css`; `src/index.css` and `src/App.css` retain existing component layout rules and consume shared tokens. Both business areas use the same theme and are distinguished by their labels.

| Token | Official colour | Role |
|---|---|---|
| Mint | #8CCDAB | Dark headings, focus accents, secondary highlights and restrained glass tints |
| Purple | #933F98 | Primary actions, navigation selection, tabs and charts |
| Green | #3EAD53 | Online/success indicators |
| Yellow | #FBBF16 | Waiting/pending indicators |
| Orange | #DE752E | High priority/escalation indicators |

The shared surface layer is `src/glass.css`, imported after the legacy component and theme styles. It is scoped to `.app-shell`, preserving the public website and its branding. Existing component classes are aliases for the reusable `.glass-nav`, `.glass-content` and `.glass-overlay` utilities; new components can use those utilities directly.

| Surface | Light opacity | Dark opacity | Desktop blur | Mobile blur |
|---|---|---|---|---|
| Navigation | 72% | 88% | 22px light / 18px dark | 14px light / 10px dark |
| Content | 58% | 72% | 20px light / 12px dark | 12px light / 6px dark |
| Overlay | 91% | 94% | 24px | 16px light / 14px dark |

All three use 130% saturation in light mode and 115% in dark mode, fine borders, a brighter upper edge and soft shadows. Navigation covers the sidebar, header, business filter, settings navigation and toolbars. Content covers cards, reports, conversation lists, chat and customer details. Overlay covers dialogs, menus, notifications, calendars, saved replies and chart tooltips. The shell supplies static, broad mint/purple gradients behind the surfaces, with greater variation in light mode. Nested light-mode cards and toolbars use a 28% white wash without another blur so they do not conceal the parent glass; dark nested surfaces remain opaque. The modal scrim has no blur. Message bubbles, tables, inputs and composer surfaces remain opaque. No foreground filter or component-wide opacity is used by this layer.

Each level has its own solid fallback token in an `@supports` block. Both prefixed and standard backdrop-filter are provided. Reduced transparency disables both properties; reduced motion disables animation and transitions. Mobile lowers the blur radii at 820px. The system adds no animation or data/state changes.

## Accessible variants

Purple button hover/pressed colours are #803486 / #6C2A72. White text measures 6.17:1 on official purple, 7.63:1 on hover and 9.49:1 on pressed. Secondary buttons use official mint #8CCDAB with dark #193C2B text; mint is never paired with white text. Tertiary links and selected labels use #E3A8E7 in dark mode and #803486 in light mode. Line charts use a lighter purple in dark mode and a darker green in light mode so both series remain visible; solid/dashed lines and the data tables also distinguish the series.

Semantic text uses lighter green/orange/error variants on dark surfaces and darker green/yellow/orange/error variants on light surfaces. Official bright status colours remain in the dots, with darker outlines in light mode: green alone is only 2.87:1 against white. Status text and icons preserve meaning independently of colour. Destructive reset uses a separate rose error treatment.

Focus uses a visible 3px mint ring in dark mode and purple in light mode. Input/composer groups have a focus-within outline. Control boundaries measure 3.25:1 against the dark raised surface and 3.88:1 against white. Disabled buttons retain readable text without reducing the whole element's opacity. Busy customer-send buttons expose aria-busy and retain their Saving label. Theme backgrounds switch immediately to avoid a temporary text/background contrast mismatch.

## Verification

- Production build succeeds; all ten existing browser regression tests pass, including 390/768/1440px layouts, chat privacy, persistence, records and routing.
- Inspected desktop inbox in both themes, overview, widget and mobile widget. Visited the remaining management screens using the shared theme.
- Computed browser samples: dark/light active navigation 7.65:1 / 6.86:1; page headings 9.86:1 / 6.92:1. Primary and secondary text meet 4.5:1 in both themes.
- Conservative alpha-compositing check places glass surfaces over both black and white, bounding the underlying gradients: smallest muted text remains at least 6.21:1 dark / 5.55:1 light.
- Keyboard focus inspected in both themes; mobile overflow checks pass. Lint has no errors and three pre-existing warnings.

These are targeted contrast and browser checks, not a complete WCAG certification. Existing compact type sizes are retained to preserve layout. User-selected widget colours update the local launcher and greeting preview. The standalone widget launcher necessarily declares its own small palette because it runs on host sites outside the React stylesheet; it now matches the Qalo palette and includes focus/hover states. The official multicolour logo is retained unchanged on a neutral dark backing.

## Standalone frontend review scope

The application is now exclusively a mock frontend. Retain the palette, glass surfaces, accessible controls, charts and responsive layout described above. The workspace opens directly into its product layout, without a development toolbar or implementation badges. Named workspace profiles are available at sign-in and in the account menu; reset is development tooling only. Demo sign-in uses mint/purple gradients and the local Qalo logo. No approved login-background image could be identified in the available assets; `src/assets/hero.png` is a generic starter illustration and is not used as an approved Qalo background. Replace the gradient with the approved asset when supplied.

See BACKEND.md for the replacement contract and VERIFICATION.md for current checks. Earlier live/database descriptions in historical research are not the application scope.

## Product language

Use task-oriented product copy throughout: Sign in, Visitors, Saved, Suggested reply, Invitation draft, Configuration saved, Connection not verified, Request refund review, Publish in help centre and Save changes. Keep implementation disclaimers in handover documentation. Retain meaningful business states such as Awaiting verification and Not available; never convert missing verification into a confirmed outcome.
