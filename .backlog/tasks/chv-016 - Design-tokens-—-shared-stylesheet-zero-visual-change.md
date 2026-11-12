---
id: CHV-016
title: 'Design tokens — shared stylesheet, zero visual change'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:16'
updated_date: '2026-11-12 16:10'
labels:
  - redesign
dependencies: []
documentation:
  - doc-012
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The app hardcodes 1,903 hex colours across page app.js files, index.html files and assets/ui.js, so no restyle is possible without a token layer. Introduce one shared stylesheet of CSS custom properties plus a Tailwind CDN config that maps colour names to them, and move every literal onto a token using the CURRENT deployed values. This task changes no pixels; it makes the Modern RA restyle a token swap. It also lifts the 'No CSS files' rule, as Savepoint already did with assets/ui.css.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every page (login, profile incl. visitor mode, game, achievement, console, search, changelog) looks identical before and after, checked by side-by-side screenshots at phone and desktop width
- [x] #2 No hex colour literals remain in app.js, index.html or assets/ui.js, except colour tables that are data (rarity scale, tilde tags), which reference tokens
- [x] #3 docs/rules.md documents the token table and allows the shared stylesheet; CLAUDE.md Styling hard rule updated to match
- [x] #4 A decision record explains why a shared CSS file is now allowed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Converted ~1,900 literals with a scripted pass (Tailwind arbitrary colours -> token classes, inline hex -> var(--x), rgba -> rgb(var(--c-x) / a)); 4 hex-alpha concatenations moved to color-mix.
- 5 aliases folded: #253443/#253344 -> box-hover, #1e2a38 -> line-faint, #212f3d -> line-soft, #3a4a57 -> ink-4.
- Verified with a replay harness (recorded real RA responses, frozen clock): 36 shots, 26 byte-identical, 8 max delta 1/255, social/stats max 4/255 from aliases.
- 404.html keeps the shared root-site design; only its paths changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Introduced a design-token layer with zero visual change.

- assets/tokens.css: 46 tokens as --NAME and --c-NAME (RGB channels); assets/tw-config.js maps them to Tailwind colours.
- All pages load both after the Tailwind CDN; sw.js precaches them.
- No hex colour literals remain in page code; dynamic alpha uses color-mix().
- decision-008 records why shared CSS files are now allowed; docs/rules.md and CLAUDE.md updated.
- Verified by pixel-diffing 18 views x 2 widths against main with replayed API data.
<!-- SECTION:FINAL_SUMMARY:END -->
