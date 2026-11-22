// Command palette: one search over what Cheevodex has already stored on this device (games, players,
// pages and actions), opened from the bottom bar's search tile, the desktop top bar's search field, or
// ⌘K / Ctrl+K. No network: games come from the catalog, your unlocks, your backlog and your friends'
// unlocks; players from your following / followers; consoles from the console list (with short names: ps2,
// gba). Typo-tolerant through its own word matcher (match()).
// Loaded as a module by assets/mobile-nav.js on every page with the nav; mounts its own React root.
// Open it from anywhere with: window.dispatchEvent(new Event('cdx:palette'))
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getCredentials, getLocalSearchData } from '../profile/utils/ra-api.js';
import { MEDIA_URL } from '../profile/utils/constants.js';
import { getMediaUrl, parseTitle } from '../profile/utils/helpers.js';
import { words, match, prepare, withIni, makeSearcher } from './match.js';

const h = React.createElement;
const { useState, useEffect, useMemo, useRef } = React;
const BASE = new URL('../', import.meta.url).href;
const RECENT_KEY = 'cdx:paletteRecent';
const DEBOUNCE_MS = 140;
const isMac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);

// ── Data ──────────────────────────────────────────────────────────────────────

// Games from every local source, one entry per id; `yours` when you have unlocks in it
function buildGames(d) {
  const map = new Map();
  const add = (g, extra = {}) => {
    const id = Number(g.id);
    if (!id || !g.title) return;
    const prev = map.get(id);
    map.set(id, { ...(prev || {}), id, title: g.title, icon: g.icon || prev?.icon || null, consoleName: g.consoleName || prev?.consoleName || '',
      total: g.total ?? prev?.total ?? null, ...extra, yours: !!(prev?.yours || extra.yours), want: !!(prev?.want || extra.want) });
  };
  d.catalog.forEach(g => add({ id: g.id, title: g.title, icon: g.imageIcon, consoleName: g.consoleName, total: g.numAchievements }));
  d.backlog.forEach(g => add({ id: g.id ?? g.gameId, title: g.title, icon: g.imageIcon, consoleName: g.consoleName, total: g.achievementsPublished ?? g.numAchievements }, { want: true }));
  d.friendActivity.forEach(f => (f.data || []).forEach(a => add({ id: a.gameId, title: a.gameTitle, icon: a.gameIcon, consoleName: a.consoleName })));
  d.progress.forEach(r => { const a = r.achievements?.[0]; if (a) add({ id: a.gameId, title: a.gameTitle, icon: a.gameIcon, consoleName: a.consoleName }, { yours: true }); });
  for (const [id, c] of Object.entries(d.completion)) {
    const g = map.get(Number(id));
    if (g) Object.assign(g, { yours: true, got: c.numAwarded, total: c.maxPossible || g.total, award: c.award });
  }
  return [...map.values()].map(g => {
    const p = parseTitle(g.title);
    return { ...g, base: p.baseTitle, subset: p.subsetName, isSubset: p.isSubset, tags: p.tags, ws: words(`${p.baseTitle} ${p.subsetName || ''}`) };
  });
}

function buildPlayers(d, me) {
  const pics = new Map(d.profiles.map(p => [p.user, p]));
  const m = new Map();
  (d.social?.following?.results || []).forEach(u => m.set(u.user, { user: u.user, pic: u.userPic, points: u.points, following: true, mutual: u.isFollowingMe }));
  (d.social?.followers?.results || []).forEach(u => m.set(u.user, { ...(m.get(u.user) || { user: u.user, pic: u.userPic, points: u.points }), follower: true }));
  if (me) m.set(me, { user: me, pic: null, me: true });
  return [...m.values()].map(p => ({ ...p, pic: pics.get(p.user)?.userPic || p.pic, last: pics.get(p.user)?.lastPlayed || null,
    ws: words(p.user.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/_/g, ' ')).concat(words(p.user)) }));
}

// Consoles by their RA name plus the short names people type (RA ids)
const CONSOLE_ALIASES = {
  1: 'md megadrive', 2: 'n64', 3: 'snes sfc', 4: 'gb', 5: 'gba', 6: 'gbc', 7: 'nes fc', 8: 'pce tg16 turbografx',
  9: 'scd megacd', 10: '32x', 11: 'sms', 12: 'ps1 psx ps', 13: 'lynx', 15: 'gg', 16: 'gc ngc gcn', 17: 'jaguar',
  18: 'nds ds', 19: 'wii', 20: 'wiiu', 21: 'ps2', 25: 'vcs 2600', 27: 'arcade mame fba', 39: 'saturn ss', 40: 'dc',
  41: 'psp', 51: '7800', 78: 'dsi',
};
function buildConsoles(d) {
  const n = new Map();
  d.catalog.forEach(g => n.set(g.consoleId, (n.get(g.consoleId) || 0) + 1));
  return (d.consoleList || []).map(c => withIni({ ...c, n: n.get(c.id) || 0, ws: words(`${c.name} ${CONSOLE_ALIASES[c.id] || ''}`) }));
}

const PAGES = [
  { key: 'p-profile', label: 'Profile',   hint: 'Your dex',                         href: 'profile/',   icon: 'user' },
  { key: 'p-social',  label: 'Social',    hint: "Friends' activity, following",      href: 'social/',    icon: 'users' },
  { key: 'p-console', label: 'Consoles',  hint: 'Every console and its games, searched together', href: 'console/', icon: 'pad' },
  { key: 'p-log',     label: 'Changelog', hint: 'What changed in each edition',     href: 'changelog/', icon: 'log' },
].map(p => withIni({ ...p, ws: words(`${p.label} ${p.hint}`) }));

const ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  user:   '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:  '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  pad:    '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="12" r="1"/><circle cx="18" cy="10" r="1"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
  log:    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  clock:  '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  x:      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  trash:  '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};
const Svg = ({ name, size = 16 }) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: ICONS[name] } });

const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
const writeRecent = list => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {} };
const pushRecent = item => writeRecent([item, ...readRecent().filter(r => r.key !== item.key)].slice(0, 6));

// The search icon turns into a spinner only for work you'd notice: shown after SHOW_MS of it, then kept at
// least HOLD_MS, so a quick search never flickers it on and off while you type
const SHOW_MS = 220, HOLD_MS = 500;
function useLagged(on) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (on && !shown) { const t = setTimeout(() => { since.current = Date.now(); setShown(true); }, SHOW_MS); return () => clearTimeout(t); }
    if (!on && shown) { const t = setTimeout(() => setShown(false), Math.max(0, HOLD_MS - (Date.now() - since.current))); return () => clearTimeout(t); }
  }, [on, shown]);
  return shown;
}

