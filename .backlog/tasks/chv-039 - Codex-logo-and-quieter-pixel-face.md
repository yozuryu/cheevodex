---
id: CHV-039
title: Codex logo and quieter pixel face
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 04:07'
updated_date: '2026-11-13 04:37'
labels:
  - design
  - brand
dependencies: []
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lens boy reads as a Pokédex crossed with a Game Boy. Replace it with a codex mark (closed book with an index tab) in the same pixel style, and keep the pixel face for dex numbers only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New mark used in the top bar, login, favicon and app icons (all sizes regenerated)
- [x] #2 The pixel face appears only on dex numbers
- [x] #3 doc-012 records the new mark and the dex wording
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Codex logo replaces Lens boy: closed pixel book, gold trophy, ribbon bookmark. favicon.svg/.ico, appicon.svg/.png, icon-192/512 regenerated (scratchpad gen.py + codex_map.py; map in doc-012). Pixel face limited to dex numbers. doc-012 records the mark, the dex wording and the codex-not-Pokédex rule.

Chosen over a tablet (read as a list app, back toward a device) and a book with a screen cover (lost the RA blue at small sizes).
<!-- SECTION:FINAL_SUMMARY:END -->
