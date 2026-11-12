---
id: CHV-017
title: 'Modern RA palette, type and headings'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:17'
updated_date: '2026-11-12 16:22'
labels:
  - redesign
dependencies:
  - CHV-016
documentation:
  - doc-012
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Switch the tokens to the approved Modern RA direction in doc-012: charcoal surfaces, RA blue for structure, gold for links and anything earned, Geist and Geist Mono, and the blue diamond section heading with the fading underline. Shapes stay on Savepoint's 2-3px corners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Token values match the doc-012 table
- [x] #2 All pages use Geist for UI and Geist Mono (tabular) for numbers, with a system fallback stack
- [x] #3 Section headings on every page use the doc-012 heading pattern
- [x] #4 Blue/gold rule holds: headings, rank, platforms, active tab and progress in blue; links, points and earned states in gold; only earned things glow
- [x] #5 Charts (stats tab, heatmap) stay readable: every series distinguishable, labels in token colours
- [x] #6 docs/rules.md Design System section rewritten for the new palette and type
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Token values swapped to doc-012 (solid equivalents for the translucent --line), plus --link and font tokens; Tailwind fontFamily sans/mono/pixel.
- assets/ui.css: base type, .sec-mark/.sec-t headings (underline via :has(> .sec-mark)), .card-t panel titles, .tabular-nums/.num -> Geist Mono.
- 26 page headings converted by script; Game Awards and StatCard panel headers by hand.
- Points chips -> gold; rank/header chips are rebuilt in CHV-022.
- Checked profile (recent/stats/activity) and game pages at desktop: charts and heatmap readable, all series distinct.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Switched the app to the Modern RA palette, Geist type and the new section headings.

- tokens.css values now match doc-012 (charcoal, RA blue structure, gold rewards); manifest colours follow.
- Geist / Geist Mono / Silkscreen loaded on every page; tabular numbers render in Geist Mono.
- New assets/ui.css with the diamond heading pattern used on every page and panel header.
- docs/rules.md Design System rewritten (blue/gold rule, headings, type, shapes).
<!-- SECTION:FINAL_SUMMARY:END -->
