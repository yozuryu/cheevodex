---
id: CHV-037
title: Dex tab as an index by console
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 04:07'
updated_date: '2026-11-13 04:37'
labels:
  - design
  - profile
dependencies: []
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Dex grid reads like a collection screen. Make it an index: grouped by console like volumes, with a jump list and an entry count line.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With Dex No. sort and no console picked, entries are grouped by console under headings with counts
- [x] #2 A jump list of consoles scrolls to each group
- [x] #3 A count line reads like an index (N dexes · M consoles)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dex as an index: in Dex No. order with no console or search, dexes are grouped by console under sticky headings with beaten / mastered counts, a jump list scrolls to each, and a count line reads N dexes · M consoles.

Tests: screenshots at 450px and 1280px.
<!-- SECTION:FINAL_SUMMARY:END -->
