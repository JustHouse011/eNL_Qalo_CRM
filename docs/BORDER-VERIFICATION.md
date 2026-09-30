# Frosted surfaces and perimeter motion

The existing border already registered its custom property and animated the pseudo-element. Its presentation was restrained by an attenuated two-colour ramp and 12-second cycle, with a negative decorative z-index that was fragile around glass stacking contexts. The revised layer uses z-index 0, content at 1, full brand colour segments and a six-second linear cycle. No element rotates. The 1.25px masked perimeter has a transparent centre and inherits the card radius. Existing scroll containers are retained; no new overflow clipping or wrappers are added.

Dark glass now uses 58% opacity for content, 72% for navigation and 92% for overlays, with 20px content/navigation blur and 130% saturation. Light glass retains its 58% content surface and broad mint/purple background. Fields, tables and messages keep their reading surfaces. Neither foreground blur nor whole-card opacity is used.

Reusable classes live in `src/animatedGradientBorder.css`: `glass-gradient-border` plus `glass-gradient-border-animated` or `glass-gradient-border-static`. Prominent report metrics, charts, inbox/conversation panels and configuration panels animate; customer context and secondary reporting panels are static. The animation runs on the decorative pseudo-element itself because the registered angle does not inherit.

`main.tsx` performs one capability check for the CSS Properties and Values API. Without it the gradient stays static, avoiding discrete custom-property animation. Both system and app reduced-motion preferences disable animation. Standard/WebKit masks preserve the centre. Browsers without masking get a static border-image fallback, which can have square corners in older engines. Backdrop-filter opaque fallbacks remain in the shared glass stylesheet.

## Actual rendering checks

Run `node docs/research/verify-border.mjs` against localhost:5174. Artifacts are in `docs/research/border/`.

- Timed light frames changed 1,230 perimeter pixels; dark frames changed 1,295. Only 2–3 pixels inside the four-pixel perimeter band differed (corner antialiasing). Frames were visually inspected, not just computed CSS.
- Card bounding rectangles, transform (`none`), shadows and 1.25px border padding stayed identical between captures.
- Computed glass retained rgba alpha .58 and `blur(20px) saturate(1.3)` in both themes.
- Reduced motion and the unsupported-animation capability branch both reported no animation.
- Draft editing and opening/dismissing the ticket dialog worked in both themes without losing the draft. Mobile at 390px showed no horizontal overflow. No page errors were reported.
- The build succeeded. The existing bundle-size advisory remains. No production performance benchmark or legacy-browser rendering test was performed; several visible summary cards were observed during the frame checks. No JavaScript animation loop was introduced.
