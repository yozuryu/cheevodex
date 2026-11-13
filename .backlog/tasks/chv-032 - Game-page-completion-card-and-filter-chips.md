---
id: CHV-032
title: Game page completion card and filter chips
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 00:12'
updated_date: '2026-11-13 03:13'
labels:
  - design
  - game
dependencies: []
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The game page shows a thin bar and a five-number strip, and labelled uppercase filter rows. Savepoint's game sheet has a completion card with a progression meter and one row of filter chips with counts. Match it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Game header has a completion card: % complete large, Achievements, Points and Played beside it, a gold progression meter and the bar along its bottom edge
- [x] #2 Achievement filters are one row of chips with counts (All, Unlocked, Locked, Progression, Missable)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ported .shd-* card CSS (inset token for Savepoint's #0e1218, 3px corners). Card: % big, Achievements, Points, Played/Players, progression meter (MAX_SEG 20, grouped beyond), bar along the bottom, wash tint. Player count moves to the meta line when playtime shows. Filters: one .frow (status + type chips with counts) and a .fbar (count, sort select, Compare chip). Tab icons on game and achievement pages.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Game page completion card and filter chips, from Savepoint's game sheet.

- Header card: % complete, Achievements, Points, Played, gold progression meter, bar on the bottom edge.
- Achievement filters: one chip row with counts, then count, sort and Compare.
- Tabs on the game and achievement pages have icons.

Tests: screenshots at 450px and desktop; swipe test on the game page; no page errors.
<!-- SECTION:FINAL_SUMMARY:END -->
