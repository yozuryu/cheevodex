---
id: CHV-042
title: Friends feed in the current design
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 06:14'
updated_date: '2026-11-13 06:39'
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
- [x] #1 Friends runs use the same day headings and run cards as Mine, with the friend's avatar and name on each card
- [x] #2 A roster of index lines ranks friends by unlocks in the feed; tapping one shows only their runs
- [x] #3 Sync, refresh, reset and failure notices sit in one filter bar row, readable on phones
- [x] #4 No sideways scroll at 450px and no page errors
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Friends view rebuilt on Mine's DayHead + RunCard with the friend's avatar and name, runs folding after two unlocks; a roster of index lines ranks players by 30-day unlocks and filters the feed on tap (verified: 100 cards all from the chosen player; All 27 expands). Removed FeedSession/FeedAchRow and the By Session/By User switch; RunCard gained a fold prop.
<!-- SECTION:FINAL_SUMMARY:END -->
