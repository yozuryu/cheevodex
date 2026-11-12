---
id: CHV-020
title: Port Savepoint page motion
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 16:35'
labels:
  - redesign
  - savepoint-port
dependencies:
  - CHV-017
documentation:
  - doc-012
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adopt Savepoint's assets/motion.css: cross-page view transitions and short fade-in on content, all disabled under prefers-reduced-motion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Navigating between pages fades with the top bar and mobile nav held in place, in browsers that support view transitions
- [x] #2 Browsers without support navigate normally with no errors
- [x] #3 All motion is off under prefers-reduced-motion
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- assets/motion.css ported verbatim (view transitions + .anim-* helpers); linked on all 7 pages and precached.
- Topbar already had .page-topbar; mobile nav gets view-transition-name: page-mnav.
- motion-pop keyframe now lives only in motion.css (sheet uses it).
- .anim-in content fades are available but not wired to tab changes: the swipe wrapper must stay mounted, and a swipe already animates.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cross-page view transitions from Savepoint.

- assets/motion.css on every page: old page fades out, new fades in with a 6px lift; top bar and mobile nav hold still.
- Unsupported browsers navigate normally (pure CSS opt-in, no JS).
- prefers-reduced-motion disables view transitions and all .anim-* classes.
<!-- SECTION:FINAL_SUMMARY:END -->
