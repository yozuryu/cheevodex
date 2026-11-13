---
id: CHV-027
title: 'Profile Overview tab: stat tiles, game awards panel, two-column desktop'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 00:12'
updated_date: '2026-11-13 03:13'
labels:
  - design
  - profile
dependencies: []
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Last played, Recent unlocks, User stats and Game awards sit above the tabs. Savepoint puts them in a first Overview tab, with stat tiles and a completions panel. Match it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overview is the first and default tab and holds Last played, Recent unlocks, User stats and Game awards; nothing sits between the header and the tab bar
- [x] #2 User stats are tiles two across with More stats on phones
- [x] #3 Game awards show Mastered and Beaten counts, the latest award as a card with its art, and the award icons with a grid/list switch
- [x] #4 On desktop the Overview has two columns: played and unlocks on the left, stats and awards on the right
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ported Savepoint completions.js (links, sec-mark heading, cheevodex:awardsView) and time.js; awards get gameId from awardData in transform.js. Overview grid lg:[minmax(0,1fr)_360px]; wide Overview loads achievement chunks for 5 .urow rows. Stat tiles show 'of N' after a rank as small text so it fits the rail in Geist Mono.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Profile Overview tab, as on Savepoint's RA profile.

- Default tab; holds Last played (game row + rich presence), Recent unlocks, User stats and Game awards.
- Stat tiles two across with More stats; Game awards: tier counts, latest award card with the game's screenshot, icons with tiles/list switch.
- Desktop: two columns, stats and awards on the right, next five unlocks as compact rows.

Tests: screenshots at 450px and desktop with recorded data; no page errors.
<!-- SECTION:FINAL_SUMMARY:END -->
