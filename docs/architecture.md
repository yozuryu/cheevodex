# Architecture

## Stack

| Layer | Technology | Constraints |
|---|---|---|
| UI framework | React 18.2 via CDN (esm.sh) | No build step. JSX transpiled in-browser by Babel standalone. |
| Styling | Tailwind CSS via CDN | Arbitrary values allowed: `text-[11px]`, `w-[140px]`. |
| Icons | Lucide React 0.263.1 via CDN | Fixed version — do not upgrade without checking breaking changes. |
| Hosting | GitHub Pages | Static files only. No server-side rendering, no backend. |
| JS module format | Native ES modules | `type="module"` in HTML. No bundler. |

## Directory Layout

```
cheevodex/
├── index.html          # Login page
├── login.js            # Login React app
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── changelog.md        # Source of truth for changelog page
│
├── assets/
│   ├── tokens.css      # Design tokens: every colour (--NAME / --c-NAME) + font stacks (decision-008)
│   ├── tw-config.js    # Tailwind CDN config: token names as utility colours, Geist font families
│   ├── ui.css          # Shared component CSS: headings, sheet, tabs, tiles, page header, brand
│   ├── motion.css      # Cross-page view transitions + .anim-* helpers (from Savepoint)
│   ├── sheet.js        # useSheet / useArtSrc / ArtBg — bottom sheet below md, dialog from md
│   ├── tabs.js         # TabBar (sliding underline) + useSwipeTabs (phone swipe between tabs)
│   ├── game-view.js    # useGameView — list / tiles choice, remembered per device; shortAgo
│   ├── completions.js  # CompletionsPanel — Overview game awards (from Savepoint)
│   ├── activity-ui.js  # Activity summary, sticky day headings, unlock rows (from Savepoint, reworked)
│   ├── time.js         # Timezone-aware date helpers: dayKey, addDays, fmtClock… (from Savepoint)
│   ├── mobile-nav.js   # Shared bottom nav IIFE (mobile only, < 768px)
│   ├── pwa-install.js  # Install banner
│   ├── update-notice.js # New-edition notice (new version published → Reload)
│   ├── palette.js      # Command palette: one search over the data saved on this device (⌘K / Ctrl+K / '/')
│   └── ui.js           # Shared Topbar (Cheevodex brand, desktop page links, ☰ menu) + Footer (React.createElement, no JSX)
│
├── social/             # Social: friends' unlocks, following / followers, Compare (docs/pages/social.md)
│   ├── index.html
│   └── app.js
│
├── profile/            # Main profile page (also visitor mode via ?u=<username>)
│   ├── index.html
│   ├── app.js          # ~4090 LOC React app
│   └── utils/          # Shared utilities — used by ALL pages
│       ├── ra-api.js   # RA API client (two-layer: raw wrappers + app composites)
│       ├── constants.js
│       ├── helpers.js
│       └── transform.js
│
├── game/               # Game detail page (?id=<gameId>)
├── achievement/        # Achievement detail page (?id=<achievementId>)
├── console/            # Console list + per-console game list (?id=<consoleId>)
├── search/             # Cross-console game search, backed by the IDB catalog
└── changelog/          # Changelog viewer page
```

There is no `user/` directory — visitor mode is the profile page with `?u=<username>`.
The `settings/` page was removed when its actions moved into the mobile menu sheet
(`assets/mobile-nav.js`); the empty directory is a leftover.

Each page directory contains `index.html` + `app.js`. No shared component files — each `app.js` is self-contained.

## Shared Utilities

All pages import from `profile/utils/` using relative paths:

```js
import { MEDIA_URL, SITE_URL } from '../profile/utils/constants.js';
import { getMediaUrl, parseTitle, formatDate, formatTimeAgo } from '../profile/utils/helpers.js';
import { getCredentials, clearCredentials, fetchProfile, ... } from '../profile/utils/ra-api.js';
```

`assets/ui.js` exports `Topbar` and `Footer`. It uses `React.createElement` (not JSX) because it is not transpiled by Babel. The same holds for `assets/sheet.js`, `assets/tabs.js`, `assets/game-view.js`, `assets/completions.js`, `assets/activity-ui.js` and `assets/time.js`: native ES modules that import `react` through the page's import map. The Topbar's first crumb always renders the brand (codex mark + "Cheevo**dex**" wordmark); the Footer always carries the "Unofficial. Not affiliated with RetroAchievements." line.

