---
id: CHV-019
title: Port Savepoint tab bar with swipe
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 16:34'
labels:
  - redesign
  - savepoint-port
dependencies:
  - CHV-017
documentation:
  - doc-012
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adopt Savepoint's TabBar (assets/tabs.js): sticky uppercase tabs with a sliding 3px underline (blue in Cheevodex), and swipe between tabs on phones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Profile and game page tabs show a sliding blue underline that follows the active tab
- [x] #2 The tab row scrolls sideways when tabs don't fit and keeps the active tab in view
- [x] #3 On phones a horizontal swipe on tab content switches tabs; vertical scrolling and horizontally scrolling children (heatmaps, chip rows) are not hijacked
- [x] #4 Tab state still syncs with the ?tab= URL parameter
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- assets/tabs.js: Savepoint TabBar (underline always blue, optional icon/count, re-measures after web fonts load) + useSwipeTabs (generic shimmer peek instead of Savepoint's per-tab PEEK_PARTS) + scrollToTabs.
- Profile: desktop bar replaced (phones keep the floating pill, now 3px corners); profileTabs drives both bar and swipe.
- Game: bordered tab buttons replaced; all tab sections wrapped in one swipe container.
- Functional test (CDP touch events, replayed data): game achievements->details->achievements, profile progress->activity->progress; vertical drag leaves the tab; no page errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported Savepoint's tab bar and phone swipe.

- assets/tabs.js + .ptabs styles in ui.css: uppercase 12px/600 tabs, sliding 3px blue underline, sideways scroll keeping the active tab in view.
- Profile (desktop) and game pages use TabBar; ?tab= sync unchanged.
- Phones: horizontal swipe on tab content switches tabs; vertical scroll and horizontally scrolling children are not hijacked.
- Verified with scripted touch gestures on both pages.
<!-- SECTION:FINAL_SUMMARY:END -->
