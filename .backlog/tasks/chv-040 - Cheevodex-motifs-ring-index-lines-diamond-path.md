---
id: CHV-040
title: 'Cheevodex motifs: ring, index lines, diamond path'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 04:57'
updated_date: '2026-11-13 04:58'
labels:
  - design
dependencies: []
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The game completion card, the game row progress and the stat / award tiles were Savepoint's exact components. Give them Cheevodex's own language: a completion ring, index lines with dotted leaders (the codex), and progression as diamonds on a path (the heading diamond).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Game page shows a dex record: completion ring, Achievements / Points / Played as index lines, progression as a diamond path
- [x] #2 Game rows show the count beside a small completion ring and the dex number before the title
- [x] #3 User stats and game award counts are index lines with dotted leaders
<!-- AC:END -->



## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the last copied Savepoint pieces with Cheevodex motifs: .dring (conic ring), .dledger / .dl-row (dotted leaders), .dpath (diamond progression path) in assets/ui.css; dex record on the game page, ringed rows, stat ledger in Overview and the rail, ledger tier counts in completions.js. Tests: screenshots at 450px and 1280px; overflow check on 15 pages x 2 widths.
<!-- SECTION:FINAL_SUMMARY:END -->