// A recent entry on a touch screen: drag it left to remove it (past a third of its width, or a flick).
// Vertical drags scroll the list as usual; the red strip behind it says what letting go does
function SwipeRow({ onRemove, children }) {
  const ref = useRef(null), g = useRef(null);
  const [x, setX] = useState(0), [anim, setAnim] = useState(false);
  const start = e => { const t = e.touches[0]; g.current = { x: t.clientX, y: t.clientY, axis: null, dx: 0, v: 0, lx: t.clientX, lt: e.timeStamp }; setAnim(false); };
  const move = e => {
    const s = g.current; if (!s) return;
    const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (s.axis === 'y') { g.current = null; return; }
    }
    const dt = e.timeStamp - s.lt; if (dt > 0) s.v = (t.clientX - s.lx) / dt;
    s.lx = t.clientX; s.lt = e.timeStamp; s.dx = dx;
    setX(dx < 0 ? dx : dx * 0.2);
  };
  const end = () => {
    const s = g.current; g.current = null;
    if (!s || s.axis !== 'x') return;
    const w = ref.current?.offsetWidth || 300;
    setAnim(true);
    if (-s.dx > w * 0.33 || (s.dx < -30 && s.v < -0.45)) { setX(-w); setTimeout(onRemove, 170); }
    else setX(0);
  };
  const reach = Math.min(1, -x / 90);
  return h('div', { ref, className: 'cpl-swipe', onTouchStart: start, onTouchMove: move, onTouchEnd: end, onTouchCancel: end },
    h('div', { className: 'cpl-swipe-bg', style: { opacity: x < 0 ? 0.35 + reach * 0.65 : 0 }, 'aria-hidden': true },
      h(Svg, { name: 'trash', size: 15 }), h('span', null, 'Remove')),
    h('div', { className: 'cpl-swipe-fg', style: { transform: x ? `translateX(${x}px)` : '', transition: anim ? 'transform .17s ease-out' : 'none' },
      onClickCapture: e => { if (x) { e.preventDefault(); e.stopPropagation(); } } }, children));
}

// ── Rows ──────────────────────────────────────────────────────────────────────

const gameHref = g => `${BASE}game/?id=${g.id}`;
const playerHref = p => p.me ? `${BASE}profile/` : `${BASE}profile/?u=${encodeURIComponent(p.user)}`;

function GameRow({ g }) {
  const pct = g.total ? Math.min(100, ((g.got || 0) / g.total) * 100) : 0;
  const mastered = g.award === 'mastered' || g.award === 'completed';
  return [
    h('img', { key: 'i', src: g.icon ? getMediaUrl(g.icon) : '', alt: '', className: 'cpl-icon', loading: 'lazy' }),
    h('span', { key: 'm', className: 'cpl-main' },
      h('span', { className: 'cpl-t' }, h('span', { className: 'truncate' }, g.base), g.isSubset && h('span', { className: 'subset-tag' }, 'Subset')),
      h('span', { className: 'cpl-s' }, h('span', { className: 'dex-no' }, `No.${g.id}`), g.subset ? h('span', { className: 'truncate text-gold-dim' }, g.subset) : g.consoleName && h('span', { className: 'truncate' }, g.consoleName))),
    h('span', { key: 'e', className: 'cpl-e' },
      g.yours && g.total
        ? [h('span', { key: 'n', className: 'num' }, g.got || 0, h('small', null, `/${g.total}`)),
           h('span', { key: 'r', className: `dring ${mastered ? 'full' : ''}`, style: { '--p': pct, '--c': mastered ? 'var(--gold)' : g.award === 'beaten-hardcore' || g.award === 'beaten-softcore' ? 'var(--silver)' : 'var(--accent)', '--s': '20px', '--w': '3px' } })]
        : g.want ? h('span', { className: 'cpl-tag' }, 'Backlog')
        : g.total ? h('span', { className: 'num text-ink-3' }, g.total, h('small', null, ' achievements')) : null),
  ];
}

function PlayerRow({ p }) {
  const sub = p.me ? 'You' : p.mutual ? 'Following each other' : p.following ? 'Following' : 'Follows you';
  return [
    h('img', { key: 'i', src: p.pic ? getMediaUrl(p.pic) : `${MEDIA_URL}/UserPic/${p.user}.png`, alt: '', className: 'cpl-icon round', loading: 'lazy' }),
    h('span', { key: 'm', className: 'cpl-main' },
      h('span', { className: 'cpl-t text-gold' }, h('span', { className: 'truncate' }, p.user)),
      h('span', { className: 'cpl-s' }, h('span', { className: 'truncate' }, p.last?.gameTitle ? `${sub} · ${parseTitle(p.last.gameTitle).baseTitle}` : sub))),
    p.points != null && h('span', { key: 'e', className: 'cpl-e num' }, p.points.toLocaleString(), h('small', null, ' pts')),
  ];
}

function ConsoleRow({ c }) {
  return [
    c.iconUrl ? h('img', { key: 'i', src: c.iconUrl, alt: '', className: 'cpl-icon contain', loading: 'lazy' }) : h('span', { key: 'i', className: 'cpl-icon tile' }, h(Svg, { name: 'pad', size: 15 })),
    h('span', { key: 'm', className: 'cpl-main' }, h('span', { className: 'cpl-t' }, h('span', { className: 'truncate' }, c.name)),
      h('span', { className: 'cpl-s' }, c.n ? [h('b', { key: 'n', className: 'num text-ink-2' }, c.n.toLocaleString()), ' games saved'] : 'Not saved yet: opens and loads it')),
  ];
}

function PageRow({ page }) {
  return [
    h('span', { key: 'i', className: 'cpl-icon tile' }, h(Svg, { name: page.icon, size: 15 })),
    h('span', { key: 'm', className: 'cpl-main' }, h('span', { className: 'cpl-t' }, page.label), h('span', { className: 'cpl-s' }, page.hint)),
  ];
}

// ── Palette ───────────────────────────────────────────────────────────────────
// Phone (< 768 px): the whole screen, the field at the bottom above the keyboard (sized to the visual viewport), filters
// above it; what's above starts at the top and reads top-down, best match first; nothing is highlighted until arrow keys are used.
// Desktop: a centred box, field on top, best match first and highlighted, Tab cycles the filters, and (≥ 900 px, with results)
// a preview of the highlighted result beside the list. Empty: Recent, Jump back in (your last played games), People, Try.

