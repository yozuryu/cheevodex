---
name: new-page
description: Scaffold a new page in the cheevodex project. Use this skill whenever the user asks to create a new page, add a new route, or build a new section of the app (e.g. "add a leaderboard page", "create a user stats page", "build a new page for X"). The skill generates the exact index.html + app.js boilerplate with all required CDN versions, auth pattern, mobile rules, and shared imports — avoiding the many easy mistakes when setting these up by hand.
---

# Scaffold a New Page

## What you need from the user

Before writing any files, confirm:
1. **Page name** — used as the directory name (e.g. `leaderboard`, `stats`, `user`)
2. **Page title** — shown in `<title>` (e.g. `Cheevodex · Leaderboard`)
3. **Needs auth?** — almost always yes; only skip for fully public pages
4. **Rough purpose** — so you can pre-fill the right Lucide icons and initial state shape

---

## Step 1 — Create the directory

```
<pagename>/
├── index.html
└── app.js
```

The directory goes at the project root alongside `profile/`, `game/`, `console/`, etc.

---

## Step 2 — Write `index.html`

Use this **exact** template. Do not change CDN versions — they are pinned intentionally.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="manifest" href="../manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Cheevodex · {{Page Title}}</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="../assets/tw-config.js"></script>
    <link rel="stylesheet" href="../assets/tokens.css">
    <link rel="stylesheet" href="../assets/ui.css">
    <link rel="stylesheet" href="../assets/motion.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Silkscreen&display=swap">

    <style>
        html, body { background-color: var(--page); margin: 0; padding: 0; font-family: var(--font); }

        @keyframes shimmer {
            0%   { background-position: -800px 0; }
            100% { background-position:  800px 0; }
        }
        .shimmer {
            background: linear-gradient(90deg, var(--box) 25%, var(--shimmer) 50%, var(--box) 75%);
            background-size: 800px 100%;
            animation: shimmer 1.6s infinite linear;
            border-radius: 2px;
        }
    </style>

    <script type="importmap">
    {
        "imports": {
            "react": "https://esm.sh/react@18.2.0",
            "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
            "lucide-react": "https://esm.sh/lucide-react@0.263.1"
        }
    }
    </script>

    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <link rel="icon" type="image/x-icon" href="../assets/favicon.ico">
    <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
    <link rel="apple-touch-icon" href="../assets/icon-192.png">
</head>
<body class="bg-page">
    <div id="root"></div>
    <script type="text/babel" data-type="module" src="./app.js"></script>
    <script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js');</script>
    <script src="../assets/mobile-nav.js"></script>
</body>
</html>
```

---

## Step 3 — Write `app.js`

Start from this skeleton and fill in the page-specific logic.

```js
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { /* Lucide icons */ } from 'lucide-react';
import { MEDIA_URL, SITE_URL } from '../profile/utils/constants.js';
import { getMediaUrl, parseTitle, formatTimeAgo } from '../profile/utils/helpers.js';
import { getCredentials, clearCredentials /* , other ra-api exports */ } from '../profile/utils/ra-api.js';
import { Topbar, Footer } from '../assets/ui.js';

function handleAuthError() {
  clearCredentials();
  window.location.replace('../');
}

function App() {
  const [creds, setCreds] = useState(null);
  const [loading, setLoading] = useState(true);
  // ... page state

  useEffect(() => {
    const c = getCredentials();
    if (!c) { handleAuthError(); return; }
    setCreds(c);
    // fetch data here
  }, []);

  if (!creds) return null;

  return (
    <div className="min-h-screen bg-page text-ink">
      <Topbar />
      <main className="max-w-4xl mx-auto px-4 md:px-8 pt-8 pb-5 md:pt-5">
        {/* page content */}
      </main>
      <Footer />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
```

### Auth rules
- Call `getCredentials()` on mount. If null → `handleAuthError()`.
- Wrap every API call in try/catch: `if (err.message === 'AUTH_ERROR') handleAuthError()`.

### Layout rules (apply to every page)
- Page header: `pt-8 pb-5 md:pt-5` — the extra `pt-8` compensates for the hidden Topbar on mobile.
- Content: `px-4 md:px-8` on the main container.
- Sticky bars that span edge-to-edge: `-mx-4 md:-mx-8`.
- Sticky top offset: `top-0 md:top-[26px]` — desktop Topbar is 26px tall.
- Scroll-to-top FAB: use class `scroll-top-btn` (mobile-nav.js repositions it above the nav bar).

### Section header pattern
```jsx
<div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3">
  <span className="sec-mark" />
  <span className="sec-t">Section title</span>
</div>
```
Blue diamond + blue sentence-case title with a fading underline (styles in `assets/ui.css`). Colours only from tokens (`docs/rules.md`): never write a hex.

### Mobile layout
- Single breakpoint: `md` = 768px.
- Column → row: `flex flex-col md:flex-row items-center md:items-start gap-5`
- Text alignment inside col/row headers: `text-center md:text-left`
- Desktop-only: `hidden md:block` / `hidden md:inline`
- Mobile-only: `block md:hidden`

---

## Step 4 — After creating the files

1. **Update `CLAUDE.md`** — add the new page doc to the table if you create a `docs/pages/<pagename>.md`.
2. **Update `docs/architecture.md`** — add the directory to the layout tree if it's a permanent new page.
3. **Add a changelog entry** using the `write-changelog` skill.
4. Consider adding the page to the mobile nav (`assets/mobile-nav.js`) if it should appear in the bottom tab bar.
