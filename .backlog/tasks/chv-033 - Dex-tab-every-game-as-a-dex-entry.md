---
id: CHV-033
title: 'Dex tab: every game as a dex entry'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 03:45'
updated_date: '2026-11-13 04:37'
labels:
  - design
  - profile
dependencies: []
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cheevodex's layout now matches Savepoint's almost exactly; the name and logo promise a dex. Make the profile's centre a dex of every game the user has touched, with seen / caught / mastered states.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Dex tab is the first and default profile tab: a grid of every played game as an entry with its dex number (RA game ID), icon, title, console, progress and state
- [x] #2 States in RA's words: played, beaten, mastered; games with no unlocks yet show their icon dimmed
- [x] #3 Filter chips with counts (All, Unbeaten, Beaten, Mastered), console select, search, and sort by dex number, last played, progress or title
- [x] #4 Entries link to the game page; the grid works at 450px and on desktop
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dex tab: every played game as a dex, numbered by its RA game ID.

- DexTab / DexEntry / DexCounter in profile/app.js; .dexc / .dgrid / .dent in assets/ui.css.
- States in RA's words (played, beaten, mastered); unstarted games dimmed. No Pokédex wording.
- Search (title or dex number), console select, sort, All / Unbeaten / Beaten / Mastered chips with counts.

Tests: screenshots at 450px and 1280px; overflow check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
