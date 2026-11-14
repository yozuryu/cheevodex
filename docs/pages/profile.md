# Profile Page

**File:** `profile/app.js` (~3800 LOC)  
**URL:** `/profile/` (own profile) · `/profile/?u=<username>` (visitor mode)  
**Auth required:** Yes

## Tabs

| Tab | Icon | URL param | Notes |
|---|---|---|---|
| Dex | BookMarked | `?tab=dex` | Default. Every played game as an entry in the dex (see below) |
| Overview | User | `?tab=overview` | Last played, Recent unlocks, User stats, Game awards |
| Recent | Clock | `?tab=recent` | Search over the library; the latest 15, or up to 50 matches |
| Progress | BarChart2 | `?tab=progress` | Views + Mastered toggle, search, sort |
| Activity | Activity | `?tab=activity` | Mine / Friends chips; lazy-loads achievement chunks |
| Backlog | Star | `?tab=backlog` | Want-to-play list; triggers `fetchBacklog` on first open |
| Social | Users | `?tab=social` | Following / followers; triggers `fetchSocial` on first open |
| Stats | PieChart | `?tab=stats` | Own profile only |

Tab state persists in the URL. `profileTabs` (in `App`) is the single ordered list: it feeds the shared `TabBar` (`assets/tabs.js`: icon + uppercase label, sliding blue underline, sideways scroll, sticky under the status bar on phones and under the top bar from md) and the phone swipe (`useSwipeTabs` on `tabContentRef`). A `.ptabs-anchor` marks the bar's natural spot; `setTab` calls `scrollToTabs(tabBarRef)` so a new tab starts at its top with the bar pinned. The layout follows Savepoint's RA profile (CHV-026–030); the phone bottom nav goes to pages, not tabs.

## Dex (CHV-033, CHV-037)

Cheevodex's centre: the player's cheevo codex. The dex is the book; each game in `ALL_GAMES` is an **entry** in it, numbered by its RA game ID (`.dex-no`, the only place the pixel face is used). `DexTab` / `DexEntry` / `DexCounter` in `profile/app.js`, styles `.dexc` / `.dgrid` / `.dent` / `.dvol` / `.dindex` in `assets/ui.css`.

- **States, in RA's words:** played (every game), beaten (`isBeaten || isMastered`), mastered. A game with no unlocks shows its icon dimmed grey (`.dent.unstarted`). Never seen / caught: Cheevodex is a codex, not a Pokédex (doc-012).
- **Entry:** Dex No., icon, title (two lines kept so rows line up), then one bottom line: the console's short name (`CONSOLE_SHORT`, full name in the tooltip) or the subset name, and the count with a small completion ring beside it (blue in progress, silver beaten, full gold mastered; no ring when the game has no set). The art is never covered. Beaten and mastered stand apart three ways: a tag in the top corner (silver outlined "Beaten" with a medal, solid gold "Mastered" with a star; icon only on phones), a tint of their metal over the whole card, and a heavier frame round the art, with the dex number and console name in the same metal and the count text a step lighter so it does not sink into the tint. Links to the game page.
- **Controls:** search (title, subset or a dex number), console select, sort (Dex No. · Last played · Progress · Title), chips All / Unbeaten / Beaten / Mastered with counts, and a count line ("96 entries · 12 consoles").
- **Order:** the default sort, **Dex No.**, is one continuous list from the lowest number (roughly the order RA added the sets). **Index:** the **By console** sort, with no console or search picked, groups entries by console (biggest first) under sticky `.dvol-h` headings with counts, and a jump list of console chips scrolls to each group.
- **Dex counter** (`DexCounter`): Played / Beaten / Mastered with a bar each (started, beaten, mastered as a share of played). In the header on phones, in the identity rail on desktop; tapping a cell opens the Dex on that filter.

## Identity rail (≥1024px, CHV-034)

