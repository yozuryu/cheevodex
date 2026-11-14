# Global Rules & Guidelines

Rules that apply to every file in this repo. Page-specific rules are in `docs/pages/`.

## Code Structure

- **One `app.js` per page.** All components for a page live in that file. No separate component files.
- **Sub-components at module level**, not inline in render. Define `function MyRow(...)` outside the parent component.
- **No build tools.** No npm, no bundler, no TypeScript. Plain `.js` files with JSX transpiled in-browser by Babel.
- **`assets/ui.js` uses `React.createElement`, not JSX.** It is loaded as a native ES module, not processed by Babel.

## Styling

| Use | When |
|---|---|
| Tailwind `className` with token colours | Fixed structural styles: `text-ink-2`, `bg-box`, `border-l-gold`, `bg-gold/10` |
| Inline `style={{}}` with `var(--token)` | Dynamic values (colours from data, computed widths) |
| `<style>` tag with `@keyframes` | CSS animations — inject inside the React return |
| `assets/*.css` | Shared component styles that classes express badly (tokens, sheets, tabs, motion) — decision-008 |

- Arbitrary Tailwind values are fine for sizes: `text-[11px]`, `w-[140px]`, `tracking-[0.07em]`.
- **Never write a colour literal.** No hex, no `rgba(r,g,b,a)` with a brand colour. Use a token. If no token fits, add one to `assets/tokens.css` (and its name to `assets/tw-config.js`) first. Pure black/white overlays (`bg-black/70`, `rgba(0,0,0,.6)`) are fine.
- Alpha: classes take Tailwind's modifier (`bg-accent/15`, `bg-gold/[0.06]`); inline styles use `rgb(var(--c-gold) / 0.3)`; a colour held in a JS variable uses `color-mix(in srgb, ${color} 25%, transparent)` — never append hex alpha.
- Every page `index.html` loads, right after the Tailwind CDN script:
  ```html
  <script src="../assets/tw-config.js"></script>
  <link rel="stylesheet" href="../assets/tokens.css">
  ```
- `<meta name="theme-color">` and `manifest.json` cannot read CSS variables; keep them in sync with `--page` / `--bar` by hand.

## Design System

### Colour tokens

Values live only in `assets/tokens.css`. Each token exists as `--NAME` (solid) and `--c-NAME` (RGB channels for alpha), and as a Tailwind colour `NAME`.

| Group | Tokens | Role |
|---|---|---|
| Surfaces | `page`, `bar`, `box`, `box-hi`, `box-hover`, `head`, `chip`, `well`, `well-edge`, `inset`, `track`, `shimmer`, `disabled` | Page, top bar/nav, panels, raised and hovered rows, table headers, neutral chips, insets and tracks |
| Lines | `line`, `line-2`, `line-soft`, `line-faint` | Default border → faintest divider |
| Text | `ink`, `ink-2`, `ink-3`, `ink-4` | Primary → faintest |
| Structure | `accent`, `accent-hi`, `accent-edge`, `heat-1`, `heat-2` | Links/active/in-progress, hover, avatar frame, heatmap steps |
| Earned | `gold`, `gold-hi`, `gold-dim`, `gold-press`, `silver`, `bronze` | Mastered/points, hover, subsets, pressed, beaten, third place |
| Status | `aqua`, `hc`, `danger`, `danger-hi`, `danger-edge`, `warn`, `ok`, `online` | Info, hardcore/error, destructive, missable, success, presence |
| Rarity | `rare`, `very-rare`, `ultra-rare` | Rarity scale (with `ink-2`, `accent` for common/uncommon) |
| Install banner | `install`, `install-hi`, `install-press` | PWA install button |

### Stat number colors (by semantic meaning)

| Color | Token | Used for |
|---|---|---|
| Gold | `gold` | Earned value: Points, Mastered |
| White | `ink` | Identity: Rank |
| Blue | `accent` | Engagement: Achievements |
| Silver | `silver` | Second tier: Beaten |
| Muted | `ink-3` | Context/breadth: Games |

### Completion status colors

| Status | Color |
|---|---|
| Mastered | `gold` (gold) |
| Beaten | `silver` (silver) — pairs with gold like a medal; badge bg `chip`, badge text `ink`; beaten award icons get a 1px silver border (mastered: 2px gold) |
| In Progress | `accent` (blue) |
| Not started / border | `line-2` |

Note: the game page's award *badge* is a different surface — `AWARD_CONFIG` in `game/app.js`
uses silver `silver` for beaten-hardcore and gray `ink-2` for beaten-softcore. The status colors above
govern everywhere else.

