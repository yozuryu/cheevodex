---
id: CHV-034
title: Desktop identity rail on the profile
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 03:47'
updated_date: '2026-11-13 04:37'
labels:
  - design
  - profile
dependencies: []
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On desktop the profile uses Savepoint's wide header over tabs. Give Cheevodex its own frame: a sticky left column with the player's identity and dex counter, content and tabs on the right.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 From 1024px the profile is two columns: a sticky identity rail (avatar, name, rank, numbers, dex counter, user stats, member since) and the tabs with their content
- [x] #2 Nothing scrolls sideways at 1024px, 1280px or 450px
- [x] #3 Below 1024px the header stays on top and shows the dex counter (Played, Beaten, Mastered) instead of the status row
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Desktop identity rail: from 1024px the profile is a pinned player card (identity, numbers, dex counter, stats) beside the tabs; below 1024px the header shows the dex counter.

Tests: overflow check at 450, 1024, 1100 and 1280px; screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
