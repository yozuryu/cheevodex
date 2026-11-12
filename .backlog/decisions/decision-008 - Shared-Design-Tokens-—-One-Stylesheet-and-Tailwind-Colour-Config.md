---
id: decision-008
title: Shared Design Tokens — One Stylesheet and Tailwind Colour Config
date: '2026-11-12 15:54'
status: accepted
---
## Context

Until now every colour was a literal: about 1,900 hex values spread over each page's `app.js`, `index.html`, `assets/ui.js`, `assets/mobile-nav.js` and `assets/pwa-install.js`, mostly as Tailwind arbitrary classes (`text-[#c6d4df]`). The "No CSS files" rule kept the site build-free, but it also meant a palette change was a search-and-replace across the whole repo with no way to check it was complete.

The Cheevodex redesign (doc-012) changes the palette, the type and several components. Savepoint, the sibling project, already dropped the same rule and ships `assets/ui.css` without a build step.

## Decision

Two shared files define every colour, and nothing else does:

- **`assets/tokens.css`** declares each token twice on `:root`: `--c-NAME` as space-separated RGB channels (for alpha, `rgb(var(--c-gold) / 0.3)`) and `--NAME` as the solid colour (`var(--gold)`, for inline styles, SVG attributes and CSS-in-JS).
- **`assets/tw-config.js`** sets `tailwind.config` for the Tailwind CDN, mapping every token name to `rgb(var(--c-NAME) / <alpha-value>)`, so utilities read `text-gold`, `bg-box/60`, `border-l-accent`.

Every page loads both right after the Tailwind CDN script. Code references token names only; a colour that has no token gets one in `tokens.css` first.

Plain CSS files are now allowed in `assets/` for shared component styles that Tailwind classes express badly (sheets, tab underlines, view transitions). They are still static files with no build step, consistent with decision-001.

## Consequences

- **Good:** a restyle is a change to `tokens.css` values, and a grep for `#` proves nothing bypasses it.
- **Good:** colour names carry meaning (`gold` = earned, `accent` = structure), which the docs and reviews can refer to.
- **Good:** Savepoint components (`sheet`, `tabs`, `motion`) can be ported with their stylesheets instead of being rewritten as class strings.
- **Bad:** colours computed in JS can no longer append hex alpha (`${color}40`); they use `color-mix(in srgb, ${color} 25%, transparent)` instead.
- **Bad:** `<meta name="theme-color">` and `manifest.json` cannot read CSS variables, so those keep literal values and must be updated by hand with the palette.
- **Bad:** a page that forgets to load `tokens.css` renders without colours; the new-page skill template includes both lines.
