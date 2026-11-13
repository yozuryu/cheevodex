---
id: CHV-047
title: Desktop consistency pass
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 13:56'
updated_date: '2026-11-13 14:00'
labels:
  - design
dependencies: []
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A desktop review after CHV-046 found six more inconsistencies: three page widths, the game Info tab, the achievement page numbers and pills, the login form, and footers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Single-column pages share one width and left edge
- [x] #2 Game Info tab uses index lines and one date format
- [x] #3 Achievement numbers are index lines; unlock rows show mode once
- [x] #4 Login labels and button match the app's style
- [x] #5 Every page has the same footer with a link to the matching RA page
- [x] #6 No sideways scroll and no page errors at 400px and 1280px
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Desktop pass after CHV-046.

- Achievement page and changelog moved from max-w-3xl to max-w-4xl: every single-column page now starts at x=224 with an 896px column (measured); changelog text capped at 72ch.
- Game Info tab: Time to Beat and facts as index lines (.info-lines, two columns from md); release date via one fmtReleased() for header and Info.
- Achievement page: unlock numbers as index lines (.ach-lines); Recent unlocks show mode by edge + flame/feather (pill removed).
- Login: normal-case labels and a solid accent Connect button.
- Footer({ label, raHref }) everywhere: 'Cheevodex · <page>', unofficial note, RetroAchievements link to the matching RA page.
- Service worker cache bumped.

Tests: 42/42 page-width checks (21 pages x 2), alignment measured on 5 pages.
<!-- SECTION:FINAL_SUMMARY:END -->
