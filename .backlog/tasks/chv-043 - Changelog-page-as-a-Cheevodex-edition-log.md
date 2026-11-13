---
id: CHV-043
title: Changelog page as a Cheevodex edition log
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 06:14'
updated_date: '2026-11-13 07:01'
labels:
  - changelog
  - design
dependencies: []
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The changelog page is the old Steam-era timeline with dot nodes and colour bars, the same shape as Savepoint's. Give it Cheevodex's own frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each release is a volume with a sticky heading, the version in the mono face and its change count
- [x] #2 Sections read as index lines (section, dotted leader, count) and open to their entries
- [x] #3 A jump list of releases sits at the top; the newest release opens by default
- [x] #4 No sideways scroll at 450px and no page errors
- [x] #5 Entries show a one-line headline and open to their detail; developer sections start closed
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changelog page rebuilt as volumes: sticky release headings with mono version, date and count; sections as index lines that open to entries; header index lines (releases, changes, since) and a jump list. Toggles and jump links verified. Docs: changelog.md.

Decluttered after review: entries show their headline only (bold lead or first sentence) and open on tap, Cache/Structure/RA API start closed, code is plain mono. Verified 34 entries open with no sideways scroll at 400px and 1280px.
<!-- SECTION:FINAL_SUMMARY:END -->