Every page `<head>` loads, in order: Tailwind CDN → `tw-config.js` → `tokens.css` → `ui.css` → `motion.css` → Geist / Geist Mono / Silkscreen from Google Fonts.

### `constants.js`

| Export | Value |
|---|---|
| `MEDIA_URL` | `https://media.retroachievements.org` |
| `SITE_URL` | `https://retroachievements.org` |
| `TILDE_TAG_COLORS` | Map of tag name → `{ bg, border, color }` (Homebrew, Demo, Prototype, Hack) |

### `helpers.js`

Pure utility functions — no API calls, no state.

| Function | Signature | Purpose |
|---|---|---|
| `getMediaUrl(path)` | `(string) → string` | Prepends `MEDIA_URL` to an RA image path |
| `formatTimeAgo(date, refTime)` | `(Date, Date?) → string` | Human-readable relative time ("3 days ago") |
| `formatDate(date)` | `(Date) → string` | Short formatted date string |
| `parseTitle(title)` | `(string) → { baseTitle, subsetName, isSubset, tags }` | Strips `~Tag~` prefixes into `tags[]` and splits `[Subset - Name]` suffixes |

### `ra-api.js` — App Composites

Full endpoint reference: [`profile/utils/ra-api.md`](../profile/utils/ra-api.md)

The only functions `app.js` calls directly (Layer 2). `CACHE_TTL` is **1 minute** — the
`sessionStorage`-backed composites use it; IDB- and localStorage-backed ones carry their own TTL.

| Function | Cache key | What it does |
|---|---|---|
| `fetchProfile(u, k)` | `ra_profile_{u}` | 5 parallel requests on mount; returns `{ profileData, firstChunkAchievements }` |
| `fetchAchievementsChunk(u, k, idx)` | `ra_chunk_{u}_{idx}` | 6-month achievement window by index (0 = latest) |
| `fetchWatchlist(u, k)` | `ra_watchlist_{u}` | Full want-to-play list, all pages |
| `fetchGameDetails(u, k, gameId)` | `ra_game_{u}_{gameId}` | Game metadata + per-achievement user progress incl. `userTotalPlaytime` |
| `fetchSocial(u, k)` | `ra_social_{u}` (localStorage, 1h) | Following + followers lists |
| `fetchCompletionMap(u, k)` | `ra_completion_{u}` (localStorage, 1h) | `{ [gameId]: { numAwarded, maxPossible, award } }` for every game the user has touched |
| `fetchFriendsActivity(u, k, followingList, { onProgress, onUser, onError })` | `ra_fa_{friendUser}` per user (localStorage, append) | 30-day window via 10-day chunks. No cache → full 3-chunk fetch. Fresh (<1h) → instant serve. Stale (≥1h) → serve stale immediately then incremental delta (≤10d=1 call, ≤20d=2, ≤30d=3, >30d=full refresh). 300ms between chunks, 1000ms between users (only when API called). |
| `allFriendsCached(followingList)` | — | Returns true if every user has any `ra_fa_*` entry (fresh or stale); stale entries are still served immediately then updated incrementally |
| `fetchAllAchievements(u, k, { onPartial })` | IDB `progress` store + `progress_ts_{u}` | Last ~12 months of unlocks as two 182-day chunks; `onPartial` fires after chunk 0 |
| `fetchBacklog(u, k, onPartial)` | IDB `backlog` store, 24h | Full want-to-play list, all pages |
| `fetchConsoles(u, k)` | `ra_consoles` (localStorage, 24h) | Active game systems, alphabetical |
| `fetchConsoleGames(u, k, consoleId)` | IDB `games`/`consoles` stores, 24h | Full game list for one console |
| `getAllGamesFromDB()` | IDB, no fetch | Whole cached catalog — powers the search page |
| `validateCredentials(u, k)` | — | Minimal profile call; throws `AUTH_ERROR` if invalid |

### `profileData` shape

Returned by `fetchProfile`, consumed by `transformData`.

