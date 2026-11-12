---
id: CHV-022
title: Art-lit profile and game headers
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 16:52'
labels:
  - redesign
dependencies:
  - CHV-017
documentation:
  - doc-012
priority: medium
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Profile and game headers get the doc-012 header: the latest (or current) game's art blurred behind, gold glow top-left and blue glow top-right, gold-ring avatar, stat cards and the mastered/beaten/in-progress status row.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Profile header shows the most recently played game's art blurred behind the identity block; game page header shows that game's art
- [x] #2 Text stays readable over any art (contrast held by the gradient overlay)
- [x] #3 Headers fall back to a plain charcoal header when art fails to load
- [x] #4 Profile header shows the status row with mastered / beaten / in progress counts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Ported .phead/.art-header into ui.css on tokens; added ::before radial gold/blue glows, conic gold avatar ring, .pstatus tinted status row.
- Profile header rewritten (identity left, numbers + status right on desktop; stacked on phone). Art: background of mostRecentGame (fallback first game).
- Game hero: ArtBg instead of opacity-15 background, icon in .phead-av.game ring by award kind.
- Readability: art at brightness .55 under a 40->96% box gradient; checked over bright art (FFCC, MaxMilyin's Ys III).
- Header content width = 64rem to line up with main (dropped Savepoint's 79rem wide rule).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Art-lit headers for profile and game pages.

- Blurred latest/current game art behind the header, gold glow top-left, blue top-right; plain charcoal fallback when art fails.
- Profile: gold-ringed avatar, numbers strip, mastered/beaten/in-progress status row.
- Game: same treatment, award-coloured icon ring.
- Verified at 400px and 1280px for own profile, visitor mode and the game page.
<!-- SECTION:FINAL_SUMMARY:END -->