const PHONE = '(max-width: 767px)', WIDE = '(min-width: 900px)';
const useMedia = q => {
  const [on, setOn] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q), f = e => setOn(e.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, [q]);
  return on;
};
const KINDS = [['all', 'All'], ['game', 'Games'], ['player', 'Players'], ['console', 'Consoles']];
const ringOf = g => {
  const pct = g.total ? Math.min(100, ((g.got || 0) / g.total) * 100) : 0, done = g.award === 'mastered' || g.award === 'completed';
  return { pct, c: done ? 'var(--gold)' : g.award === 'beaten-hardcore' || g.award === 'beaten-softcore' ? 'var(--silver)' : 'var(--accent)', done };
};
const fmtDay = iso => { const d = new Date(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z')); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

// The highlighted result in full (desktop, beside the list)
function Preview({ item, data }) {
  if (!item) return null;
  if (item.kind === 'game') {
    const g = item.g, r = ringOf(g), friends = data.playedBy.get(g.id) || [];
    return h('div', { className: 'cpl-pv anim-fade', key: item.key },
      h('div', { className: 'cpl-pv-hero' }, g.icon && h('img', { src: getMediaUrl(g.icon), alt: '' })),
      h('div', { className: 'cpl-pv-in' },
        g.icon ? h('img', { className: 'cpl-pv-ic', src: getMediaUrl(g.icon), alt: '' }) : h('span', { className: 'cpl-pv-ic' }),
        h('div', { className: 'dex-no' }, 'Dex No.', h('b', null, g.id)),
        h('h3', null, g.base), g.subset && h('div', { className: 'cpl-pv-sub' }, g.subset),
        g.consoleName && h('div', { className: 'cpl-pv-c' }, g.consoleName),
        h('div', { className: 'cpl-pv-led' },
          h('span', { className: `dring ${r.done ? 'full' : ''}`, style: { '--p': g.yours ? r.pct : 0, '--c': r.c, '--s': '44px', '--w': '5px' } },
            h('b', { style: { fontSize: 11 } }, g.yours && g.total ? [Math.round(r.pct), h('small', { key: 's' }, '%')] : '–')),
          h('dl', null,
            h('dt', null, 'Achievements'), h('dd', null, g.yours ? [g.got || 0, h('small', { key: 's' }, `/${g.total ?? '?'}`)] : g.total ?? '–'),
            g.last && [h('dt', { key: 't' }, 'Last unlock'), h('dd', { key: 'd' }, fmtDay(g.last))],
            g.want && [h('dt', { key: 't2' }, 'Backlog'), h('dd', { key: 'd2' }, 'Want to play')])),
        friends.length > 0 && h('div', { className: 'cpl-pv-fr' }, ...friends.slice(0, 3).flatMap((u, i) => [i ? (i === friends.slice(0, 3).length - 1 ? ' and ' : ', ') : '', h('b', { key: u }, u)]),
          friends.length > 3 ? ` and ${friends.length - 3} more` : '', ' played it lately'),
        h('div', { className: 'cpl-pv-acts' },
          h('a', { className: 'cpl-pv-btn go', href: gameHref(g) }, 'Open', h('kbd', null, '↵')),
          h('a', { className: 'cpl-pv-btn', href: `https://retroachievements.org/game/${g.id}`, target: '_blank', rel: 'noreferrer' }, 'RA ↗'))));
  }
  if (item.kind === 'player') {
    const p = item.p;
    return h('div', { className: 'cpl-pv anim-fade', key: item.key },
      h('div', { className: 'cpl-pv-in', style: { paddingTop: 22 } },
        h('img', { className: 'cpl-pv-ic round', src: p.pic ? getMediaUrl(p.pic) : `${MEDIA_URL}/UserPic/${p.user}.png`, alt: '' }),
        h('h3', { className: 'text-gold' }, p.user),
        h('div', { className: 'cpl-pv-c', style: { color: 'var(--ink-2)' } }, p.me ? 'You' : p.mutual ? 'You follow each other' : p.following ? 'You follow them' : 'Follows you'),
        h('div', { className: 'cpl-pv-led' }, h('dl', null,
          p.points != null && [h('dt', { key: 'a' }, 'Points'), h('dd', { key: 'b', style: { color: 'var(--gold)' } }, p.points.toLocaleString())],
          p.last?.gameTitle && [h('dt', { key: 'c' }, 'Last played'), h('dd', { key: 'd' }, parseTitle(p.last.gameTitle).baseTitle)])),
        h('div', { className: 'cpl-pv-acts' }, h('a', { className: 'cpl-pv-btn go', href: playerHref(p) }, 'Open', h('kbd', null, '↵')),
          h('a', { className: 'cpl-pv-btn', href: `https://retroachievements.org/user/${encodeURIComponent(p.user)}`, target: '_blank', rel: 'noreferrer' }, 'RA ↗'))));
  }
  if (item.kind === 'console') {
    const c = item.c;
    return h('div', { className: 'cpl-pv anim-fade', key: item.key },
      h('div', { className: 'cpl-pv-in', style: { paddingTop: 22 } },
        c.iconUrl ? h('img', { className: 'cpl-pv-ic contain', src: c.iconUrl, alt: '' }) : h('span', { className: 'cpl-pv-ic' }),
        h('h3', null, c.name),
        h('div', { className: 'cpl-pv-led' }, h('dl', null, h('dt', null, 'Games saved'), h('dd', null, c.n ? c.n.toLocaleString() : 'Not yet'))),
        h('div', { className: 'cpl-pv-acts' }, h('a', { className: 'cpl-pv-btn go', href: `${BASE}console/?id=${c.id}` }, c.n ? 'Open' : 'Open and load', h('kbd', null, '↵')))));
  }
  return null;
}

function Palette({ onClose }) {
  const creds = getCredentials();
  const phone = useMedia(PHONE), wide = useMedia(WIDE);
  const [q, setQ] = useState('');          // the field, instant
  const [term, setTerm] = useState('');    // what is searched: q once typing pauses (DEBOUNCE_MS), or at once on Enter
  const openFirst = useRef(false);         // Enter pressed before the search caught up: open the top result once it has
  const [found, setFound] = useState(null);   // the last finished search: { query, all } (shown until a newer one lands)
  const searcher = useRef(null);
  const [data, setData] = useState(null);
  const [active, setActive] = useState(0);
  const [kb, setKb] = useState(false);     // arrow keys used: show the highlight on touch screens too
  const [kind, setKind] = useState('all'); // the filter
  const inputRef = useRef(null), listRef = useRef(null), rootRef = useRef(null);
  const [recent, setRecent] = useState(readRecent);
  const [undo, setUndo] = useState(null);   // { label, list }: the recent list before the last removal, for 5 s
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 5000); return () => clearTimeout(t); }, [undo]);
  const setRecentList = list => { setRecent(list); writeRecent(list); };
  const removeRecent = item => { setUndo({ label: `Removed “${item.title}”`, list: recent }); setRecentList(recent.filter(r => r.key !== item.key)); };
  const clearRecent = () => { setUndo({ label: `Cleared ${recent.length} recent`, list: recent }); setRecentList([]); };
  const undoRemove = () => { if (undo) { setRecentList(undo.list); setUndo(null); } };

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, []);
  // Phones: the palette follows the visual viewport, so the field sits right above the on-screen keyboard
  useEffect(() => {
    const vv = window.visualViewport, el = rootRef.current;
    if (!vv || !el || !phone) { if (el) { el.style.height = ''; el.style.top = ''; } return; }
    const fit = () => { el.style.height = `${vv.height}px`; el.style.top = `${vv.offsetTop}px`; };
    fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
  }, [phone]);

  // Local data, once per open
  useEffect(() => {
    if (!creds) return;
    let live = true;
    getLocalSearchData(creds.username).then(d => {
      if (!live) return;
      const games = buildGames(d).map(withIni), players = buildPlayers(d, creds.username).map(withIni), byId = new Map(games.map(g => [g.id, g]));
      // Jump back in: the games of your latest unlocks (the last 12 months are saved), newest first
      const lastOf = new Map();
      d.progress.forEach(r => (r.achievements || []).forEach(a => { if (!lastOf.has(a.gameId) || a.date > lastOf.get(a.gameId)) lastOf.set(a.gameId, a.date); }));
      // The profile's recently played list (this session, if the profile was opened) leads: it knows games played without unlocks too
      let played = [];
      try {
        const prof = JSON.parse(sessionStorage.getItem(`ra_profile_${creds.username}`))?.data;
        played = prof?.profileData?.recentlyPlayedGames || [];
        (prof?.firstChunkAchievements || []).forEach(a => { if (!lastOf.has(a.gameId) || a.date > lastOf.get(a.gameId)) lastOf.set(a.gameId, a.date); });     // its latest unlocks too
      } catch {}
      played.forEach(p => { const id = Number(p.gameId); if (byId.has(id) && p.lastPlayed && (!lastOf.has(id) || p.lastPlayed > lastOf.get(id))) lastOf.set(id, p.lastPlayed); });
      lastOf.forEach((t, id) => { const g = byId.get(Number(id)); if (g) g.last = t; });
      const recentGames = [...lastOf].sort((a, b) => String(b[1]).localeCompare(String(a[1]))).map(([id]) => byId.get(Number(id))).filter(Boolean).slice(0, 4);
      // Friends' latest activity: who played what (for the preview), and the people row, most recently active first
      const playedBy = new Map(), seen = new Map();
      d.friendActivity.forEach(f => (f.data || []).forEach(a => {
        const list = playedBy.get(a.gameId) || []; if (!list.includes(f.username)) list.push(f.username); playedBy.set(a.gameId, list);
        if (!seen.has(f.username) || a.date > seen.get(f.username)) seen.set(f.username, a.date);
      }));
      const people = players.filter(p => p.following).sort((a, b) => String(seen.get(b.user) || '').localeCompare(String(seen.get(a.user) || '')) || a.user.localeCompare(b.user)).slice(0, 6);
      const consoleItems = buildConsoles(d);
      // Try: searches that show what it understands, from this device's own data
      const topConsole = consoleItems.filter(c => c.n && CONSOLE_ALIASES[c.id]).sort((a, b) => b.n - a.n)[0];      // your most-saved console's short name
      const tries = [recentGames[0] && `No.${recentGames[0].id}`, topConsole && CONSOLE_ALIASES[topConsole.id].split(' ')[0], people[0]?.user].filter(Boolean);
      setData({ games, players, consoleItems, recentGames, people, playedBy, tries,
        followingTotal: players.filter(p => p.following).length, consoles: d.consoles, consolesTotal: d.consolesTotal, hasSocial: !!d.social });
    });
    return () => { live = false; };
  }, []);

  // What this device hasn't saved yet: one slim line each, linking to the page that loads it
  const notes = useMemo(() => {
    if (!data) return [];
    const out = [];
    if (!data.consoles) out.push({ key: 'n-games', text: 'Game catalog not saved yet', go: 'Load it', href: 'console/' });
    else if (data.consolesTotal && data.consoles < data.consolesTotal) out.push({ key: 'n-games', text: `${data.consoles} of ${data.consolesTotal} consoles saved`, go: 'Load the rest', href: 'console/' });
    if (!data.hasSocial) out.push({ key: 'n-friends', text: 'Friends not saved yet', go: 'Open Social', href: 'social/' });
    return out;
  }, [data]);

  // A searcher per open, fed the saved names once
  useEffect(() => {
    if (!data) return;
    const s = makeSearcher([data.games, data.players, PAGES, data.consoleItems].map(list => list.map(x => ({ ws: x.ws, ini: x.ini }))));
    searcher.current = s;
    return () => s.stop();
  }, [data]);
  useEffect(() => {
    if (!term || !data || !searcher.current) return;
    let live = true;
    searcher.current.search(term).then(all => { if (live) setFound({ query: term, all }); });
    return () => { live = false; };
  }, [term, data]);
  useEffect(() => {
    const t = q.trim();
    if (t === term) return;
    const id = setTimeout(() => setTerm(t), t && term ? DEBOUNCE_MS : 0);   // the first letter and clearing answer at once
    return () => clearTimeout(id);
  }, [q]);

  // Results by kind (for the filters and their counts); a dex number jumps to that entry first
  const results = useMemo(() => {
    if (!term || !data || !found) return null;
    const query = found.query;
    const lists = [data.games, data.players, PAGES, data.consoleItems];
    const clean = found.all.some(rs => rs.some(r => !r[2]));
    const find = i => found.all[i].filter(r => !clean || !r[2]).map(([k, s]) => ({ item: lists[i][k], s }));
    const games = find(0).map(r => ({ ...r, s: r.s - (r.item.yours ? 0.08 : r.item.want ? 0.04 : 0) }))     // your games first when the match is as good
      .sort((a, b) => a.s - b.s || a.item.base.length - b.item.base.length).slice(0, 8);
    const num = query.match(/^(?:no\.?\s*)?(\d{1,6})$/i);
    const dex = num ? (data.games.find(x => x.id === Number(num[1])) || { id: Number(num[1]), base: `Open entry No.${num[1]}`, title: '', consoleName: 'Not saved on this device yet' }) : null;
    const players = find(1).sort((a, b) => a.s - b.s).slice(0, 5);
    const pages = find(2).sort((a, b) => a.s - b.s).slice(0, 3);
    const cons = find(3).sort((a, b) => a.s - b.s || b.item.n - a.item.n).slice(0, 4);
    const groups = [
      dex && { best: -1, kind: 'game', label: 'Dex No.', items: [{ kind: 'game', key: `g-${dex.id}`, g: dex }] },
      games.length && { best: games[0].s, kind: 'game', label: 'Games', items: games.filter(r => r.item.id !== dex?.id).map(r => ({ kind: 'game', key: `g-${r.item.id}`, g: r.item })) },
      players.length && { best: players[0].s, kind: 'player', label: 'Players', items: players.map(r => ({ kind: 'player', key: `u-${r.item.user}`, p: r.item })) },
      cons.length && { best: cons[0].s - 0.01, kind: 'console', label: 'Consoles', items: cons.map(r => ({ kind: 'console', key: `c-${r.item.id}`, c: r.item })) },
      pages.length && { best: pages[0].s + 0.02, kind: 'page', label: 'Go to', items: pages.map(r => ({ kind: 'page', key: r.item.key, page: r.item })) },
    ].filter(g => g && g.items.length).sort((a, b) => a.best - b.best);
    const counts = { all: groups.filter(g => g.kind !== 'page').reduce((n, g) => n + g.items.length, 0) };
    ['game', 'player', 'console'].forEach(k => { counts[k] = groups.filter(g => g.kind === k).reduce((n, g) => n + g.items.length, 0); });
    return { groups, counts, query };
  }, [term, found, data]);
  const groups = useMemo(() => results ? results.groups.filter(g => kind === 'all' || g.kind === kind) : [], [results, kind]);

  // What the arrows walk through: the results, or (empty) Recent, Jump back in, People
  const flat = useMemo(() => term ? groups.flatMap(g => g.items)
    : [...recent.map(r => ({ ...r, kind: 'recent' })), ...(data?.recentGames || []).map(g => ({ kind: 'game', key: `j-${g.id}`, g })), ...(data?.people || []).map(p => ({ kind: 'player', key: `p-${p.user}`, p }))],
    [term, groups, recent, data]);
  const indexOf = useMemo(() => new Map(flat.map((it, i) => [it.key, i])), [flat]);
  useEffect(() => {
    setActive(0);
    if (openFirst.current && data && (!term || found?.query === term)) { openFirst.current = false; open(flat[0]); }
  }, [term, found, data, kind]);
  useEffect(() => { listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  // A new search starts at its best match, at the top
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [term, kind]);

  const open = item => {
    if (!item) return;
    if (item.kind === 'recent') { pushRecent(item); go(item.href); return; }
    const href = item.kind === 'game' ? gameHref(item.g) : item.kind === 'player' ? playerHref(item.p)
      : item.kind === 'console' ? `${BASE}console/?id=${item.c.id}` : `${BASE}${item.page.href}`;
    if (item.kind === 'console') pushRecent({ key: item.key, href, title: item.c.name, sub: 'Console', img: item.c.iconUrl, contain: true });
    else if (item.kind !== 'page') pushRecent({ key: item.kind === 'game' ? `g-${item.g.id}` : `u-${item.p.user}`, href, title: item.kind === 'game' ? item.g.base : item.p.user,
      sub: item.kind === 'game' ? item.g.consoleName : 'Player', icon: item.kind === 'game' ? item.g.icon : item.p.pic, round: item.kind === 'player' });
    go(href);
  };
  const cycle = dir => {
    if (!results) return;
    const ks = KINDS.map(k => k[0]).filter(k => k === 'all' || results.counts[k]);
    setKind(ks[(ks.indexOf(kind) + dir + ks.length) % ks.length]);
  };
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setKb(true); setActive(a => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setKb(true); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Tab' && term && results) { e.preventDefault(); cycle(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (q.trim() !== term || !data) { openFirst.current = true; setTerm(q.trim()); }   // results not caught up yet
      else open(flat[active]);
    }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    // Delete (or ⇧⌫) on a highlighted recent entry, with nothing typed, removes it
    else if (!q && flat[active]?.kind === 'recent' && (e.key === 'Delete' || (e.key === 'Backspace' && e.shiftKey))) { e.preventDefault(); removeRecent(flat[active]); }
  };

  // A selectable row: highlighted when it's the active one (the arrows' and the preview's)
  const pick = (item, cls, content, extra = {}) => {
    const idx = indexOf.get(item.key) ?? -1;
    return h(extra.tag || 'button', { key: item.key, type: 'button', role: 'option', 'aria-selected': idx === active, className: `${cls} ${idx === active ? 'on' : ''}`,
      onMouseMove: () => idx >= 0 && idx !== active && setActive(idx), onClick: () => open(item), ...extra.props }, content);
  };
  const row = item => {
    const content = item.kind === 'game' ? h(GameRow, { g: item.g }) : item.kind === 'player' ? h(PlayerRow, { p: item.p })
      : item.kind === 'page' ? h(PageRow, { page: item.page }) : item.kind === 'console' ? h(ConsoleRow, { c: item.c })
      : [item.img || item.icon ? h('img', { key: 'i', src: item.img || getMediaUrl(item.icon), alt: '', className: `cpl-icon ${item.round ? 'round' : ''} ${item.contain ? 'contain' : ''}` }) : h('span', { key: 'i', className: 'cpl-icon tile' }, h(Svg, { name: 'clock', size: 15 })),
         h('span', { key: 'm', className: 'cpl-main' }, h('span', { className: 'cpl-t' }, h('span', { className: 'truncate' }, item.title)), item.sub && h('span', { className: 'cpl-s' }, h('span', { className: 'truncate' }, item.sub)))];
    const btn = pick(item, 'cpl-row', content);
    if (item.kind !== 'recent') return btn;
    // A recent entry: × to remove it (on hover or when highlighted; always shown on touch screens), or swipe it away
    const idx = indexOf.get(item.key);
    return h('div', { key: item.key, className: `cpl-rwrap ${idx === active ? 'on' : ''}` },
      h(SwipeRow, { onRemove: () => removeRecent(item) }, btn),
      h('button', { type: 'button', className: 'cpl-rm', onClick: () => removeRecent(item), 'aria-label': `Remove ${item.title} from recent`, title: 'Remove (Delete)' }, h(Svg, { name: 'x', size: 14 })));
  };
  const noteLines = list => list.length > 0 && h('div', { className: 'cpl-notes', key: 'notes' }, list.map(n => h('div', { key: n.key, className: 'cpl-note' },
    h('i'), h('span', null, n.text), h('a', { href: `${BASE}${n.href}`, onClick: e => { e.preventDefault(); go(`${BASE}${n.href}`); } }, `${n.go} ›`))));

  // ── Before you type ──
  const home = data && h('div', { className: 'cpl-home', key: 'home' },
    data.tries.length > 0 && h('section', { className: 'cpl-sec s-try' }, h('div', { className: 'cpl-label' }, h('span', null, 'Try')),
      h('div', { className: 'cpl-chips' }, data.tries.map(t => h('button', { key: t, type: 'button', className: 'cpl-chip', onClick: () => { setQ(t); inputRef.current?.focus(); } },
        t.startsWith('No.') ? [h('em', { key: 'n' }, 'No.'), t.slice(3)] : t)))),
    data.people.length > 0 && h('section', { className: 'cpl-sec s-ppl' }, h('div', { className: 'cpl-label' }, h('span', null, 'People'),
      h('a', { className: 'cpl-clear', href: `${BASE}social/?view=following`, onClick: e => { e.preventDefault(); go(`${BASE}social/?view=following`); } }, `All ${data.followingTotal} ›`)),
      h('div', { className: 'cpl-people' }, data.people.map(p => pick({ kind: 'player', key: `p-${p.user}`, p }, 'cpl-pp', [
        h('img', { key: 'i', src: p.pic ? getMediaUrl(p.pic) : `${MEDIA_URL}/UserPic/${p.user}.png`, alt: '', loading: 'lazy' }), h('span', { key: 'n' }, p.user)])))),
    data.recentGames.length > 0 && h('section', { className: 'cpl-sec s-jump' }, h('div', { className: 'cpl-label' }, h('span', null, 'Jump back in')),
      h('div', { className: 'cpl-jump' }, data.recentGames.map(g => { const r = ringOf(g); return pick({ kind: 'game', key: `j-${g.id}`, g }, 'cpl-jg', [
        g.icon ? h('img', { key: 'i', src: getMediaUrl(g.icon), alt: '', loading: 'lazy' }) : h('span', { key: 'i', className: 'cpl-icon' }),
        h('b', { key: 't' }, g.base),
        h('span', { key: 'n', className: 'num' }, g.got || 0, h('small', null, `/${g.total ?? '?'}`),
          h('span', { className: `dring ${r.done ? 'full' : ''}`, style: { '--p': r.pct, '--c': r.c, '--s': '18px', '--w': '3px' } }))]); }))),
    (recent.length > 0 || undo) && h('section', { className: 'cpl-sec s-rec' }, h('div', { className: 'cpl-label' }, h('span', null, 'Recent'),
      recent.length > 1 && h('button', { type: 'button', className: 'cpl-clear', onClick: clearRecent }, 'Clear')),
      recent.map(r => row({ ...r, kind: 'recent' })),
      undo && h('div', { className: 'cpl-undo anim-fade', role: 'status' }, h('span', { className: 'truncate' }, undo.label), h('button', { type: 'button', onClick: undoRemove }, 'Undo'))),
    noteLines(notes));

  // ── Results ──
  const resultList = groups.map(gr => h('div', { key: gr.label, className: 'cpl-group', role: 'group', 'aria-label': gr.label },
    h('div', { className: 'cpl-label' }, h('span', null, gr.label)), gr.items.map(row)));
  const query = term;
  const searching = !!q.trim() && !data;                    // typed before the saved data was read: shimmer rows
  const settled = !term || found?.query === term;           // the results are for exactly what is typed
  // Work you're waiting on: the saved data still being read once you've typed, or a search still running.
  // The pause before a search starts (the debounce) isn't work, so typing alone never lights it
  const busy = useLagged((!data && !!q.trim()) || (!!term && !settled));
  const gameNote = notes.filter(n => n.key === 'n-games' || !results?.groups.length);
  const listBody = searching ? [0, 1, 2, 3].map(k => h('div', { key: k, className: 'cpl-sk' }, h('span', { className: 'shimmer' }), h('span', { className: 'shimmer' })))
    : !term ? home
    : results && !results.groups.length && settled ? [h('div', { key: 'none', className: 'cpl-none' }, h('b', null, `Nothing saved here matches “${query}”`),
        h('span', null, 'The search looks through what this device has already loaded.')), noteLines(notes)]
    : results && !groups.length ? h('div', { key: 'none', className: 'cpl-none' }, h('b', null, `No ${KINDS.find(k => k[0] === kind)[1].toLowerCase()} match “${query}”`))
    : [...resultList, noteLines(gameNote),
       query && h('a', { key: 'all', className: 'cpl-all', href: `${BASE}console/?q=${encodeURIComponent(query)}` }, h(Svg, { name: 'search', size: 13 }), `See all results for “${query}”`)];
  const filters = term && results && h('div', { className: 'cpl-filters', role: 'tablist', 'aria-label': 'Show' },
    KINDS.map(([k, label]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': kind === k, className: `cpl-f ${kind === k ? 'on' : ''}`, disabled: k !== 'all' && !results.counts[k],
      onClick: () => { setKind(k); inputRef.current?.focus(); } }, label, h('b', null, results.counts[k] ?? 0))),
    h('span', { className: 'cpl-fhint md-only' }, h('kbd', null, 'tab'), ' next filter'));
  const bar = h('div', { className: `cpl-bar ${busy ? 'busy' : ''}`, key: 'bar' },
    h('span', { className: 'cpl-field' },
      h('span', { className: 'cpl-lead', 'aria-hidden': true }, h(Svg, { name: 'search', size: 17 }), h('span', { className: 'cpl-spin' })),
      h('input', { ref: inputRef, value: q, onChange: e => setQ(e.target.value), onKeyDown: onKey, placeholder: 'Search games, players, consoles',
        className: 'cpl-input', type: 'search', enterKeyHint: 'go', autoComplete: 'off', spellCheck: false, 'aria-controls': 'cpl-list', id: 'cpl-input' }),
      q && h('button', { type: 'button', className: 'cpl-clr', onClick: () => { setQ(''); inputRef.current?.focus(); }, 'aria-label': 'Clear' }, h(Svg, { name: 'x', size: 12 }))),
    h('kbd', { className: 'cpl-kbd md-only' }, 'esc'),
    h('button', { type: 'button', className: 'cpl-cancel', onClick: onClose }, 'Cancel'));
  const preview = wide && !phone && term && ['game', 'player', 'console'].includes(flat[active]?.kind);
  return h('div', { ref: rootRef, className: `cpl-root ${kb ? 'kb' : ''}`, onMouseDown: e => { if (e.target === e.currentTarget) onClose(); } },
    h('div', { className: `cpl ${preview ? 'wide' : ''}`, role: 'dialog', 'aria-modal': true, 'aria-label': 'Search Cheevodex' },
      !phone && bar, !phone && filters,
      h('div', { className: 'cpl-body' },
        h('div', { ref: listRef, id: 'cpl-list', role: 'listbox', className: 'cpl-list' }, h('div', { className: 'cpl-stack' }, listBody)),
        preview && h('aside', { className: 'cpl-pane' }, h(Preview, { item: flat[active], data }))),
      phone && filters, phone && bar,
      h('div', { className: 'cpl-foot md-only' },
        h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' move'), h('span', null, h('kbd', null, '↵'), ' open'),
        term && h('span', null, h('kbd', null, 'tab'), ' filter'),
        flat[active]?.kind === 'recent' && !q ? h('span', null, h('kbd', null, 'del'), ' remove') : h('span', null, h('kbd', null, 'esc'), ' close'),
        data && (() => {
          const n = data.players.filter(p => !p.me).length, g = data.games.length;
          return h('span', { className: 'cpl-scope' }, h('b', { className: 'num' }, g.toLocaleString()), g === 1 ? ' game · ' : ' games · ',
            h('b', { className: 'num' }, n), n === 1 ? ' player saved' : ' players saved');
        })())));
}