```
{
  metadata:              { extractionTimestamp }
  coreProfile:           { user, userPic, memberSince, richPresenceMsg, totalPoints,
                           totalSoftcorePoints, totalTruePoints, motto }
  userSummary:           { rank, totalRanked, softcoreRank, status, lastActivity }
  gameAwardsAndProgress: { total, results: [{ gameId, title, consoleName, imageIcon,
                           numAwarded, numAwardedHardcore, maxPossible,
                           highestAwardKind, highestAwardDate, mostRecentAwardedDate }] }
  pageAwards:            { visibleUserAwards: [{ awardType, imageIcon, awardData,
                           title, consoleName, awardedAt }] }
  recentlyPlayedGames:   [{ gameId, title, consoleName, lastPlayed, imageIcon,
                           imageIngame, imageTitle, numAchieved, numPossibleAchievements }]
  mostRecentGame:        { gameId, title, consoleName, lastPlayed, imageIcon } | null
  mostRecentAchievement: { achievementId, title, description, points, trueRatio,
                           badgeName, hardcoreMode, gameId, gameTitle, gameIcon,
                           consoleName, date } | null
  points7Days:           number
  points30Days:          number
}
```

### `rawData` memo shape

Assembled in `profile/app.js`, passed to `transformData()` → `{ profile, games, backlog }`.

```
rawData = {
  ...profileData,          // from fetchProfile()
  wantToPlayList,          // backlogData — null until the Backlog tab opens
  recentAchievements: [],  // not used directly — achievements handled via achievementChunks
  detailedGameProgress,    // lazy-populated per game via fetchGameDetails()
}
```

Do not bypass `transformData`. All derived fields (progress %, mastery status, subset parsing) live in `transform.js`.

## Data Flow

```
RA API (live)
    ↓  ra-api.js (raw wrappers → camelCase)
    ↓  ra-api.js (app composites → sessionStorage cache, CACHE_TTL = 1 min)
    ↓  app.js useState / useMemo (rawData)
    ↓  transform.js (transformData → { profile, games, backlog })
    ↓  React components
```

- Raw RA API responses are PascalCase (`GameID`, `NumAwarded`). `ra-api.js` maps everything to camelCase before returning.
- Do not read raw API fields in `app.js`. Call exported composites only.
- `transform.js` is the single merge point. Do not build derived UI state from raw API data directly.

## Caching Strategy

| Store | TTL | What is cached |
|---|---|---|
| `sessionStorage` | 1 min (`CACHE_TTL`) | Profile data, game details, watchlist (`ra_*` keys) |
| `localStorage` | 1 hour | Social data (following/followers, `ra_social_*`) |
| `localStorage` | 1 hour | Completion map for the console coverage strip (`ra_completion_{username}`) |
| `localStorage` | append (1h freshness) | Per-friend activity (`ra_fa_{username}`): served instantly if any cache exists; incremental delta fetched when stale; full refresh only when missing or delta >30d |
| `sessionStorage` | 5 min | Per-friend game data on game page (`ra_fg_*`) |

Bust cache: `sessionStorage.clear()` for session data, `localStorage.removeItem(key)` for social.

## Auth

- Credentials stored in `localStorage` as `raCredentials = { username, apiKey }`.
- Every page calls `getCredentials()` on mount. Null → `handleAuthError()` → clear localStorage → redirect to `/`.
- Any API call returning `AUTH_ERROR` also triggers `handleAuthError()`.
- `validateCredentials(u, k)` is the only function used before credentials are stored (login flow).

## README images

`scripts/posters.js` (dev only, Puppeteer in `scripts/`) composes the README posters in `docs/images/` from the screenshots in `docs/images/shots/`; `--capture` signs in to a running copy (`RA_USERNAME`, `RA_API_KEY`, `APP_URL`) and retakes them first.

## Search engines

- The sign-in page (`index.html`) carries the title, description, canonical and Open Graph tags, using the website's share image; it links to the website (yozuryu.github.io/cheevodex-site), which holds the full SEO head and sitemap.
- Pages behind sign-in (profile, game, achievement, console, search) carry `<meta name="robots" content="noindex">`: without an account they render nothing.
- The domain root's `robots.txt` (root site repo) lists the website's sitemap.

## Command palette

