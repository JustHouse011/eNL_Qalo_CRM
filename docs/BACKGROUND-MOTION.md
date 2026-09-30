# Ambient light and glass sheen

Animated borders also carry two narrow specular highlights: white centres with mint/lilac shoulders, layered above the brand gradient inside the existing 1.25px perimeter mask. These follow the six-second border orbit without extra animation loops, outer glow or changing shadows. Secondary borders remain quiet. Reduced motion freezes the border highlights along with the orbit. The border verification was rerun in both themes: geometry/shadows stayed fixed, drafts survived dialog dismissal, and mobile had no horizontal overflow. Pixel changes inside cards now include the intentional background/sheening effect, so the earlier border-only pixel counts are historical.

`src/animatedGradientBorder.css` adds one inherited, registered `--qalo-light-position` property. A 22-second linear CSS cycle moves a broad mint/purple wash behind the workspace and a narrower white reflection over prominent glass cards. Viewport-aligned gradient coordinates make the reflection follow the same light across neighbouring cards rather than starting separately inside each card.

The shell background remains stationary beneath the moving colour wash. Card reflection layers have transparent centres outside the highlight, inherited rounded corners and `pointer-events: none`. They render below content and above the glass surface. Card geometry, shadows and blur do not animate. The existing perimeter animation is independent. Secondary panels, inputs, rows and messages do not receive individual sheen layers.

Both system and in-app reduced motion disable the background sweep and sheen. Reduced transparency also disables these effects. Without custom-property animation support the light stays outside the viewport; existing static glass remains. Mobile uses a lower highlight intensity. No animation timers or JavaScript loops run in the app.

`node docs/research/verify-sheen.mjs` checks live CSS position changes, stable geometry/shadows, reduced motion and mobile overflow. It also captures before/passing phases of the actual CSS animation in both themes under `docs/research/sheen/`. Phase control is confined to the verification script.
