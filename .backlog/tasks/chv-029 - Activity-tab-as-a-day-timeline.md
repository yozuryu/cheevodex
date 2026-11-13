---
id: CHV-029
title: Activity tab as a day timeline
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 00:12'
updated_date: '2026-11-13 03:13'
labels:
  - design
  - profile
dependencies: []
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Activity tab shows a heatmap and nested lists. Savepoint shows a folded 14-day summary, sticky day headings and one card per game run. Match it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A summary card shows the last 14 days' unlocks and games with one bar per day, and opens to show the year heatmap
- [x] #2 Each day has a heading that sticks under the tab bar, with unlock and points totals
- [x] #3 Each run of unlocks in one game is one card with the game's art band and compact unlock rows
- [x] #4 Friends view still works
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ported activity-ui.js (in-app links, cheevodex:activitySummary). Mine view rebuilt with ActivitySummary/DayHead/RunCard/UnlockRow; RunCard art from game screenshots (gameArt prop). Friends view keeps its feed; Mine/Friends are fchips. Sticky day headings offset for the 37px top bar.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Activity tab as Savepoint's day timeline.

- Folded 14-day summary that opens to past-year numbers, streak tiles and the heatmap; picking a day filters.
- Day headings stick under the tab bar; one card per run of unlocks in a game with its art band and compact rows.
- Friends view unchanged apart from the chip switch.

Tests: screenshots of Mine and Friends at 450px and desktop; no page errors.
<!-- SECTION:FINAL_SUMMARY:END -->
