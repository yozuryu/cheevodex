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
  const ICON_USER     = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
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
      active: path.includes('/search/'),
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

    /* Search, in the middle: a raised round button over the bar's top edge (opens the command palette) */
    .mnav-fab { overflow: visible; }
    .mnav-fab:active { background: none; }
    .mnav-fab .mnav-icon {
      width: 50px; height: 50px; margin-top: -22px; border-radius: 50%;
      background: var(--accent); color: var(--page); border: 4px solid var(--bar);
      box-shadow: 0 6px 16px rgb(0 0 0 / 0.45), 0 0 0 1px var(--line);
      transition: transform 0.12s, background 0.15s;
    }
    .mnav-fab .mnav-icon svg { stroke: var(--page) !important; }
    .mnav-fab:active .mnav-icon { transform: scale(0.94); background: var(--accent-hi); }
    .mnav-fab .mnav-label { color: var(--ink-2); }
    .mnav-fab.mnav-active::before { display: none; }

    .mnav-icon {
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .mnav-icon svg { transition: stroke 0.15s; }

    .mnav-label {
      font-family: var(--font);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      line-height: 1;
      white-space: nowrap;
    }

    .mnav-item.mnav-active { color: var(--mnav-color, var(--gold)); }
    .mnav-item.mnav-active .mnav-icon svg { stroke: var(--mnav-color, var(--gold)); }
    .mnav-item.mnav-active::before {
      content: '';
      position: absolute;
      top: 0; left: 15%; right: 15%;
      height: 2px;
      background: var(--mnav-color, var(--gold));
      border-radius: 0 0 2px 2px;
    }

    /* ── Slide-up menu sheet ── */
    .msheet-bd {
      position: fixed;
      inset: 0;
      z-index: 300;
      background: rgba(0, 0, 0, 0.6);
      animation: mbd-in 0.2s ease-out;
    }
    .msheet-bd.closing { animation: mbd-out 0.15s ease-in forwards; }

    @keyframes mbd-in  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes mbd-out { from { opacity: 1; } to { opacity: 0; } }

    .msheet {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: var(--box);
      border-top: 1px solid var(--line);
      border-radius: 3px 3px 0 0;
      padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      max-height: 85vh;
      overflow-y: auto;
      animation: msheet-in 0.2s ease-out;
    }
    .msheet-bd.closing .msheet { animation: msheet-out 0.15s ease-in forwards; }

    @keyframes msheet-in  { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes msheet-out { from { transform: translateY(0); } to { transform: translateY(100%); } }

    .msheet-handle {
      width: 36px; height: 4px;
      background: var(--line);
      border-radius: 2px;
      margin: 10px auto 6px;
    }

    .msheet-user, .msheet-row {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 14px 16px;
      box-sizing: border-box;
    }
    .msheet-row {
      background: none;
      border: none;
      cursor: pointer;
      text-decoration: none;
      font-family: var(--font);
      text-align: left;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.1s;
    }
    .msheet-row:active { background: var(--box-hi); }

    .msheet-row-icon {
      width: 32px; height: 32px;
      border-radius: 3px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .msheet-row-body {
      display: flex; flex-direction: column;
      gap: 2px; min-width: 0; flex: 1;
    }
    .msheet-row-label {
      font-size: 13px; font-weight: 600;
      color: var(--ink); line-height: 1.2;
    }
    .msheet-row-desc { font-size: 10px; color: var(--ink-3); line-height: 1.2; }
    .msheet-divider  { height: 1px; background: var(--line); }
    .msheet-foot     { padding: 10px 16px 4px; font-size: 10px; color: var(--ink-3); text-align: center; }
  `;
  document.head.appendChild(style);

  // ── DOM: nav bar ───────────────────────────────────────────────────────────
  const nav = document.createElement('nav');
  nav.className = 'mnav';
  nav.setAttribute('aria-label', 'Main navigation');

  nav.innerHTML = tabs.map((t) => {
    const isBtn = !t.href;
    const tag   = isBtn ? 'button' : 'a';
    const attr  = isBtn ? 'type="button"' : `href="${t.href}"`;
    return `<${tag} ${attr}
        class="mnav-item${t.active ? ' mnav-active' : ''}${t.fab ? ' mnav-fab' : ''}"
        style="--mnav-color: ${t.color};"
        data-id="${t.id}"
        ${t.active && !isBtn ? 'aria-current="page"' : ''}
        aria-label="${t.label}"
      >
        <span class="mnav-icon">${t.icon}</span>
        <span class="mnav-label">${t.label}</span>
      </${tag}>`;
  }).join('');

  document.body.appendChild(nav);

  // ── Sheet logic ────────────────────────────────────────────────────────────
  const menuNavBtn = nav.querySelector('[data-id="menu"]');
  let sheetOpen = false;

  function makeRow(tag, href, iconHtml, iconColor, iconBg, label, desc, labelColor) {
    const el = document.createElement(tag);
    if (tag === 'button') el.type = 'button';
    if (href) el.href = href;
    el.className = 'msheet-row';
    const iconStyle  = `background:${iconBg || 'var(--box-hi)'};color:${iconColor}`;
    const labelStyle = labelColor ? ` style="color:${labelColor}"` : '';
    el.innerHTML = `<span class="msheet-row-icon" style="${iconStyle}">${iconHtml}</span><span class="msheet-row-body"><span class="msheet-row-label"${labelStyle}>${label}</span>${desc ? `<span class="msheet-row-desc">${desc}</span>` : ''}</span>`;
    return el;
  }

  function divider() {
    return Object.assign(document.createElement('div'), { className: 'msheet-divider' });
  }

  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    if (!onChangelog) menuNavBtn.classList.remove('mnav-active');
    document.body.style.overflow = '';
    const bd = document.querySelector('.msheet-bd');
    if (bd) { bd.classList.add('closing'); setTimeout(() => bd.remove(), 150); }
  }

  function openSheet() {
    if (sheetOpen) { closeSheet(); return; }
    sheetOpen = true;
    menuNavBtn.classList.add('mnav-active');
    document.body.style.overflow = 'hidden';

    let creds = null;
    try { creds = JSON.parse(localStorage.getItem('raCredentials')); } catch {}
    let dbg = localStorage.getItem('raDebugMode') === 'true';

    const bd = document.createElement('div');
    bd.className = 'msheet-bd';
    bd.addEventListener('click', (e) => { if (e.target === bd) closeSheet(); });

    const sheet = document.createElement('div');
    sheet.className = 'msheet';

    // Handle bar
    const handle = document.createElement('div');
    handle.className = 'msheet-handle';
    sheet.appendChild(handle);

    // Username row (non-interactive)
    if (creds?.username) {
      const userRow = document.createElement('div');
      userRow.className = 'msheet-user';
      userRow.innerHTML = `<span class="msheet-row-icon" style="background:var(--box-hi);color:var(--ink-2)">${ICON_USER}</span><span class="msheet-row-body"><span class="msheet-row-label">${creds.username}</span><span class="msheet-row-desc">Signed in to RetroAchievements</span></span>`;
      sheet.appendChild(userRow);
    }

    sheet.appendChild(divider());

    // Changelog (its page lights Menu in the nav)
    const logRow = makeRow('a', BASE + '/changelog/', ICON_LOG, 'var(--aqua)', 'var(--box-hi)', 'Changelog', 'What changed in each edition of the dex');
    if (onChangelog) logRow.setAttribute('aria-current', 'page');
    sheet.appendChild(logRow);

    sheet.appendChild(divider());

    // Refresh Data
    const refreshRow = makeRow('button', null, ICON_REFRESH, 'var(--accent)', 'var(--box-hi)', 'Refresh Data', 'Clear profile & activity cache, keep game catalog');
    refreshRow.addEventListener('click', async () => {
      sessionStorage.clear();
      Object.keys(localStorage).filter(k => k.startsWith('ra_')).forEach(k => localStorage.removeItem(k));
      // Clear only ephemeral IDB stores — keep consoles + games (expensive catalog data)
      if (window.indexedDB) {
        await new Promise(resolve => {
          const req = indexedDB.open('cheevodex');
          req.onsuccess = e => {
            const db = e.target.result;
            const toClean = ['progress', 'friend_activity', 'backlog', 'friend_list', 'meta']
              .filter(s => db.objectStoreNames.contains(s));
            if (!toClean.length) { db.close(); resolve(); return; }
            const tx = db.transaction(toClean, 'readwrite');
            toClean.forEach(s => tx.objectStore(s).clear());
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror    = () => { db.close(); resolve(); };
          };
          req.onerror = () => resolve();
        });
      }
      location.reload();
    });
    sheet.appendChild(refreshRow);

    // Purge Cache
    const purgeRow = makeRow('button', null, ICON_PURGE, 'var(--ink-2)', 'var(--box-hi)', 'Purge Cache', 'Force fresh app download, keep all data');
    purgeRow.addEventListener('click', async () => {
      // Clear only SW asset cache — IDB data (including game catalog) is untouched
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      location.reload();
    });
    sheet.appendChild(purgeRow);

    sheet.appendChild(divider());

    // Debug toggle
    const dbgIcon = () => dbg ? 'rgb(var(--c-gold) / 0.1)' : 'var(--box-hi)';
    const dbgColor = () => dbg ? 'var(--gold)' : 'var(--ink-3)';
    const debugRow = makeRow('button', null, ICON_DEBUG, dbgColor(), dbgIcon(), 'Debug Mode', dbg ? 'Enabled — API log visible in topbar' : 'Disabled');
    debugRow.addEventListener('click', () => {
      dbg = !dbg;
      localStorage.setItem('raDebugMode', String(dbg));
      window.dispatchEvent(new CustomEvent('raDebugModeChange', { detail: dbg }));
      debugRow.querySelector('.msheet-row-icon').style.background = dbgIcon();
      debugRow.querySelector('.msheet-row-icon').style.color      = dbgColor();
      debugRow.querySelector('.msheet-row-desc').textContent = dbg ? 'Enabled — API log visible in topbar' : 'Disabled';
    });
    sheet.appendChild(debugRow);

    sheet.appendChild(divider());

    // Log Out
    const logoutRow = makeRow('button', null, ICON_LOGOUT, 'var(--hc)', 'var(--box-hi)', 'Log Out', 'Clear credentials and return to login', 'var(--hc)');
    logoutRow.addEventListener('click', () => {
      localStorage.removeItem('raCredentials');
      window.location.replace(BASE + '/');
    });
    sheet.appendChild(logoutRow);

    // Phones hide the page footer, so the brand line and disclaimer live here
    sheet.appendChild(Object.assign(document.createElement('div'), {
      className: 'msheet-foot',
      textContent: 'Cheevodex · Unofficial. Not affiliated with RetroAchievements.',
    }));

    bd.appendChild(sheet);
    document.body.appendChild(bd);
  }

  menuNavBtn.addEventListener('click', openSheet);
  nav.querySelector('[data-id="search"]').addEventListener('click', () => window.dispatchEvent(new Event('cdx:palette')));
})();
