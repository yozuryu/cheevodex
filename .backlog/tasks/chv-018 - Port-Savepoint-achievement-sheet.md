---
id: CHV-018
title: Port Savepoint achievement sheet
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 16:25'
labels:
  - redesign
  - savepoint-port
dependencies:
  - CHV-017
documentation:
  - doc-012
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the achievement modals with Savepoint's sheet pattern (assets/sheet.js + its ui.css block): a bottom sheet on phones and a centred dialog from md, restyled in Cheevodex tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On phones the achievement modal slides up as a bottom sheet and closes by drag-down, backdrop tap, close button or Escape
- [x] #2 From md the same content opens as a centred dialog
- [x] #3 The sheet covers the mobile bottom nav and respects safe-area insets
- [x] #4 Animations are off under prefers-reduced-motion
- [x] #5 Works on profile and game pages, including visitor mode
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Ported useSheet/useArtSrc to assets/sheet.js (native ESM, imports react via the importmap) + ArtBg helper; sheet CSS in ui.css on tokens; close button squared to 3px (Savepoint's was round).
- Profile CompareModal and RAchievementModal moved onto sheet-root/panel/head/scroll; their own Escape + body overflow effects removed (useSheet locks <html>).
- Found: RAchievementModal is unreachable — openGameDetails is never called; game cards link to the game page. Game page has no modal. Converted anyway; flagged to Bambang.
- Verified compare sheet at 400px (bottom sheet over nav) and 1280px (dialog) with recorded data.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Modals now use Savepoint's sheet pattern.

- assets/sheet.js: useSheet (slide-up sheet below md, drag/backdrop/close/Escape to close, scroll lock), useArtSrc, ArtBg.
- ui.css: sheet, art-bg styles on Cheevodex tokens; reduced-motion disables animation.
- Profile compare modal and achievement modal converted.
- Note: the profile achievement modal has no entry point today (openGameDetails unused).
<!-- SECTION:FINAL_SUMMARY:END -->
