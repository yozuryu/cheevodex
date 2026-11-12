---
id: decision-009
title: Cheevodex URL — Rename the Repo, Redirect the Old Path
date: '2026-11-12 17:08'
status: accepted
---
## Context

The app was renamed from Cheevo Tracker to Cheevodex (doc-012). It was served as a GitHub Pages project site at `yozuryu.github.io/cheevo-tracker/`. The options were to keep that URL, rename the repo (and so the path), or move to a custom domain alongside the planned promo site.

Bambang renamed the GitHub repo to `cheevodex` on 2026-11-12, so the app is now at `yozuryu.github.io/cheevodex/` and the old path returned GitHub's 404.

## Decision

- **Rename the repo; keep github.io for now.** A custom domain can come later with the promo site.
- **Redirect the old path from the root site.** With no repo named `cheevo-tracker`, every request under `/cheevo-tracker/` is served by the user site's `404.html` (repo `yozuryu.github.io`). A script at the top of that page replaces `/cheevo-tracker` with `/cheevodex` and keeps the rest of the path, the query string and the hash, so bookmarks and shared links land on the same page.
- **Storage names.** The origin (`yozuryu.github.io`) is unchanged, so `localStorage` credentials (`raCredentials`) carry over. The IndexedDB cache was renamed from `cheevo_tracker` to `cheevodex` afterwards (same day); the app deletes the old database on first open and refetches, which costs one download and loses nothing the user made.

## Consequences

- **Good:** every old link, including `?u=` and `?tab=` URLs, keeps working with one small script and no stub pages.
- **Good:** an installed PWA on the old scope checks `/cheevo-tracker/sw.js` on its next update, gets a 404, and the browser unregisters that worker; the app then follows the redirect to the new address and still finds its login.
- **Bad:** the installed app's scope is still the old path, so after the redirect it shows the browser's out-of-scope bar until the user reinstalls from `/cheevodex/`.
- **Bad:** the redirect lives in another repo; renaming again means editing `yozuryu.github.io/404.html` too.
