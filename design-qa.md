# Design QA - Direct Floating Dashboard

## Evidence

- Source visual truth: `C:/Users/vinip/AppData/Local/Temp/codex-clipboard-946d501e-8216-4963-ad7b-06a6adcf55c6.png`.
- Desktop light: `test-results/design-dashboard-light.png`.
- Desktop dark: `test-results/design-dashboard-dark.png`.
- Mobile light: `test-results/design-mobile-demandas-light.png`.
- Mobile dark: `test-results/design-mobile-demandas-dark.png`.
- Side-by-side: `test-results/design-comparison-floating-dashboard.png`.
- Desktop viewport: 1440 x 1000 CSS px.
- Mobile viewport: Playwright iPhone 14 Pro Max profile.
- Source pixels: 1143 x 626.
- Captures: 1440 x 1182 light, 1440 x 1096 dark and 1290 x 2220 mobile.
- State: authenticated Direct dashboard using the current account data.

## Full-view comparison

The implementation now follows the reference's strongest visual traits: clearly separated modules, rounded independent cards, short layered elevation, a cool blue-gray canvas, white technical surfaces, a navy featured KPI and bright cyan/status accents. The Direct information architecture and real operational metrics were preserved.

The source contains decorative finance charts that are not approved Direct metrics. No fabricated chart or sample business data was introduced. Existing priorities, coverage, activity, demand, diarist and finance content occupies the same modular dashboard language instead.

## Motion and depth

- Visible cards enter with a staggered rise, scale and soft overshoot.
- Hover-capable devices lift cards by 8 px, slightly enlarge them and strengthen edge light and shadow.
- KPI cards receive a fast directional light sweep on hover.
- Buttons compress on press for direct physical feedback.
- Motion uses `transform` and `opacity`; no continuous full-page animation was added.
- `prefers-reduced-motion` collapses animation and transition duration to 0.01 ms.

## Performance

- Opaque card blur was reduced from 14-16 px to 5-10 px.
- Long demand, diarist and finance surfaces use `content-visibility: auto` with stable intrinsic sizes.
- No JavaScript animation library or additional runtime dependency was added.
- Production CSS remains 103.84 kB raw and 18.75 kB gzip in the verified build.

## Responsive review

- Desktop keeps the dense horizontal navigation and gains larger 16-20 px gaps between modules.
- iPhone retains two KPI columns, fixed bottom navigation and full-width controls without horizontal overflow.
- Hover elevation is disabled on small touch viewports, while entrance and press feedback remain available.
- Dialog bounds and internal scrolling remain unchanged and reachable.

## Findings

No actionable P0, P1 or P2 visual mismatch remains for the requested floating-card design direction.

## Verification

- `npm run verify`: passed.
- Full responsive suite: 14 passed; two concurrent mobile checks hit authentication/timeout instability.
- Isolated rerun of the two mobile checks: 2 passed.
- Motion and reduced-motion behavior: passed.
- Desktop dashboard capture: passed in light and dark themes.
- Mobile Demandas capture: passed in light and dark themes.
- Browser layout: no horizontal overflow detected.

## Follow-up polish

- P3: historical operational charts can be introduced later after their source metrics and periods are formally defined.

final result: passed
