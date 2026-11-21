# Consoles Page

**File:** `console/app.js`  
**URL:** `/console/` · `?id=<consoleId>` (one console) · `?q=<query>` (search) · `?group=era` · `?ach=all|with|without`  
**Auth required:** Yes

Every console and its games, and one search over all of them. It replaced the Search page: `/search/` redirects here with its query (`search/index.html`).

## Data

- `fetchConsoles()`: the console list (names, icons; cached a day). No game counts: RA's console list has none, so a console's count is known once its game list is saved
- `getAllGamesFromDB()`: what this device has saved, grouped into `catalog` (`{ [consoleId]: games[] }`; a console counts as saved once its `consoles` row has `fetchedAt`)
- `fetchCompletionMap()`: your progress per game (rings on rows, the console's coverage). A failure leaves them out; only `AUTH_ERROR` signs out

## Loading the catalog

One console at a time, 1 s apart (RA's rate limit), through `fetchConsoleGames(…, forceRefresh, onProgress)`; `onProgress(gamesSoFar)` fires after each page of 500.

- `enqueue(ids, { force, first })` adds to `queueRef`; `run()` works through it. Each console's state (`stateOf`): loaded (its count), loading (games so far), queued, failed, not loaded
- Main view: **Load every console / Load the other N** (not yet saved) or **Refresh all** (everything again); a console view: **Refresh** (that console)
- Opening a console that isn't saved puts it first in the queue
- While anything loads: a box under the search field (so loading never moves the field): a spinner, the console loading and its games so far (no bar: a console's total isn't known until its last page), and **Stop**. With several asked for (`batch`), also "3 of 54" and a plain solid bar of consoles done. Each card / rail row shows its own state: a spinner while loading, a clock while waiting. No sliding lines or gradients
- Once every console is saved, `markAllGamesFullFetch()` stamps the full fetch

## Header

One frame for both views, so moving between All consoles and a console only changes its contents:

1. **Crumb row**: Consoles › **All consoles** or the console's name, a picker (All consoles, then every console with its count; closes on an outside tap or Escape). On desktop the rail does the switching once you are in a console or a search; on the main view, which has no rail, the picker works there too
2. **Title row**: an icon box (the stacked icon for All consoles, the console's icon), the name, a subline (games · consoles saved, or games · with sets / the load state), one button on the right (Load every console / Load the other N / Refresh all; a console: Refresh)
3. **Ring panel**: All consoles: the share of consoles saved, Consoles saved and Games saved; a console: your coverage (sets played of the sets with achievements, Mastered; `–` until it is known)

The title row and panel fade when the view changes (`key` on the console).

## Views

- **Main view** (`?id` absent, no query): the header, the search field, Group by Maker / Generation, then the console **cards** in groups: icon, name, state line (count, games so far, Waiting its turn, Not saved, Didn't load) and an action at the card's right edge (`CardAction`: a download button when not saved, retry when failed, a spinner, a clock)
- **A console** (`?id=`): the header, the search scoped to it, the Achievements chips, its games
- **Search** (a query, from either view): matches over every saved game (main view, each row naming its console, the count saying "in N of M consoles" while some aren't saved) or only the open console's
- **Rail** (md and up, in a console or a search): All consoles (games saved) and every console by group with its count or state, the open one marked; it scrolls the open one into view. Phones: the cards and the picker instead

## Search

`assets/match.js` (shared with the command palette): typo-tolerant word matching in a Web Worker (`makeSearcher`), built over every saved game when there is a query, and again when the catalog grows. The field is instant; the search runs once typing pauses (160 ms). Results: the search's order, your games first among equals (`completion`), then shorter titles. 60 rows, then **Show more**.

**Achievements chips** (With achievements, All games, Without): your pick (`?ach=`) stays until you change it; untouched, they show **All games while searching** (you are after one game; a hidden match is worse than extra rows) and **With achievements while browsing** a console's list (games without a set are mostly noise there).

## Game rows

Icon, title with Subset / tilde tags (and the subset's name), dex number, the console (across consoles), achievements and points (or "No achievements"); your count and ring when you've played it. Link to `/game/?id=`.
