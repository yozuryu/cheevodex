---
id: CHV-045
title: Mine runs in the Cheevodex run strip
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 09:48'
updated_date: '2026-11-13 09:48'
labels:
  - profile
  - design
dependencies: []
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mine still used Savepoint's run card (screenshot art band, 'No Screenshot Found' placeholders) while Friends used Cheevodex's own run. One run design across Activity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mine runs open with the same game strip as Friends (tags, subset, mode, console, time, +N and points), edge and wash in the mode colour
- [x] #2 Full unlock rows stay under each run; runs over five fold after four
- [x] #3 No Savepoint art band or placeholder art remains; no sideways scroll, no page errors
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extracted RunStrip + runMode (profile/app.js) and used them for both FriendRun and the new MyRun; MyRun keeps full unlockRow rows, folding after four past five. Removed RunCard/RunCount/StripArt from assets/activity-ui.js and the gameArt map. Verified at 450 / 1280 (Poring Clicker no longer shows placeholder art) and 32/32 page-width checks. Docs: profile.md, rules.md, architecture.md.
<!-- SECTION:FINAL_SUMMARY:END -->