From 1024px the profile is two columns (`lg:grid-cols-[300px_minmax(0,1fr)]`, main `lg:max-w-[80rem]`): a sticky `.idrail` on the left (the player card over the last game's art: avatar, name + RA link, rank, last active, motto, Points / Achievements / Rank; then the dex counter; then the stat tiles with More stats; then Member since) and the tab bar + content on the right. The `.phead` header is `lg:hidden`, and the Overview's User stats block is `lg:hidden` (the rail has them).

## Overview

The header sits on top, then the tab bar; nothing between them. Overview is `grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]`:

- **Last played**: the regular `GameListRow` with the rich presence as a `.grow-extra` line.
- **Recent unlocks**: the newest unlock as a card; on ≥1024px also the next five as `.urow` rows (`.ulist`, hidden on phones) from the achievement chunks, which the wide Overview loads.
- **User stats** (`.prail`): `StatTiles` (index lines, `.sledger`; two across in the rail, value over label, `STAT_LABELS` shortens labels, "of N" after a rank shown as small text); `statsRight` behind **More stats**.
- **Game awards**: `CompletionsPanel` (`assets/completions.js`, `.cmp-*`): Mastered / Beaten counts, the newest award as a card with the game's screenshot behind, then the icons with a tiles / list switch (`cheevodex:awardsView`). Items link to the game page (`gameId` from the award's `awardData`, added in `transform.js`).

## Compare sheet

`CompareModal` (a `useSheet` sheet) compares your progress with a friend's on the games you share: index lines for Shared, You ahead, Tied and them ahead; Sort chips (Biggest gap, Mine, Theirs, A–Z by the shown title); one `.cmpr` row per game (icon, title + tags, dex number, console) with your ring (blue) and theirs (aqua), gold when mastered, the mode icon, and the leader's side tinted.

## Game lists: list / tiles

Recent and Progress render `GameListRow` (`.grow` in a `.glist`, two columns from md: icon, title, console + subset + tilde tags + mode icon, playtime · `shortAgo` last played ("18h ago"), the count beside a small `.dring` on the right, the screenshot faded in on the right, status colour on the left edge) or `GameTile`s in `.gtiles`, chosen with `ViewToggle` and remembered by `useGameView()` (`assets/game-view.js`, `cheevodex:gameView`). Rows and tiles link to the game page. `gameStatus(game)` gives the status colour (gold mastered, silver beaten, blue in progress, `line-2` not started). Tiles show the count beside a small ring (`.gtile-n`). Game art (`game.background`) is the in-game or title screenshot only, or none (`gameArt()` in `transform.js` skips RA's `000002.png` placeholder).

Filters use Savepoint's shared filter styles (`.frow` / `.fchip` / `.fsep` / `.fbar` / `.fsearch` / `.fselect-w` + `.fselect` / `.crits` in `assets/ui.css`): Recent has `SearchField` + `ViewToggle`; Progress has `ProgressFilterBar` (view chips with counts, the Mastered toggle in All, search, sort select in All: Overall % or Last played, view toggle, and the view's rules as `.crit` chips). Search uses `fold()` (no accents or case).

## Header

`.phead` (styles in `assets/ui.css`): the most recently played game's `background` blurred behind (`ArtBg` variant `art-header`), gold glow top-left and blue glow top-right, gold conic-ring avatar with status dot, name + RA link, rank and last active, motto; on the right (stacked on phones) a numbers strip (Points, Achievements, Site rank) and the `.pstatus` row counting mastered / beaten / in-progress games from `ALL_GAMES`. No art → plain charcoal.

## Mount Sequence

5 parallel requests via `fetchProfile()`:

1. `API_GetUserProfile` → `coreProfile`
2. `API_GetUserSummary?g=20&a=5` → `userSummary`, `recentlyPlayedGames`, `mostRecentGame`, `mostRecentAchievement`
3. `API_GetUserCompletionProgress` (auto-paginated, 500/page) → `gameAwardsAndProgress`
4. `API_GetUserAwards` → `pageAwards`
5. `API_GetAchievementsEarnedBetween` (last 182 days) → pre-populates chunk 0 + computes `points7Days`/`points30Days`

## Lazy Loads

| Trigger | Fetch | State updated |
|---|---|---|
| Backlog tab opens (first time) | `getBacklog()` from IDB, then `fetchBacklog()` | `backlogData` |
| Social tab opens (first time) | `fetchSocial()` | `socialData` |
| Activity tab scroll (sentinel ref) | `fetchAchievementsChunk(u, k, idx)` idx 1–3 | `achievementChunks` |
| Stats tab opens (first time) | `loadAchievements()` — same call the Activity tab makes, shared state | `achievements` |
| Game modal opens (achievements not yet loaded) | `fetchGameDetails(u, k, gameId)` | `gamesData.detailedGameProgress[gameId]` |
| Friends view opens (first time, own session) | `fetchFriendsActivity()` | `friendsActivity`, `friendsActivityStatus` |

