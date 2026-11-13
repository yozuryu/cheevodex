---
id: CHV-031
title: Remove the leftover Series tab
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 00:12'
updated_date: '2026-11-13 03:13'
labels:
  - profile
dependencies: []
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Series tab tells the user to enable Progress in an admin panel Cheevodex doesn't have.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No Series tab or series code path remains on the profile
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
seriesData was initialised to [] and never set, so the tab only appeared via ?tab=series, showing an admin-panel message. Removed SeriesProgressTab, the state, the URL value and the floating-pill entry.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the leftover Series tab from the profile.

- SeriesProgressTab, seriesData state, 'series' in VALID_TABS and the render branch are gone.
- ?tab=series now falls back to the default tab.

Tests: profile loads with no page errors at 450px and desktop.
<!-- SECTION:FINAL_SUMMARY:END -->