// ── Mount + open triggers ─────────────────────────────────────────────────────

const css = document.createElement('style');
css.textContent = `
  .cpl-root { position: fixed; inset: 0; z-index: 400; background: rgb(0 0 0 / 0.6); display: flex; justify-content: center; align-items: flex-start;
    padding: max(10vh, env(safe-area-inset-top, 0px)) 16px 16px; animation: cpl-bd .15s ease-out; }
  .cpl { width: min(640px, 100%); max-height: min(600px, 80vh); display: flex; flex-direction: column; background: var(--box); border: 1px solid var(--line);
    border-radius: 4px; box-shadow: 0 24px 64px rgb(0 0 0 / 0.7); overflow: hidden; font-family: var(--font); color: var(--ink); animation: cpl-in .18s cubic-bezier(.2,.8,.2,1);
    transition: width .18s ease; }
  .cpl.wide { width: min(880px, 100%); }
  @keyframes cpl-bd { from { opacity: 0; } }
  @keyframes cpl-in { from { opacity: 0; transform: translateY(-8px) scale(.98); } }
  .cpl-bar { position: relative; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 16px; height: 54px; border-bottom: 1px solid rgb(var(--c-accent) / 0.55); color: var(--ink-3); flex-shrink: 0; }      /* desktop: a blue edge under the field, as the phone's field has a blue frame */
  .cpl-field { flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; gap: 10px; }
  /* Loading, or a slow search: the magnifier cross-fades into a small spinner (flat, no sweep) */
  .cpl-lead { position: relative; display: grid; place-items: center; width: 18px; height: 18px; flex-shrink: 0; }
  .cpl-lead > * { grid-area: 1 / 1; transition: opacity .18s, transform .18s; }
  .cpl-lead svg { color: var(--accent); }      /* blue, like the phone's Search tile */
  .cpl-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--accent); opacity: 0; transform: scale(.6); animation: cpl-rot .7s linear infinite; }
  .cpl-bar.busy .cpl-spin { opacity: 1; transform: scale(1); }
  .cpl-bar.busy .cpl-lead svg { opacity: 0; transform: scale(.6); }
  @keyframes cpl-rot { to { rotate: 360deg; } }
  .cpl-input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: 0; color: var(--ink); font: 500 16px var(--font); }
  .cpl-input::placeholder { color: var(--ink-3); }
  .cpl-input::-webkit-search-cancel-button { display: none; }
  .cpl-clr { display: grid; place-items: center; width: 22px; height: 22px; flex-shrink: 0; border: 0; border-radius: 50%; background: var(--line-2); color: var(--ink-2); cursor: pointer; }
  .cpl-clr svg { stroke-width: 3; }
  .cpl-cancel { display: none; border: 0; background: none; color: var(--accent); font: 600 14px var(--font); cursor: pointer; padding: 6px 2px; flex-shrink: 0; }
  .cpl-kbd, .cpl-foot kbd, .cpl-fhint kbd, .cpl-pv-btn kbd { font: 500 10px var(--mono); color: var(--ink-2); background: var(--box-hi); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 3px; padding: 1px 5px; }
  /* Filters: by kind, with counts (Tab cycles them on a keyboard) */
  .cpl-filters { display: flex; align-items: center; gap: 6px; padding: 9px 12px; border-bottom: 1px solid var(--line); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; }
  .cpl-f { height: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 0 11px; flex-shrink: 0; border: 1px solid var(--line-2); border-radius: 3px; background: none;
    color: var(--ink-2); font: 600 12.5px var(--font); cursor: pointer; }
  .cpl-f b { font: 600 11px var(--mono); color: var(--ink-3); }
  .cpl-f.on { background: rgb(var(--c-accent) / 0.14); border-color: rgb(var(--c-accent) / 0.5); color: var(--ink); } .cpl-f.on b { color: var(--accent); }
  .cpl-f:disabled { opacity: .45; cursor: default; }
  .cpl-fhint { margin-left: auto; font-size: 11.5px; color: var(--ink-3); align-items: center; gap: 4px; white-space: nowrap; }
  .cpl-body { flex: 1; min-height: 0; display: flex; }
  .cpl-list { overflow-y: auto; overscroll-behavior: contain; padding: 6px; flex: 1; min-width: 0; }
  .cpl-group + .cpl-group { margin-top: 6px; }
  .cpl-label { display: flex; align-items: center; justify-content: space-between; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3); padding: 8px 10px 4px; }
  .cpl-clear { border: 0; background: none; padding: 2px 4px; margin: -2px -4px; color: var(--ink-3); font: 500 11px var(--font); text-transform: none; letter-spacing: 0; cursor: pointer; border-radius: 2px; text-decoration: none; }
  .cpl-clear:hover { color: var(--ink); }
  .s-rec .cpl-clear:hover { color: var(--danger); }
  /* Recent entries: × at the end (hover / highlighted; always on touch), and swipe left on touch */
  .cpl-rwrap { position: relative; }
  .cpl-rwrap .cpl-row { padding-right: 44px; }
  .cpl-rm { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 3px;
    background: none; color: var(--ink-3); cursor: pointer; opacity: 0; transition: opacity .12s, color .12s, background .12s; }
  .cpl-rwrap:hover .cpl-rm, .cpl-rwrap.on .cpl-rm, .cpl-rm:focus-visible { opacity: 1; }
  .cpl-rm:hover { color: var(--danger); background: rgb(var(--c-danger) / 0.1); }
  @media (hover: none) { .cpl-rm { opacity: 1; color: var(--ink-4); } }
  .cpl-swipe { position: relative; overflow: hidden; border-radius: 3px; touch-action: pan-y; }
  .cpl-swipe-bg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding-right: 16px; background: rgb(var(--c-danger) / 0.16);
    color: var(--danger); font-size: 12px; font-weight: 600; border-radius: 3px; pointer-events: none; }
  .cpl-swipe-fg { position: relative; background: var(--box); border-radius: 3px; }
  .cpl-undo { display: flex; align-items: center; gap: 10px; margin: 4px 4px 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: 3px; background: var(--box-hi); font-size: 12px; color: var(--ink-2); }
  .cpl-undo button { margin-left: auto; flex-shrink: 0; border: 0; background: none; color: var(--accent); font: 600 12px var(--font); cursor: pointer; padding: 2px 4px; }
  .cpl-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 10px; border: 0; border-radius: 3px; background: none;
    color: inherit; font: inherit; text-align: left; cursor: pointer; position: relative; }
  .cpl-row.on, .cpl-jg.on { background: var(--box-hi); }
  .cpl-row.on::before, .cpl-jg.on::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; border-radius: 2px; background: var(--accent); }
  .cpl-pp.on img { box-shadow: 0 0 0 2px var(--accent); }
  /* Touch screens: no highlight until the arrow keys are used (nothing is "selected" under a finger) */
  @media (hover: none) { .cpl-root:not(.kb) .cpl-row.on, .cpl-root:not(.kb) .cpl-jg.on { background: none; } .cpl-root:not(.kb) .on::before { display: none; } .cpl-root:not(.kb) .cpl-pp.on img { box-shadow: none; } }
  .cpl-icon { width: 34px; height: 34px; border-radius: 3px; object-fit: cover; flex-shrink: 0; background: var(--well); border: 1px solid var(--well-edge); }
  .cpl-icon.round { border-radius: 50%; }
  .cpl-icon.contain { object-fit: contain; padding: 4px; background: var(--bar); }
  .cpl-icon.tile { display: grid; place-items: center; color: var(--accent); background: var(--box-hi); border-color: var(--line); }
  .cpl-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .cpl-t { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; font-weight: 600; line-height: 1.2; }
  .cpl-s { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; color: var(--ink-3); line-height: 1.2; }
  .cpl-e { display: flex; align-items: center; gap: 8px; flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--ink-2); }
  .cpl-e small { font-weight: 500; color: var(--ink-3); }
  .cpl-tag { font-size: 10px; font-weight: 600; color: var(--accent); border: 1px solid rgb(var(--c-accent) / .4); border-radius: 2px; padding: 1px 6px; }
  .cpl-all { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 10px; border-radius: 3px; font-size: 12px; color: var(--accent); text-decoration: none; border-top: 1px solid var(--line-soft); }
  .cpl-all:hover { background: var(--box-hi); }
  .cpl-none { display: flex; flex-direction: column; gap: 4px; padding: 22px 12px; text-align: center; font-size: 12px; color: var(--ink-3); }
  .cpl-none b { color: var(--ink-2); font-size: 13px; }
  .cpl-sk { display: flex; flex-direction: column; gap: 6px; padding: 10px 10px 10px 54px; }
  .cpl-sk span { height: 10px; width: 50%; border-radius: 2px; }
  .cpl-sk span + span { width: 30%; height: 8px; }
  /* What isn't saved: one slim line each */
  .cpl-notes { display: flex; flex-direction: column; gap: 2px; padding: 6px 10px; }
  .cpl-note { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--ink-3); min-height: 24px; }
  .cpl-note i { width: 6px; height: 6px; flex-shrink: 0; background: var(--gold); transform: rotate(45deg); }
  .cpl-note a { margin-left: auto; color: var(--accent); text-decoration: none; white-space: nowrap; font-weight: 600; }
  /* Before you type: Recent | People + Try on top, Jump back in under them (desktop); stacked toward the field (phone) */
  .cpl-home { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: 'rec ppl' 'rec try' 'jump jump' 'note note'; gap: 4px 20px; padding: 0 4px; align-items: start; }
  .s-rec { grid-area: rec; } .s-ppl { grid-area: ppl; } .s-try { grid-area: try; } .s-jump { grid-area: jump; } .cpl-home > .cpl-notes { grid-area: note; }
  .cpl-home:not(:has(.s-rec)) { grid-template-areas: 'ppl try' 'jump jump' 'note note'; }
  .cpl-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 2px 8px 6px; }
  .cpl-chip { height: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 0 11px; border: 1px solid var(--line-2); border-radius: 14px; background: none; color: var(--ink-2); font: 500 12.5px var(--font); cursor: pointer; }
  .cpl-chip:hover { color: var(--ink); border-color: var(--ink-4); } .cpl-chip em { font-style: normal; font: 400 8px var(--pixel, monospace); color: var(--accent); }
  .cpl-people { display: flex; gap: 10px; flex-wrap: wrap; padding: 2px 6px 6px; }
  .cpl-pp { width: 52px; display: flex; flex-direction: column; align-items: center; gap: 5px; border: 0; background: none; color: var(--ink-2); font: 500 10.5px var(--font); cursor: pointer; padding: 0; }
  .cpl-pp img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: var(--well); box-shadow: 0 0 0 1px var(--line-2); transition: box-shadow .12s; }
  .cpl-pp span { max-width: 56px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cpl-pp:hover { color: var(--ink); }
  .cpl-jump { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
  .cpl-jg { position: relative; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 10px; border: 0; border-radius: 3px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; }
  .cpl-jg img, .cpl-jg .cpl-icon { width: 34px; height: 34px; border-radius: 3px; object-fit: cover; flex-shrink: 0; background: var(--well); }
  .cpl-jg b { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cpl-jg .num { display: flex; align-items: center; gap: 7px; flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--ink-2); } .cpl-jg .num small { color: var(--ink-3); font-weight: 500; }
  /* Preview (desktop, ≥ 900 px): the highlighted result beside the list */
  .cpl-pane { width: 300px; flex-shrink: 0; border-left: 1px solid var(--line); background: var(--head, var(--box)); overflow-y: auto; }
  .cpl-pv-hero { position: relative; height: 120px; overflow: hidden; }
  .cpl-pv-hero img { position: absolute; inset: -24px; width: calc(100% + 48px); height: calc(100% + 48px); object-fit: cover; filter: blur(16px) brightness(.5) saturate(1.2); }
  .cpl-pv-hero::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, var(--head, var(--box))); }
  .cpl-pv-in { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 0 16px 16px; margin-top: -50px; }
  .cpl-pv-ic { width: 68px; height: 68px; border-radius: 4px; object-fit: cover; background: var(--well); box-shadow: 0 0 0 2px var(--line-2), 0 8px 20px rgb(0 0 0 / .6); }
  .cpl-pv-ic.round { border-radius: 50%; } .cpl-pv-ic.contain { object-fit: contain; padding: 8px; background: var(--bar); }
  .cpl-pv-in .dex-no b { color: var(--ink); font-weight: 400; }
  .cpl-pv-in h3 { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.25; }
  .cpl-pv-sub { font-size: 12px; color: var(--gold-dim); } .cpl-pv-c { font-size: 12px; color: var(--accent); }
  .cpl-pv-led { display: flex; align-items: center; gap: 14px; padding: 10px 12px; margin-top: 4px; background: var(--box); border: 1px solid var(--line); border-radius: 4px; }
  .cpl-pv-led dl { flex: 1; margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 5px 10px; font-size: 12px; }
  .cpl-pv-led dt { color: var(--ink-3); } .cpl-pv-led dd { margin: 0; text-align: right; font: 600 12px var(--mono); } .cpl-pv-led dd small { color: var(--ink-3); font-weight: 500; }
  .cpl-pv-fr { font-size: 11.5px; color: var(--ink-3); line-height: 1.5; } .cpl-pv-fr b { color: var(--ink-2); font-weight: 600; }
  .cpl-pv-acts { display: flex; gap: 6px; margin-top: 4px; }
  .cpl-pv-btn { flex: 1; height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--line-2); border-radius: 4px; color: var(--ink-2); font: 600 12.5px var(--font); text-decoration: none; }
  .cpl-pv-btn:hover { color: var(--ink); border-color: var(--ink-4); }
  .cpl-pv-btn.go { background: var(--accent); border-color: var(--accent); color: var(--page); } .cpl-pv-btn.go kbd { background: rgb(0 0 0 / .18); border-color: rgb(0 0 0 / .25); color: var(--page); }
  .cpl-foot { display: flex; align-items: center; gap: 14px; padding: 8px 14px; border-top: 1px solid var(--line); font-size: 11px; color: var(--ink-3); flex-shrink: 0; }
  .cpl-foot kbd { margin-right: 2px; }
  .cpl-scope { margin-left: auto; }
  .cpl-scope b { color: var(--ink-2); font-weight: 600; }
  .cpl .md-only { display: none; }
  @media (min-width: 768px) { .cpl .md-only { display: flex; } }
  /* Phones: the whole screen; the field at the bottom above the keyboard (the root follows the visual viewport), filters above it,
     what's above starts at the top. Before you type: Recent, Jump back in (tiles), People, Try */
  @media (max-width: 767px) {
    .cpl-root { padding: 0; background: var(--page); align-items: stretch; bottom: auto; height: 100dvh; }
    .cpl { width: 100%; max-height: none; height: 100%; border: 0; border-radius: 0; box-shadow: none; padding-top: env(safe-area-inset-top, 0px); animation: cpl-up .2s ease-out; }
    @keyframes cpl-up { from { opacity: 0; transform: translateY(16px); } }
    .cpl-list { padding: 6px 8px; }
    .cpl-bar { border-bottom: 0; border-top: 1px solid var(--line); background: var(--bar); height: 62px; padding: 8px 12px; }
    .cpl-field { height: 44px; padding: 0 12px; background: var(--box); border: 1px solid var(--accent); border-radius: 6px; }
    .cpl-cancel { display: block; }
    .cpl-filters { border-bottom: 0; border-top: 1px solid var(--line-soft); padding: 8px 10px; }
    .cpl-home { display: flex; flex-direction: column; align-items: stretch; gap: 12px; padding: 0; }
    .s-rec { order: 1; } .s-jump { order: 2; } .s-ppl { order: 3; } .s-try { order: 4; } .cpl-home > .cpl-notes { order: 5; }
    .cpl-jump { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 0 2px; }
    .cpl-jg { flex-direction: column; align-items: stretch; gap: 6px; padding: 8px; background: var(--box-hi); border: 1px solid var(--line); border-radius: 4px; }
    .cpl-jg img, .cpl-jg .cpl-icon { width: 100%; height: auto; aspect-ratio: 1; }
    .cpl-jg b { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 11px; line-height: 1.25; height: 2.5em; }
    .cpl-jg .num { font-size: 11px; justify-content: space-between; }
    .cpl-people { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  }
  @media (prefers-reduced-motion: reduce) { .cpl-root, .cpl { animation: none; transition: none; } .cpl-spin { animation-duration: 2s; } }
`;
document.head.appendChild(css);

