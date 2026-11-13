---
id: CHV-042
title: Friends activity as a party
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 06:14'
updated_date: '2026-11-13 08:45'
labels:
  - profile
  - design
dependencies: []
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Friends view of Activity still uses the old tiny-text tree (9px labels, dot timelines, badge strips). Bring it to the same timeline as Mine and give it a Cheevodex roster.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sync, refresh, reset and failure notices sit in one filter bar row, readable on phones
- [x] #2 No sideways scroll at 450px and no page errors
- [x] #3 One card per friend (last 30 days) shows who, when, unlocks and the games they moved as +N chips; tapping opens their runs; sort by Recent or Most unlocks
<!-- AC:END -->



## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Friends view rebuilt on Mine's DayHead + RunCard with the friend's avatar and name, runs folding after two unlocks; a roster of index lines ranks players by 30-day unlocks and filters the feed on tap (verified: 100 cards all from the chosen player; All 27 expands). Removed FeedSession/FeedAchRow and the By Session/By User switch; RunCard gained a fold prop.

Reworked after review into a Party: one card per friend (avatar, last active, +N, points, game chips with +N linking to compare), runs behind a toggle, Recent / Most unlocks sort, two columns on desktop. Roster removed. Rings skipped on purpose: the friends endpoint has no per-game totals. Verified: expand (14 runs), sort, no sideways scroll at 400 / 1280.
<!-- SECTION:FINAL_SUMMARY:END -->
