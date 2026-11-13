---
id: CHV-030
title: Backlog as compact watchlist rows
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 00:12'
updated_date: '2026-11-13 03:13'
labels:
  - design
  - profile
dependencies: []
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog is an old table with stacked uppercase filters. Savepoint's Watchlist uses compact rows with status on the edge, subsets stacked under their base game, and one filter bar. Match it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each backlog game is a compact row: icon, title and tags, console and points, status on the right and as the edge colour
- [x] #2 Subsets stack under their base game as one card
- [x] #3 Status and grouping filters use the shared filter bar
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the table with Savepoint's wrow/wstack/wsub render functions and stackSubsets; grouping none/console/status/subsets (no series: Cheevodex has no series data). Kept sync time + Refresh and the streaming 'Loading N of M' line in .fmeta. Paging removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backlog as Savepoint's watchlist rows.

- Compact rows with status on the right and as the edge colour; subsets stacked under their base game as one card.
- Search + grouping select, status chips with counts, meta line with sync and Refresh.

Tests: screenshots at 450px and desktop (two columns from md); overflow check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
