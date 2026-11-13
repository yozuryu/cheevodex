---
id: CHV-042
title: 'Friends timeline, lighter and with a friend strip'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 06:14'
updated_date: '2026-11-13 09:26'
labels:
  - profile
  - design
dependencies: []
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Friends view of Activity still uses the old tiny-text tree (9px labels, dot timelines, badge strips). Bring it to the same timeline as Mine and give it a Cheevodex roster.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sync, refresh, reset and failure notices sit in one filter bar row, readable on phones
- [x] #2 No sideways scroll at 450px and no page errors
- [x] #3 A strip of active friends sits on top (tap to narrow); the timeline hangs each friend's posts on a day rail, each run a game line with +N and a badge strip that opens to the unlock rows
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Friends view rebuilt on Mine's DayHead + RunCard with the friend's avatar and name, runs folding after two unlocks; a roster of index lines ranks players by 30-day unlocks and filters the feed on tap (verified: 100 cards all from the chosen player; All 27 expands). Removed FeedSession/FeedAchRow and the By Session/By User switch; RunCard gained a fold prop.

Reworked after review into a Party: one card per friend (avatar, last active, +N, points, game chips with +N linking to compare), runs behind a toggle, Recent / Most unlocks sort, two columns on desktop. Roster removed. Rings skipped on purpose: the friends endpoint has no per-game totals. Verified: expand (14 runs), sort, no sideways scroll at 400 / 1280.

Third pass, per review (keep the timeline): Party cards replaced by a friend strip + day rail. Posts group a friend's back-to-back runs; runs are a game line and a badge strip opening to rows. Verified: expand (13 rows), strip filter, phone badge count (7 + '+1'), no sideways scroll at 400 / 1280.

Colour pass: friend palette tokens --pal-1..6 (stable per username) on avatar ring, name and run edge; +N gold; hardcore badges underlined in gold instead of framed.

Run strip pass: game icon blurred behind the strip, Subset/tilde tags, subset name, console, mode icon; run edge shows mode (red HC, grey SC, split mixed); friend colour kept to avatar ring and name.

Per review: mode colours follow RA (gold hardcore, grey softcore) on the run edge, a faint wash on the strip, and the flame; the blurred icon background is gone.

Friend colours computed from the username (FNV-1a + finaliser → hue 70°–330°, tokens --pal-s/--pal-l) instead of a 6-colour palette; the --pal-1..6 tokens are removed.
<!-- SECTION:FINAL_SUMMARY:END -->
