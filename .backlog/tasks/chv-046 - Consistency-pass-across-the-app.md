---
id: CHV-046
title: Consistency pass across the app
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 13:18'
updated_date: '2026-11-13 13:44'
labels:
  - design
dependencies: []
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A full scan (code + screenshots of every page) found 12 places where the app disagrees with itself after the Cheevodex redesign. Fix them all.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hardcore is gold and softcore grey everywhere (pills, flames, counts, tiles, compare); red stays for errors and win conditions
- [x] #2 RA's 'No Screenshot Found' placeholder never shows as row or tile art
- [x] #3 Social tab, Consoles, Console page and the compare sheet use the shared filter chips instead of tiny uppercase toggles
- [x] #4 Stats tab numbers read as index lines, not boxed tiles
- [x] #5 Tiles view and compare sheet show progress as rings, not bars
- [x] #6 Dex numbers show on Activity runs, watchlist rows and the console game list
- [x] #7 Install banner and sheets keep 2-3px corners; no hex literals remain
- [x] #8 Time-ago reads one way across the app
- [x] #9 Friends loading placeholder matches the new run shape
- [x] #10 No 8-9px body text or buttons remain (7px tags excepted)
- [x] #11 The v26.11.13 changelog no longer lists superseded designs
- [x] #12 The console page game list renders with real data
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consistency pass from a full scan (code + screenshots of every page).

- Hardcore gold everywhere (game header tag, unlock-rate bars, achievement counts/pills, tiles, flames, compare); red kept for errors, win conditions, top RetroRatio; token comment updated.
- Game art: gameArt() in transform.js skips RA's 000002.png placeholder and the stretched icon.
- Filter chips replace tiny uppercase toggles on Social, Consoles, Console, Search and the compare sheet.
- Rings/index lines: tiles ring (SegBar removed), compare sheet rings + ledger, Stats streaks as StatLine index lines, console coverage as a two-tone ring.
- Dex numbers on Activity runs, watchlist rows/sets, console list, search, compare.
- 2-3px corners on banner/sheets/menu; #fff and text-white replaced by ink.
- One time-ago style (5m/18h/3d ago, then date); rows say 'ago' so it no longer reads as playtime.
- Skeletons match runs (TimelineSkeleton strip shape, new FriendsSkeleton); dead tcard/tlist CSS removed.
- 8-9px classes raised to 10px; nav labels 10px; dex numbers crisp 8px pixel face.
- v26.11.13 changelog: superseded entries corrected.
- Console list verified with recorded data.
- Fixed along the way: compare A-Z sorted by RA's raw ~tag~ title.

Tests: 38/38 page-width checks; social sort, compare sheet (10 rows, 20 rings, A-Z), friends timeline, backlog rings.
<!-- SECTION:FINAL_SUMMARY:END -->
