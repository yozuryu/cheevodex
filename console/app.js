import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Gamepad2, ChevronRight, ChevronDown, Search, X, RefreshCw, Download, Loader2, Layers, Clock, RotateCw } from 'lucide-react';
import { parseTitle, getMediaUrl } from '../profile/utils/helpers.js';
import { TILDE_TAG_COLORS } from '../profile/utils/constants.js';
import {
  getCredentials, clearCredentials, fetchConsoles, fetchConsoleGames, fetchCompletionMap,
  getAllGamesFromDB, markAllGamesFullFetch,
} from '../profile/utils/ra-api.js';
import { words, withIni, makeSearcher } from '../assets/match.js';
import { Topbar, Footer } from '../assets/ui.js';

// ── Consoles: every console and its games, and one search over all of them ──────────────────────────────
// The catalog is what this device has saved (IDB `games` / `consoles`); a console's list loads on demand,
// one console at a time (RA's rate limit), with its progress on its own card / rail row. ?id= opens a
// console (its games, the search scoped to it), ?q= searches (all loaded games, or the open console's).
// Desktop: a rail of consoles beside the open console or the search; phones: the card grid, and a picker
// on the console's name. The Search page redirects here.

function handleAuthError() {
  clearCredentials();
  window.location.replace('../');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const n0 = n => n.toLocaleString();

// ── Grouping maps ── ID-based; any ID not present falls back to 'Other'
const PUBLISHER_MAP = {
  2: 'Nintendo', 3: 'Nintendo', 4: 'Nintendo', 5: 'Nintendo', 6: 'Nintendo',
  7: 'Nintendo', 16: 'Nintendo', 18: 'Nintendo', 19: 'Nintendo', 20: 'Nintendo',
  24: 'Nintendo', 28: 'Nintendo', 60: 'Nintendo', 62: 'Nintendo', 78: 'Nintendo', 81: 'Nintendo',
  12: 'Sony', 21: 'Sony', 41: 'Sony',
  1: 'Sega', 9: 'Sega', 10: 'Sega', 11: 'Sega', 15: 'Sega',
  33: 'Sega', 39: 'Sega', 40: 'Sega', 68: 'Sega',
  13: 'Atari', 17: 'Atari', 25: 'Atari', 36: 'Atari', 50: 'Atari', 51: 'Atari', 77: 'Atari',
  8: 'NEC', 47: 'NEC', 49: 'NEC', 67: 'NEC', 76: 'NEC',
  22: 'Microsoft',
};
const PUBLISHER_ORDER = ['Atari', 'Microsoft', 'NEC', 'Nintendo', 'Sega', 'Sony', 'Other'];
const ERA_MAP = {
  23: 'Pre-8-Bit', 25: 'Pre-8-Bit', 44: 'Pre-8-Bit', 45: 'Pre-8-Bit',
  46: 'Pre-8-Bit', 50: 'Pre-8-Bit', 54: 'Pre-8-Bit', 57: 'Pre-8-Bit',
  73: 'Pre-8-Bit', 74: 'Pre-8-Bit', 75: 'Pre-8-Bit',
  4: '8-Bit', 7: '8-Bit', 11: '8-Bit', 13: '8-Bit', 15: '8-Bit',
  33: '8-Bit', 51: '8-Bit', 55: '8-Bit', 63: '8-Bit', 68: '8-Bit', 69: '8-Bit', 81: '8-Bit',
  1: '16-Bit', 3: '16-Bit', 8: '16-Bit', 9: '16-Bit', 10: '16-Bit', 76: '16-Bit',
  2: '32 / 64-Bit', 6: '32 / 64-Bit', 12: '32 / 64-Bit', 14: '32 / 64-Bit',
  17: '32 / 64-Bit', 28: '32 / 64-Bit', 39: '32 / 64-Bit', 43: '32 / 64-Bit',
  49: '32 / 64-Bit', 53: '32 / 64-Bit', 56: '32 / 64-Bit', 77: '32 / 64-Bit',
  5: '6th Gen', 16: '6th Gen', 21: '6th Gen', 22: '6th Gen',
  24: '6th Gen', 40: '6th Gen', 42: '6th Gen', 61: '6th Gen',
  18: '7th Gen', 19: '7th Gen', 41: '7th Gen', 70: '7th Gen', 78: '7th Gen',
  20: '8th Gen+', 62: '8th Gen+',
  26: 'Computer', 29: 'Computer', 30: 'Computer', 31: 'Computer', 32: 'Computer',
  34: 'Computer', 35: 'Computer', 36: 'Computer', 37: 'Computer', 38: 'Computer',
  47: 'Computer', 48: 'Computer', 52: 'Computer', 58: 'Computer', 59: 'Computer',
  64: 'Computer', 65: 'Computer', 66: 'Computer', 67: 'Computer', 79: 'Computer',
  27: 'Arcade',
};
const ERA_ORDER = ['Pre-8-Bit', '8-Bit', '16-Bit', '32 / 64-Bit', '6th Gen', '7th Gen', '8th Gen+', 'Computer', 'Arcade', 'Other'];

function groupConsoles(consoles, grouping) {
  const key = c => grouping === 'era' ? (ERA_MAP[c.id] || 'Other') : (PUBLISHER_MAP[c.id] || 'Other');
  const order = grouping === 'era' ? ERA_ORDER : PUBLISHER_ORDER;
  const map = {};
  for (const c of consoles) (map[key(c)] ??= []).push(c);
  return [...order.filter(k => map[k]), ...Object.keys(map).filter(k => !order.includes(k))].map(name => ({ name, consoles: map[name] }));
}

// ── Pieces ────────────────────────────────────────────────────────────────────

const ConsoleIcon = ({ c, size = 24, box = 32 }) => {
  const [err, setErr] = useState(false);
  return (
    <span className="cn-icon" style={{ width: box, height: box }}>
      {c?.iconUrl && !err
        ? <img src={c.iconUrl} alt="" style={{ width: size, height: size }} onError={() => setErr(true)} />
        : <Gamepad2 size={Math.round(size * 0.6)} color="var(--ink-3)" />}
    </span>
  );
};

// A console's load state as one short line: count, loading (games so far: a console's total isn't known
// until its last page, so no bar), waiting its turn, failed, or not saved
function StateLine({ st }) {
  if (st.kind === 'loaded') return <span className="cn-st"><b className="num">{n0(st.count)}</b> games</span>;
  if (st.kind === 'loading') return <span className="cn-st on">{st.n ? <><b className="num">{n0(st.n)}</b> so far</> : 'Loading'}</span>;
  if (st.kind === 'queued') return <span className="cn-st">Waiting its turn</span>;
  if (st.kind === 'failed') return <span className="cn-st"><span className="text-danger">Didn't load</span></span>;
  return <span className="cn-st">Not saved</span>;
}

// The card's right edge: a download button (not saved), retry (failed), a spinner (loading), a clock (waiting)
function CardAction({ st, onLoad, name }) {
  const press = e => { e.stopPropagation(); e.preventDefault(); onLoad(); };
  if (st.kind === 'loading') return <span className="cn-act busy" aria-label="Loading"><Loader2 size={15} className="animate-spin" /></span>;
  if (st.kind === 'queued') return <span className="cn-act wait" aria-label="Waiting its turn"><Clock size={14} /></span>;
  if (st.kind === 'failed') return <button type="button" className="cn-act btn danger" onClick={press} aria-label={`Try ${name} again`}><RotateCw size={14} /></button>;
  if (st.kind === 'none') return <button type="button" className="cn-act btn" onClick={press} aria-label={`Save ${name}'s game list`}><Download size={14} /></button>;
  return null;
}

const TitleTags = ({ title }) => {
  const { baseTitle, tags, subsetName, isSubset } = parseTitle(title);
  return (<>
    <span className="cn-gt">
      <span className="truncate">{baseTitle}</span>
      {isSubset && <span className="subset-tag">Subset</span>}
      {tags.map(tag => {
        const tc = TILDE_TAG_COLORS[tag] || TILDE_TAG_COLORS['Prototype'];
        return <span key={tag} className="cn-tag" style={{ border: `1px solid ${tc.border}`, background: tc.bg, color: tc.color }}>{tag}</span>;
      })}
    </span>
    {isSubset && subsetName && <span className="cn-gsub">{subsetName}</span>}
  </>);
};

// One game: icon, title with tags, dex number, console (across consoles), achievements and points; your ring
function GameRow({ g, consoleName, comp }) {
  const played = comp && comp.numAwarded > 0;
  const pct = played && comp.maxPossible ? Math.min(100, comp.numAwarded / comp.maxPossible * 100) : 0;
  const mastered = played && comp.maxPossible > 0 && comp.numAwarded >= comp.maxPossible;
  return (
    <a href={`../game/?id=${g.id}`} className="cn-game">
      {g.imageIcon
        ? <img src={getMediaUrl(g.imageIcon)} alt="" loading="lazy" className="cn-gicon" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
        : <span className="cn-gicon cn-gph"><Gamepad2 size={14} color="var(--ink-3)" /></span>}
      <span className="cn-gmain">
        <TitleTags title={g.title} />
        <span className="cn-gmeta">
          <span className="dex-no">No.{g.id}</span>
          {consoleName && <span className="text-accent truncate">{consoleName}</span>}
          {g.numAchievements > 0
            ? <span className="shrink-0"><span className="text-ink-2 num">{g.numAchievements}</span> ach · <span className="text-gold num">{n0(g.points || 0)}</span> pts</span>
            : <span className="shrink-0">No achievements</span>}
        </span>
      </span>
      {played && (
        <span className="cn-mine" title={`${comp.numAwarded} of ${comp.maxPossible}`}>
          <span className="num">{comp.numAwarded}<small>/{comp.maxPossible}</small></span>
          <span className={`dring ${mastered ? 'full' : ''}`} style={{ '--p': pct, '--c': mastered ? 'var(--gold)' : 'var(--accent)', '--s': '20px', '--w': '3px' }} />
        </span>
      )}
      <ChevronRight size={12} color="var(--line)" className="shrink-0" />
    </a>
  );
}

const GamesSkeleton = ({ n = 10 }) => (
  <div className="flex flex-col gap-[2px]" aria-busy="true">
    {[...Array(n)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-box rounded-[2px]">
        <div className="shimmer w-8 h-8 rounded-[2px] shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5"><div className="shimmer h-3 rounded" style={{ width: `${40 + (i % 4) * 12}%` }} /><div className="shimmer h-2 w-1/4 rounded" /></div>
      </div>
    ))}
  </div>
);

