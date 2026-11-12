---
id: CHV-024
title: Rebrand to Cheevodex
status: Done
assignee:
  - '@claude'
created_date: '2026-11-12 14:18'
updated_date: '2026-11-12 17:08'
labels:
  - rebrand
dependencies:
  - CHV-017
documentation:
  - doc-012
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rename Cheevo Tracker to Cheevodex and ship the Lens boy mark from doc-012. Keeps the current URL; moving the repo is a separate task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The name Cheevodex appears in every page title, top bar, breadcrumb, footer, manifest, package.json, README, docs and CLAUDE.md; 'Cheevo Tracker' no longer appears in user-facing text
- [x] #2 Wordmark renders as Cheevo + blue dex in Geist in the top bar
- [x] #3 Every page footer says the app is unofficial and not affiliated with RetroAchievements
- [x] #4 Service worker cache name is bumped so installed PWAs pick up the new icons and name
- [x] #5 App icon, favicon (svg + ico) and 192/512 PWA icons use the Lens boy mark exactly as in doc-012
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Mechanical rename Cheevo Tracker->Cheevodex / cheevo-tracker->cheevodex in all tracked files except changelog history and .backlog; IndexedDB name cheevo_tracker and localStorage keys deliberately untouched (data + login carry over; root site CLAUDE.md also reserves that IDB name).
- Icons generated from the doc-012 map (scratchpad gen.py): favicon.svg transparent, appicon.svg/png + 192/512 on #141312 with 2.5u padding and 7% blue wash, favicon.ico 16/32/48 rendered pixel-exact.
- Topbar first crumb renders .brand (mark + .wm Cheevo<em>dex</em>); login shows app icon + wordmark.
- Disclaimer: ui.js Footer (desktop), mobile-nav menu sheet foot (phones hide footers), login.
- sw CACHE_NAME cheevodex-1794528000.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebranded to Cheevodex.

- Name in every title, top bar, footer, manifest, package.json, README, docs, skills and CLAUDE.md.
- Lens boy mark: favicon svg/ico, 192/512 PWA icons, app icon svg/png.
- Top bar wordmark Cheevo + blue dex in Geist 650; login page rebranded.
- Unofficial / not affiliated disclaimer on every page (footer, phone menu, login).
- Service worker cache renamed and bumped; storage names unchanged so users keep data.
<!-- SECTION:FINAL_SUMMARY:END -->
