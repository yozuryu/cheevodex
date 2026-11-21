# Social Page

`social/` (`social/app.js`, one React app like every page). Your friends' unlocks and the people you follow / who follow you. It used to be the profile's Social tab plus the Activity tab's Friends view; the profile redirects old links here.

## Layout

| Screen | Layout |
|---|---|
| Phone (< md) | Heading **Social** with the current part's sync time and controls; chips **Unlocks · Following N · Followers N** (`?view=`, absent = unlocks); the chosen part below |
| md and up | Two columns: **Friends' unlocks** (feed) beside a 400px **People** rail (Following / Followers chips and the A–Z / Points sort, which sits on the right as one unit and drops to its own line rather than splitting) |

`useWide()` (`matchMedia('(min-width: 768px)')`) picks the layout; on phones `SocialTab` gets `subTab` from the page chips and `hideTabs`.

## Data

| Part | Source | Cache |
|---|---|---|
| Following / followers | `fetchSocial()` (`API_GetUsersIFollow` + `API_GetUsersFollowingMe`) | IDB, a day; Refresh forces it |
| People's pictures, last played, rich presence | `fetchAndCacheSocialProfiles()` (`API_GetUserSummary` per person, 1 s apart) | IDB, an hour (`PROFILE_SYNC_TTL`) |
| Friends' unlocks | `fetchFriendsActivity()` (`API_GetAchievementsEarnedBetween`, last 30 days in three windows, one friend at a time), started once the following list is in | IDB per friend, an hour; Refresh marks them stale, Reset clears them |
| Compare | `getUserCompletionProgress()` for you and for them, in parallel, when it opens | none |

## Feed (`FriendsFeed`)

- Runs: each friend's unlocks in one game, split where more than an hour passes between two
- `party`: the friends in the feed with their unlocks and last active, newest first: the strip on top (`.fstrip` / `.fpal`, Everyone first). Tapping one narrows the feed and shows a Profile link
- Days: runs (first 100, then Show more days) grouped by local day, a friend's consecutive runs as one `FriendPost` (avatar node, name, time, "+N in N games") on the day's rail (`.fposts`), under a `DayHead` (unlocks · friends)
- `FriendRun`: `RunStrip` (icon, title with Subset / tilde tags, subset name, mode icon, dex number, console, time range; +N and points) linking to the game in compare mode, then up to 10 badges (7 on phones, gold edge for hardcore) that open to the full unlock rows
- Colours: `friendColor(username)` (hue, saturation and lightness from a hash of the name, within readable bounds; `--fc`) for each friend's ring and name; the run's edge and wash are its mode (gold hardcore, grey softcore, split mixed)
- States: skeleton (`FriendsSkeleton`) while loading, an error box with Try again, "You're not following anyone yet", and one quiet line naming friends whose fetch failed

## People (`SocialTab`, `SocialUserRow`) and Compare (`CompareModal`)

Rows: avatar (green dot when active in the last hour), name in gold, ⇄ for a mutual follow, last played game and time (within a week) or "Last active", rich presence, points (softcore players' softcore points in grey), and **Compare**. Compare is a sheet: index lines (Shared, You ahead, Tied, They're ahead), a sort (Biggest gap, Mine, Theirs, A–Z), and one row per shared game with both players' rings.

## Navigation

The bottom bar's Social and the desktop top bar's Social link here (lit on this page).