const PAGE = 60;

// ── App ───────────────────────────────────────────────────────────────────────

function ConsolesApp() {
  const creds = getCredentials();
  const params = new URLSearchParams(window.location.search);
  const [consoleId, setConsoleId] = useState(params.get('id') ? Number(params.get('id')) : null);
  const [query, setQuery] = useState(params.get('q') || '');
  const [term, setTerm] = useState((params.get('q') || '').trim());          // the query once typing pauses
  const [grouping, setGrouping] = useState(params.get('group') === 'era' ? 'era' : 'publisher');
  // Achievements filter: your pick (?ach=) wins; otherwise All games while searching (you're after one game, a
  // hidden match is worse than extra rows), With achievements while browsing a console's list
  const [achPick, setAchPick] = useState(['all', 'with', 'without'].includes(params.get('ach')) ? params.get('ach') : null);
  const [consoles, setConsoles] = useState(null);
  const [consolesError, setConsolesError] = useState(false);
  const [catalog, setCatalog] = useState(null);       // { [consoleId]: games[] } for the consoles saved here
  const [lastFullFetch, setLastFullFetch] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(null);       // { id, n }: the console loading now
  const [queue, setQueue] = useState([]);             // console ids waiting their turn
  const [failed, setFailed] = useState(() => new Set());
  const [batch, setBatch] = useState({ total: 0, done: 0 });   // this run of loads: how many asked for, how many finished
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const away = e => { if (!pickerRef.current?.contains(e.target)) setPickerOpen(false); };
    const esc = e => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [pickerOpen]);
  const [shown, setShown] = useState(PAGE);
  const queueRef = useRef([]), forceRef = useRef(new Set()), running = useRef(false), cancelRef = useRef(false), inputRef = useRef(null);

  // ── Data: the console list, what's saved, your progress ──
  useEffect(() => {
    if (!creds) { handleAuthError(); return; }
    fetchConsoles(creds.username, creds.apiKey).then(setConsoles).catch(e => { if (e.message === 'AUTH_ERROR') handleAuthError(); else setConsolesError(true); });
    getAllGamesFromDB().then(d => {
      const by = {};
      for (const id of Object.keys(d.consolesFetched || {})) if (d.consolesFetched[id]) by[id] = [];
      for (const g of d.games) (by[g.consoleId] ??= []).push(g);
      Object.values(by).forEach(list => list.sort((a, b) => a.title.localeCompare(b.title)));
      setCatalog(by);
      setLastFullFetch(d.lastFullFetch);
    }).catch(() => setCatalog({}));
    fetchCompletionMap(creds.username, creds.apiKey).then(setCompletion).catch(e => { if (e.message === 'AUTH_ERROR') handleAuthError(); });
  }, []);

  // ── Loading: one console at a time, 1 s apart; each card / rail row shows its own state ──
  const run = async () => {
    if (running.current) return;
    running.current = true;
    cancelRef.current = false;
    while (queueRef.current.length && !cancelRef.current) {
      const id = queueRef.current[0];
      setLoading({ id, n: 0 });
      try {
        const games = await fetchConsoleGames(creds.username, creds.apiKey, id, forceRef.current.has(id), n => setLoading({ id, n }));
        forceRef.current.delete(id);
        setCatalog(c => ({ ...c, [id]: [...games].sort((a, b) => a.title.localeCompare(b.title)) }));
        setFailed(f => { const s = new Set(f); s.delete(id); return s; });
      } catch (e) {
        if (e.message === 'AUTH_ERROR') { handleAuthError(); return; }
        setFailed(f => new Set(f).add(id));
      }
      queueRef.current = queueRef.current.slice(1);
      setQueue(queueRef.current);
      setBatch(b => ({ ...b, done: b.done + 1 }));
      if (queueRef.current.length && !cancelRef.current) await sleep(1000);
    }
    queueRef.current = []; setQueue([]); setLoading(null); setBatch({ total: 0, done: 0 });
    running.current = false;
  };
  const enqueue = (ids, { force = false, first = false } = {}) => {
    const fresh = ids.filter(id => !queueRef.current.includes(id) && loading?.id !== id);
    if (force) fresh.forEach(id => forceRef.current.add(id));
    setBatch(b => running.current ? { ...b, total: b.total + fresh.length } : { total: fresh.length, done: 0 });
    queueRef.current = first ? [...fresh, ...queueRef.current] : [...queueRef.current, ...fresh];
    setQueue(queueRef.current);
    run();
  };
  const loadAll = force => {
    const ids = (consoles || []).map(c => c.id).filter(id => force || !catalog?.[id]);
    enqueue(ids, { force });
  };
  const cancel = () => { cancelRef.current = true; queueRef.current = queueRef.current.slice(0, 1); setQueue(queueRef.current); setBatch(b => ({ ...b, total: b.done + 1 })); };
  // Every console saved: stamp the full fetch (as the old Search page did)
  useEffect(() => {
    if (!consoles || !catalog || loading || queue.length) return;
    if (consoles.every(c => catalog[c.id]) && !lastFullFetch) markAllGamesFullFetch().then(() => setLastFullFetch(Date.now())).catch(() => {});
  }, [catalog, consoles, loading, queue]);

  // Opening a console that isn't saved loads it first
  useEffect(() => {
    if (consoleId && catalog && !catalog[consoleId] && loading?.id !== consoleId && !queueRef.current.includes(consoleId)) enqueue([consoleId], { first: true });
  }, [consoleId, catalog]);

  const stateOf = id => loading?.id === id ? { kind: 'loading', n: loading.n }
    : queue.includes(id) ? { kind: 'queued' }
    : catalog?.[id] ? { kind: 'loaded', count: catalog[id].length }
    : failed.has(id) ? { kind: 'failed' } : { kind: 'none' };

  // ── URL: ?id= (console), ?q= (search), ?group=, ?ach= ──
  const urlRef = useRef(window.location.search);   // the address this page last showed
  const writeUrl = (patch, push = false) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) (v == null || v === '' ? sp.delete(k) : sp.set(k, v));
    const qs = sp.toString();
    history[push ? 'pushState' : 'replaceState'](null, '', qs ? '?' + qs : window.location.pathname);
    urlRef.current = window.location.search;
  };
  const openConsole = id => {
    writeUrl({ id, q: null }, true);
    setConsoleId(id); setQuery(''); setTerm(''); setPickerOpen(false); setShown(PAGE);
    window.scrollTo(0, 0);
  };
  const openAll = () => {
    writeUrl({ id: null, q: null }, true);
    setConsoleId(null); setQuery(''); setTerm(''); setPickerOpen(false);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onPop = () => {
      // Back that only closed the search palette or the menu lands on the same address: nothing to change
      if (window.location.search === urlRef.current) return;
      urlRef.current = window.location.search;
      const p = new URLSearchParams(window.location.search);
      setConsoleId(p.get('id') ? Number(p.get('id')) : null);
      setQuery(p.get('q') || ''); setTerm((p.get('q') || '').trim());
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // The search runs once typing pauses
  useEffect(() => {
    const t = query.trim();
    if (t === term) return;
    const id = setTimeout(() => { setTerm(t); setShown(PAGE); writeUrl({ q: t || null }); }, t && term ? 160 : 0);
    return () => clearTimeout(id);
  }, [query]);

  // ── Search: one background searcher over every saved game, results narrowed to the open console ──
  const allGames = useMemo(() => catalog ? Object.values(catalog).flat() : [], [catalog]);
  const searcher = useRef(null);
  const [found, setFound] = useState(null);           // { term, rows: [[index, score]], games }
  useEffect(() => {
    if (!term || !allGames.length) { setFound(null); return; }
    // Build the searcher only when there's something to search, and again when the catalog grew
    if (!searcher.current || searcher.current.games !== allGames) {
      searcher.current?.s.stop();
      const items = allGames.map(g => { const p = parseTitle(g.title); return withIni({ ws: words(`${p.baseTitle} ${p.subsetName || ''}`) }); });
      searcher.current = { games: allGames, s: makeSearcher([items]) };
    }
    let live = true;
    const { games, s } = searcher.current;
    s.search(term).then(all => {
      if (!live) return;
      const clean = all[0].some(r => !r[2]);
      setFound({ term, games, rows: all[0].filter(r => !clean || !r[2]) });
    });
    return () => { live = false; };
  }, [term, allGames]);
  useEffect(() => () => searcher.current?.s.stop(), []);

  const byConsole = useMemo(() => Object.fromEntries((consoles || []).map(c => [c.id, c])), [consoles]);
  const current = consoleId ? byConsole[consoleId] : null;
  const ach = achPick ?? (term ? 'all' : 'with');
  const achOk = g => ach === 'all' || (ach === 'with' ? g.numAchievements > 0 : g.numAchievements === 0);

  // Results: matches (in the open console, or everywhere), your games first among equals; else the console's list
  const results = useMemo(() => {
    if (term) {
      if (!found || found.term !== term) return null;
      const mine = g => completion?.[g.id]?.numAwarded > 0;
      return found.rows
        .map(([i, s]) => ({ g: found.games[i], s }))
        .filter(r => (!consoleId || r.g.consoleId === consoleId) && achOk(r.g))
        .sort((a, b) => (a.s - (mine(a.g) ? 0.08 : 0)) - (b.s - (mine(b.g) ? 0.08 : 0)) || a.g.title.length - b.g.title.length)
        .map(r => r.g);
    }
    if (consoleId) return catalog?.[consoleId] ? catalog[consoleId].filter(achOk) : null;
    return null;
  }, [term, found, consoleId, catalog, ach, completion]);

  // Coverage of the open console: sets you've played and mastered
  const coverage = useMemo(() => {
    const games = consoleId && catalog?.[consoleId];
    if (!games || !completion) return null;
    const withAch = games.filter(g => g.numAchievements > 0);
    if (!withAch.length) return null;
    let played = 0, mastered = 0;
    withAch.forEach(g => { const c = completion[g.id]; if (!c?.numAwarded) return; played++; if (c.maxPossible > 0 && c.numAwarded >= c.maxPossible) mastered++; });
    return { total: withAch.length, played, mastered };
  }, [consoleId, catalog, completion]);

  // The rail keeps the open console in view
  useEffect(() => { document.querySelector('.cn-rail .cn-rrow.on')?.scrollIntoView({ block: 'nearest' }); }, [consoleId, consoles]);

  const savedConsoles = catalog ? (consoles || []).filter(c => catalog[c.id]).length : 0;
  const busy = !!loading || queue.length > 0;
  const grouped = useMemo(() => consoles ? groupConsoles(consoles, grouping) : [], [consoles, grouping]);
  const setGroup = g => { setGrouping(g); writeUrl({ group: g }); };
  const setAchF = a => { setAchPick(a); writeUrl({ ach: a }); setShown(PAGE); };
  const searching = !!term;
  const inside = !!consoleId || searching;     // the rail shows (desktop) once you're in a console or a search

  // ── Pieces of the page ──
  // What loads now. One console: a spinner and its count so far (its total is unknown until it's done).
  // Several: also "3 of 54" and a plain bar, since how many consoles are done is a real fraction
  const many = batch.total > 1;
  const loadBar = busy && (
    <div className="cn-progress anim-fade">
      <div className="cn-progress-h">
        <Loader2 size={14} className="text-accent animate-spin shrink-0" />
        <span className="truncate"><b>{byConsole[loading?.id]?.name || 'Loading'}</b>{loading?.n ? <> · <span className="num">{n0(loading.n)}</span> games so far</> : null}</span>
        {many && <span className="num text-ink-3 shrink-0">{Math.min(batch.done + 1, batch.total)} of {batch.total}</span>}
        <button type="button" onClick={cancel} className="fchip ml-auto" style={{ height: 26 }}>Stop</button>
      </div>
      {many && <div className="cn-bar"><i style={{ width: `${(batch.done / batch.total) * 100}%` }} /></div>}
    </div>
  );

  const searchBox = (
    <div className="cn-search">
      <Search size={13} className="cn-search-i" />
      <input ref={inputRef} id="cn-q" type="search" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false}
        placeholder={current ? `Search ${current.name}` : allGames.length ? `Search ${n0(allGames.length)} games` : 'Search games'} aria-label="Search games" />
      {query && <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search" className="cn-search-x"><X size={13} /></button>}
    </div>
  );
  const achChips = (
    <div className="frow" role="group" aria-label="Achievements">
      {[['with', 'With achievements'], ['all', 'All games'], ['without', 'Without']].map(([v, l]) => (
        <button key={v} type="button" onClick={() => setAchF(v)} aria-pressed={ach === v} className={`fchip ${ach === v ? 'on' : ''}`}>{l}</button>
      ))}
    </div>
  );

  const rail = (
    <nav className="cn-rail" aria-label="Consoles">
      <button type="button" onClick={openAll} className={`cn-rrow all ${!consoleId ? 'on' : ''}`}>
        <span className="cn-icon" style={{ width: 22, height: 22 }}><Layers size={13} color="var(--accent)" /></span>
        <span className="cn-rname">All consoles</span>
        <span className="cn-st"><b className="num">{n0(allGames.length)}</b></span>
      </button>
      {grouped.map(gr => (
        <div key={gr.name} className="cn-rgroup">
          <div className="cn-rlabel">{gr.name}</div>
          {gr.consoles.map(c => {
            const st = stateOf(c.id);
            return (
              <button key={c.id} type="button" onClick={() => openConsole(c.id)} className={`cn-rrow ${consoleId === c.id ? 'on' : ''} ${st.kind}`} aria-current={consoleId === c.id ? 'page' : undefined}>
                <ConsoleIcon c={c} size={16} box={22} />
                <span className="cn-rname">{c.name}</span>
                {st.kind === 'loaded' ? <span className="cn-st num">{n0(st.count)}</span>
                  : st.kind === 'loading' ? <Loader2 size={12} className="animate-spin text-accent shrink-0" />
                  : st.kind === 'queued' ? <Clock size={11} className="text-ink-3 shrink-0" aria-label="Waiting its turn" />
                  : <span className="cn-st dim">–</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const cards = (
    <div className="flex flex-col gap-6">
      {grouped.map(gr => (
        <section key={gr.name}>
          <div className="cn-glabel"><span>{gr.name}</span><b className="num">{gr.consoles.length}</b></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {gr.consoles.map(c => {
              const st = stateOf(c.id);
              return (
                <a key={c.id} href={`?id=${c.id}`} onClick={e => { e.preventDefault(); openConsole(c.id); }} className={`cn-card ${st.kind}`}>
                  <ConsoleIcon c={c} />
                  <span className="cn-cmain">
                    <span className="cn-cname">{c.name}</span>
                    <StateLine st={st} />
                  </span>
                  <CardAction st={st} name={c.name} onLoad={() => enqueue([c.id], { force: st.kind === 'failed' })} />
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  const list = (
    results === null ? (current && stateOf(current.id).kind !== 'loaded' ? <GamesSkeleton /> : searching ? <GamesSkeleton n={6} /> : null)
    : results.length === 0 ? (
      <div className="cn-none">
        <b>{searching ? `Nothing ${current ? `on ${current.name}` : 'saved here'} matches “${term}”` : 'No games here'}</b>
        {ach !== 'all' && <button type="button" className="fchip" onClick={() => setAchF('all')}>Show all games</button>}
      </div>
    ) : (<>
      <div className="cn-count"><b className="num">{n0(results.length)}</b> {searching ? `match${results.length === 1 ? '' : 'es'}` : results.length === 1 ? 'game' : 'games'}{searching && !current && savedConsoles < (consoles?.length || 0) && <span> · in {savedConsoles} of {consoles.length} consoles</span>}</div>
      <div className="flex flex-col gap-[2px]">
        {results.slice(0, shown).map(g => <GameRow key={g.id} g={g} consoleName={!current ? byConsole[g.consoleId]?.name : null} comp={completion?.[g.id]} />)}
      </div>
      {results.length > shown && <button type="button" className="smore" onClick={() => setShown(s => s + PAGE * 2)}>Show more · {n0(results.length - shown)} left</button>}
    </>)
  );

  // ── Headers ──
  const notAllSaved = consoles && catalog && savedConsoles < consoles.length;
  // ── One header frame for both views: crumb row, title row (icon, name, subline, one button), a ring panel.
  // Only the contents change between All consoles and a console, so moving between them doesn't rearrange the top
  const curState = current ? stateOf(current.id) : null;
  const ring = (pct, c, cb, b, label) => (
    <span className="dring" style={{ '--p': pct, '--c': c, ...(cb ? { '--b': b, '--cb': cb } : {}), '--s': '44px', '--w': '5px' }}>
      <b style={{ fontSize: 11 }}>{label}</b>
    </span>
  );
  const pick = (
    <div ref={pickerRef} className="cn-crumbwrap">
      <div className="cn-crumbs">
        {current ? <a href="?" onClick={e => { e.preventDefault(); openAll(); }}>Consoles</a> : <span>Consoles</span>}
        <ChevronRight size={11} />
        <button type="button" className="cn-pick" onClick={() => setPickerOpen(o => !o)} aria-expanded={pickerOpen} aria-label="Switch console">
          <span className="truncate">{current ? current.name : 'All consoles'}</span><ChevronDown size={12} className={pickerOpen ? 'rotate-180' : ''} />
        </button>
      </div>
      {pickerOpen && (
        <div className="cn-picker anim-fade" role="listbox" aria-label="Switch console">
          <button type="button" role="option" aria-selected={!consoleId} onClick={openAll} className={`cn-rrow all ${!consoleId ? 'on' : ''}`}>
            <span className="cn-icon" style={{ width: 22, height: 22 }}><Layers size={13} color="var(--accent)" /></span>
            <span className="cn-rname">All consoles</span>
            <span className="cn-st num">{n0(allGames.length)}</span>
          </button>
          {grouped.map(gr => (
            <div key={gr.name}>
              <div className="cn-rlabel">{gr.name}</div>
              {gr.consoles.map(c => {
                const st = stateOf(c.id);
                return (
                  <button key={c.id} type="button" role="option" aria-selected={c.id === consoleId} onClick={() => openConsole(c.id)} className={`cn-rrow ${c.id === consoleId ? 'on' : ''} ${st.kind}`}>
                    <ConsoleIcon c={c} size={16} box={22} />
                    <span className="cn-rname">{c.name}</span>
                    <span className="cn-st num">{st.kind === 'loaded' ? n0(st.count) : st.kind === 'loading' ? '…' : '–'}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
  const action = current
    ? (curState?.kind === 'loaded' && !busy && <button type="button" className="fchip" onClick={() => enqueue([current.id], { force: true, first: true })} title={`Fetch ${current.name}'s game list again`}><RefreshCw size={12} />Refresh</button>)
    : (!busy && consoles && catalog && (notAllSaved
        ? <button type="button" className="fchip on" onClick={() => loadAll(false)}><Download size={12} />{savedConsoles === 0 ? 'Load every console' : `Load the other ${consoles.length - savedConsoles}`}</button>
        : <button type="button" className="fchip" onClick={() => loadAll(true)} title="Fetch every console's game list again"><RefreshCw size={12} />Refresh all</button>));
  const withSets = current && catalog?.[current.id] ? catalog[current.id].filter(g => g.numAchievements > 0).length : null;
  const header = (
    <header className={`cn-head ${inside ? '' : 'norail'}`}>
      {pick}
      <div key={consoleId ?? 'all'} className="cn-title anim-fade">
        {current ? <ConsoleIcon c={current} size={30} box={44} /> : <span className="cn-icon" style={{ width: 44, height: 44 }}><Layers size={20} color="var(--accent)" /></span>}
        <div className="min-w-0 flex-1">
          <h1 className="truncate">{current ? current.name : 'All consoles'}</h1>
          {current
            ? (curState.kind === 'loaded' ? <span className="cn-st"><b className="num">{n0(curState.count)}</b> games<span className="text-ink-4">·</span><b className="num">{n0(withSets)}</b> with sets</span> : <StateLine st={curState} />)
            : <span className="cn-st"><b className="num">{n0(allGames.length)}</b> games<span className="text-ink-4">·</span>{consoles ? <><b className="num">{savedConsoles}</b> of {consoles.length} consoles</> : '…'}</span>}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <div key={`p-${consoleId ?? 'all'}`} className="drec-top sledger anim-fade" style={{ alignItems: 'center' }}>
        {current ? (() => {
          const pct = v => coverage?.total ? v / coverage.total * 100 : 0;
          return (<>
            {ring(pct(coverage?.played || 0), 'var(--accent)', 'var(--gold)', pct(coverage?.mastered || 0), coverage ? <>{Math.round(pct(coverage.played))}<small>%</small></> : '–')}
            <div className="dledger" style={{ flex: 1 }}>
              <div className="dl-row"><span className="dl-k">Sets played</span><span className="dl-dots" /><span className="dl-v" style={{ color: 'var(--accent)' }}>{coverage ? <>{n0(coverage.played)}<small> of {n0(coverage.total)}</small></> : '–'}</span></div>
              <div className="dl-row"><span className="dl-k">Mastered</span><span className="dl-dots" /><span className="dl-v" style={{ color: coverage?.mastered ? 'var(--gold)' : 'var(--ink-3)' }}>{coverage ? n0(coverage.mastered) : '–'}</span></div>
            </div>
          </>);
        })() : (() => {
          const pct = consoles?.length ? savedConsoles / consoles.length * 100 : 0;
          return (<>
            {ring(pct, 'var(--accent)', null, 0, <>{Math.round(pct)}<small>%</small></>)}
            <div className="dledger" style={{ flex: 1 }}>
              <div className="dl-row"><span className="dl-k">Consoles saved</span><span className="dl-dots" /><span className="dl-v" style={{ color: 'var(--accent)' }}>{savedConsoles}<small> of {consoles ? consoles.length : '–'}</small></span></div>
              <div className="dl-row"><span className="dl-k">Games saved</span><span className="dl-dots" /><span className="dl-v">{n0(allGames.length)}</span></div>
            </div>
          </>);
        })()}
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <Topbar crumbs={[{ label: 'Cheevodex', href: '../profile/' }, current ? { label: 'Consoles', href: '?' } : { label: 'Consoles' }, ...(current ? [{ label: current.name }] : [])]} />
      <main className={`flex-1 mx-auto w-full px-4 md:px-8 pt-8 pb-16 md:pt-5 md:pb-8 ${inside ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <div className={inside ? 'cn-layout' : ''}>
          {inside && <div className="cn-rail-col">{rail}</div>}
          <div className="min-w-0 flex flex-col gap-4">
            {header}
            {consolesError && <div className="cn-none"><b>The console list didn't load.</b><button type="button" className="fchip" onClick={() => location.reload()}>Try again</button></div>}
            <div className="flex flex-col gap-2">{searchBox}{(inside) && achChips}</div>
            {/* under the search, so loading never moves the field you're about to type in */}
            {loadBar}
            {inside ? <div key={`${consoleId}-${term}-${ach}`} className="anim-fade">{list}</div>
              : consoles === null || catalog === null ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{[...Array(12)].map((_, i) => <div key={i} className="shimmer h-[58px] rounded-[3px]" />)}</div>
              ) : (<>
                <div className="frow" role="group" aria-label="Group consoles">
                  <span className="text-[11px] text-ink-3 shrink-0">Group by</span>
                  {[['publisher', 'Maker'], ['era', 'Generation']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setGroup(v)} aria-pressed={grouping === v} className={`fchip ${grouping === v ? 'on' : ''}`}>{l}</button>
                  ))}
                </div>
                {cards}
              </>)}
          </div>
        </div>
      </main>
      <Footer label={`Cheevodex · ${current ? current.name : 'Consoles'}`} raHref={current ? `https://retroachievements.org/system/${current.id}/games` : 'https://retroachievements.org/system'} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<ConsolesApp />);
