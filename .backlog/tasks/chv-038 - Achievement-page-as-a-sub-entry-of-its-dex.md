---
id: CHV-038
title: Achievement page as a sub-entry of its dex
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 04:07'
updated_date: '2026-11-13 04:37'
labels:
  - design
dependencies: []
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let the achievement page read as part of its game's dex and let the user page through the set.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header shows Dex No. of the game and the achievement's position in the set (n of N)
- [x] #2 Previous and next links move through the set in display order
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Achievement page shows Dex No. of its game and n of N in display order, with Prev / Next through the set (from the progress data it already loads).

Tests: screenshot at 450px; overflow check.
<!-- SECTION:FINAL_SUMMARY:END -->