## Social Timeline (Activity Tab — Friends View)

The Activity tab has a **Mine / Friends** toggle. Friends view shows a merged timeline of the authed user's own achievements + all followed users' achievements, as a timeline of friends' posts by day (runs: user + game within a 1-hour window; a friend's consecutive runs grouped), under a strip of active friends.

### State (main app)

| State | Type | Purpose |
|---|---|---|
| `socialView` | `'mine' \| 'friends'` | Active sub-tab |
| `friendsActivityStatus` | `'idle' \| 'loading' \| 'updating' \| 'done' \| 'error'` | Fetch lifecycle |
| `friendsActivity` | `{ [username]: achievement[] }` | Per-friend achievement arrays (streams in) |
| `friendsFetchProgress` | `{ done, total } \| null` | Progress counter for loading indicator |
| `friendsFetchingRef` | `useRef(boolean)` | Re-entry guard for the fetch useEffect |

### Fetch flow

1. User switches to Friends view → useEffect fires (deps: `activeTab`, `socialView`, `friendsActivityStatus`)
2. Resolve following list: `socialData?.following.results ?? fetchSocial()`
3. `allFriendsCached(followingList)` — if all users have a valid `ra_fa_*` cache entry, skip 'loading' state and resolve instantly
4. Otherwise set `friendsActivityStatus = 'loading'`; `fetchFriendsActivity` fetches one user at a time (1000ms gap between API calls), streams results via `onUser` callback
5. On complete: `friendsActivityStatus = 'done'`; on unrecoverable error: `'error'`

### Mine view (ActivityTab)

