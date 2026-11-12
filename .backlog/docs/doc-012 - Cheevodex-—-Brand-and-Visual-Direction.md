---
id: doc-012
title: Cheevodex — Brand and Visual Direction
type: specification
created_date: '2026-11-12 14:15'
updated_date: '2026-11-12 15:47'
---
> **Status:** approved direction (2026-11-12). Mockups: direction study v2 and logo sheet (claude.ai artifacts, private to the owner).

## Product

- **Name:** Cheevodex. Wordmark is "Cheevo" in ink plus "dex" in RA blue, set in Geist 650 with tight tracking (-0.02em).
- **Positioning:** an unofficial, modern companion to RetroAchievements. It is RA-inspired, never RA-impersonating: no RA logo, no "RetroAchievements" or "RA" in our brand, and every page footer says "Unofficial. Not affiliated with RetroAchievements."
- **Sibling:** Savepoint (multi-platform hub). Shapes and components come from Savepoint; colour, type and logo are what set Cheevodex apart.
- **Later (not in this plan):** promo site and README posters, like Savepoint's.

## Visual direction: "Modern RA"

RA's DNA (measured from RAWeb `resources/css/theme.css`: page #1a1a1a, box #232323, embed #161616, text #2C97FA, link #CC9900) carried by Savepoint's geometry.

### Colour tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | #111111 | page |
| `--box` | #1a1918 | cards |
| `--box-hi` | #201f1e | card top / hover |
| `--well` | #0c0c0c | insets, top bar |
| `--line` | rgba(255,255,255,.075) | hairline borders |
| `--ink` / `--ink-2` / `--ink-3` | #e8e5df / #9b968e / #5f5b55 | text, secondary, muted |
| `--blue` | #2c97fa (RA exact) | headings, rank, platforms, active tab, in-progress |
| `--link` | #e0a412 | game and achievement links (RA's gold link) |
| `--gold` | #f2b731 | mastered, points, anything earned |
| `--silver` | #c4cad1 | beaten |
| `--hc` | #ff5d4a | hardcore |

Rules:
- **Blue is structure, gold is reward.** Blue for headings, rank, platform names, active tab, progress. Gold for links and anything earned.
- **Only earned things glow** (mastered badges, points).
- **Neutrals are charcoal,** not Steam blue-grey.

### Type
- UI: Geist (400/500/600/650). Numbers: Geist Mono, tabular.
- Pixel face (Silkscreen) only for tiny accents, never body or headings.

### Shapes (from Savepoint `assets/ui.css`)
- 2–3px corners on cards, icons, badges, chips. 4px on cards inside sheets.
- 12px only on the phone bottom-sheet top edge.
- No pills.
- Tabs: uppercase 12px/600, tracking .07em, with a 3px sliding underline in blue.

### Signature pieces
- **Section heading:** blue text 15px/500, small rotated blue diamond marker, 1px underline fading from blue 55% to 8%.
- **Profile and game header:** last game's art blurred behind, a gold radial glow top-left and a blue one top-right, and the avatar with a 2px gold conic ring.
- **Badges:** gold 2px ring plus glow for mastered, silver ring for beaten, greyscale for locked.
- **Progress:** segmented bars (one segment per step), and the mastered / beaten / in progress status row as tinted segments with a coloured bottom edge.

## Logo: Lens boy

A dex crossed with a pocket console: a blue handheld whose screen is one big round lens, and the lens is a gold achievement coin. A d-pad and one gold button sit below it. 16x16 grid, `shape-rendering="crispEdges"`. Chosen over C-coin (round 1) on 2026-11-12.

Colour keys: B #8cc8ff, b #2c97fa, k #123a63, G #ffd76e, g #f2b731, o #b37a0c, w #fff6dc, `.` transparent.

```
................
..BBBBBBBBBBBB..
..bbbbkkkkbbbb..
..bbbkwGGGkbbb..
..bbkGGggggkbb..
..bbkGgggggkbb..
..bbkGggggokbb..
..bbkggggookbb..
..bbbkggookbbb..
..bbbbkkkkbbbb..
..bbkbbbbbbbbb..
..bkkkbbbbggbb..
..bbkbbbbbbbbb..
..bbbbbbbbbbb...
..kkkkkkkkkk....
................
```

- **No red, ever.** Blue and gold keep it ours; red plus this silhouette would read as a copy of a Pokédex.
- **The rounded bottom-right corner** is a nod to classic handhelds. If Cheevodex is ever sold, review it; a square corner removes the risk.

- **App icon:** the mark on #141312 with 2.5 grid units of padding and a 7% blue wash on the top half.
- **Favicon:** the mark on a transparent background.
