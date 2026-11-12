---
id: CHV-025
title: Move to a Cheevodex repo and URL
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 17:08'
labels:
  - rebrand
dependencies:
  - CHV-024
documentation:
  - doc-012
priority: low
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decide whether to rename the GitHub repo (and so the Pages URL /cheevo-tracker/) to cheevodex, or put the app on its own domain later with the promo site. A path change alters the PWA scope, so installed apps and bookmarks need a redirect. Credentials in localStorage are per origin and survive a path change on the same github.io origin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision is recorded: keep URL, rename repo, or custom domain
- [ ] #2 If the URL changes, the old path redirects to the new one for every page and query string
- [ ] #3 An installed PWA on the old path is told how to reinstall, or keeps working through the redirect
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Decision recorded as decision-009 (repo renamed by Bambang 2026-11-12; github.io kept for now).
- Redirect implemented in ../yozuryu.github.io (uncommitted): 404.html script maps /cheevo-tracker/* -> /cheevodex/* keeping query + hash (tested: /cheevo-tracker/profile/?u=Foo&tab=stats#h -> /cheevodex/profile/?u=Foo&tab=stats#h; /cheevo-trackerx/ untouched). Also Lineup card, README, CLAUDE.md, changelog there.
- Live check before push: old URL 404, new URL 200.
- Waiting on Bambang to commit + push yozuryu.github.io; then check AC2/AC3 against the live site.
<!-- SECTION:NOTES:END -->
