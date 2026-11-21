// Command palette: one search over what Cheevodex has already stored on this device (games, players,
// pages and actions), opened from the bottom bar's middle button, the desktop top bar's search field, or
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

function Palette({ onClose }) {
  const creds = getCredentials();
  const [q, setQ] = useState('');          // the field, instant
  const [term, setTerm] = useState('');    // what is searched: q once typing pauses (DEBOUNCE_MS), or at once on Enter
  const openFirst = useRef(false);         // Enter pressed before the search caught up: open the top result once it has
  const [found, setFound] = useState(null);   // the last finished search: { query, all } (shown until a newer one lands)
  const searcher = useRef(null);
  const [data, setData] = useState(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null), listRef = useRef(null);
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

  // Local data, once per open
  useEffect(() => {
    if (!creds) return;
    let live = true;
    getLocalSearchData(creds.username).then(d => {
      if (live) setData({ games: buildGames(d).map(withIni), players: buildPlayers(d, creds.username).map(withIni), consoleItems: buildConsoles(d),
        consoles: d.consoles, consolesTotal: d.consolesTotal, hasSocial: !!d.social });
    });
    return () => { live = false; };
  }, []);

  // What this device hasn't saved yet, as rows that open the page that loads it
  const notes = useMemo(() => {
    if (!data) return [];
    const out = [];
    if (!data.consoles) out.push({ kind: 'note', key: 'n-games', icon: 'pad', title: "The game catalog isn't saved yet",
      sub: 'Only your games, your backlog and your friends\' games are searchable. Consoles loads the catalog', href: 'console/' });
    else if (data.consolesTotal && data.consoles < data.consolesTotal) out.push({ kind: 'note', key: 'n-games', icon: 'pad',
      title: `Only ${data.consoles} of ${data.consolesTotal} consoles are saved`, sub: 'Games on the others won\'t show up. Consoles loads the rest', href: 'console/' });
    if (!data.hasSocial) out.push({ kind: 'note', key: 'n-friends', icon: 'users', title: "Your friends aren't saved yet",
      sub: 'Players and their games show up once Social has loaded them', href: 'social/' });
    return out;
  }, [data]);

  // Results: groups of { kind, items }; a dex number jumps to that entry first
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

  const groups = useMemo(() => {
    if (!term) {
      return [
        (recent.length || undo) && { label: 'Recent', recent: true, items: recent.map(r => ({ ...r, kind: 'recent' })) },
        notes.length && { label: 'Not saved yet', items: notes },
        { label: 'Go to', items: PAGES.map(page => ({ kind: 'page', key: page.key, page })) },
      ].filter(Boolean);
    }
    if (!data || !found) return [];
    const query = found.query;   // the last finished search, while a newer one is on its way
    const out = [];
    const num = query.match(/^(?:no\.?\s*)?(\d{1,6})$/i);
    if (num) {
      const g = data.games.find(x => x.id === Number(num[1]));
      out.push({ label: 'Dex No.', items: [g ? { kind: 'game', key: `g-${g.id}`, g } : { kind: 'game', key: `g-${num[1]}`, g: { id: Number(num[1]), base: `Open entry No.${num[1]}`, title: '', consoleName: 'Not saved on this device yet' } }] });
    }
    const lists = [data.games, data.players, PAGES, data.consoleItems];
    const clean = found.all.some(rs => rs.some(r => !r[2]));
    const find = i => found.all[i].filter(r => !clean || !r[2]).map(([k, s]) => ({ item: lists[i][k], s }));   // 0 games, 1 players, 2 pages, 3 consoles
    // Your games rank above the catalog when the match is as good
    const games = find(0).map(r => ({ ...r, s: r.s - (r.item.yours ? 0.08 : r.item.want ? 0.04 : 0) }))
      .sort((a, b) => a.s - b.s || a.item.base.length - b.item.base.length).slice(0, 8);
    const players = find(1).sort((a, b) => a.s - b.s).slice(0, 5);
    const pages = find(2).sort((a, b) => a.s - b.s).slice(0, 3);
    const cons = find(3).sort((a, b) => a.s - b.s || b.item.n - a.item.n).slice(0, 4);
    // Groups in order of their best match, so a near-exact player isn't buried under loose games
    const ranked = [
      games.length && { best: games[0].s, label: 'Games', items: games.map(r => ({ kind: 'game', key: `g-${r.item.id}`, g: r.item })) },
      players.length && { best: players[0].s, label: 'Players', items: players.map(r => ({ kind: 'player', key: `u-${r.item.user}`, p: r.item })) },
      cons.length && { best: cons[0].s - 0.01, label: 'Consoles', items: cons.map(r => ({ kind: 'console', key: `c-${r.item.id}`, c: r.item })) },
      pages.length && { best: pages[0].s + 0.02, label: 'Go to', items: pages.map(r => ({ kind: 'page', key: r.item.key, page: r.item })) },
    ].filter(Boolean).sort((a, b) => a.best - b.best);
    out.push(...ranked);
    // Something isn't saved: under an empty result, say what; under game results, say they may be incomplete
    if (!ranked.length && notes.length) out.push({ label: 'Not saved yet', items: notes });
    else if (games.length && notes.some(n => n.key === 'n-games')) out.push({ label: 'Not saved yet', items: notes.filter(n => n.key === 'n-games') });
    return out;
  }, [term, found, data, notes, recent, undo]);
  const flat = useMemo(() => groups.flatMap(gr => gr.items), [groups]);
  useEffect(() => {
    setActive(0);
    if (openFirst.current && data && (!term || found?.query === term)) { openFirst.current = false; open(flat[0]); }
  }, [term, found, data]);
  useEffect(() => { listRef.current?.querySelector('.cpl-row.on')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const open = item => {
    if (!item) return;
    if (item.kind === 'recent') { pushRecent(item); go(item.href); return; }
    if (item.kind === 'note') { go(`${BASE}${item.href}`); return; }
    const href = item.kind === 'game' ? gameHref(item.g) : item.kind === 'player' ? playerHref(item.p)
      : item.kind === 'console' ? `${BASE}console/?id=${item.c.id}` : `${BASE}${item.page.href}`;
    if (item.kind === 'console') pushRecent({ key: item.key, href, title: item.c.name, sub: 'Console', img: item.c.iconUrl, contain: true });
    else if (item.kind !== 'page') pushRecent({ key: item.key, href, title: item.kind === 'game' ? item.g.base : item.p.user,
      sub: item.kind === 'game' ? item.g.consoleName : 'Player', icon: item.kind === 'game' ? item.g.icon : item.p.pic, round: item.kind === 'player' });
    go(href);
  };
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (q.trim() !== term || !data) { openFirst.current = true; setTerm(q.trim()); }   // results not caught up yet
      else open(flat[active]);
    }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    // Delete (or ⇧⌫) on a highlighted recent entry, with nothing typed, removes it
    else if (!q && flat[active]?.kind === 'recent' && (e.key === 'Delete' || (e.key === 'Backspace' && e.shiftKey))) { e.preventDefault(); removeRecent(flat[active]); }
  };

  let i = -1;
  const row = item => {
    const idx = ++i;
    const content = item.kind === 'game' ? h(GameRow, { g: item.g }) : item.kind === 'player' ? h(PlayerRow, { p: item.p })
      : item.kind === 'page' ? h(PageRow, { page: item.page })
      : item.kind === 'note' ? [h('span', { key: 'i', className: 'cpl-icon tile note' }, h(Svg, { name: item.icon, size: 15 })),
          h('span', { key: 'm', className: 'cpl-main' }, h('span', { className: 'cpl-t' }, item.title), h('span', { className: 'cpl-s wrap' }, item.sub))]
      : item.kind === 'console' ? h(ConsoleRow, { c: item.c })
      : [item.img || item.icon ? h('img', { key: 'i', src: item.img || getMediaUrl(item.icon), alt: '', className: `cpl-icon ${item.round ? 'round' : ''} ${item.contain ? 'contain' : ''}` }) : h('span', { key: 'i', className: 'cpl-icon tile' }, h(Svg, { name: 'clock', size: 15 })),
         h('span', { key: 'm', className: 'cpl-main' }, h('span', { className: 'cpl-t' }, h('span', { className: 'truncate' }, item.title)), item.sub && h('span', { className: 'cpl-s' }, h('span', { className: 'truncate' }, item.sub)))];
    const btn = h('button', { key: item.key, type: 'button', role: 'option', 'aria-selected': idx === active, className: `cpl-row ${idx === active ? 'on' : ''}`,
      onMouseMove: () => idx !== active && setActive(idx), onClick: () => open(item) }, content);
    if (item.kind !== 'recent') return btn;
    // A recent entry: × to remove it (on hover or when highlighted; always shown on touch screens), or swipe it away
    return h('div', { key: item.key, className: `cpl-rwrap ${idx === active ? 'on' : ''}` },
      h(SwipeRow, { onRemove: () => removeRecent(item) }, btn),
      h('button', { type: 'button', className: 'cpl-rm', onClick: () => removeRecent(item), 'aria-label': `Remove ${item.title} from recent`, title: 'Remove (Delete)' }, h(Svg, { name: 'x', size: 14 })));
  };
  const group = gr => h('div', { key: gr.label, className: 'cpl-group', role: 'group', 'aria-label': gr.label },
    h('div', { className: 'cpl-label' }, h('span', null, gr.label),
      gr.recent && recent.length > 1 && h('button', { type: 'button', className: 'cpl-clear', onClick: clearRecent }, 'Clear')),
    gr.items.map(row),
    gr.recent && undo && h('div', { key: 'undo', className: 'cpl-undo anim-fade', role: 'status' },
      h('span', { className: 'truncate' }, undo.label), h('button', { type: 'button', onClick: undoRemove }, 'Undo')));

  const query = term;
  const searching = !!q.trim() && !data;                    // typed before the saved data was read: shimmer rows
  const settled = !term || found?.query === term;           // the results are for exactly what is typed
  // Work you're waiting on: the saved data still being read once you've typed, or a search still running.
  // The pause before a search starts (the debounce) isn't work, so typing alone never lights it
  const busy = useLagged((!data && !!q.trim()) || (!!term && !settled));
  return h('div', { className: 'cpl-root', onMouseDown: e => { if (e.target === e.currentTarget) onClose(); } },
    h('div', { className: 'cpl', role: 'dialog', 'aria-modal': true, 'aria-label': 'Search Cheevodex' },
      h('div', { className: `cpl-bar ${busy ? 'busy' : ''}` },
        h('span', { className: 'cpl-lead', 'aria-hidden': true }, h(Svg, { name: 'search', size: 17 }), h('span', { className: 'cpl-spin' })),
        h('input', { ref: inputRef, value: q, onChange: e => setQ(e.target.value), onKeyDown: onKey, placeholder: 'Search games, players and pages',
          className: 'cpl-input', type: 'search', enterKeyHint: 'go', autoComplete: 'off', spellCheck: false, 'aria-controls': 'cpl-list', id: 'cpl-input' }),
        h('kbd', { className: 'cpl-kbd md-only' }, 'esc'),
        h('button', { type: 'button', className: 'cpl-x', onClick: onClose, 'aria-label': 'Close' }, h(Svg, { name: 'x', size: 16 }))),
      h('div', { ref: listRef, id: 'cpl-list', role: 'listbox', className: 'cpl-list' },
        searching ? [0, 1, 2, 3].map(k => h('div', { key: k, className: 'cpl-sk' }, h('span', { className: 'shimmer' }), h('span', { className: 'shimmer' })))
        : !groups.some(gr => gr.label !== 'Not saved yet') && query && settled ? [h('div', { key: 'none', className: 'cpl-none' },
            h('b', null, `Nothing saved here matches “${query}”`)),
            ...groups.map(group)]
        : groups.length === 0 ? settled && h('div', { className: 'cpl-none' },
            h('b', null, `Nothing saved here matches “${query}”`),
            h('span', null, 'The palette searches what this device has already loaded. Consoles loads the whole catalog.'))
        : groups.map(group),
        query && h('a', { className: 'cpl-all', href: `${BASE}console/?q=${encodeURIComponent(query)}` }, h(Svg, { name: 'search', size: 13 }), `See all results for “${query}”`)),
      h('div', { className: 'cpl-foot md-only' },
        h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' move'), h('span', null, h('kbd', null, '↵'), ' open'),
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
  .cpl { width: min(640px, 100%); max-height: min(560px, 76vh); display: flex; flex-direction: column; background: var(--box); border: 1px solid var(--line);
    border-radius: 4px; box-shadow: 0 24px 64px rgb(0 0 0 / 0.7); overflow: hidden; font-family: var(--font); color: var(--ink); animation: cpl-in .18s cubic-bezier(.2,.8,.2,1); }
  @keyframes cpl-bd { from { opacity: 0; } }
  @keyframes cpl-in { from { opacity: 0; transform: translateY(-8px) scale(.98); } }
  .cpl-bar { position: relative; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 16px; height: 54px; border-bottom: 1px solid var(--line); color: var(--ink-3); flex-shrink: 0; }
  /* Loading, or a slow search: the magnifier cross-fades into a small spinner (flat, no sweep) */
  .cpl-lead { position: relative; display: grid; place-items: center; width: 18px; height: 18px; flex-shrink: 0; }
  .cpl-lead > * { grid-area: 1 / 1; transition: opacity .18s, transform .18s; }
  .cpl-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--accent); opacity: 0; transform: scale(.6); animation: cpl-rot .7s linear infinite; }
  .cpl-bar.busy .cpl-spin { opacity: 1; transform: scale(1); }
  .cpl-bar.busy .cpl-lead svg { opacity: 0; transform: scale(.6); }
  @keyframes cpl-rot { to { rotate: 360deg; } }
  .cpl-input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: 0; color: var(--ink); font: 500 16px var(--font); }
  .cpl-input::placeholder { color: var(--ink-3); }
  .cpl-input::-webkit-search-cancel-button { display: none; }
  .cpl-kbd, .cpl-foot kbd { font: 500 10px var(--mono); color: var(--ink-2); background: var(--box-hi); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 3px; padding: 1px 5px; }
  .cpl-x { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 3px; background: none; color: var(--ink-3); cursor: pointer; }
  .cpl-x:hover { color: var(--ink); background: var(--box-hi); }
  .cpl-list { overflow-y: auto; overscroll-behavior: contain; padding: 6px; flex: 1; min-height: 0; }
  .cpl-group + .cpl-group { margin-top: 6px; }
  .cpl-label { display: flex; align-items: center; justify-content: space-between; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3); padding: 8px 10px 4px; }
  .cpl-clear { border: 0; background: none; padding: 2px 4px; margin: -2px -4px; color: var(--ink-3); font: 500 11px var(--font); text-transform: none; letter-spacing: 0; cursor: pointer; border-radius: 2px; }
  .cpl-clear:hover { color: var(--danger); }
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
  .cpl-row.on { background: var(--box-hi); }
  .cpl-row.on::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; border-radius: 2px; background: var(--accent); }
  .cpl-icon { width: 34px; height: 34px; border-radius: 3px; object-fit: cover; flex-shrink: 0; background: var(--well); border: 1px solid var(--well-edge); }
  .cpl-icon.round { border-radius: 50%; }
  .cpl-icon.contain { object-fit: contain; padding: 4px; background: var(--bar); }
  .cpl-icon.tile { display: grid; place-items: center; color: var(--accent); background: var(--box-hi); border-color: var(--line); }
  .cpl-icon.tile.note { color: var(--gold); background: rgb(var(--c-gold) / 0.08); border-color: rgb(var(--c-gold) / 0.3); }
  .cpl-s.wrap { white-space: normal; line-height: 1.35; }
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
  .cpl-foot { display: flex; align-items: center; gap: 14px; padding: 8px 14px; border-top: 1px solid var(--line); font-size: 11px; color: var(--ink-3); flex-shrink: 0; }
  .cpl-foot kbd { margin-right: 2px; }
  .cpl-scope { margin-left: auto; }
  .cpl-scope b { color: var(--ink-2); font-weight: 600; }
  .cpl .md-only { display: none; }
  @media (min-width: 768px) { .cpl .md-only { display: flex; } .cpl-x { display: none; } }
  /* Phones: the whole screen, the field at the top */
  @media (max-width: 767px) {
    .cpl-root { padding: 0; background: var(--page); }
    .cpl { width: 100%; max-height: none; height: 100%; border: 0; border-radius: 0; box-shadow: none; padding-top: env(safe-area-inset-top, 0px); animation: cpl-up .2s ease-out; }
    @keyframes cpl-up { from { opacity: 0; transform: translateY(16px); } }
    .cpl-list { padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
  }
  @media (prefers-reduced-motion: reduce) { .cpl-root, .cpl { animation: none; } .cpl-spin { animation-duration: 2s; } }
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