// Open adds a history entry, so the phone's back button (or the browser's) closes the palette and stays on the
// page; closing it any other way takes that entry back off. Opening a result replaces the entry, so Back from
// there lands on the page you searched from, not on it again
let root = null, isOpen = false;
const close = (fromBack = false) => {
  if (!isOpen) return;
  isOpen = false; root?.render(null);
  if (!fromBack && history.state?.cdxOverlay === 'palette') history.back();
};
function go(href) { isOpen = false; location.replace(href); }
const openPalette = () => {
  if (isOpen || !getCredentials()) return;
  isOpen = true;
  history.pushState({ cdxOverlay: 'palette' }, '');
  if (!root) { const el = document.createElement('div'); el.id = 'cdx-palette'; document.body.appendChild(el); root = createRoot(el); }
  root.render(h(Palette, { onClose: () => close() }));
};
window.addEventListener('popstate', () => { if (isOpen) close(true); });
window.addEventListener('cdx:palette', openPalette);
// ⌘K on a Mac, Ctrl+K elsewhere (the page takes it before the browser's own search box); "/" too, when not typing
window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); isOpen ? close() : openPalette(); return; }
  const t = e.target;
  if (e.key === '/' && !isOpen && !e.metaKey && !e.ctrlKey && !e.altKey && !(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) { e.preventDefault(); openPalette(); }
});
window.__cdxPaletteKey = isMac ? '⌘K' : 'Ctrl K';