Savepoint's timeline from `assets/activity-ui.js` (styles: the "Activity timelines" block in `assets/ui.css`): `ActivitySummary` — the dex entries that moved: the page passes rows (`moved` in ActivityTab: games with unlocks in the last 14 days, from `achievements` joined to `games`/`ALL_GAMES`; before = unlocked now − unlocks in the window) drawn as a two-tone `.dring` (`--b` before %, dim; `--p` now %) around the game icon, dex number, console, +N and before → now; three shown, "N more entries" for the rest. Its toggle (remembered as `cheevodex:activitySummary`, open from md) opens past-year index lines, current / best streak, and the year heatmap), sticky `DayHead`s under the tab bar (`.tl-tabs`), and one `MyRun` per run of unlocks in one game: the shared `RunStrip` (icon, title with Subset / tilde tags, subset name, mode icon, console, time range; +N and points in gold; the run's edge and a faint wash in its mode colour, gold hardcore / grey softcore) over the full `unlockRow`s; runs over 5 fold after 4. Picking a day in the heatmap filters the timeline. Dates and times use `assets/time.js` (viewer's timezone).

### Feed rendering (ActivityTab, Friends view)

- `mergedFeed`: own `achievements` + all `friendsActivity` values, sorted newest-first
- `feedGroups`: consecutive same-user+game runs within 1-hour window → session objects
- `party`: friends (not you) in the feed with their unlocks and last active, newest first: the strip on top (`.fstrip` / `.fpal`, Everyone first). Tapping one sets `friendSel`, narrowing the timeline and showing a Profile link
- `friendDays`: friends' runs (filtered), first `visibleSessionCount` (100 more per Show more days), grouped by day; within a day, a friend's consecutive runs become one post. Each day has a `DayHead` (unlocks · friends) and a rail (`.fposts`) of `FriendPost`s: avatar node, name, time, and "+N in N games" when there's more than one run
- Colours: each friend's avatar ring and name use `friendColor(username)` (hue, saturation and lightness from a hash of the username, within readable bounds; set as `--fc`). The rail (`.fposts`) is padded 6px and the strip has no negative margin, because the content column clips past its left edge; +N is gold; the run's left edge and the strip's faint wash are its mode (`.frun.hc` gold, `.sc` grey, `.mix` split, with hardcore badges underlined in gold)
- `FriendRun`: the shared `RunStrip` (icon, title with Subset / tilde tags, subset name, mode icon, console, time range; +N and points) linking to the game in compare mode, then a strip of badges (10 on desktop, 7 on phones, gold edge for hardcore) that opens to the full `unlockRow`s
- Sync time, Refresh and Reset (icon chips) sit beside the Mine / Friends chips; friends whose fetch failed are listed in one quiet line under the strip

## `rawData` Memo

```js
rawData = {
  ...profileData,          // from fetchProfile()
  wantToPlayList,          // backlogData — null until the Backlog tab opens
  recentAchievements: [],  // not used directly
  detailedGameProgress,    // lazy-populated per game
}
```

Passed to `transformData()` → `{ profile, games, backlog }`.

## Completion Progress — Progression Buckets

`progressFilter` state (`'all' | 'nearly' | 'inprogress' | 'abandoned'`) is the view chip row of `ProgressFilterBar`; `applyProgressView()` buckets the games and `progressViewCounts()` gives each chip its count. All views run after the shared base filter (has unlocks, has an achievement set, matches `progressSearch`).

The three progression buckets **partition** started-but-unfinished games — every such game lands
in exactly one, and their counts sum to the unfinished total. Precedence is first-match-wins in
the order below.

| View | Filter | Sort |
|---|---|---|
| `nearly` | `!isMastered && rawProgress >= 75` | achievements remaining asc, then `rawProgress` desc |
| `inprogress` | not nearly, `lastPlayedStr` within 30 days | `lastPlayedStr` desc |
| `abandoned` | not nearly, `lastPlayedStr` older than 30 days **or missing** | `lastPlayedStr` desc |
| `all` | `showMastered \|\| !isMastered` | `progressSort`: `rawProgress` desc (Overall %) or `lastPlayedStr` desc (Last played) |

Two deliberate choices:

- **`nearly` is recency-neutral** — it outranks `abandoned`, so a game left at 80% seven months
  ago stays on the finish-line list instead of vanishing into the abandoned pile.
- **Percentage is the gate, remaining is the sort.** A pure `remaining <= N` rule surfaces tiny
  6-achievement sets where the user has one unlock (17% complete, 5 left); a pure percentage rule
  puts an 81%-of-93 set with 18 to go at the top. Gating on 75% and sorting by remaining ascending
  avoids both.

`lastPlayedStr` is the *play* timestamp for games in `recentlyPlayedGames`, falling back to
`mostRecentAwardedDate` otherwise — so launching a game without unlocking anything still counts
as in progress.

The `Mastered` toggle and the sort only render under `all`; the buckets exclude mastered games by definition and have a fixed order, shown as `.crit` rule chips.

## Stats Tab

`StatsTab` — own profile only. Reuses `ALL_GAMES`, `PROFILE_DATA.gameAwards` and `heatmapData`
from the mount fetch, plus the achievement chunks it shares with the Activity tab. No extra
API surface.

### Props

| Prop | Source |
|---|---|
| `achievements` | `allLoadedAchievements` |
| `achLoading` | `achievements === null \|\| achievementsLoadingMore` |
| `games` | `ALL_GAMES` |
| `gameAwards` | `PROFILE_DATA.gameAwards` (needs the raw `awardedAt` field added in `transform.js`) |
| `heatmapData` | the same memo the Activity tab uses |

### Streaks and pace (`StatLine`, index lines in `.stat-lines`, two columns from md)

| Line | Derived from |
|---|---|
| Current streak | `heatmapData` day keys. Counts back from today; a quiet today starts the count at yesterday rather than breaking the streak |
| Longest streak | Longest consecutive run in the loaded window |
| Active days | Days with any unlock in the last 90 |
| Points this month | This calendar month's points vs the median of the other months in the window |

Day keys are local (`YYYY-MM-DD`) but parsed as UTC (`T00:00:00Z`) for arithmetic, so run
lengths stay exact across DST boundaries.

### Cards (`StatCard`)

- **Point acquisition** (`PointAcquisitionChart`) — points per **week** as columns with a 4-week
  trailing mean as a 2px line overlay. ~52 columns over the loaded window; weeks start Monday and
  quiet weeks are filled so the axis is real time. Too many columns to label individually, so the
  x-axis ticks the first week of each month. **Both series are points-per-month and share one axis.**
  A cumulative line here would need a second y-scale; dual-axis plots invent a correlation that
  isn't in the data, so the trend is a rolling mean instead. The oldest bucket is dropped because
  the 364-day fetch window clips it. The line starts at the fourth retained week, where a true
  4-week mean first exists.
  Bars are capped at 24px and centred inside full-width bands, so column centres line up with the
  line's percentage geometry — capping the *band* instead misaligns the two series. The line is a
  stretched `viewBox="0 0 100 100"` SVG with `vectorEffect="non-scaling-stroke"` (stays 2px at any
  width); the end marker is a div, so it stays circular while the SVG is stretched. Hovering a
  column band dims the others and swaps the legend row for a readout. Only the peak column carries
  a direct label.
- **Mastery timeline** — lifetime, bucketed by month from `gameAwards[].awardedAt`. Mastery and
  Beaten stack in one column with a 2px surface gap, using the same gold/silver the Consoles card
  does. Hovering a column dims the others and swaps
  the legend row for a readout, matching the acquisition chart (`tlHover` state, keyed by month). Empty months are filled, short histories pad back to a 24-month
  span, and the axis always runs to the current month so a drought is visible. Columns are
  `flex: 1 1 0` with `minWidth: 10px` / `maxWidth: 22px` — they fill the card on desktop and
  overflow into a horizontal scroll on mobile, auto-scrolled to the right edge on mount (same
  `requestAnimationFrame` trick as the heatmap).
- **Consoles** (`StackedBarRow`) — **everything is counted in games.** Bar length is games played
  on that console (relative to the console with the most), split into **1–3 segments** ordered
  **in progress (`#66c0f4`) → beaten (silver `#b8c4ce`) → mastered (gold)**. Mastered wins over
  beaten, so a game is never counted twice. The mastered/beaten counts printed beside the bar are
  the same numbers the segments encode.

  **In progress is deliberately first.** A stacked bar is only precisely comparable across rows for
  the segment anchored at the baseline; everything after it floats. Only 3 of 12 consoles have a
  mastered game, so a mastered-first order left nine bars starting on a different colour and
  nothing comparable at the baseline — every row has in-progress games, so blue anchors all of
  them. Left-to-right then reads as the progression, gold terminating the bar, matching the
  blue-to-gold progress bars elsewhere in the app. **The legend follows the segment order**; if one
  changes, change the other.

  Segments were briefly weighted by *achievements earned in* mastered/beaten games, which was
  coherent arithmetic but read as broken: one 80-achievement mastery filled 83% of a PSP bar
  labelled "1 mastered". Keep both the length and the segments in one unit.

  Rows sort by games played; top 10, remainder rolled into one "N more systems" row that sums
  every segment. Achievements unlocked is no longer encoded on this card.
- **Rarity profile** — unlocks banded by `trueRatio / points`, RA's own difficulty weighting.
  Bands: Common `<1.5`, Uncommon `<3`, Rare `<6`, Very rare `<12`, Ultra rare above. Achievements
  with no points or no `trueRatio` are skipped.

  Rarity has **its own palette**, not the generic accents and not a single-hue ramp:

  | Band | Colour |
  |---|---|
  | Common | `#8f98a0` grey |
  | Uncommon | `#66c0f4` blue — the app's bar blue exactly |
  | Rare | `#e8813c` orange |
  | Very rare | `#f5e08f` pale yellow |
  | Ultra rare | `#c94040` deep red |

  The three warm tiers are hue-wheel neighbours, so they are separated by **lightness**, not hue.
  At comparable saturation they measure ΔE 8–11 against each other and collapse entirely under
  red-green CVD; spread across lightness they clear it (CVD ΔE 12.4 deutan, contrast all ≥ 3:1).
  The shades are also pulled away from meanings the app already owns — `#f5e08f` is far from the
  `#e5b143` gold that means *mastered*, and `#c94040` is far from the `#ff6b6b` that means *error*.

  Nothing in this palette encodes the order; the labels, counts and percentages do. The one
  sub-floor pair is grey↔blue at ΔE 13.9; the Consoles card has a similar close pair (silver↔blue)
  mitigated the same way. Kept in sync with the game page's `DIFFICULTY_BANDS` — same ladder.

Charts are hand-rolled divs (plus one stretched SVG for the trend line) — no chart library,
consistent with the heatmap.

Chart palettes are checked with the `dataviz` skill's `scripts/validate_palette.js` against the
`#1b2838` card surface before shipping. The award segments use the repo's status colors unchanged;
silver `#b8c4ce`↔`#66c0f4` is a close pair (ΔE2000 15.5, not yet re-run through the validator), so every segment carries its own
count and icon as secondary encoding — see `docs/rules.md`. The app's `#66c0f4` / `#e5b143` accents sit outside the
validator's dark lightness band but pass CVD separation, normal-vision separation and contrast by
wide margins; they are kept for design-system consistency. Ordered scales must use the validated
single-hue ramp rather than a set of accent hues.

## Heatmap

Computed via `useMemo` from `achievementChunks`. Format: `{ "YYYY-MM-DD": { count, points } }`. No separate file.

## Game Achievement Modal

> Rendered as a sheet (`useSheet` from `assets/sheet.js`: bottom sheet below md, dialog from md; drag/backdrop/✕/Escape close) with the game art blurred behind its header. **Nothing calls `openGameDetails` today** — game cards and tiles link to the game page — so the modal is currently unreachable.

`openGameDetails(game)` flow:
1. `setSelectedGame(game)` immediately — modal opens with shimmer
2. If `game.achievements` is empty → fetch `API_GetGameInfoAndUserProgress`
3. Update `gamesData.detailedGameProgress[gameId]` → `rawData` memo recomputes → `transformData` re-runs → modal receives enriched game via `ALL_GAMES.find(g => g.id === selectedGame.id)`
4. `loadingGameDetailId === selectedGame.id` controls shimmer skeleton

## Compare Modal

- Shows side-by-side completion progress between the authed user and another user.
- Rendered as a sheet (`sheet-panel wide`): bottom sheet on phones covering the nav, centred dialog from md; closes by dragging the header down, backdrop, ✕ or Escape.
- Leading side (higher %) gets an `accent`-tinted highlight on a 120×py-2.5 cell; trailing side is transparent.
- Divider between cells: `w-px self-stretch bg-line`.

## Visitor Mode

Triggered by `?u=<username>` query param. `isVisitorMode = !!targetUser`.

- `fetchProfile(creds.username, creds.apiKey, targetUser)` fetches the target user's data.
- Valid tabs restricted to `['overview', 'recent', 'progress']` — backlog, activity, social and stats are disabled.
- Topbar breadcrumb shows visited username instead of "Log out" button.
- `document.title` updates to the visited user's username.

Link to visitor mode: `./profile/?u=<username>` (from within the app) or `../profile/?u=<username>` (from other pages).

## Topbar

Right side: **Log out** button (own profile) or username breadcrumb (visitor mode).

## Mobile

### Tab bar

The same sticky `TabBar` as desktop, pinned under the status bar (`top: env(safe-area-inset-top)`); swipe between tabs with `useSwipeTabs`. There is no floating pill and the header shows on every tab.

### Bottom nav

`assets/mobile-nav.js` links pages: Profile, Search, Consoles, Changelog, Menu (refresh, purge, debug, log out).

### User stats

`statsRight` is behind **More stats** on every screen size (`statsExpanded`).

### Backlog

An index, not Savepoint's watchlist rows. **Up next** (`.bnext`) comes first when no search or status filter is on: the started games as the Dex's own cards (`DexEntry`, fed through `asDex()`), closest to done first, in a row that scrolls; at most 12, then a "+N more started" card that switches to the In progress chip. Then every game as an **index line** (`.bline`): the icon (faded until the game is started, ringed blue once it is, ringed gold and glowing when mastered), the title + subset / tilde tags, under it the dex number and the set's size, and on the right the count and the completion ring (`.dring`, the same as every game row) when started, a solid gold star Mastered tag (the same as a mastered dex card), the points on offer when not started, or "No set". Inside each volume the games sit under **index letters** (`.blet`: # first, then A to Z, the letter in the gutter in the pixel face), and the volume header carries a thin bar of how much of that console is started (blue) or mastered (gold) (`.bvol-bar`). They come in **console volumes** (`.dvol`, shared with the Dex's By console view: biggest first, sticky header with the count and how many are started, titles A to Z inside), two columns from md (`.bvol`, CSS columns). A jump list of consoles sits above the volumes. Subsets hang under their base game as one-row gold lines on a thin connector (`stackSubsets()`), and a game never splits from its subsets across columns (`.bgrp`). Filters: search (titles, subset names, tags or a dex number), status chips with counts, a meta line with the sync time and Refresh. Lines are render functions, not components (as components React would remount every line on each re-render).

### Header layout

See **Header** above: identity block and numbers stack on phones (`.phead-in` column), side by side from md.
