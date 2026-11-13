---
id: CHV-036
title: 'Game page as a dex: summary, chapters, see also'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 04:07'
updated_date: '2026-11-13 04:37'
labels:
  - design
  - game
dependencies: []
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Read the game page as a dex (an entry in the user's cheevo codex), not a dashboard: a dex heading, a summary, the achievements arranged as chapters, related dexes at the end. Dex is the word for an entry; no Pokédex look.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header reads as a dex: Dex No. (RA game ID) and title, with a summary block (console, developer, publisher, genre, release, your status)
- [x] #2 With the default view, achievements are grouped into chapters: progression path in set order, then the rest, with missables flagged
- [x] #3 A See also section links related dexes (parent game, sibling subsets) when there are any
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Game page as a dex: Dex No. heading, facts (labelled block from md, one line on phones), achievements in Progression / Everything else chapters in the default view, See also for a subset's base game and Professor Oak siblings.

Tests: screenshots at 450px and 1280px; swipe test; overflow check.
<!-- SECTION:FINAL_SUMMARY:END -->
