---
id: CHV-025
title: Move to a Cheevodex repo and URL
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 23:50'
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
- [x] #2 If the URL changes, the old path redirects to the new one for every page and query string
- [x] #3 An installed PWA on the old path is told how to reinstall, or keeps working through the redirect
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Decision recorded as decision-009 (repo renamed by Bambang 2026-11-12; github.io kept for now).
- Redirect implemented in ../yozuryu.github.io (uncommitted): 404.html script maps /cheevo-tracker/* -> /cheevodex/* keeping query + hash (tested: /cheevo-tracker/profile/?u=Foo&tab=stats#h -> /cheevodex/profile/?u=Foo&tab=stats#h; /cheevo-trackerx/ untouched). Also Lineup card, README, CLAUDE.md, changelog there.
- Live check before push: old URL 404, new URL 200.
- Waiting on Bambang to commit + push yozuryu.github.io; then check AC2/AC3 against the live site.

- 2026-11-13: pushed both repos (cheevodex 494d668, yozuryu.github.io 2e7968b); Pages deploys succeeded.
- Live check (Chrome, logged out): /cheevo-tracker/ -> /cheevodex/; /cheevo-tracker/game/?id=1234#x -> /cheevodex/game/?id=1234#x, then the expected auth bounce to login. /cheevodex/ returns 200 and serves sw.js cheevodex-1794528600.
- AC3 rests on the redirect plus spec behaviour: the old worker's update check gets a 404 for /cheevo-tracker/sw.js and unregisters, so later launches reach the redirect. Not tested on an installed device.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved Cheevodex to yozuryu.github.io/cheevodex/ by renaming the repo (decision-009) and redirecting the old path from the root site.

Changes:
- Root site 404.html forwards any /cheevo-tracker/… URL to the same page under /cheevodex/, query string and hash kept.
- Root site Lineup card, links, README and docs point at /cheevodex/; the card has the new icon, preview and description.
- Git remote updated to yozuryu/cheevodex.git.

Tests:
- Live redirect checked in Chrome for the root and for a game link with query and hash.
- Unit test of the redirect rewrite before deploy.

Follow-up:
- Installed apps on the old path were not tested on a device; they rely on the old service worker unregistering after a 404.
<!-- SECTION:FINAL_SUMMARY:END -->
