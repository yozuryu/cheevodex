---
id: CHV-028
title: Compact game rows and filter bar on Recent and Progress
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 00:12'
updated_date: '2026-11-13 03:13'
labels:
  - design
  - profile
dependencies: []
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent and Progress use tall cards with a full-width bar and stacked uppercase filter rows. Savepoint uses compact rows and one filter bar. Match it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Game rows show icon, title, console and mode on one line, last played, and count with a short bar on the right, with the art faded behind
- [x] #2 Recent has a search box and the list/tiles switch on one row
- [x] #3 Progress views are one row of buttons with counts; search, sort and the view switch share one row
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
GameListRow/.grow replaces GameCard; ProgressFilterBar + applyProgressView/progressViewCounts from Savepoint; sort Overall % or Last played (Savepoint's Progression sort needs per-game progression data Cheevodex only has after opening a game). Recent: search over the library, latest 15 or up to 50 matches; Show more removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compact game rows and Savepoint's filter bar on Recent and Progress.

- Rows: icon, title, console, subset, tags, mode, playtime/last played, count and short bar, screenshot faded behind; link to the game page.
- Recent: search + list/tiles switch in one row.
- Progress: view chips with counts, Mastered toggle, search, sort select, view toggle, rule chips.

Tests: screenshots at 450px and desktop; overflow check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