`assets/palette.js` (ES module, no JSX; loaded by `mobile-nav.js` on every page with the nav, its own React root). One search over **what this device has already saved**, never the network: `getLocalSearchData(username)` in `ra-api.js` reads the IDB catalog (`games` / `consoles`), your unlocks (`progress`), your backlog, following / followers (`friend_list`), their profiles (`social_profiles`), friends' unlocks (`friend_activity`) and the completion map, without expiry.

- **Opens** from the bottom bar's middle Search button, the desktop top bar's field, ⌘K (Mac) / Ctrl+K (elsewhere; the page takes it before the browser's own search box), or `/` when not typing in a field; `window.dispatchEvent(new Event('cdx:palette'))` from code. Phones: full screen, field on top; md+: centred, 640px, with a footer of keys and what is saved
- **Results** in groups ordered by their best match: Games (your games first with count and ring, Backlog tagged, then the catalog; a number or `No.123` opens that Dex No.), Players (you, following, followers), Go to (pages). Nothing typed: Recent (what was opened from the palette, `cdx:paletteRecent`, six) and Go to. **See all results** opens `search/?q=`
- **Speed**: the field is instant; the search runs once typing pauses (`DEBOUNCE_MS`, 140 ms; the first letter and clearing at once), in a **Web Worker** built from the matcher's own functions (`makeSearcher`: the saved names go to it once per open, then one query at a time; an answer for an outdated query is dropped; without workers it runs on the page). The last finished results stay on screen while a newer search runs; a blue line slides along the field's bottom edge while the data loads or a search is on its way, and shimmer rows show only when you type before the saved data is read. Enter before the results catch up opens the top one once they do. On 30,000 titles a search takes ~3 ms clean, ~20 ms with the typo pass (Node; 228 ms before)
- **Matching** (`match()`): word based. Every typed word must match a word of the name, from its start, inside it (3+ letters), or within a typo (Damerau–Levenshtein: one from 4 letters, two from 7); numbers exactly; one typed word of 2–5 letters may be the title's initials (ff, kh, smt). Fewer extra words rank higher; your games and Backlog get a boost. Typo-only matches show only when nothing matches without one, so the typo pass runs only when the clean pass finds nothing; it skips words sharing neither of the first two letters (nor their swap) and gives up on a word once it is over the typo budget
- **Not saved yet** (gold rows that open the page that loads it): the catalog missing or partial (`N of M consoles`, from the `consoles` store's `fetchedAt`) → Search; friends missing → Social. Shown with nothing typed (above Go to), under an empty result, and after game results while the catalog is incomplete

## PWA / Service Worker

- Cache-first for same-origin static assets.
- Network-first for `changelog.md` (always fresh).
- Every code change bumps `CACHE_NAME`, so the browser installs the new worker; it takes over open pages at once (`skipWaiting` + `clients.claim`) and deletes the old cache. Install precaches with `cache: 'reload'`, past GitHub Pages' 10-minute HTTP cache, so a worker installed right after a deploy stores the new files.
- **New-edition notice** (`assets/update-notice.js`, loaded by `mobile-nav.js`): on that takeover (`controllerchange`, only when a worker already controlled the page) a card slides up above the bottom nav: blue diamond, "A new edition of the dex", the newest changelog version (Geist Mono), Reload (a plain reload: the cache is already fresh) and × (hidden until the page reloads). The page calls `registration.update()` when it comes back to the foreground (at most once a minute) and every 30 minutes. The menu's Refresh stays
- Cross-origin RA API requests pass through untouched.
- Icons: `icon-192/512.png` (`purpose: any`, the mark at full size) and `icon-maskable-192/512.png` (`purpose: maskable`, the mark at 56% of the width so Android's circle crop, 80% wide, never cuts it). Never mark a full-bleed icon `maskable`.

## Mobile Nav

`assets/mobile-nav.js` is an IIFE injected via `<script>`. On screens < 768px it:
- Hides `.page-topbar` and `footer`
- Adds `padding-bottom` to body
- Repositions `.scroll-top-btn` above the nav bar

Six nav slots: Profile, Progress, Activity, Backlog, Social, Menu. The bar is full — a seventh
slot makes the 8px labels unreadable at 360px, so new destinations go in the Menu sheet instead.

The Menu sheet (slide-up, opened from the Menu slot) holds: Stats (`/profile/?tab=stats`),
Consoles, Search, Changelog, Refresh Data, Purge Cache, Debug Mode, Log Out.