**Charts use these colors unchanged.** Note that beaten silver↔`accent` is a close pair (ΔE2000
15.5 — the old gray was 13.9 on the `dataviz` skill's `validate_palette.js` metric, below its 15 floor):
silver has almost no chroma, so no blue at a similar lightness separates well from it. Where both appear in one chart,
give every segment its own visible count and icon so identity never rests on color alone.

### Tilde tag colors

| Tag | Color |
|---|---|
| Hack | `hc` |
| Homebrew | `accent` |
| Demo | `aqua` |
| Prototype | `ink-2` |

### Blue and gold

Cheevodex follows RetroAchievements' own split (doc-012):

- **Blue (`accent`) is structure:** section headings, rank, platform names, the active tab, filters that are on, and progress bars for anything not yet earned.
  - Reward beats structure: on a beaten or mastered dex entry card (`.dent`) the whole card takes its metal, platform name included (silver or gold instead of blue).
- **Words:** the dex is the whole book; each game in it is an **entry** ("96 entries", never "96 dexes"). Its page holds the entry's **dex record**. An entry's number is its **Dex No.**, the number in the dex (its RA game ID, the same for everyone), never "Entry No.", which would read as a position in the list. On a card, "No." alone is enough.
- **Gold (`gold`) is reward:** points, mastered, unlocked achievements, user links. Only earned things glow (gold ring/shadow); nothing blue glows except the heading diamond.
- Surfaces are warm charcoal (`page` → `box` → `box-hi`), never blue-grey.

### Section headers

Every page section uses the same heading (styles in `assets/ui.css`):

```jsx
<div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3">
  <span className="sec-mark" />
  <span className="sec-t">Title</span>
</div>
```

`.sec-mark` is a rotated blue diamond; `.sec-t` is blue 15px/500, sentence case. Any element that directly holds a `.sec-mark` gets an underline fading from 55% to 8% blue. Inside a panel's header strip use `<span className="sec-mark sm" />` + `<span className="card-t">`.

### Typography

- UI: **Geist** (`var(--font)`, Tailwind `font-sans`, the default). Numbers: **Geist Mono** (`var(--mono)`, `font-mono`); anything with `tabular-nums` or `.num` gets it automatically. **Silkscreen** (`font-pixel`) only for tiny accents.
- Fonts load from Google Fonts in each page's `<head>`, with system fallbacks in the token stacks.
- Sizes: 7–15px body (compact, dashboard-style); headings 15px.
- Labels: `uppercase tracking-[0.07em]` with `font-semibold`.
- Corners: 2–3px on cards, chips, icons; 4px for cards inside sheets; no pills (Savepoint geometry).

### Shimmer skeleton

Defined in each page's `index.html` `<style>` block. Class: `.shimmer`. Use on loading placeholders while data is null.

### Scroll-to-top button

```jsx
<button className="scroll-top-btn w-10 h-10 rounded-full bg-bar border border-line active:scale-90">  {/* round is fine for this floating button */}
```

Class `scroll-top-btn` is required — `mobile-nav.js` repositions it above the nav bar.

## Mobile Rules

### Breakpoint

`md` = 768px. This is the only breakpoint used for layout switches. `sm` (640px) is used sparingly for grid column counts and secondary details.

### Page headers

All page headers use `pt-8 pb-5 md:pt-5`. The extra `pt-8` compensates for the hidden Topbar breadcrumb on mobile. Apply to every new page.

### Bottom navigation (`assets/mobile-nav.js`)

- Visible only on screens < 768px. Injects a fixed bottom bar with two tabs: Profile and Log.
- Hides `.page-topbar` and `footer` on mobile. Adds `padding-bottom` to body.
- Repositions `.scroll-top-btn` above the nav bar — always use class `scroll-top-btn` on the FAB.

### Content padding

All page `<main>` sections use `px-4 md:px-8`. Sticky bars that span edge-to-edge use `-mx-4 md:-mx-8`.

### Tab bars (sticky)

Use `TabBar` from `assets/tabs.js` for page tabs (an icon on every tab + uppercase 12px/600 label, sliding 3px blue underline), on phones too. It is sticky at the top; pass `className="md:top-[26px]"` (the global Topbar is 26px tall on desktop) plus any page padding. Wrap the tab content in one element and call `useSwipeTabs(ref, ids, active, onChange, ready)` for phone swipe.

### Cheevodex motifs

Cheevodex's own pieces, not Savepoint's (CHV-040; styles in `assets/ui.css`):
- **Ring** (`.dring`, `--p` %, `--c` colour, `--s` size, `--w` width; optional `--b` % in `--cb` for an earlier part drawn dim) for completion: the game page record, the game rows, the Dex entry cards (small, beside the count), the Backlog's index lines, and the activity summary's entries that moved (before dim, gained bright). Gold with a glow only when mastered.
- **Index lines** (`.dledger` / `.dl-row`: `.dl-k` label, `.dl-dots` dotted leader, `.dl-v` value) for lists of numbers: the game record, user stats, award counts, the activity summary's year and streaks, changelog sections. Not boxed stat tiles.
- **Diamond path** (`.dpath`) for progression: one diamond per progression achievement (grouped past 20), gold when done, on a line that fills up to the last done one.
- **Volumes** (`.dvol` / `.dvol-h`) for long grouped lists: the Dex by console, the changelog by release.

- **Friend colours** (`friendColor(username)` in `profile/app.js`: hue 70°–330°, saturation 55–90% and lightness 60–76%, all from one hash of the username; computed, so no tokens): one stable colour per friend for identity only (avatar ring, name). Run edges show the mode the RA way (gold hardcore, grey softcore); earned counts stay gold. The hue range skips red, orange and gold, so it never reads as a status.

Shared with Savepoint on purpose: the tab bar, filter chips, sheets, and the activity day headings. Activity runs (Mine and Friends) use Cheevodex's own `RunStrip`: mode-coloured edge and wash, gold +N.

### Consistency rules (CHV-046)

- **Mode colours:** hardcore is gold, softcore grey, everywhere (pills, flames, counts, bars, run edges). Red (`--hc`) means errors, win conditions and the top RetroRatio band only.
- **Progress is a ring** (`.dring`) beside its count. No progress bars on game rows, tiles, Dex cards, Backlog lines or compare.
- **Controls are filter chips** (`.fchip`, `.on` when active, `.n` for a count). No tiny uppercase toggle buttons.
- **Numbers in lists are index lines** (`.dledger`), not boxed tiles.
- **Dex numbers** (`.dex-no`, 8px pixel face) on every game row and card: Dex, Recent, Progress, Activity runs, Backlog, console list, search, compare.
- **Time ago** is one style: `5m ago`, `18h ago`, `3d ago`, then the date (`formatTimeAgo`, `timeAgo`, `shortAgo` + " ago").
- **Text** is 10px or larger; only the 7px Subset / tilde tags and chart axis labels are smaller.
- **Corners** 2–3px, sheets included. No `#fff` / `text-white`: use `ink`.
- **Page width:** single-column pages (game, achievement, consoles, console, search, changelog) use `max-w-4xl mx-auto px-4 md:px-8`; the profile uses its rail layout. Long text keeps ~72ch inside it.
- **Footer:** `Footer({ label: 'Cheevodex · <page>', raHref })` on every page; the RA link points to the matching RA page.
- **Game art** is a real screenshot or nothing (never RA's placeholder, never the icon stretched).

### Dex numbers

A game's dex number is its RA game ID, written `No.<id>` (or `Dex No.<id>` in page headings) with class `.dex-no` — the only place the Silkscreen pixel face is used. "Dex" is the word for an entry in the codex; never seen / caught or other Pokédex wording.

### Filters

Use Savepoint's shared filter styles in `assets/ui.css`, never stacked uppercase label rows: a `.frow` of sentence-case `.fchip`s (counts in `.n`, `.fsep` between groups, the row scrolls sideways), a `.fbar` with `.fsearch` (search icon + clear button), sort / group as a `<select class="fselect">` inside `<span class="fselect-w">` (its icons are token-coloured masks), and the `ViewToggle`. Counts and hints go in a plain `.fmeta` line or `.crit` chips.

### Layout direction

Headers and content areas switch from column to row at `md`:

```jsx
<div className="flex flex-col md:flex-row items-center md:items-start gap-5">
```

Text alignment: `text-center md:text-left` inside `flex-col md:flex-row` headers.

### Icon sizes

Page hero icons (game box art, achievement badge, avatar) scale up at `md`:

| Context | Mobile | Desktop |
|---|---|---|
| Profile / User avatar | `w-20 h-20` | `w-24 h-24` |
| Game box art (game page header) | `w-16 h-16` | `w-20 h-20` |
| Achievement badge (achievement header) | `w-16 h-16` | `w-28 h-28` |

### Hiding / showing elements

| Pattern | When to use |
|---|---|
| `hidden md:block` | Desktop-only element |
| `block md:hidden` | Mobile-only element (icon labels in compact tabs) |
| `hidden md:inline` | Desktop-only inline text (breadcrumb words) |
| `sm:hidden` | Elements visible only on mobile (abbreviated hints) |

## Auth Pattern

Every page that requires credentials follows this pattern:

```js
const creds = getCredentials();
if (!creds) { handleAuthError(); return; }
```

```js
function handleAuthError() {
  clearCredentials();
  window.location.replace('../');
}
```

Wrap every API call in a try/catch and call `handleAuthError()` if `err.message === 'AUTH_ERROR'`.

## API Usage

- **Never call `raFetch` directly from `app.js`.** Use exported composites from `ra-api.js`.
- **Never access PascalCase raw fields in `app.js`.** Everything from `ra-api.js` is camelCase.
- **Never bypass `transformData`.** All derived UI state (progress %, mastery status, subset parsing) lives in `transform.js`.
- Rate limit same-endpoint pagination: internal `paginate()` helper sleeps 1 s between pages. Do not add extra delays for `Promise.all` across different endpoints.

## Comments

Write no comments unless the WHY is non-obvious. One short line max. No docstrings. No multi-line comment blocks.

## Changelog

**Update `changelog.md` after every change.** Do not wait for the user to ask.

- Version: `## vYY.MM.DD` (e.g. `## v26.04.28`)
- If an entry for today exists, add to it — never create a duplicate date header.
- One-line summary after the version header.
- `### SectionName` subsections per area changed.
- Section order: RetroAchievements, Auth, Structure.
