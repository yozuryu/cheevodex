/**
 * New-edition notice: tells the reader when a new version of Cheevodex has been published.
 * Loaded by assets/mobile-nav.js on every signed-in page (plain script, colours from tokens.css).
 *
 * Every code change bumps CACHE_NAME in sw.js, so the browser installs a new service worker; it
 * takes over open pages at once (skipWaiting + clients.claim) and drops the old cache. That takeover
 * (`controllerchange`, only when a worker already controlled the page: a first visit isn't an update)
 * slides up the card. Reload just reloads: the new worker's cache is already fresh. The page asks the
 * browser to look for a new worker when it comes back to the foreground and every 30 minutes.
 * The version shown is the newest `## vYY.MM.DD` in changelog.md (network-first in sw.js).
 */
(function () {
  if (!('serviceWorker' in navigator) || window.__cdxUpdate) return;
  window.__cdxUpdate = true;
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/\/assets\/update-notice\.js.*$/, '');
  const hadController = !!navigator.serviceWorker.controller;

  const css = document.createElement('style');
  css.textContent = `
    .cdx-up {
      position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 250;
      width: min(380px, calc(100vw - 32px)); transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px; padding: 11px 9px 11px 13px;
      background: var(--box); border: 1px solid var(--line); border-radius: 3px;
      box-shadow: 0 8px 32px rgb(0 0 0 / 0.65); font-family: var(--font); color: var(--ink);
      animation: cdx-up-in .35s cubic-bezier(0.34, 1.4, 0.64, 1) backwards;
    }
    .cdx-up::before {   /* the dex's blue rule along the top edge, solid */
      content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 2px; border-radius: 3px 3px 0 0; background: var(--accent);
    }
    .cdx-up.out { animation: cdx-up-out .25s ease-in forwards; }
    @keyframes cdx-up-in { from { transform: translate(-50%, calc(100% + 28px)); } }
    @keyframes cdx-up-out { to { transform: translate(-50%, calc(100% + 28px)); } }
    @media (max-width: 767px) { .cdx-up { bottom: calc(72px + env(safe-area-inset-bottom, 0px)); } }
    .cdx-up-mark { width: 8px; height: 8px; transform: rotate(45deg); background: var(--accent); flex-shrink: 0; margin: 0 3px; }
    .cdx-up-text { flex: 1; min-width: 0; }
    .cdx-up-title { font-size: 13px; font-weight: 600; line-height: 1.2; display: flex; align-items: baseline; gap: 6px; min-width: 0; }
    .cdx-up-title span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cdx-up-title em { font-style: normal; font-family: var(--mono); font-size: 11px; font-weight: 500; color: var(--ink-3); flex-shrink: 0; }
    .cdx-up-btn { height: 30px; padding: 0 13px; flex-shrink: 0; background: var(--accent); color: var(--page); border: 0; border-radius: 3px;
      font: 600 12px var(--font); cursor: pointer; transition: background .12s; }
    .cdx-up-btn:hover { background: var(--accent-hi); }
    .cdx-up-btn:disabled { opacity: .7; cursor: default; }
    .cdx-up-x { width: 26px; height: 26px; flex-shrink: 0; display: grid; place-items: center; padding: 0; border: 0; border-radius: 3px;
      background: none; color: var(--ink-3); cursor: pointer; transition: color .12s, background .12s; }
    .cdx-up-x:hover { color: var(--ink-2); background: rgb(var(--c-ink) / 0.06); }
    .cdx-up button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .cdx-up, .cdx-up.out { animation: none; } .cdx-up.out { display: none; } }
  `;
  document.head.appendChild(css);

  // The newest changelog version, e.g. "v26.11.21" (none when it can't be read: the card still shows)
  const version = () => fetch(BASE + '/changelog.md', { cache: 'no-store' })
    .then(r => r.ok ? r.text() : '').then(t => (t.match(/^## (v\d{2}\.\d{2}\.\d{2})/m) || [])[1] || null).catch(() => null);

  let card = null, dismissed = false;
  const hide = () => {
    if (!card) return;
    const el = card; card = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  };
  const show = async () => {
    if (card || dismissed) return;
    const v = await version();
    if (card) return;
    card = document.createElement('div');
    card.className = 'cdx-up';
    card.setAttribute('role', 'status');
    card.innerHTML = `
      <span class="cdx-up-mark" aria-hidden="true"></span>
      <div class="cdx-up-text">
        <span class="cdx-up-title"><span>A new edition of the dex</span>${v ? `<em>${v}</em>` : ''}</span>
      </div>
      <button class="cdx-up-btn" type="button">Reload</button>
      <button class="cdx-up-x" type="button" aria-label="Dismiss">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    card.querySelector('.cdx-up-btn').addEventListener('click', e => { e.currentTarget.disabled = true; location.reload(); });
    card.querySelector('.cdx-up-x').addEventListener('click', () => { dismissed = true; hide(); });
    document.body.appendChild(card);
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) show(); });

  // Ask the browser to look for a new sw.js now and then (it also does on every navigation)
  let last = Date.now();
  const check = () => {
    last = Date.now();
    navigator.serviceWorker.getRegistration().then(reg => reg && reg.update()).catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - last > 60 * 1000) check();
  });
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30 * 60 * 1000);
})();
