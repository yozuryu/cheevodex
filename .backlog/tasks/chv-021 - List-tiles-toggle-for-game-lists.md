---
id: CHV-021
title: List / tiles toggle for game lists
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 16:41'
labels:
  - redesign
  - savepoint-port
dependencies:
  - CHV-017
documentation:
  - doc-012
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adopt Savepoint's list/tiles view for profile game lists (assets/game-view.js and the .glist/.gtiles styles), restyled with segmented progress and status-coloured edges.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Profile game lists offer a list and a tiles view via a toggle
- [x] #2 The chosen view is remembered per device and survives reloads; private mode falls back to list without errors
- [x] #3 Both views show status colour, achievement count and segmented progress
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- assets/game-view.js: useGameView (localStorage key cheevodex:gameView, try/catch -> list).
- profile/app.js: gameStatus(), SegBar (<=20 segments, fractional fill, gold glow only when mastered), ViewToggle, GameTile; GameCard keeps the rich row as the list view with its overall bar now segmented.
- Recent tab shows 8 tiles / 5 rows before Show more.
- Screenshots: tiles at 1280 (4 cols) and 400 (2 cols), list view at 1280.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
List / tiles toggle for the profile game lists.

- Toggle on Recent Games and Completion Progress; choice persisted per device, private mode falls back to list.
- New tile view (art + icon, last played, mode, count, status, status-coloured edge).
- Segmented progress bars in both views; mastered glows gold.
<!-- SECTION:FINAL_SUMMARY:END -->
