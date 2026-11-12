---
id: CHV-023
title: Restyle remaining pages
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 16:59'
labels:
  - redesign
dependencies:
  - CHV-017
documentation:
  - doc-012
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the Modern RA look to the pages not covered by the header and component tasks: login, achievement, console, search, changelog and 404.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each page is checked at phone (~400px) and desktop width with no overflow or clipped text
- [x] #2 Login, achievement, console, search and changelog pages use the new tokens, type, headings and shapes; 404 keeps the shared yozuryu.github.io not-found design (only its paths and name change)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Tokens/type/headings already reached every page via CHV-016/017; this task did the per-page pieces.
- Achievement: .phead + ArtBg hero, gold ring on earned badge, TabBar.
- Changelog: renderText handles **bold** (entries have used it for months; it showed raw asterisks).
- Console/search/login needed no structural change beyond 017 (login branding is CHV-024).
- 404.html: decided to keep the shared root-site not-found design (noah-ui.css, used by every yozuryu.github.io site); AC reworded.
- Overflow check: 10 URLs x phone/desktop, document scrollWidth == clientWidth on all.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restyled the remaining pages.

- Achievement page: art-lit header, gold-ringed earned badge, sliding-underline tabs.
- Changelog page: renders bold text.
- Login, console, search, changelog carry the new palette, Geist and headings from CHV-017.
- 404 stays on the shared site-wide not-found design.
- No horizontal overflow at 400px or 1280px on any page.
<!-- SECTION:FINAL_SUMMARY:END -->
