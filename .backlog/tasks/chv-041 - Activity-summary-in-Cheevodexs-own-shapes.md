---
id: CHV-041
title: 'Activity summary: the dexes that moved'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 06:14'
updated_date: '2026-11-13 06:58'
labels:
  - profile
  - design
dependencies: []
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The activity summary card was Savepoint's shape (numbers left, 14-day bars right). A restyle wasn't enough; Cheevodex's version is about entries, not days: the games you progressed in the last 14 days.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tapping a day still filters the timeline; no sideways scroll at 450px
- [x] #2 The top of Activity lists the games progressed in the last 14 days, newest first, each with a two-tone ring (before dim, gained bright), +N and before → now
- [x] #3 A totals line (unlocks, points, dexes) heads it; past-year numbers, streaks and heatmap sit behind one toggle
- [x] #4 Index lines for the year and streaks; no Savepoint tiles or bars remain
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced Savepoint's numbers-plus-14-day-bars card with the dexes that moved in the last 14 days: icon inside a two-tone ring (.dring gained --b/--cb for the before part), dex number, console, +N, before → now; totals line on top; the toggle opens past-year and streak index lines and the heatmap (day filter kept). Removed the diamond-strip draft and the folded-row CSS. 32/32 page and width checks pass. Docs: profile.md, rules.md.
<!-- SECTION:FINAL_SUMMARY:END -->
