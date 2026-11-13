---
id: CHV-026
title: Profile tab bar with icons on every screen; bottom nav goes to pages
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 00:11'
updated_date: '2026-11-13 03:13'
labels:
  - design
  - profile
dependencies: []
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cheevodex shows its profile tab bar only on desktop, without icons, and uses the phone bottom nav as a second tab switcher. Savepoint has one sticky tab bar with icons on every screen and a bottom nav for pages. Match Savepoint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Profile tab bar shows an icon and label per tab, and is sticky below the status bar on phones and below the top bar on desktop
- [x] #2 Phone bottom nav links to pages (Profile, Search, Consoles, Changelog, Menu) instead of profile tabs
- [x] #3 The floating tab pill is removed
- [x] #4 Swipe between tabs still works on phones
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
profileTabs carry Lucide icons; TabBar shows on every screen (sticky top env(safe-area) on phones, md:top-[37px]); .ptabs-anchor + scrollToTabs on tab change. Floating pill, its scroll handler, state and keyframes removed; header no longer hidden on phones off the first tab. mobile-nav.js: Profile, Search, Consoles, Changelog, Menu; menu sheet keeps account + cache actions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One sticky tab bar with icons on every screen; the phone bottom nav now goes to pages.

- Profile tabs: Overview, Recent, Progress, Activity, Backlog, Social, Stats, each with an icon; sticky under the status bar on phones.
- Floating tab pill removed; header shows on every tab; switching tabs scrolls the new tab to its top.
- Bottom nav: Profile, Search, Consoles, Changelog, Menu.

Tests: func.cjs swipe test (profile progress->activity->progress, game achievements->details->achievements, vertical drag ignored); screenshots at 450px and 1280px.
<!-- SECTION:FINAL_SUMMARY:END -->
