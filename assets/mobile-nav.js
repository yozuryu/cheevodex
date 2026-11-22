/**
 * Mobile bottom navigation bar + slide-up menu sheet.
 * Injected into every page via a <script> tag.
 * Visible only on screens < 768px (md breakpoint).
 */
(function () {
  const BASE = (document.currentScript.src || '')
    .replace(/\/assets\/mobile-nav\.js.*$/, '');

  // New-edition notice (a new version published → "A new edition of the dex", Reload), on every page with this nav
  const upd = document.createElement('script');
  upd.src = BASE + '/assets/update-notice.js';
  document.head.appendChild(upd);

  // Command palette (assets/palette.js): the middle button here, the desktop top bar's field, ⌘K / Ctrl+K
  const pal = document.createElement('script');
  pal.type = 'module';
  pal.src = BASE + '/assets/palette.js';
  document.head.appendChild(pal);

  const path       = window.location.pathname;
  const isProfile  = path.includes('/profile');
  const onSocial   = path.includes('/social/');
  const onChangelog = path.includes('/changelog/');           // the changelog lives under Menu

  // ── Sheet icon SVGs (16px) ─────────────────────────────────────────────────
  const ICON_REFRESH  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>`;
  const ICON_PURGE    = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
  const ICON_DEBUG    = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="M19 12h-4"/><path d="M5 12h4"/><path d="m19 17-3-2"/><path d="m5 17 3-2"/></svg>`;
  const ICON_LOG      = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  const ICON_LOGOUT   = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

  // ── Nav items: pages (the profile's own tabs live in its sticky tab bar) ────
  const ICON20 = inner => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const tabs = [
    {
      id: 'profile',
      label: 'Profile',
      href: BASE + '/profile/',
      active: isProfile || path.includes('/game/') || path.includes('/achievement/'),
      color: 'var(--accent)',
      icon: ICON20('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    },
    {
      id: 'social',
      label: 'Social',
      href: BASE + '/social/',
      active: onSocial,
      color: 'var(--accent)',
      icon: ICON20('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    },
    {
      id: 'search',
      label: 'Search',
      href: null,          // opens the command palette (assets/palette.js)
      active: false,
      color: 'var(--accent)',
      fab: true,
      icon: ICON20('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    },
    {
      id: 'consoles',
      label: 'Consoles',
      href: BASE + '/console/',
      active: path.includes('/console/'),
      color: 'var(--accent)',
      icon: ICON20('<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="12" r="1"/><circle cx="18" cy="10" r="1"/><rect x="2" y="6" width="20" height="12" rx="2"/>'),
    },
    {
      id: 'menu',
      label: 'Menu',
      href: null,
      active: onChangelog,
      color: 'var(--ink-2)',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>`,
    },
  ];

  // ── CSS ────────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .mnav {
      display: none;
      position: fixed;
      view-transition-name: page-mnav;
      bottom: 0; left: 0; right: 0;
      z-index: 200;
      background: var(--bar);
      border-top: 1px solid var(--line);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    @media (max-width: 767px) {
      .mnav { display: flex; align-items: stretch; }
      body { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important; }
      .scroll-top-btn { bottom: calc(68px + env(safe-area-inset-bottom, 0px)) !important; }
      .page-topbar { display: none !important; }
      footer { display: none !important; }
    }

    .mnav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 8px 2px;
      min-height: 60px;
      min-width: 0;
      text-decoration: none;
      color: var(--ink-3);
      background: none;
      border: none;
      cursor: pointer;
      position: relative;
      transition: color 0.15s, background 0.1s;
      -webkit-tap-highlight-color: transparent;
    }

    .mnav-item:active { background: rgb(var(--c-accent) / 0.06); }

    /* The four places share the bar; search is a solid blue tile in the right corner, raised over the bar's top edge,
       where the thumb rests (opens the command palette) */
    .mnav-tabs { flex: 1; display: flex; min-width: 0; padding: 0 2px; }
    .mnav-tile {
      flex: 0 0 auto; align-self: flex-start; width: 84px; height: 66px; min-height: 0; margin: -12px 10px 0 4px; padding: 0; gap: 4px;
      border-radius: 6px; background: var(--accent); color: var(--page);
      box-shadow: 0 0 0 4px var(--bar), 0 10px 24px rgb(0 0 0 / 0.5);
      transition: transform 0.12s, background 0.15s;
    }
    .mnav-tile:active { background: var(--accent-hi); transform: scale(0.96); }
    .mnav-tile .mnav-icon, .mnav-tile .mnav-icon svg { width: 22px; height: 22px; }
    .mnav-tile .mnav-icon svg { stroke: var(--page); stroke-width: 2.4; }
    .mnav-tile .mnav-label { color: var(--page); font-weight: 700; }

    .mnav-icon {
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .mnav-icon svg { transition: stroke 0.15s; }

    .mnav-label {
      font-family: var(--font);
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
    }

    /* The open place: its icon blue, its name white and bold, a short blue bar under the name */
    .mnav-tabs .mnav-item.mnav-active { color: var(--ink); }
    .mnav-tabs .mnav-item.mnav-active .mnav-icon svg { stroke: var(--accent); }
    .mnav-tabs .mnav-item.mnav-active .mnav-label { font-weight: 700; }
    .mnav-tabs .mnav-item.mnav-active::after {
      content: ''; position: absolute; bottom: 5px; left: 50%; width: 22px; margin-left: -11px; height: 3px;
      border-radius: 2px; background: var(--accent);
    }

    /* ── Menu: a bottom sheet on phones (drag it down to close), a popover under ☰ on desktop ── */
    .msheet-bd {
      position: fixed; inset: 0; z-index: 300;
      background: rgb(0 0 0 / 0.6);
      animation: mbd-in 0.2s ease-out;
      transition: opacity 0.2s ease-in;
    }
    .msheet-bd.pop { background: transparent; animation: none; }
    .msheet-bd.closing { opacity: 0; }
    @keyframes mbd-in { from { opacity: 0; } }

    .msheet {
      position: fixed; bottom: 0; left: 0; right: 0;
      display: flex; flex-direction: column;
      max-height: calc(100dvh - 48px - env(safe-area-inset-top, 0px));
      background: var(--box); border-top: 1px solid var(--line); border-radius: 3px 3px 0 0;
      box-shadow: 0 -12px 30px rgb(0 0 0 / 0.5);
      font-family: var(--font); color: var(--ink);
      animation: msheet-in 0.26s cubic-bezier(0.2, 0.8, 0.3, 1);
      touch-action: pan-y;
    }
    @keyframes msheet-in { from { transform: translateY(100%); } }
    .msheet-scroll { overflow-y: auto; overscroll-behavior: contain; padding: 0 12px calc(14px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 14px; }
    .msheet-grab { flex-shrink: 0; display: grid; place-items: center; height: 22px; cursor: grab; }
    .msheet-grab i { width: 36px; height: 4px; border-radius: 2px; background: var(--line-2); }
    /* Desktop: a popover under the ☰ button */
    .msheet.pop {
      top: var(--mtop, 44px); right: var(--mright, 16px); bottom: auto; left: auto; width: 320px;
      max-height: min(640px, calc(100vh - var(--mtop, 44px) - 16px));
      border: 1px solid var(--line); border-radius: 4px; box-shadow: 0 18px 48px rgb(0 0 0 / 0.65);
      animation: mpop-in 0.16s ease-out; transition: opacity 0.12s, transform 0.12s;
    }
    .msheet.pop .msheet-grab { display: none; }
    .msheet.pop .msheet-scroll { padding: 12px; }
    .msheet-bd.closing .msheet.pop { opacity: 0; transform: translateY(-4px); }
    @keyframes mpop-in { from { opacity: 0; transform: translateY(-6px); } }

    /* Who's signed in */
    .mm-id { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--box-hi); border: 1px solid var(--line-soft); border-radius: 3px; text-decoration: none; color: inherit; }
    .mm-id img { width: 44px; height: 44px; border-radius: 3px; object-fit: cover; background: var(--well); box-shadow: 0 0 0 2px var(--gold); flex-shrink: 0; }
    .mm-id-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .mm-id-name { font-size: 16px; font-weight: 600; color: var(--gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mm-id-sub { font-size: 11.5px; color: var(--ink-3); }
    .mm-id-go { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; height: 30px; padding: 0 10px; border: 1px solid var(--line); border-radius: 3px; font-size: 11.5px; font-weight: 600; color: var(--ink-2); }
    .mm-id:hover .mm-id-go, .mm-id:active .mm-id-go { color: var(--accent); border-color: rgb(var(--c-accent) / 0.5); }

    /* Groups: an uppercase label, then the rows in one card */
    .mm-sec { display: flex; flex-direction: column; gap: 6px; }
    .mm-label { padding: 0 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-3); }
    .mm-card { display: flex; flex-direction: column; background: var(--box-hi); border: 1px solid var(--line-soft); border-radius: 3px; overflow: hidden; }
    .mm-row {
      display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 12px;
      background: none; border: 0; text-align: left; text-decoration: none; color: inherit; font: inherit; cursor: pointer;
      -webkit-tap-highlight-color: transparent; transition: background 0.1s;
    }
    .mm-row + .mm-row { border-top: 1px solid var(--line-soft); }
    .mm-row:hover, .mm-row:active { background: var(--box-hover); }
    .mm-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .mm-ic { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 3px; flex-shrink: 0; background: var(--box); border: 1px solid var(--line); color: var(--ink-2); }
    .mm-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .mm-t b { font-size: 13.5px; font-weight: 600; color: var(--ink); line-height: 1.25; }
    .mm-t span { font-size: 11.5px; color: var(--ink-3); line-height: 1.35; }
    .mm-end { flex-shrink: 0; color: var(--ink-4); display: grid; place-items: center; }
    .mm-row[aria-current="page"] .mm-t b { color: var(--accent); }
    /* A switch for on / off rows */
    .mm-sw { position: relative; width: 36px; height: 20px; border-radius: 10px; background: var(--line-2); transition: background 0.15s; flex-shrink: 0; }
    .mm-sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--ink-2); transition: transform 0.15s, background 0.15s; }
    .mm-row[aria-checked="true"] .mm-sw { background: rgb(var(--c-gold) / 0.35); }
    .mm-row[aria-checked="true"] .mm-sw::after { transform: translateX(16px); background: var(--gold); }
    .mm-row.busy { pointer-events: none; opacity: 0.6; }
    .mm-out {
      display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 44px;
      background: none; border: 1px solid rgb(var(--c-hc) / 0.4); border-radius: 3px; color: var(--hc);
      font: 600 13px var(--font); cursor: pointer; transition: background 0.12s;
    }
    .mm-out:hover, .mm-out:active { background: rgb(var(--c-hc) / 0.08); }
    .mm-foot { padding: 0 4px; font-size: 10.5px; color: var(--ink-4); text-align: center; line-height: 1.5; }
    @media (prefers-reduced-motion: reduce) { .msheet, .msheet-bd, .msheet.pop { animation: none; transition: none; } }
  `;
  document.head.appendChild(style);

  // ── DOM: nav bar ───────────────────────────────────────────────────────────
  const nav = document.createElement('nav');
  nav.className = 'mnav';
  nav.setAttribute('aria-label', 'Main navigation');

  const item = (t, extra = '') => {
    const isBtn = !t.href;
    const tag   = isBtn ? 'button' : 'a';
    const attr  = isBtn ? 'type="button"' : `href="${t.href}"`;
    return `<${tag} ${attr}
        class="mnav-item${t.active ? ' mnav-active' : ''}${extra}"
        data-id="${t.id}"
        ${t.active && !isBtn ? 'aria-current="page"' : ''}
        aria-label="${t.label}"
      >
        <span class="mnav-icon">${t.icon}</span>
        <span class="mnav-label">${t.label}</span>
      </${tag}>`;
  };
  nav.innerHTML = `<div class="mnav-tabs">${tabs.filter(t => !t.fab).map(t => item(t)).join('')}</div>${tabs.filter(t => t.fab).map(t => item(t, ' mnav-tile')).join('')}`;

  document.body.appendChild(nav);

  // ── Menu ───────────────────────────────────────────────────────────────────
  // One menu for every screen: the bottom bar's Menu opens it as a sheet (drag it down, tap outside, or press
  // Back to close it); the desktop top bar's ☰ (assets/ui.js) sends 'cdx:menu' with its button, and it opens as a
  // popover under it. Its rows: who's signed in, the changelog, installing the app when the browser offers it,
  // this device's data, debug mode, log out.
  const menuNavBtn = nav.querySelector('[data-id="menu"]');
  let menuEl = null, menuPop = false;

  // The browser's install offer, kept for the menu's Install row (assets/pwa-install.js shows its own banner)
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', () => { installEvt = null; });

  const svg = inner => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICON_INSTALL = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>');
  const ICON_CHEV = svg('<polyline points="9 18 15 12 9 6"/>');
  const ICON_EXT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><polyline points="7 7 17 7 17 17"/></svg>`;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function row({ tag = 'button', href, icon, color, title, sub, end = ICON_CHEV, attrs = '' }) {
    const open = tag === 'a' ? `<a class="mm-row" href="${href}" ${attrs}>` : `<button type="button" class="mm-row" ${attrs}>`;
    return `${open}<span class="mm-ic" style="color:${color}">${icon}</span><span class="mm-t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span><span class="mm-end">${end}</span>${tag === 'a' ? '</a>' : '</button>'}`;
  }

  async function refreshData() {
    sessionStorage.clear();
    Object.keys(localStorage).filter(k => k.startsWith('ra_')).forEach(k => localStorage.removeItem(k));
    // Clear only what's fetched again cheaply; the consoles + games (the catalog) stay
    if (window.indexedDB) {
      await new Promise(resolve => {
        const req = indexedDB.open('cheevodex');
        req.onsuccess = e => {
          const db = e.target.result;
          const toClean = ['progress', 'friend_activity', 'backlog', 'friend_list', 'meta'].filter(s => db.objectStoreNames.contains(s));
          if (!toClean.length) { db.close(); resolve(); return; }
          const tx = db.transaction(toClean, 'readwrite');
          toClean.forEach(s => tx.objectStore(s).clear());
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); resolve(); };
        };
        req.onerror = () => resolve();
      });
    }
    location.reload();
  }
  async function freshApp() {
    // The app's files only; everything saved in IndexedDB (the catalog too) stays
    if ('caches' in window) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
    location.reload();
  }

  function buildMenu() {
    let creds = null;
    try { creds = JSON.parse(localStorage.getItem('raCredentials')); } catch {}
    const dbg = localStorage.getItem('raDebugMode') === 'true';
    const user = creds?.username;
    return `
      <div class="msheet-grab" aria-hidden="true"><i></i></div>
      <div class="msheet-scroll">
        ${user ? `<a class="mm-id" href="https://retroachievements.org/user/${encodeURIComponent(user)}" target="_blank" rel="noreferrer">
          <img src="https://media.retroachievements.org/UserPic/${encodeURIComponent(user)}.png" alt="">
          <span class="mm-id-t"><span class="mm-id-name">${esc(user)}</span><span class="mm-id-sub">Signed in to RetroAchievements</span></span>
          <span class="mm-id-go">RA ${ICON_EXT}</span></a>` : ''}
        <div class="mm-sec"><div class="mm-label">Cheevodex</div><div class="mm-card">
          ${row({ tag: 'a', href: BASE + '/changelog/', icon: ICON_LOG, color: 'var(--aqua)', title: 'Changelog', sub: 'What changed in each edition', attrs: onChangelog ? 'aria-current="page"' : '' })}
          ${installEvt ? row({ icon: ICON_INSTALL, color: 'var(--accent)', title: 'Install the app', sub: 'Opens on its own, like any app', attrs: 'data-act="install"' }) : ''}
        </div></div>
        <div class="mm-sec"><div class="mm-label">This device</div><div class="mm-card">
          ${row({ icon: ICON_REFRESH, color: 'var(--accent)', title: 'Refresh my data', sub: 'Profile, friends and backlog load again. The game catalog stays', end: '', attrs: 'data-act="refresh"' })}
          ${row({ icon: ICON_PURGE, color: 'var(--ink-2)', title: 'Get the latest app', sub: 'Clears the app files and reloads. Your data stays', end: '', attrs: 'data-act="purge"' })}
          ${row({ icon: ICON_DEBUG, color: dbg ? 'var(--gold)' : 'var(--ink-3)', title: 'Debug mode', sub: 'A log of API calls in the top bar', end: '<span class="mm-sw"></span>', attrs: `data-act="debug" role="switch" aria-checked="${dbg}"` })}
        </div></div>
        ${user ? `<button type="button" class="mm-out" data-act="logout">${ICON_LOGOUT}Log out</button>` : ''}
        <div class="mm-foot">Cheevodex · Unofficial. Not affiliated with RetroAchievements.</div>
      </div>`;
  }

  function closeMenu(fromBack = false) {
    if (!menuEl) return;
    const bd = menuEl, sheet = bd.querySelector('.msheet');
    menuEl = null;
    if (!onChangelog) menuNavBtn.classList.remove('mnav-active');
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', onMenuKey);
    if (!menuPop) {
      sheet.style.transition = 'transform 0.2s ease-in';
      sheet.style.transform = 'translateY(100%)';
    }
    bd.classList.add('closing');
    setTimeout(() => bd.remove(), 200);
    if (!fromBack && !menuPop && history.state?.cdxOverlay === 'menu') history.back();
  }
  function onMenuKey(e) { if (e.key === 'Escape') closeMenu(); }

  // Drag down to close: from the handle, or anywhere once the sheet is scrolled to its top
  function dragToClose(bd, sheet) {
    const scroller = sheet.querySelector('.msheet-scroll');
    let g = null;
    sheet.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      g = { y: e.touches[0].clientY, t: e.timeStamp, dy: 0, v: 0, ly: e.touches[0].clientY, lt: e.timeStamp, onTop: scroller.scrollTop <= 0, drag: false };
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (!g) return;
      const y = e.touches[0].clientY, dy = y - g.y;
      if (!g.drag) {
        if (dy < 6) { if (dy < -6) g = null; return; }   // upward: let the sheet scroll
        if (!g.onTop && !e.target.closest('.msheet-grab')) { g = null; return; }
        g.drag = true;
      }
      e.preventDefault();
      const dt = e.timeStamp - g.lt; if (dt > 0) g.v = (y - g.ly) / dt;
      g.ly = y; g.lt = e.timeStamp; g.dy = Math.max(0, dy);
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${g.dy}px)`;
      bd.style.background = `rgb(0 0 0 / ${0.6 * Math.max(0, 1 - g.dy / sheet.offsetHeight)})`;
    }, { passive: false });
    const end = () => {
      if (!g?.drag) { g = null; return; }
      const { dy, v } = g; g = null;
      if (dy > Math.min(120, sheet.offsetHeight * 0.3) || (dy > 24 && v > 0.5)) { closeMenu(); return; }
      sheet.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1)';
      sheet.style.transform = '';
      bd.style.background = '';
    };
    sheet.addEventListener('touchend', end, { passive: true });
    sheet.addEventListener('touchcancel', end, { passive: true });
  }

  function openMenu(anchor) {
    if (menuEl) { closeMenu(); return; }
    menuPop = !!anchor && window.matchMedia('(min-width: 768px)').matches;
    const bd = document.createElement('div');
    bd.className = `msheet-bd${menuPop ? ' pop' : ''}`;
    bd.addEventListener('click', e => { if (e.target === bd) closeMenu(); });
    const sheet = document.createElement('div');
    sheet.className = `msheet${menuPop ? ' pop' : ''}`;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Menu');
    sheet.innerHTML = buildMenu();
    if (menuPop) {
      sheet.style.setProperty('--mtop', `${Math.round(anchor.bottom + 6)}px`);
      sheet.style.setProperty('--mright', `${Math.max(8, Math.round(window.innerWidth - anchor.right))}px`);
    }
    sheet.addEventListener('click', async e => {
      // A page link from the sheet replaces its history entry, so Back from that page doesn't land on this one twice
      const link = e.target.closest('a.mm-row');
      if (link && !menuPop && history.state?.cdxOverlay === 'menu') { e.preventDefault(); location.replace(link.href); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'debug') {
        const on = b.getAttribute('aria-checked') !== 'true';
        localStorage.setItem('raDebugMode', String(on));
        window.dispatchEvent(new CustomEvent('raDebugModeChange', { detail: on }));
        b.setAttribute('aria-checked', String(on));
        b.querySelector('.mm-ic').style.color = on ? 'var(--gold)' : 'var(--ink-3)';
        return;
      }
      if (act === 'install' && installEvt) { const ev = installEvt; installEvt = null; closeMenu(); ev.prompt(); return; }
      b.classList.add('busy');
      if (act === 'refresh') refreshData();
      else if (act === 'purge') freshApp();
      else if (act === 'logout') { localStorage.removeItem('raCredentials'); window.location.replace(BASE + '/'); }
    });
    bd.appendChild(sheet);
    document.body.appendChild(bd);
    menuEl = bd;
    if (!menuPop) {
      menuNavBtn.classList.add('mnav-active');
      document.documentElement.style.overflow = 'hidden';
      dragToClose(bd, sheet);
      history.pushState({ cdxOverlay: 'menu' }, '');   // Back closes the sheet and stays on the page
    }
    document.addEventListener('keydown', onMenuKey);
  }
  window.addEventListener('popstate', () => { if (menuEl && !menuPop) closeMenu(true); });
  window.addEventListener('cdx:menu', e => openMenu(e.detail?.anchor || null));
  menuNavBtn.addEventListener('click', () => openMenu(null));
  nav.querySelector('[data-id="search"]').addEventListener('click', () => window.dispatchEvent(new Event('cdx:palette')));
})();
