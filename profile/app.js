import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Gamepad2, Activity, BarChart2, Award, Star, ChevronDown, ChevronUp, AlertCircle, Trophy, Crown, Lock, Unlock, AlertTriangle, Flame, Feather, Medal, ShieldOff, CircleDashed, X, Clock, Layers, Users, Loader2, RefreshCw, RotateCcw, ArrowLeftRight, PieChart, TrendingUp, List, LayoutGrid, Search, Check, Plus, Radio, ArrowDown, Hourglass, User, BookMarked, Circle, CircleDot } from 'lucide-react';
import { MEDIA_URL, SITE_URL, TILDE_TAG_COLORS } from './utils/constants.js';
import { getMediaUrl, parseTitle, formatTimeAgo } from './utils/helpers.js';
import { transformData } from './utils/transform.js';
import {
  getCredentials, clearCredentials,
  fetchProfile, fetchAllAchievements, clearProgress, fetchBacklog, fetchGameDetails,
  fetchSocial, fetchFriendsActivity, allFriendsCached, getUserCompletionProgress,
  getBacklog,
  getSocialData,
  staleFriendActivity, clearAllFriendActivity,
  getSocialProfileMap, fetchAndCacheSocialProfiles,
  getSocialProfilesSyncTs, setSocialProfilesSyncTs, PROFILE_SYNC_TTL,
} from './utils/ra-api.js';
import { Topbar, Footer } from '../assets/ui.js';
import { useSheet, ArtBg } from '../assets/sheet.js';
import { TabBar, useSwipeTabs, scrollToTabs } from '../assets/tabs.js';
import { useGameView, shortAgo } from '../assets/game-view.js';
import { CompletionsPanel } from '../assets/completions.js';
import { ActivitySummary, useSummaryOpen, computeStreak, yearOf, DayHead, UnlockRow, ActivitySkeleton, TimelineSkeleton } from '../assets/activity-ui.js';
import { dayKey, addDays, fmtClock, fmtDayKey, TZ } from '../assets/time.js';

const _visitedUser = new URLSearchParams(window.location.search).get('u');
const compareParam = _visitedUser ? `&compare=${encodeURIComponent(_visitedUser)}` : '';

const toLocalDay = (str) => {
  if (!str) return '';
  const s = str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const toLocalTime = (str) => {
  if (!str) return '';
  const s = str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// --- JSX Helpers ---
const timeAgo = (ts) => {
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

const renderTildeTags = (tags) => {
  if (!tags || tags.length === 0) return null;
  return tags.map(tag => {
    const style = TILDE_TAG_COLORS[tag] || TILDE_TAG_COLORS['Prototype'];
    return (
      <span key={tag} style={{
        fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
        padding: '1px 4px', borderRadius: '2px',
        border: `1px solid ${style.border}`, background: style.bg, color: style.color,
        flexShrink: 0,
      }}>{tag}</span>
    );
  });
};

// --- Components ---



// Status colour of a game: gold mastered, silver beaten, blue in progress, line not started
const gameStatus = (game) =>
  game.isMastered ? { key: 'mastered', color: 'var(--gold)', label: 'Mastered' }
  : game.isBeaten ? { key: 'beaten', color: 'var(--silver)', label: 'Beaten' }
  : game.achievementsUnlocked > 0 ? { key: 'progress', color: 'var(--accent)', label: 'In progress' }
  : game.achievementsTotal > 0 ? { key: 'none', color: 'var(--line-2)', label: 'Not started' }
  : { key: 'noach', color: 'var(--line-faint)', label: 'No achievements' };

// Segmented progress (doc-012): up to 20 segments filling in turn; only mastered glows
const SegBar = ({ pct, total, color, glow = false }) => {
  const n = Math.max(1, Math.min(total || 20, 20));
  const filled = Math.max(0, Math.min(100, pct || 0)) / 100 * n;
  return (
    <div className={`segbar${glow ? ' glow' : ''}`} role="img" aria-label={`${Math.round(pct || 0)}% complete`}>
      {Array.from({ length: n }, (_, i) => {
        const f = Math.max(0, Math.min(1, filled - i));
        return <i key={i}>{f > 0 && <b style={{ width: `${f * 100}%`, background: color }} />}</i>;
      })}
    </div>
  );
};

// List / tiles switch for the profile game lists (assets/game-view.js remembers the choice)
const ViewToggle = ({ view, onChange }) => (
  <div className="vtoggle" role="group" aria-label="Game list view">
    <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => onChange('list')} title="List"><List size={14} /></button>
    <button type="button" className={view === 'tiles' ? 'on' : ''} aria-pressed={view === 'tiles'} onClick={() => onChange('tiles')} title="Tiles"><LayoutGrid size={14} /></button>
  </div>
);

const GameTile = ({ game }) => {
  const st = gameStatus(game);
  const hasAch = game.achievementsTotal > 0;
  return (
    <a href={`../game/?id=${game.id}${compareParam}`} className={`gtile ${st.key}`} style={{ borderBottomColor: st.color }}>
      <div className="gtile-art">
        {game.background && <img className="bg" src={game.background} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />}
        <img className="icon" src={game.icon} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
        {game.lastPlayed && <span className="gtile-ago">{game.lastPlayed}</span>}
        {hasAch && game.achievementsUnlocked > 0 && (
          <span className="gtile-mode" style={{ borderColor: game.hardcore ? 'rgb(var(--c-hc) / 0.5)' : 'var(--line-2)', color: game.hardcore ? 'var(--hc)' : 'var(--ink-2)' }}
            title={game.hardcore ? 'Hardcore' : 'Softcore'}>
            {game.hardcore ? <Flame size={11} /> : <Feather size={11} />}
          </span>
        )}
      </div>
      <div className="gtile-body">
        <div className="gtile-title">{game.baseTitle || game.title}</div>
        {game.isSubset && game.subsetName && <div className="text-[10px] text-gold-dim truncate -mt-1">{game.subsetName}</div>}
        <div className="gtile-sub"><Gamepad2 size={11} className="shrink-0" /><span className="shrink">{game.console}</span></div>
        <div className="gtile-meta">
          {hasAch
            ? <span className="num"><b>{game.achievementsUnlocked}</b>/{game.achievementsTotal}</span>
            : <span>No achievements</span>}
          <span style={{ color: st.key === 'none' || st.key === 'noach' ? 'var(--ink-3)' : st.color }}>{hasAch ? st.label : ''}</span>
        </div>
        {hasAch && <SegBar pct={game.rawProgress} total={game.achievementsTotal} color={st.color} glow={st.key === 'mastered'} />}
      </div>
    </a>
  );
};

// ── Game list rows (Savepoint's GameListRow; styles .grow / .glist in assets/ui.css) ──
// RA dates come as "YYYY-MM-DD HH:MM:SS" (UTC) or ISO; Safari can't parse the former
const raDateMs = s => {
  if (!s) return 0;
  const t = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime();
  return Number.isNaN(t) ? 0 : t;
};
// Search text without accents or case, so "pokemon" finds "Pokémon"
const fold = str => (str ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const ModeIcon = ({ game, size = 11 }) => {
  if (!game.achievementsUnlocked) return null;
  return game.hardcore
    ? <Flame size={size} className="text-hc shrink-0" aria-label="Hardcore" />
    : <Feather size={size} className="text-ink-2 shrink-0" aria-label="Softcore" />;
};

// Count beside a small completion ring (Cheevodex's ring motif, CHV-040)
const GameProgress = ({ game }) => (
  <>
    <span className="gcount num" style={game.isMastered ? { color: 'var(--gold)' } : undefined}>
      {game.achievementsUnlocked}<span>/{game.achievementsTotal}</span>
    </span>
    <span className={`dring ${game.isMastered ? 'full' : ''}`} title={`${Math.floor(game.rawProgress)}% complete`}
      style={{ '--p': game.rawProgress, '--c': game.isMastered ? 'var(--gold)' : game.isBeaten ? 'var(--silver)' : 'var(--accent)', '--s': '26px', '--w': '4px' }} />
  </>
);

// One compact row: icon, title, console + subset + tags + mode, playtime · last played, count and bar,
// the game's screenshot faded in on the right, status colour on the left edge. Links to the game page.
const GameListRow = ({ game, extra = null }) => {
  const hasAch = game.achievementsTotal > 0;
  const ago = shortAgo(raDateMs(game.lastPlayedStr));
  return (
    <a href={`../game/?id=${game.id}${compareParam}`} className="grow" style={{ borderLeftColor: gameStatus(game).color }}>
      {game.background && <div className="grow-art"><img src={game.background} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>}
      <img src={game.icon} alt="" loading="lazy" className="grow-icon" />
      <div className="grow-main">
        <span className="grow-title"><span className="dex-no mr-1.5 align-[1px]">No.<b>{game.id}</b></span>{game.baseTitle || game.title}</span>
        <div className="grow-sub">
          <span className="text-accent keep">{game.console}</span>
          {game.isSubset && game.subsetName && <span className="text-gold-dim shrink">{game.subsetName}</span>}
          {renderTildeTags(game.tags)}
          <ModeIcon game={game} />
          <span className="shrink">{[game.playtime !== 'Unknown' ? game.playtime : null, ago].filter(Boolean).join(' · ')}</span>
        </div>
        {extra}
      </div>
      <div className="grow-prog dprog">
        {hasAch ? <GameProgress game={game} /> : <span className="text-[11px] text-ink-3">No achievements</span>}
      </div>
    </a>
  );
};

const GameViewSkeleton = ({ view, count = 4 }) => view === 'tiles' ? (
  <div className="gtiles">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="gtile"><div className="gtile-art shimmer" /><div className="gtile-body"><div className="shimmer h-3 w-3/4 rounded-[2px]" /><div className="shimmer h-2.5 w-1/2 rounded-[2px]" /><div className="shimmer h-1 rounded-[2px]" /></div></div>
    ))}
  </div>
) : (
  <div className="glist">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="grow"><div className="grow-icon shimmer" /><div className="grow-main"><div className="shimmer h-3 w-2/3 rounded-[2px]" /><div className="shimmer h-2.5 w-1/2 rounded-[2px]" /></div></div>
    ))}
  </div>
);

// ── The dex (Cheevodex's own: .dexc / .dgrid / .dent in assets/ui.css) ─────────
// The codex of the player's cheevos: every game they've played is an entry, numbered by its RA game ID,
// in RA's own states (played, beaten, mastered); an entry with no unlocks yet shows its icon dimmed.
const dexState = g => g.isMastered ? 'mastered' : g.isBeaten ? 'beaten' : 'played';
const dexCounts = games => {
  const played = games.length;
  const started = games.filter(g => g.achievementsUnlocked > 0).length;
  const beaten = games.filter(g => g.isBeaten || g.isMastered).length;
  const mastered = games.filter(g => g.isMastered).length;
  return { played, started, beaten, mastered };
};

// Played / Beaten / Mastered with a bar each (started, beaten and mastered as a share of played)
const DexCounter = ({ counts, onPick }) => {
  const pct = n => counts.played ? (n / counts.played) * 100 : 0;
  const cells = [
    { key: 'all',      label: 'Played',   n: counts.played,   bar: pct(counts.started),  c: 'var(--accent)', title: `${counts.played} games played, ${counts.started} with unlocks` },
    { key: 'beaten',   label: 'Beaten',   n: counts.beaten,   bar: pct(counts.beaten),   c: 'var(--silver)', title: `${counts.beaten} beaten or mastered` },
    { key: 'mastered', label: 'Mastered', n: counts.mastered, bar: pct(counts.mastered), c: 'var(--gold)',   title: `${counts.mastered} mastered` },
  ];
  return (
    <div className="dexc" role="list" aria-label="Dex">
      {cells.map(cl => {
        const Tag = onPick ? 'button' : 'div';
        return (
          <Tag key={cl.key} role="listitem" type={onPick ? 'button' : undefined} onClick={onPick ? () => onPick(cl.key) : undefined}
            className={`dexc-cell ${cl.key}`} style={{ '--c': cl.c }} title={cl.title}>
            <span>{cl.label}</span>
            <b>{cl.n.toLocaleString()}</b>
            <i><u style={{ width: `${cl.bar}%` }} /></i>
          </Tag>
        );
      })}
    </div>
  );
};

const DEX_STATE_ICON = {
  mastered: <Star size={11} className="text-gold" fill="currentColor" aria-label="Mastered" />,
  beaten:   <Medal size={11} className="text-silver" aria-label="Beaten" />,
  played:   <CircleDot size={11} className="text-accent" aria-label="In progress" />,
  unstarted: <Circle size={11} className="text-ink-4" aria-label="Not started" />,
};

const DexEntry = ({ game }) => {
  const st = dexState(game);
  const unstarted = game.achievementsUnlocked === 0 && st === 'played';
  const hasAch = game.achievementsTotal > 0;
  return (
    <a href={`../game/?id=${game.id}${compareParam}`} className={`dent ${st} ${unstarted ? 'unstarted' : ''}`} title={game.title}>
      <div className="dent-top">
        <span className="dex-no">No.<b>{game.id}</b></span>
        <span className="dent-st">{DEX_STATE_ICON[unstarted ? 'unstarted' : st]}</span>
      </div>
      <div className="dent-pic"><img src={game.icon} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /></div>
      <span className="dent-t">{game.baseTitle || game.title}</span>
      <span className="dent-c">{game.isSubset && game.subsetName ? game.subsetName : game.console}</span>
      <div className="dent-m">
        {hasAch ? <span><b>{game.achievementsUnlocked}</b>/{game.achievementsTotal}</span> : <span className="text-ink-3">No set</span>}
        {hasAch && <span>{Math.floor(game.rawProgress)}%</span>}
      </div>
    </a>
  );
};

const DEX_FILTERS = [
  { value: 'all',      label: 'All'      },
  { value: 'unbeaten', label: 'Unbeaten' },
  { value: 'beaten',   label: 'Beaten'   },
  { value: 'mastered', label: 'Mastered' },
];
const DEX_SORTS = [
  { value: 'no',       label: 'Dex No.'     },
  { value: 'recent',   label: 'Last played' },
  { value: 'progress', label: 'Progress'    },
  { value: 'title',    label: 'Title'       },
];

const DexTab = ({ games, filter, onFilter }) => {
  const [search, setSearch] = useState('');
  const [consoleName, setConsoleName] = useState('all');
  const [sort, setSort] = useState('no');
  const consoles = useMemo(() => {
    const m = new Map();
    games.forEach(g => m.set(g.console, (m.get(g.console) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [games]);
  const inScope = games.filter(g => (consoleName === 'all' || g.console === consoleName)
    && (!search || fold(g.baseTitle || g.title).includes(fold(search)) || fold(g.subsetName).includes(fold(search)) || String(g.id) === search.trim()));
  const counts = {
    all: inScope.length,
    unbeaten: inScope.filter(g => !g.isBeaten && !g.isMastered).length,
    beaten: inScope.filter(g => g.isBeaten || g.isMastered).length,
    mastered: inScope.filter(g => g.isMastered).length,
  };
  const shown = inScope
    .filter(g => filter === 'all' || (filter === 'unbeaten' ? !g.isBeaten && !g.isMastered : filter === 'beaten' ? g.isBeaten || g.isMastered : g.isMastered))
    .sort(sort === 'recent' ? (a, b) => raDateMs(b.lastPlayedStr) - raDateMs(a.lastPlayedStr)
        : sort === 'progress' ? (a, b) => b.rawProgress - a.rawProgress || a.id - b.id
        : sort === 'title' ? (a, b) => (a.baseTitle || a.title).localeCompare(b.baseTitle || b.title)
        : (a, b) => a.id - b.id);
  // Shown as an index (grouped by console, biggest volume first) in Dex No. order with no console or search picked
  const asIndex = sort === 'no' && consoleName === 'all' && !search;
  const volumes = useMemo(() => {
    if (!asIndex) return [];
    const m = new Map();
    shown.forEach(g => { if (!m.has(g.console)) m.set(g.console, []); m.get(g.console).push(g); });
    return [...m.entries()].map(([name, gs]) => ({
      name, games: gs,
      beaten: gs.filter(g => g.isBeaten && !g.isMastered).length,
      mastered: gs.filter(g => g.isMastered).length,
    })).sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
  }, [asIndex, shown]);
  const volId = name => `dex-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  return (
    <div className="flex flex-col gap-3">
      {/* Search, then console and sort (one row from md); then the state chips with counts */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="fsearch">
            <Search size={14} />
            <input type="text" inputMode="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the dex or a No." aria-label="Search the dex" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={13} /></button>}
          </div>
          <div className="flex gap-2 md:shrink-0">
            <span className="fselect-w !max-w-none flex-1 md:flex-none md:w-[200px]">
              <select value={consoleName} onChange={e => setConsoleName(e.target.value)} className="fselect" aria-label="Console">
                <option value="all">All consoles</option>
                {consoles.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
              </select>
            </span>
            <span className="fselect-w !max-w-none">
              <select value={sort} onChange={e => setSort(e.target.value)} className="fselect" aria-label="Sort">
                {DEX_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </span>
          </div>
        </div>
        <div className="frow" role="group" aria-label="Show">
          {DEX_FILTERS.map(f => (
            <button type="button" key={f.value} onClick={() => onFilter(f.value)} aria-pressed={filter === f.value}
              className={`fchip ${filter === f.value ? 'on' : ''}`}>{f.label}<span className="n num">{counts[f.value].toLocaleString()}</span></button>
          ))}
        </div>
      </div>
      {/* Index line, and the console jump list when the dex is shown as an index */}
      <div className="dindex"><b>{inScope.length.toLocaleString()}</b> dexes · <b>{new Set(inScope.map(g => g.console)).size}</b> consoles</div>
      {asIndex && volumes.length > 1 && (
        <div className="frow" role="navigation" aria-label="Jump to console">
          {volumes.map(v => (
            <button type="button" key={v.name} className="fchip" onClick={() => document.getElementById(volId(v.name))?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
              {v.name}<span className="n num">{v.games.length}</span>
            </button>
          ))}
        </div>
      )}
      {shown.length === 0
        ? <div className="text-center py-12 text-ink-3 text-[12px]">No dexes match.</div>
        : asIndex
          ? <div key={`${filter}-idx`} className="anim-fade tl-tabs">
              {volumes.map(v => (
                <section key={v.name} id={volId(v.name)} className="dvol">
                  <div className="dvol-h">
                    <span className="dvol-t">{v.name}</span>
                    <span className="dvol-n">{v.games.length}</span>
                    <span className="dvol-m">
                      {v.beaten > 0 && <span><b className="text-silver">{v.beaten}</b> beaten</span>}
                      {v.mastered > 0 && <span><b className="text-gold">{v.mastered}</b> mastered</span>}
                    </span>
                  </div>
                  <div className="dgrid">{v.games.map(g => <DexEntry key={g.id} game={g} />)}</div>
                </section>
              ))}
            </div>
          : <div key={`${filter}-${sort}-${consoleName}`} className="dgrid anim-fade">{shown.map(g => <DexEntry key={g.id} game={g} />)}</div>}
    </div>
  );
};

// ── Overview stat tiles (styles .stiles / .stile in assets/ui.css) ─────────────
// User stats as index lines: label, dotted leader, value (Cheevodex's codex motif, CHV-040)
const StatTiles = ({ items }) => (
  <div className="sledger dledger">
    {items.map(st => {
      // "#37,546 of 172,642": the total after the rank as small text
      const [main, rest] = String(st.value).split(/ (?=of )/);
      return (
        <div key={st.label} className="dl-row">
          <span className="dl-k">{st.label}</span><span className="dl-dots" />
          <span className={`dl-v ${st.dim ? '!text-ink-3 italic !font-normal' : ''}`} title={st.value}>{main}{rest && <small>{rest}</small>}</span>
        </div>
      );
    })}
  </div>
);
// Shorter labels for the tiles
const STAT_LABELS = {
  'Points earned in the last 7 days': 'Points, last 7 days',
  'Points earned in the last 30 days': 'Points, last 30 days',
  'Average points per week': 'Avg points per week',
};

// ── Progress filter bar (Savepoint's ProgressFilterBar; .frow / .fchip / .fbar in assets/ui.css) ──
// Views bucket started-but-unfinished games, first match wins: nearly there → in progress → abandoned.
// "Nearly there" ignores recency on purpose — a game dropped at 80% is the one most worth picking back up.
const NEARLY_PCT = 75;
const STALE_MS   = 30 * 24 * 60 * 60 * 1000;
const PROGRESS_VIEWS = [
  { value: 'all',        label: 'All'          },
  { value: 'nearly',     label: 'Nearly there', rules: [[Trophy, <><b>75%+</b> done</>], [ArrowDown, 'Fewest left first']] },
  { value: 'inprogress', label: 'In progress',  rules: [[Clock, <>Played in the last <b>30</b> days</>], [ArrowDown, 'Most recent first']] },
  { value: 'abandoned',  label: 'Abandoned',    rules: [[Hourglass, 'Unfinished'], [Clock, <>Idle <b>30+</b> days</>]] },
];
const PROGRESS_SORTS = [
  { value: 'overall', label: 'Overall %'   },
  { value: 'recent',  label: 'Last played' },
];

const applyProgressView = (games, view) => {
  const now = Date.now();
  const isNearly = g => !g.isMastered && g.rawProgress >= NEARLY_PCT;
  const isStale  = g => { const t = raDateMs(g.lastPlayedStr); return !t || now - t > STALE_MS; };
  const byRecency = (a, b) => raDateMs(b.lastPlayedStr) - raDateMs(a.lastPlayedStr);
  const left = g => g.achievementsTotal - g.achievementsUnlocked;
  if (view === 'nearly')     return games.filter(isNearly).sort((a, b) => (left(a) - left(b)) || (b.rawProgress - a.rawProgress));
  if (view === 'inprogress') return games.filter(g => !g.isMastered && !isNearly(g) && !isStale(g)).sort(byRecency);
  if (view === 'abandoned')  return games.filter(g => !g.isMastered && !isNearly(g) && isStale(g)).sort(byRecency);
  return null; // 'all': the caller applies its sort and the Mastered toggle
};
const progressViewCounts = (games, showMastered) => Object.fromEntries(PROGRESS_VIEWS.map(v => [v.value,
  v.value === 'all' ? games.filter(g => showMastered || !g.isMastered).length : applyProgressView(games, v.value).length]));

const SearchField = ({ value, onChange }) => (
  <div className="fsearch">
    <Search size={14} />
    <input type="text" inputMode="search" value={value} onChange={e => onChange(e.target.value)} placeholder="Search games" aria-label="Search games" />
    {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search"><X size={13} /></button>}
  </div>
);

const ProgressFilterBar = ({ view, onView, sort, onSort, showMastered, onShowMastered, counts, search, onSearch, viewToggle }) => {
  const rules = PROGRESS_VIEWS.find(v => v.value === view)?.rules;
  return (
    <div className="flex flex-col gap-2.5 mb-1 anim-fade">
      <div className="frow" role="group" aria-label="Show">
        {PROGRESS_VIEWS.map(v => (
          <button type="button" key={v.value} onClick={() => onView(v.value)} aria-pressed={view === v.value}
            className={`fchip ${view === v.value ? 'on' : ''}`}>{v.label}{counts && <span className="n num">{counts[v.value].toLocaleString()}</span>}</button>
        ))}
        {view === 'all' && (
          <>
            <span className="fsep" />
            <button type="button" onClick={() => onShowMastered(v => !v)} aria-pressed={showMastered} title="Include mastered games"
              className={`fchip anim-fade ${showMastered ? 'on' : ''}`}>
              {showMastered ? <Check size={12} /> : <Plus size={12} />}Mastered
            </button>
          </>
        )}
      </div>
      <div className="fbar">
        <SearchField value={search} onChange={onSearch} />
        {view === 'all' && (
          <span className="fselect-w anim-fade">
            <select value={sort} onChange={e => onSort(e.target.value)} className="fselect" aria-label="Sort">
              {PROGRESS_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </span>
        )}
        {viewToggle}
      </div>
      {rules && <div key={view} className="crits anim-fade">{rules.map(([Icon, text], i) => <span key={i} className="crit"><Icon />{text}</span>)}</div>}
    </div>
  );
};

// ── RAchievementModal ─────────────────────────────────────────────────────────

const RAchievementModal = ({ game, onClose, loadingDetails }) => {
  const [lockFilter, setLockFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tooltip,    setTooltip]    = useState(null); // { content, rect }

  const showTip = (e, content) => setTooltip({ content, rect: e.currentTarget.getBoundingClientRect() });
  const hideTip = () => setTooltip(null);

  const filteredAchs = useMemo(() => {
    if (!game.achievements) return [];
    return game.achievements.filter(ach => {
      if (lockFilter === 'unlocked' && !ach.isUnlocked) return false;
      if (lockFilter === 'locked'   &&  ach.isUnlocked) return false;
      if (typeFilter === 'progression' && ach.type !== 'progression' && ach.type !== 'win_condition') return false;
      if (typeFilter === 'missable'    && ach.type !== 'missable') return false;
      return true;
    });
  }, [game.achievements, lockFilter, typeFilter]);

  const progAchs     = game.achievements?.filter(a => a.type === 'progression' || a.type === 'win_condition') ?? [];
  const progUnlocked = progAchs.filter(a => a.isUnlocked).length;
  const progPct      = progAchs.length > 0 ? (progUnlocked / progAchs.length) * 100 : null;

  const rootRef = useRef(null), panelRef = useRef(null), headRef = useRef(null);
  const close = useSheet({ panelRef, dragRef: headRef, rootRef, onClose });

  return (
    <div ref={rootRef} className="sheet-root" role="dialog" aria-modal="true" aria-label={game.title}>
      <div className="sheet-backdrop" onClick={close} />

      <div ref={panelRef} className="sheet-panel">
        {/* Header: blurred game art, grab handle (phone), close */}
        <div ref={headRef} className="sheet-head">
        <ArtBg urls={[game.background]} />
        <span className="sheet-grab" aria-hidden="true" />
        <button onClick={close} className="sheet-close" aria-label="Close">
          <X size={15} />
        </button>
        <div className="relative flex items-center gap-4 px-4 pt-3 pb-4 md:pt-4 pr-12 art-shadow">
          <a href={`../game/?id=${game.id}${compareParam}`}
            className="shrink-0 w-16 h-16 rounded-[2px] overflow-hidden border border-well bg-well hover:scale-105 transition-transform">
            <img src={game.icon} alt={game.title} className="w-full h-full object-cover" />
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`../game/?id=${game.id}${compareParam}`}
                  className="text-[15px] font-medium text-white hover:text-accent transition-colors leading-tight truncate">
                  {game.baseTitle || game.title}
                </a>
                {game.isSubset && (
                  <span className="text-[8px] font-bold uppercase tracking-[0.07em] px-1.5 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>
                )}
                {renderTildeTags(game.tags)}
              </div>
              {game.isSubset && game.subsetName && (
                <span className="text-[10px] text-gold-dim truncate">{game.subsetName}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2 text-[10px]">
              <span className="text-accent flex items-center gap-1"><Gamepad2 size={10} />{game.console}</span>
              <span className="text-ink-3">·</span>
              {!game.achievementsUnlocked ? null : game.hardcore ? (
                <span className="shrink-0 text-[9px] text-hc border border-hc/30 bg-well/60 px-1.5 py-[1px] rounded-sm font-semibold uppercase tracking-wider flex items-center gap-1"><Flame size={10} /> Hardcore</span>
              ) : (
                <span className="shrink-0 text-[9px] text-ink-2 border border-line-2 bg-well/60 px-1.5 py-[1px] rounded-sm font-semibold uppercase tracking-wider flex items-center gap-1"><Feather size={10} /> Softcore</span>
              )}
              {game.isMastered && (
                <span className="shrink-0 text-[9px] text-well bg-gold px-1.5 py-[1px] rounded-sm font-bold uppercase tracking-wider flex items-center gap-1"><Trophy size={10} /> Mastered</span>
              )}
              {game.isBeaten && !game.isMastered && (
                <span className="shrink-0 text-[9px] text-ink bg-chip px-1.5 py-[1px] rounded-sm font-bold uppercase tracking-wider border border-silver/40 flex items-center gap-1"><Medal size={10} /> Beaten</span>
              )}
            </div>
            {/* Progress bars */}
            <div className="flex flex-col gap-1">
              {progPct !== null && (
                <div className="flex items-center gap-2">
                  <span className="w-[64px] shrink-0 text-[8px] text-ink-3 uppercase tracking-wider text-right">Progression</span>
                  <div className="flex-1 bg-well h-[3px] rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm bg-gold" style={{ width: `${progPct}%` }} />
                  </div>
                  <span className="text-[9px] text-gold shrink-0">{progUnlocked}/{progAchs.length}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-[64px] shrink-0 text-[8px] text-ink-3 uppercase tracking-wider text-right">Overall</span>
                <div className="flex-1 bg-well h-[3px] rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm ${game.isMastered ? 'bg-gold' : 'bg-accent'}`} style={{ width: `${game.rawProgress}%` }} />
                </div>
                <span className="text-[9px] text-ink-2 shrink-0">
                  <span className="text-ink">{game.achievementsUnlocked}</span>/{game.achievementsTotal}
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Game meta row */}
        {(game.genre || game.developer || game.released) && (
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-well flex-wrap shrink-0">
            {game.genre    && <span className="text-[9px] text-ink-2 flex items-center gap-1"><Gamepad2 size={9} className="text-ink-3" />{game.genre}</span>}
            {game.genre    && (game.developer || game.released) && <span className="text-line-2 text-[9px]">·</span>}
            {game.developer && <span className="text-[9px] text-ink-2 flex items-center gap-1"><BarChart2 size={9} className="text-ink-3" />{game.developer}</span>}
            {game.developer && game.released && <span className="text-line-2 text-[9px]">·</span>}
            {game.released  && <span className="text-[9px] text-ink-2">{game.released}</span>}
          </div>
        )}

        {/* Filter bar — two rows */}
        <div className="flex flex-col px-4 py-2 border-b border-well gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] uppercase tracking-wider text-ink-3 w-[44px] shrink-0">Status</span>
            {[
              { value: 'all',      label: 'All',      icon: null },
              { value: 'unlocked', label: 'Unlocked', icon: <Unlock size={9} /> },
              { value: 'locked',   label: 'Locked',   icon: <Lock size={9} /> },
            ].map(opt => (
              <button key={opt.value} onClick={() => setLockFilter(opt.value)}
                className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-sm border transition-colors flex items-center gap-1 ${
                  lockFilter === opt.value
                    ? 'bg-accent text-well border-accent'
                    : 'bg-well text-ink-2 border-line-2 hover:text-ink hover:border-ink-3'
                }`}>{opt.icon}{opt.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] uppercase tracking-wider text-ink-3 w-[44px] shrink-0">Type</span>
            {[
              { value: 'all',         label: 'All',         icon: null },
              { value: 'progression', label: 'Progression', icon: <Trophy size={9} /> },
              { value: 'missable',    label: 'Missable',    icon: <AlertTriangle size={9} /> },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTypeFilter(opt.value)}
                className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-sm border transition-colors flex items-center gap-1 ${
                  typeFilter === opt.value
                    ? 'bg-gold text-well border-gold'
                    : 'bg-well text-ink-2 border-line-2 hover:text-ink hover:border-ink-3'
                }`}>{opt.icon}{opt.label}</button>
            ))}
            <span className="ml-auto text-[9px] text-ink-3">{filteredAchs.length} / {game.achievements?.length ?? 0}</span>
          </div>
        </div>

        {/* Achievement list */}
        <div className="sheet-scroll px-4 py-3 space-y-1.5">
          {loadingDetails ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-[2px] border border-line bg-page">
                <div className="shimmer w-10 h-10 rounded-[2px] shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="shimmer h-3 w-2/3 rounded" />
                  <div className="shimmer h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))
          ) : filteredAchs.length > 0 ? filteredAchs.map(ach => {
            const casualPct   = game.totalPlayers   > 1 ? Math.min(100, (ach.numAwardedCasual   / game.totalPlayers)   * 100).toFixed(2) : null;
            const hardcorePct = game.totalPlayersHC > 1 ? Math.min(100, (ach.numAwardedHardcore / game.totalPlayersHC) * 100).toFixed(2) : null;
            return (
              <div key={ach.id}
                className={`flex items-center gap-3 p-2 rounded-[2px] border border-transparent border-l-[3px] transition-colors ${ach.isUnlocked ? 'bg-box-hi hover:bg-box-hover' : 'bg-page opacity-75 border-l-line-2'} ${ach.isHardcore ? 'border-l-gold' : ach.isUnlocked ? 'border-l-ink-2' : ''}`}
              >
                <a href={`../achievement/?id=${ach.id}`}
                  className="relative shrink-0 w-10 h-10 rounded-[2px] border border-well overflow-hidden bg-black hover:scale-105 transition-transform block">
                  <img src={`${MEDIA_URL}/Badge/${ach.badgeName || '00001'}.png`} alt={ach.title}
                    className={`w-full h-full object-cover ${!ach.isUnlocked ? 'grayscale brightness-40' : ''}`} />
                  {!ach.isUnlocked && <Lock size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50" />}
                </a>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <a href={`../achievement/?id=${ach.id}`}
                      className={`text-[12px] font-medium tracking-wide leading-tight transition-colors ${ach.isUnlocked ? 'text-gold hover:text-gold-hi' : 'text-ink-2 hover:text-ink'}`}>
                      {ach.title}
                    </a>
                    <span className="text-[9px] font-bold text-gold num bg-well border border-line-2 px-1.5 py-[1px] rounded-sm shrink-0">{ach.points} pts</span>
                    {ach.trueRatio > 0 && ach.points > 0 && (
                      <span className={`text-[9px] shrink-0 ${!ach.isUnlocked ? 'opacity-40' : ''}`} style={{ color: (() => { const r = ach.trueRatio / ach.points; return r >= 30 ? 'var(--hc)' : r >= 20 ? 'var(--gold)' : r >= 10 ? 'var(--accent)' : 'var(--ink-2)'; })() }}>×{(ach.trueRatio / ach.points).toFixed(1)}</span>
                    )}
                    {ach.type === 'progression' && <span className="shrink-0 cursor-help inline-flex items-center" onMouseEnter={e => showTip(e, <><div className="pop-name" style={{color:'var(--gold)'}}>Progression</div><div className="pop-sub">Required to complete the game</div></>)} onMouseLeave={hideTip}><Trophy size={11} className="text-gold" /></span>}
                    {ach.type === 'win_condition' && <span className="shrink-0 cursor-help inline-flex items-center" onMouseEnter={e => showTip(e, <><div className="pop-name" style={{color:'var(--hc)'}}>Win Condition</div><div className="pop-sub">Triggers game completion</div></>)} onMouseLeave={hideTip}><Crown size={11} className="text-hc" /></span>}
                    {ach.type === 'missable' && <span className="shrink-0 cursor-help inline-flex items-center" onMouseEnter={e => showTip(e, <><div className="pop-name" style={{color:'var(--warn)'}}>Missable</div><div className="pop-sub">Can be permanently missed</div></>)} onMouseLeave={hideTip}><AlertTriangle size={11} className="text-warn" /></span>}
                  </div>

                  <p className="text-[10px] text-ink-2 leading-snug mb-1.5">{ach.description}</p>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="relative h-1.5 bg-well rounded-full overflow-hidden w-full max-w-[180px]">
                        {casualPct !== null && <div className="absolute top-0 left-0 h-full bg-ink-3" style={{ width: `${casualPct}%` }} />}
                        {hardcorePct !== null && <div className="absolute top-0 left-0 h-full bg-hc" style={{ width: `${hardcorePct}%` }} />}
                      </div>
                      <div className="flex justify-between text-[8px] font-medium w-full max-w-[180px]">
                        {hardcorePct !== null && <span className="flex items-center gap-0.5 text-hc"><Flame size={8} />{hardcorePct}%</span>}
                        {casualPct !== null && <span className="flex items-center gap-0.5 text-ink-3"><Feather size={8} />{casualPct}%</span>}
                      </div>
                    </div>
                    {ach.isUnlocked && (
                      <p className="text-[9px] text-accent shrink-0">Unlocked: {new Date(ach.unlockDate).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-8 text-ink-3 text-[11px]">No achievements match the current filters.</div>
          )}
        </div>
      </div>

      {/* Fixed-position tooltip — escapes scroll container, always above hovered element */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-[9999] bg-bar border border-line rounded-[2px] px-2 py-1.5 shadow-lg"
          style={{ left: tooltip.rect.left + tooltip.rect.width / 2, top: tooltip.rect.top - 7, transform: 'translate(-50%, -100%)' }}
        >
          {tooltip.content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid var(--line)' }} />
        </div>
      )}
    </div>
  );
};

// A friend's colour, computed from their username: one hash (FNV-1a, scrambled) gives the hue (70°–330°, skipping
// red, orange and gold, which mean errors, hardcore and earned), the saturation (55–90%) and the lightness (60–76%,
// so it always reads on the dark page). About 9,800 colours; same name, same colour, everywhere
const friendColor = (u) => {
  let h = 0x811c9dc5;
  for (const ch of String(u).toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;  // spread short names
  h >>>= 0;
  const hue = 70 + (h % 261), sat = 55 + ((h >>> 9) % 36), light = 60 + ((h >>> 17) % 17);
  return `hsl(${hue} ${sat}% ${light}%)`;
};

// ── FriendRun / FriendPost — the Friends timeline: one post per friend per stretch of the day (their runs back
// to back), avatar on the day's rail; each run is a game line with +N, then its badges, opening to the full rows ──
// A run's mode from its unlocks: all hardcore, all softcore, or both
const runMode = achs => {
  const hc = achs.filter(a => a.hardcoreMode).length;
  return hc === achs.length ? 'hc' : hc === 0 ? 'sc' : 'mix';
};

// The game strip at the head of a run (Mine and Friends): icon, title with Subset / tilde tags, subset name, mode
// icon, console and time range; +N and points in gold. `achs` newest first; `icon` already a media URL
const RunStrip = ({ href, gameTitle, icon, consoleName, achs, mode, runTitle }) => {
  const { p } = runTitle(gameTitle);
  const t0 = fmtClock(achs[achs.length - 1].date), t1 = fmtClock(achs[0].date);
  const pts = achs.reduce((t, a) => t + (a.points || 0), 0);
  return (
    <a href={href} className="frun-h">
      {icon ? <img src={icon} alt="" loading="lazy" className="frun-icon" /> : <span className="trow-ph frun-icon" />}
      <span className="frun-main">
        <span className="frun-t">
          <span className="truncate">{p.baseTitle}</span>
          {p.isSubset && <span className="subset-tag">Subset</span>}
          {!p.isSubset && renderTildeTags(p.tags)}
        </span>
        {p.isSubset && <span className="frun-sub">{p.subsetName}</span>}
        <span className="frun-m">
          {mode === 'sc'
            ? <Feather size={11} className="text-ink-2 shrink-0" aria-label="Softcore" />
            : <Flame size={11} className={`shrink-0 ${mode === 'hc' ? 'text-gold' : 'text-ink-2'}`} aria-label={mode === 'hc' ? 'Hardcore' : 'Hardcore and softcore'} />}
          {consoleName && <span className="truncate">{consoleName}</span>}
          <span className="num shrink-0">{t0 === t1 ? t0 : `${t0}–${t1}`}</span>
        </span>
      </span>
      <span className="frun-e">
        <b>+{achs.length}</b>
        <span>{pts} pts</span>
      </span>
    </a>
  );
};

// Your own run (Mine): the strip, then the full unlock rows; runs over five fold after four
const MyRun = ({ session, unlockRow, runTitle }) => {
  const [open, setOpen] = useState(false);
  const achs = useMemo(() => [...session.achievements].sort((a, b) => b.date.localeCompare(a.date)), [session]);
  const mode = runMode(achs);
  const folded = achs.length > 5 && !open;
  const shown = folded ? achs.slice(0, 4) : achs;
  return (
    <div className={`frun mine ${mode}`}>
      <RunStrip href={`../game/?id=${session.gameId}`} gameTitle={session.gameTitle} icon={session.gameIcon}
        consoleName={session.consoleName} achs={achs} mode={mode} runTitle={runTitle} />
      <div className="frun-rows">{shown.map(unlockRow)}</div>
      {achs.length > 5 && (
        <button type="button" className="tmore" onClick={() => setOpen(o => !o)}>
          {open ? 'Show less' : `Show ${achs.length - 4} more`}
          <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
        </button>
      )}
    </div>
  );
};

const FriendRun = ({ run, user, unlockRow, runTitle }) => {
  const [open, setOpen] = useState(false);
  const achs = run.achievements;
  const mode = runMode(achs);
  return (
    <div className={`frun ${mode} ${open ? 'open' : ''}`}>
      <RunStrip href={`../game/?id=${run.gameId}&compare=${user}`} gameTitle={run.gameTitle} icon={getMediaUrl(run.gameIcon)}
        consoleName={run.consoleName} achs={achs} mode={mode} runTitle={runTitle} />
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="frun-b"
        aria-label={open ? 'Hide the unlocks' : `Show the ${achs.length} unlocks`}>
        {achs.slice(0, 10).map((a, i) => (
          <img key={`${a.achievementId}-${i}`} src={`${MEDIA_URL}/Badge/${a.badgeName}.png`} alt="" title={a.title} loading="lazy" className={a.hardcoreMode ? 'hc' : ''} />
        ))}
        {achs.length > 7 && <span className="frun-more sm:hidden">+{achs.length - 7}</span>}
        {achs.length > 10 && <span className="frun-more hidden sm:inline">+{achs.length - 10}</span>}
        <ChevronDown size={13} className="frun-c" />
      </button>
      {open && <div className="frun-rows anim-fade">{achs.map(unlockRow)}</div>}
    </div>
  );
};

const FriendPost = ({ post, pic, unlockRow, runTitle }) => {
  const n = post.runs.reduce((t, r) => t + r.achievements.length, 0);
  return (
    <div className="fpost anim-fade" style={{ '--fc': friendColor(post.username) }}>
      <a href={`../profile/?u=${post.username}`} className="fpost-av"><img src={pic} alt="" loading="lazy" /></a>
      <div className="fpost-main">
        <div className="fpost-h">
          <a href={`../profile/?u=${post.username}`} className="fpost-name">{post.username}</a>
          <span className="fpost-time num">{fmtClock(post.runs[0].latestDate)}</span>
          {post.runs.length > 1 && <span className="fpost-sum">+{n} in {post.runs.length} games</span>}
        </div>
        {post.runs.map(run => <FriendRun key={`${run.gameId}-${run.latestDate}`} run={run} user={post.username} unlockRow={unlockRow} runTitle={runTitle} />)}
      </div>
    </div>
  );
};

// ── ActivityTab Component ──────────────────────────────────────────────────

const ActivityTab = ({ achievements, refTime, heatmapData, games = [], loadingMore, allLoaded, socialView, setSocialView, friendsActivityStatus, setFriendsActivityStatus, friendsActivity, friendsFetchProgress, failedFriends, onRefreshFriends, onResetFriends, friendsActivityTs, ownUsername, socialProfileMap = new Map() }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [visibleSessionCount, setVisibleSessionCount] = useState(100);

  const heatmapScrollRef = useRef(null);
  const heatmapKeys = Object.keys(heatmapData).length;
  useEffect(() => {
    if (!heatmapScrollRef.current || heatmapKeys === 0) return;
    requestAnimationFrame(() => { heatmapScrollRef.current.scrollLeft = heatmapScrollRef.current.scrollWidth; });
  }, [heatmapKeys]);


  // Build day map: { 'YYYY-MM-DD': { count, points, achievements[] } }
  const dayMap = useMemo(() => {
    const map = {};
    achievements.forEach(ach => {
      const day = toLocalDay(ach.date);
      if (!map[day]) map[day] = { count: 0, points: 0, retro: 0, achievements: [] };
      map[day].count++;
      map[day].points += ach.points    || 0;
      map[day].retro  += ach.trueRatio || 0;
      map[day].achievements.push(ach);
    });
    return map;
  }, [achievements]);

  const totalPts   = useMemo(() => achievements.reduce((s, a) => s + (a.points    || 0), 0), [achievements]);
  const totalRetro = useMemo(() => achievements.reduce((s, a) => s + (a.trueRatio || 0), 0), [achievements]);

  const maxPoints = useMemo(() => Math.max(1, ...Object.values(heatmapData).map(d => d.points || 0)), [heatmapData]);

  // Build 365-day grid ending on ref date
  const refDate = refTime ? new Date(refTime) : new Date();
  const days = useMemo(() => {
    const arr = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(refDate);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      arr.push({ key, date: d });
    }
    return arr;
  }, [refTime]);

  // Week columns for grid layout
  const weeks = useMemo(() => {
    const ws = [];
    for (let i = 0; i < days.length; i += 7) ws.push(days.slice(i, i + 7));
    return ws;
  }, [days]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const m = week[0].date.getMonth();
      if (m !== lastMonth) { labels.push({ wi, label: week[0].date.toLocaleDateString('en-GB', { month: 'short' }) }); lastMonth = m; }
    });
    return labels;
  }, [weeks]);

  const getColor = (key) => {
    const d = heatmapData[key];
    if (!d) return 'var(--well)';
    const ratio = (d.points || 0) / maxPoints;
    if (ratio >= 0.8) return 'var(--gold)';
    if (ratio >= 0.5) return 'var(--accent)';
    if (ratio >= 0.25) return 'var(--heat-2)';
    if (ratio > 0) return 'var(--heat-1)';
    return 'var(--well)';
  };

  // Timeline — filtered by selectedDay or show all grouped by date+game session
  const timelineGroups = useMemo(() => {
    const source = selectedDay
      ? (dayMap[selectedDay]?.achievements || [])
      : achievements;

    // Group by day
    const byDay = {};
    source.forEach(ach => {
      const day = toLocalDay(ach.date);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ach);
    });

    // Within each day, group by game session (consecutive same game)
    return Object.entries(byDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, achs]) => {
        const sorted = [...achs].sort((a, b) => a.date.localeCompare(b.date));
        const sessions = [];
        sorted.forEach(ach => {
          const last = sessions[sessions.length - 1];
          if (last && last.gameId === ach.gameId) {
            last.achievements.push(ach);
            if (ach.date > last.endTime) last.endTime = ach.date;
          } else {
            sessions.push({ gameId: ach.gameId, gameTitle: ach.gameTitle, gameIcon: getMediaUrl(ach.gameIcon), consoleName: ach.consoleName, startTime: ach.date, endTime: ach.date, achievements: [ach] });
          }
        });
        sessions.reverse(); // newest session first within a day
        const dayPts   = achs.reduce((s, a) => s + (a.points    || 0), 0);
        const dayRetro = achs.reduce((s, a) => s + (a.trueRatio || 0), 0);
        return { day, dayPts, dayRetro, achCount: achs.length, sessions };
      });
  }, [achievements, selectedDay, dayMap]);

  // Summary numbers (assets/activity-ui.js): the last 14 days (folded row) and the past year (open card)
  const [summaryOpen, toggleSummary] = useSummaryOpen();
  const streak  = useMemo(() => computeStreak(heatmapData, 1), [heatmapData]);
  const year    = useMemo(() => yearOf(heatmapData), [heatmapData]);
  const yearPts = useMemo(() => yearOf(heatmapData, 'points').total, [heatmapData]);
  // The dexes that moved in the last 14 days: unlocks and points gained in each game, newest first, with its
  // progress now and before the fortnight (now minus what was unlocked in it) for the two-tone ring
  const moved = useMemo(() => {
    const from = addDays(dayKey(new Date()), -13);
    const byGame = new Map();
    achievements.forEach(a => {
      if (dayKey(a.date) < from) return;
      const r = byGame.get(a.gameId) ?? { gameId: a.gameId, gameTitle: a.gameTitle, gameIcon: a.gameIcon, consoleName: a.consoleName, n: 0, pts: 0, last: a.date };
      r.n++; r.pts += a.points || 0;
      if (a.date > r.last) r.last = a.date;
      byGame.set(a.gameId, r);
    });
    const byId = new Map(games.map(g => [Number(g.id), g]));
    return [...byGame.values()].map(r => {
      const g = byId.get(Number(r.gameId));
      const total = g?.achievementsTotal || 0;
      const now = g ? g.achievementsUnlocked : null;
      const before = now != null ? Math.max(0, now - r.n) : null;
      return { ...r, game: g, total, now, before };
    }).sort((a, b) => b.last.localeCompare(a.last));
  }, [achievements, games]);
  const [movedAll, setMovedAll] = useState(false);
  const movedTotals = useMemo(() => moved.reduce((t, m) => ({ n: t.n + m.n, pts: t.pts + m.pts }), { n: 0, pts: 0 }), [moved]);
  const describeDay = key => heatmapData[key] ? `${key} · ${heatmapData[key].count} achievement${heatmapData[key].count !== 1 ? 's' : ''} · ${heatmapData[key].points} pts` : key;

  // Merged feed for Friends view: own achievements + all friends' achievements, sorted newest first
  const mergedFeed = useMemo(() => {
    const ownRows = achievements.map(ach => ({ ach, username: ownUsername, isOwn: true }));
    const friendRows = Object.entries(friendsActivity).flatMap(([user, achs]) =>
      achs.map(ach => ({ ach, username: user, isOwn: false }))
    );
    return [...ownRows, ...friendRows].sort((a, b) => b.ach.date.localeCompare(a.ach.date));
  }, [achievements, friendsActivity, ownUsername]);

  // Group all same-user+game unlocks within a 1-hour gap into sessions (non-consecutive safe)
  const feedGroups = useMemo(() => {
    // Bucket by (username, gameId)
    const byKey = {};
    mergedFeed.forEach(({ username, ach, isOwn }) => {
      const key = `${username}::${ach.gameId}`;
      if (!byKey[key]) byKey[key] = { username, isOwn, gameId: ach.gameId, gameTitle: ach.gameTitle, gameIcon: ach.gameIcon, consoleName: ach.consoleName, achs: [] };
      byKey[key].achs.push(ach);
    });

    const sessions = [];
    Object.values(byKey).forEach(({ username, isOwn, gameId, gameTitle, gameIcon, consoleName, achs }) => {
      // Sort ascending to detect gaps between consecutive unlocks
      const sorted = [...achs].sort((a, b) => a.date.localeCompare(b.date));
      let start = 0;
      for (let i = 1; i <= sorted.length; i++) {
        if (i === sorted.length || new Date(sorted[i].date) - new Date(sorted[i - 1].date) > 3600000) {
          const slice = sorted.slice(start, i);
          sessions.push({
            username, isOwn, gameId, gameTitle, gameIcon, consoleName,
            achievements: [...slice].reverse(), // newest first, as the runs list them
            latestDate: slice[slice.length - 1].date,
          });
          start = i;
        }
      }
    });

    return sessions.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [mergedFeed]);

  // Friends timeline. The strip: friends active in the last 30 days (the fetch window), most recent first, with
  // their unlocks; tapping one narrows the timeline to them. The timeline: days → posts (a friend's runs back to back)
  const [friendSel, setFriendSel] = useState(null);
  const party = useMemo(() => {
    const m = new Map();
    feedGroups.forEach(run => {
      if (run.isOwn) return;
      const f = m.get(run.username) ?? { username: run.username, n: 0, last: run.latestDate };
      f.n += run.achievements.length;
      if (run.latestDate > f.last) f.last = run.latestDate;
      m.set(run.username, f);
    });
    return [...m.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [feedGroups]);
  const friendRuns = useMemo(() => feedGroups.filter(r => !r.isOwn && (!friendSel || r.username === friendSel)), [feedGroups, friendSel]);
  const friendDays = useMemo(() => {
    const byDay = new Map();
    friendRuns.slice(0, visibleSessionCount).forEach(run => {
      const day = toLocalDay(run.latestDate);
      if (!byDay.has(day)) byDay.set(day, []);
      const posts = byDay.get(day);
      const last = posts[posts.length - 1];
      if (last && last.username === run.username) last.runs.push(run);
      else posts.push({ username: run.username, runs: [run] });
    });
    return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [friendRuns, visibleSessionCount]);
  const userPic = u => socialProfileMap.get(u)?.userPic ? getMediaUrl(socialProfileMap.get(u).userPic) : `${MEDIA_URL}/UserPic/${u}.png`;


  // One unlock row (Mine and Friends): badge, name in gold when hardcore, type mark, time, points and RetroRatio
  const unlockRow = ach => {
    const ratio = ach.trueRatio && ach.points ? ach.trueRatio / ach.points : null;
    const typeIcon = ach.type === 'progression' ? <Trophy size={11} className="text-gold shrink-0"><title>Progression: required to complete the game</title></Trophy>
      : ach.type === 'win_condition' ? <Crown size={11} className="text-hc shrink-0"><title>Win condition: triggers game completion</title></Crown>
      : ach.type === 'missable' ? <AlertTriangle size={11} className="text-warn shrink-0"><title>Missable</title></AlertTriangle> : null;
    return (
      <UnlockRow key={`${ach.achievementId}-${ach.date}`}
        href={`../achievement/?id=${ach.achievementId}`}
        icon={`${MEDIA_URL}/Badge/${ach.badgeName}.png`}
        title={ach.title} titleStyle={{ color: ach.hardcoreMode ? 'var(--gold)' : 'var(--ink)' }}
        marks={typeIcon}
        desc={ach.description}
        time={<span className="num">{fmtClock(ach.date)}</span>}
        value={<em className="num">
          <span className="text-gold">{ach.points} pts</span>
          {ratio > 0 && <span style={{ color: ratio >= 30 ? 'var(--hc)' : ratio >= 20 ? 'var(--gold)' : ratio >= 10 ? 'var(--accent)' : 'var(--ink-2)' }}> ×{ratio.toFixed(1)}</span>}
        </em>} />
    );
  };
  const runTitle = gameTitle => {
    const p = parseTitle(gameTitle);
    return { p, node: <><span className="truncate">{p.baseTitle}</span>{p.isSubset && <span className="subset-tag">Subset</span>}{!p.isSubset && renderTildeTags(p.tags)}</> };
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── Mine / Friends, and the friends' sync controls ── */}
      <div className="flex items-center gap-1.5 min-h-[30px]">
        {[['mine', 'Mine'], ['friends', 'Friends']].map(([v, label]) => (
          <button type="button" key={v} onClick={() => setSocialView(v)} aria-pressed={socialView === v}
            className={`fchip ${socialView === v ? 'on' : ''}`}>
            {label}
          </button>
        ))}
        {socialView === 'friends' && (
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-3 min-w-0">
            {(friendsActivityStatus === 'loading' || friendsActivityStatus === 'updating') && (
              <span className="flex items-center gap-1.5 text-accent">
                <Loader2 size={12} className="animate-spin" />
                {friendsFetchProgress ? <span className="num">{friendsFetchProgress.done}/{friendsFetchProgress.total}</span> : 'Loading'}
              </span>
            )}
            {friendsActivityStatus === 'done' && (<>
              {friendsActivityTs && <span className="truncate mr-1">Synced {timeAgo(friendsActivityTs)}</span>}
              <button type="button" onClick={onRefreshFriends} className="fchip" title="Fetch new unlocks" aria-label="Refresh friends activity"><RefreshCw size={12} /></button>
              <button type="button" onClick={onResetFriends} className="fchip" title="Clear the saved friends activity and fetch it all again" aria-label="Reset friends activity"><RotateCcw size={12} /></button>
            </>)}
          </div>
        )}
      </div>

      {socialView === 'friends' ? (
        <div className="flex flex-col gap-4 anim-fade tl-tabs">

          {friendsActivityStatus === 'error' && (
            <div className="flex items-center justify-between gap-3 bg-box border border-line rounded-[3px] px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12px] text-ink-2"><AlertCircle size={14} className="text-hc" /> Friends activity didn't load.</span>
              <button type="button" onClick={() => setFriendsActivityStatus('idle')} className="fchip">Try again</button>
            </div>
          )}

          {friendsActivityStatus === 'done' && Object.keys(friendsActivity).length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 border border-line rounded-[3px] bg-box">
              <Users size={22} className="text-ink-3" />
              <div className="text-[12px] text-ink-3">You're not following anyone yet</div>
            </div>
          )}

          {friendsActivityStatus === 'loading' && Object.keys(friendsActivity).length === 0 && <TimelineSkeleton />}

          {Object.keys(friendsActivity).length > 0 && (<>
            {/* ── Friend strip: who's been active, tap to narrow the timeline ── */}
            {party.length > 0 && (
              <div className="fstrip" role="group" aria-label="Show one friend">
                <button type="button" onClick={() => setFriendSel(null)} aria-pressed={!friendSel} className={`fpal all ${!friendSel ? 'on' : ''}`}>
                  <span className="fpal-av"><Users size={16} /></span>
                  <span className="fpal-name">Everyone</span>
                  <b>{party.length}</b>
                </button>
                {party.map(f => (
                  <button type="button" key={f.username} onClick={() => setFriendSel(u => u === f.username ? null : f.username)}
                    aria-pressed={friendSel === f.username} className={`fpal ${friendSel === f.username ? 'on' : ''}`} title={`${f.username} · ${f.n} unlocks`}
                    style={{ '--fc': friendColor(f.username) }}>
                    <span className="fpal-av"><img src={userPic(f.username)} alt="" loading="lazy" /></span>
                    <span className="fpal-name">{f.username}</span>
                    <b>+{f.n}</b>
                  </button>
                ))}
              </div>
            )}

            {failedFriends.length > 0 && (
              <p className="flex items-start gap-2 text-[11.5px] text-ink-3 -mt-2">
                <AlertCircle size={13} className="text-gold shrink-0 mt-[2px]" />
                <span>No activity came back for <span className="text-ink-2">{failedFriends.join(', ')}</span>.</span>
              </p>
            )}

            <div>
              <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-1">
                <span className="sec-mark" />
                <span className="sec-t flex items-center gap-2 min-w-0"><Users size={15} className="text-accent shrink-0" /> <span className="truncate">{friendSel ? `${friendSel}'s unlocks` : 'Friends unlocks'}</span></span>
                {friendSel && <a href={`../profile/?u=${friendSel}`} className="ml-auto text-[11.5px] text-accent hover:text-ink shrink-0">Profile ›</a>}
              </div>
              {friendDays.length === 0 ? (
                <div className="text-ink-2 text-[11px] py-4 italic text-center">No unlocks from friends in the last 30 days.</div>
              ) : (
                <div key={friendSel ?? 'all'} className="flex flex-col gap-3">
                  {friendDays.map(([day, posts]) => {
                    const n = posts.reduce((t, p) => t + p.runs.reduce((u, r) => u + r.achievements.length, 0), 0);
                    const people = new Set(posts.map(p => p.username)).size;
                    return (
                      <section key={day}>
                        <DayHead day={day}>
                          <b className="num">{n}</b> unlock{n !== 1 ? 's' : ''}{!friendSel && <> · <b className="num">{people}</b> friend{people !== 1 ? 's' : ''}</>}
                        </DayHead>
                        <div className="fposts">
                          {posts.map(post => (
                            <FriendPost key={`${post.username}-${post.runs[0].latestDate}`} post={post} pic={userPic(post.username)} unlockRow={unlockRow} runTitle={runTitle} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                  {friendRuns.length > visibleSessionCount && (
                    <button type="button" onClick={() => setVisibleSessionCount(c => c + 100)} className="smore">Show more days</button>
                  )}
                </div>
              )}
            </div>
          </>)}
        </div>
      ) : (() => {
        // ── Mine: Savepoint's timeline (assets/activity-ui.js): summary card, sticky day headings, one card per run ──
        const heatmap = (
          <div className="overflow-x-auto" ref={heatmapScrollRef}>
            <div style={{ minWidth: `${53 * 14}px` }}>
              <div className="flex mb-1" style={{ paddingLeft: '28px' }}>
                {weeks.map((_week, wi) => {
                  const ml = monthLabels.find(m => m.wi === wi);
                  return <div key={wi} className="text-ink-3" style={{ flex: 1, fontSize: '8px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{ml ? ml.label : ''}</div>;
                })}
              </div>
              <div className="flex gap-0">
                <div className="flex flex-col gap-[2px] mr-1" style={{ paddingTop: '1px' }}>
                  {['M','','W','','F','','S'].map((l, i) => (
                    <div key={i} className="text-ink-3" style={{ height: '12px', width: '20px', fontSize: '7px', lineHeight: '12px', textAlign: 'right', flexShrink: 0 }}>{l}</div>
                  ))}
                </div>
                <div className="flex flex-1 gap-[2px]">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[2px] flex-1" style={{ minWidth: '10px' }}>
                      {week.map(({ key }) => (
                        <div key={key}
                          onClick={() => heatmapData[key] && setSelectedDay(selectedDay === key ? null : key)}
                          title={describeDay(key)}
                          style={{ height: '12px', borderRadius: '1px', background: getColor(key), cursor: heatmapData[key] ? 'pointer' : 'default', outline: selectedDay === key ? '2px solid var(--accent)' : 'none' }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 mt-2" style={{ paddingLeft: '28px' }}>
                <span className="text-[8px] text-ink-3">Less</span>
                {['var(--well)', 'var(--heat-1)', 'var(--heat-2)', 'var(--accent)', 'var(--gold)'].map(c => (
                  <div key={c} style={{ width: '10px', height: '10px', borderRadius: '1px', background: c, flexShrink: 0 }} />
                ))}
                <span className="text-[8px] text-ink-3">More</span>
              </div>
            </div>
          </div>
        );
        const fmtDayLong = key => fmtDayKey(key, { day: '2-digit', month: 'short', year: 'numeric' });
        return (
          <div className="flex flex-col gap-4 anim-fade tl-tabs">
            <ActivitySummary
              open={summaryOpen} onToggle={toggleSummary}
              title="Last 14 days"
              totals={moved.length > 0 && <>
                <b className="num">{movedTotals.n}</b> unlock{movedTotals.n !== 1 ? 's' : ''} · <b className="num text-gold">+{movedTotals.pts}</b> pts · <b className="num">{moved.length}</b> dex{moved.length !== 1 ? 'es' : ''}
              </>}
              stats={[
                { v: year.total.toLocaleString(), l: 'Unlocks', color: 'var(--accent)' },
                { v: yearPts.toLocaleString(), l: 'Points', color: 'var(--gold)' },
                { v: year.best ? year.best.count : '–', l: 'Best day', sub: year.best ? fmtDayLong(year.best.key) : null },
              ]}
              streak={streak}
              selectedDay={selectedDay} onSelectDay={setSelectedDay}
              heatmap={heatmap}>
              {moved.length === 0 ? (
                <p className="mdex-none">No dex moved in the last 14 days.{achievements[0] && <> Your last unlock was on {fmtDayLong(dayKey(achievements[0].date))}.</>}</p>
              ) : (
                <div className="mdex-list">
                  {(movedAll ? moved : moved.slice(0, 3)).map(m => {
                    const p = parseTitle(m.gameTitle);
                    const pct = v => m.total ? v / m.total * 100 : 0;
                    const mastered = m.total > 0 && m.now >= m.total;
                    const c = mastered ? 'var(--gold)' : m.game?.isBeaten ? 'var(--silver)' : 'var(--accent)';
                    return (
                      <a key={m.gameId} href={`../game/?id=${m.gameId}`} className="mrow">
                        <span className={`dring ${mastered ? 'full' : ''}`} title={m.total ? `${m.before} → ${m.now} of ${m.total}` : undefined}
                          style={{ '--p': pct(m.now ?? 0), '--b': pct(m.before ?? 0), '--cb': 'rgb(var(--c-ink) / 0.3)', '--c': c, '--s': '44px', '--w': '4px' }}>
                          <img src={getMediaUrl(m.gameIcon)} alt="" loading="lazy" />
                        </span>
                        <span className="mrow-main">
                          <span className="mrow-t"><span className="truncate">{p.baseTitle}</span>{p.isSubset && <span className="subset-tag">Subset</span>}</span>
                          <span className="mrow-s"><span className="dex-no">No.{m.gameId}</span>{m.consoleName && <span className="truncate">{m.consoleName}</span>}{mastered && m.before < m.total && <b className="text-gold">Mastered</b>}</span>
                        </span>
                        <span className="mrow-e">
                          <b style={{ color: c }}>+{m.n}</b>
                          {m.total > 0 && <span>{m.before} → {m.now}<small>/{m.total}</small></span>}
                        </span>
                      </a>
                    );
                  })}
                  {moved.length > 3 && (
                    <button type="button" onClick={() => setMovedAll(o => !o)} className="mdex-all">
                      {movedAll ? 'Show fewer' : `${moved.length - 3} more dex${moved.length - 3 !== 1 ? 'es' : ''}`}
                      <ChevronDown size={12} className={movedAll ? 'rotate-180' : ''} />
                    </button>
                  )}
                </div>
              )}
            </ActivitySummary>

            <div>
              <div className="flex items-center gap-2 border-b border-line pb-1.5 mt-2 mb-1">
                <span className="sec-mark" />
                <span className="sec-t flex items-center gap-2"><Trophy size={15} className="text-gold" /> Recent unlocks</span>
                {selectedDay && (
                  <button type="button" onClick={() => setSelectedDay(null)} className="ml-auto fchip on anim-fade" style={{ height: 22 }}>{fmtDayLong(selectedDay)} ✕</button>
                )}
              </div>

              {timelineGroups.length === 0 ? (
                <div key={selectedDay ?? 'all'} className="text-ink-2 text-[11px] py-4 italic text-center anim-fade">
                  {selectedDay ? 'No achievements on this day.' : 'No achievements unlocked in the last year.'}
                </div>
              ) : (
                <div key={selectedDay ?? 'all'} className="flex flex-col gap-4">
                  {timelineGroups.slice(0, visibleSessionCount).map(({ day, dayPts, achCount, sessions }) => (
                    <section key={day} className="anim-fade">
                      <DayHead day={day}>
                        <b className="num">{achCount}</b> unlock{achCount !== 1 ? 's' : ''} · <b className="text-gold num">+{dayPts}</b> pts
                      </DayHead>
                      <div className="flex flex-col gap-2">
                        {sessions.map(session => (
                          <MyRun key={`${session.gameId}-${session.startTime}`} session={session} unlockRow={unlockRow} runTitle={runTitle} />
                        ))}
                      </div>
                    </section>
                  ))}
                  {timelineGroups.length > visibleSessionCount && (
                    <button type="button" onClick={() => setVisibleSessionCount(n => n + 100)} className="smore">Show more days</button>
                  )}
                </div>
              )}

              {!selectedDay && (
                loadingMore ? (
                  <div className="flex flex-col gap-2 mt-4">
                    {[...Array(2)].map((_, i) => <div key={i} className="shimmer h-[86px] rounded-[3px]" />)}
                  </div>
                ) : allLoaded && achievements.length > 0 ? (
                  <div className="flex justify-center py-3 mt-2 border-t border-line-faint anim-fade">
                    <span className="crit"><Trophy /><b className="num">{achievements.length.toLocaleString()}</b> unlocks · the whole year</span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── Skeleton Components ───────────────────────────────────────────────────

const Sk = ({ w = 'w-full', h = 'h-4', cls = '' }) => (
  <div className={`shimmer ${w} ${h} ${cls}`} />
);

const ProfileLoadingSkeleton = () => (
  <div className="min-h-screen bg-page flex flex-col">
    {/* Topbar */}
    <div className="bg-bar border-b border-well px-4 md:px-8 py-1.5 flex items-center gap-2">
      <Sk w="w-16" h="h-2.5" /><span className="text-line">›</span><Sk w="w-28" h="h-2.5" /><span className="text-line">›</span><Sk w="w-20" h="h-2.5" />
    </div>
    {/* Header */}
    <div className="bg-box border-b border-line px-4 md:px-8 pt-8 pb-5 md:pt-5">
      <div className="max-w-5xl mx-auto flex items-center gap-5">
        <div className="shimmer w-20 h-20 md:w-24 md:h-24 rounded-[2px] flex-shrink-0" />
        <div className="flex flex-col gap-2.5 flex-1">
          <Sk w="w-44" h="h-6" />
          <Sk w="w-64" h="h-3" />
          <div className="flex gap-2 mt-1">
            <Sk w="w-20" h="h-5" /><Sk w="w-28" h="h-5" /><Sk w="w-24" h="h-5" />
          </div>
        </div>
      </div>
    </div>
    {/* Main */}
    <main className="max-w-5xl mx-auto px-4 md:px-8 py-6 w-full flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">
        <div className="flex flex-col gap-6">
          {/* Recently played */}
          <div><Sk w="w-40" h="h-3" cls="mb-3" />
            <div className="bg-box border border-line rounded-[3px] p-3 flex gap-4">
              <div className="shimmer w-14 h-14 rounded-[2px] flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2 justify-center">
                <Sk w="w-48" h="h-3.5" /><Sk w="w-32" h="h-2.5" />
              </div>
            </div>
          </div>
          {/* Most recent achievement */}
          <div><Sk w="w-48" h="h-3" cls="mb-3" />
            <div className="bg-box border border-line rounded-[3px] p-3 flex gap-3">
              <div className="shimmer w-12 h-12 rounded-[2px] flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2 justify-center">
                <Sk w="w-56" h="h-3.5" /><Sk w="w-36" h="h-2.5" /><Sk w="w-44" h="h-2.5" />
              </div>
            </div>
          </div>
          {/* Stats */}
          <div><Sk w="w-24" h="h-3" cls="mb-3" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 px-1">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-end py-[3px] gap-2">
                  <Sk w="w-28" h="h-2.5" /><div className="flex-1 border-b border-dotted border-line mb-1" /><Sk w="w-16" h="h-2.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Sidebar */}
        <div className="flex flex-col gap-5">
          <div className="bg-box border border-line rounded-[3px] p-3 flex flex-col gap-3">
            <Sk w="w-32" h="h-3" />
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="shimmer aspect-square rounded-[2px]" />)}
            </div>
          </div>
          <div className="bg-box border border-line rounded-[3px] p-3 flex flex-col gap-3">
            <Sk w="w-28" h="h-3" />
            <div className="grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => <div key={i} className="shimmer aspect-square rounded-[2px]" />)}
            </div>
          </div>
        </div>
      </div>
      {/* Tab bar skeleton */}
      <div className="flex gap-6 border-b border-line mb-4 pb-2">
        {[...Array(4)].map((_, i) => <Sk key={i} w="w-24" h="h-3.5" />)}
      </div>
      {/* Game card skeletons */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="shimmer h-[90px] rounded-[3px] mb-3" />
      ))}
    </main>
  </div>
);



const RARITY_BANDS = [
  { key: 'common',    label: 'Common',     max: 1.5,      color: 'var(--ink-2)' },
  { key: 'uncommon',  label: 'Uncommon',   max: 3,        color: 'var(--accent)' },
  { key: 'rare',      label: 'Rare',       max: 6,        color: 'var(--rare)' },
  { key: 'veryrare',  label: 'Very rare',  max: 12,       color: 'var(--very-rare)' },
  { key: 'ultrarare', label: 'Ultra rare', max: Infinity, color: 'var(--ultra-rare)' },
];

const StatTile = ({ label, value, sub, color = 'var(--accent)', Icon }) => (
  <div className="flex flex-col gap-1.5 bg-box border border-line rounded-[3px] px-3 py-2.5">
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={11} className="shrink-0" style={{ color }} />}
      <span className="text-[8px] uppercase tracking-[0.09em] text-ink-3 leading-none">{label}</span>
    </div>
    <span className="text-[18px] font-bold leading-none tabular-nums" style={{ color }}>{value}</span>
    {sub && <span className="text-[9px] text-ink-3 leading-none truncate">{sub}</span>}
  </div>
);

const StatCard = ({ title, hint, children }) => (
  <div className="bg-box border border-line rounded-[3px]">
    <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
      <span className="sec-mark sm" />
      <span className="card-t">{title}</span>
      {hint && <span className="text-[9px] text-ink-3 ml-auto text-right shrink-0">{hint}</span>}
    </div>
    <div className="p-3">{children}</div>
  </div>
);

const BarRow = ({ label, value, sub, pct, color }) => (
  <div className="flex items-center gap-2">
    <span className="w-[80px] md:w-[130px] shrink-0 text-[10px] text-ink truncate" title={label}>{label}</span>
    <div className="flex-1 min-w-0 h-[10px] bg-well rounded-[2px] overflow-hidden">
      <div className="h-full rounded-[2px] transition-all duration-500" style={{ width: `${Math.max(pct, 1.5)}%`, background: color }} />
    </div>
    <span className="w-[64px] md:w-[86px] shrink-0 text-right text-[10px] tabular-nums text-ink-2">
      {value.toLocaleString()}
      {sub && <span className="text-ink-3 ml-1">{sub}</span>}
    </span>
  </div>
);

// Round an axis maximum up to a readable tick (132 → 200, 45 → 50).
const niceMax = v => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Points per week as columns, with a 4-week trailing mean as a trend line.
// Both series are points-per-week, so they share one axis — a cumulative line
// here would need a second y-scale, which invents a correlation that isn't
// in the data.
const PointAcquisitionChart = ({ data }) => {
  const [hover, setHover] = useState(null);

  if (!data) return <div className="text-[10px] text-ink-3 py-3 text-center">Not enough history yet.</div>;

  const { weeks, max } = data;
  const axisMax  = niceMax(max);
  const PLOT_H   = 132;
  const peakIdx  = weeks.reduce((best, w, i) => w.points > weeks[best].points ? i : best, 0);
  const trendPts = weeks
    .map((w, i) => w.trend === null ? null
      : `${((i + 0.5) / weeks.length) * 100},${100 - (w.trend / axisMax) * 100}`)
    .filter(Boolean)
    .join(' ');
  const lastTrendIdx = weeks.reduce((last, w, i) => w.trend !== null ? i : last, -1);
  const active = hover !== null ? weeks[hover] : null;

  return (
    <>
      <div className="relative" style={{ height: `${PLOT_H}px` }}>
        {/* Gridlines — hairline, solid, recessive; sit behind the marks */}
        {[0, 0.5, 1].map(f => (
          <div key={f} className="absolute left-0 right-0 flex items-center pointer-events-none"
            style={{ bottom: `${f * 100}%`, height: '1px' }}>
            <span className="w-full" style={{ height: '1px', background: f === 0 ? 'var(--line)' : 'var(--line-soft)' }} />
            <span className="absolute right-0 -top-[9px] text-[8px] text-ink-3 tabular-nums bg-box pl-1">
              {f === 0 ? '' : Math.round(axisMax * f).toLocaleString()}
            </span>
          </div>
        ))}

        {/* Columns — bar capped at 24px and centred inside a full-width band, so
            column centres line up with the trend line's percentage geometry */}
        <div className="absolute inset-0 flex items-end" style={{ gap: '1px' }}>
          {weeks.map((w, i) => (
            <div key={w.key}
              className="relative h-full flex flex-col justify-end items-center cursor-default"
              style={{ flex: '1 1 0' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(h => (h === i ? null : h))}>
              {/* Hit target spans the whole column band, not just the painted bar */}
              <div className="absolute inset-0" />
              <div style={{
                width: '100%', maxWidth: '24px',
                height: `${Math.max((w.points / axisMax) * 100, w.points > 0 ? 1.5 : 0)}%`,
                background: 'var(--accent)',
                opacity: hover === null || hover === i ? 1 : 0.4,
                borderRadius: '3px 3px 0 0',
                transition: 'opacity 0.12s',
              }} />
            </div>
          ))}
        </div>

        {/* Trend line — stretched to the plot box; non-scaling-stroke keeps it 2px at any width */}
        {trendPts && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points={trendPts} fill="none" stroke="var(--gold)" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        )}

        {/* End marker — a div, so it stays circular while the SVG is stretched */}
        {lastTrendIdx >= 0 && (
          <div className="absolute pointer-events-none" style={{
            left:   `${((lastTrendIdx + 0.5) / weeks.length) * 100}%`,
            bottom: `${(weeks[lastTrendIdx].trend / axisMax) * 100}%`,
            width: '8px', height: '8px', marginLeft: '-4px', marginBottom: '-4px',
            borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 0 2px var(--box)',
          }} />
        )}

        {/* Selective direct label — the peak week only, never a number on every bar */}
        {weeks[peakIdx].points > 0 && hover === null && (
          <div className="absolute text-[8px] text-ink-2 tabular-nums pointer-events-none whitespace-nowrap"
            style={{
              left: `${((peakIdx + 0.5) / weeks.length) * 100}%`,
              bottom: `calc(${(weeks[peakIdx].points / axisMax) * 100}% + 3px)`,
              transform: 'translateX(-50%)',
            }}>
            {weeks[peakIdx].points.toLocaleString()}
          </div>
        )}
      </div>

      {/* X axis — 52 weeks is too many to label, so tick the first week of each month */}
      <div className="flex mt-1.5" style={{ gap: '1px' }}>
        {weeks.map((w, i) => {
          const isMonthStart = i === 0 || weeks[i - 1].start.getMonth() !== w.start.getMonth();
          return (
            <div key={w.key} className="relative text-[7px] text-ink-3 leading-none" style={{ flex: '1 1 0' }}>
              {isMonthStart && (
                <span className="absolute left-0 top-0 whitespace-nowrap">
                  {MONTH_ABBR[w.start.getMonth()]}{w.start.getMonth() === 0 ? ` '${String(w.start.getFullYear()).slice(2)}` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover readout — reserves its own row so the card never reflows */}
      <div className="mt-3 pt-2 border-t border-line flex items-center gap-3 flex-wrap min-h-[16px]">
        {active ? (
          <span className="text-[10px] text-ink tabular-nums">
            Week of {active.start.getDate()} {MONTH_ABBR[active.start.getMonth()]} {active.start.getFullYear()}
            <span className="text-accent ml-2">{active.points.toLocaleString()} pts</span>
            <span className="text-ink-3 ml-1.5">· {active.count} cheevo{active.count === 1 ? '' : 's'}</span>
            {active.trend !== null && (
              <span className="text-gold ml-2">avg {Math.round(active.trend).toLocaleString()}</span>
            )}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-[9px] text-ink-3">
              <span className="w-2 h-2 rounded-[1px] bg-accent" /> Points earned
            </span>
            <span className="flex items-center gap-1.5 text-[9px] text-ink-3">
              <span className="w-3 h-[2px] rounded-full bg-gold" /> 4-week average
            </span>
          </>
        )}
      </div>
    </>
  );
};

// Segment colours are the repo's status colours (docs/rules.md): gold = mastered,
// silver = beaten, blue = in progress. Silver and blue were a close pair on the old
// palette (light Steam blue), so every segment is also labelled with its own count and a
// Trophy/Medal icon — identity never rests on colour alone.
const AWARD_SEGMENTS = {
  mastered: 'var(--gold)',
  beaten:   'var(--silver)',
  other:    'var(--accent)',
};

const StackedBarRow = ({ label, segments, total, max, mastered, beaten }) => {
  const shown = segments.filter(seg => seg.value > 0);
  return (
    <div className="flex items-center gap-2">
      <span className="w-[80px] md:w-[130px] shrink-0 text-[10px] text-ink truncate" title={label}>{label}</span>
      <div className="flex-1 min-w-0 h-[10px] bg-well rounded-[2px] flex overflow-hidden" style={{ gap: '2px' }}>
        {shown.map((seg, i) => (
          <div key={seg.key} style={{
            width: `${(seg.value / max) * 100}%`,
            minWidth: '3px',
            background: seg.color,
            borderRadius: i === shown.length - 1 ? '0 3px 3px 0' : 0,
          }} />
        ))}
      </div>
      <span className="w-[76px] md:w-[104px] shrink-0 flex items-center justify-end gap-1.5 text-[10px] tabular-nums">
        {mastered > 0 && (
          <span className="flex items-center gap-0.5" style={{ color: AWARD_SEGMENTS.mastered }}>
            <Trophy size={9} className="shrink-0" />{mastered}
          </span>
        )}
        {beaten > 0 && (
          <span className="flex items-center gap-0.5" style={{ color: AWARD_SEGMENTS.beaten }}>
            <Medal size={9} className="shrink-0" />{beaten}
          </span>
        )}
        <span className="text-ink-2">{total.toLocaleString()}</span>
      </span>
    </div>
  );
};

const StatsTab = ({ achievements, achLoading, games, gameAwards, heatmapData }) => {
  const timelineRef = useRef(null);
  const [tlHover, setTlHover] = useState(null);

  // ── Streaks + active days, from the same day map the heatmap uses ──
  const streaks = useMemo(() => {
    const DAY = 86400000;
    // Keys are local calendar days ("YYYY-MM-DD"); read them as UTC so day
    // arithmetic stays exact across DST boundaries.
    const nums = Object.keys(heatmapData)
      .map(k => Math.round(new Date(`${k}T00:00:00Z`).getTime() / DAY))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
    if (!nums.length) return { current: 0, longest: 0, active90: 0 };

    const set = new Set(nums);
    const now = new Date();
    const todayNum = Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY);

    // A quiet today does not break the streak — start counting from yesterday.
    let cursor = set.has(todayNum) ? todayNum : todayNum - 1;
    let current = 0;
    while (set.has(cursor)) { current++; cursor--; }

    let longest = 1, run = 1;
    for (let i = 1; i < nums.length; i++) {
      run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }

    return { current, longest, active90: nums.filter(n => n > todayNum - 90).length };
  }, [heatmapData]);

  // ── This month's points against the median of the loaded window ──
  const pace = useMemo(() => {
    const byMonth = {};
    achievements.forEach(a => {
      const d = new Date(a.date);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + (a.points || 0);
    });
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const past = Object.entries(byMonth).filter(([k]) => k !== thisKey).map(([, v]) => v).sort((a, b) => a - b);
    const median = past.length
      ? (past.length % 2
          ? past[(past.length - 1) / 2]
          : Math.round((past[past.length / 2 - 1] + past[past.length / 2]) / 2))
      : 0;
    const currentPts = byMonth[thisKey] || 0;
    return { currentPts, median, delta: median > 0 ? Math.round(((currentPts - median) / median) * 100) : null };
  }, [achievements]);

  // ── Point acquisition — points per week with a 4-week trailing mean ──
  const acquisition = useMemo(() => {
    const weekKey = d => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));   // snap back to Monday
      return x;
    };
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const byWeek = new Map();
    achievements.forEach(a => {
      const d = new Date(a.date);
      if (isNaN(d)) return;
      const start = weekKey(d);
      const key = fmt(start);
      if (!byWeek.has(key)) byWeek.set(key, { key, start, points: 0, count: 0 });
      const b = byWeek.get(key);
      b.points += a.points || 0;
      b.count++;
    });
    if (byWeek.size < 4) return null;

    // Fill quiet weeks so the axis is real time, not just weeks with unlocks.
    const keys = Array.from(byWeek.keys()).sort();
    const last = byWeek.get(keys[keys.length - 1]).start;
    const weeks = [];
    for (const cur = new Date(byWeek.get(keys[0]).start); cur <= last; cur.setDate(cur.getDate() + 7)) {
      const key = fmt(cur);
      weeks.push(byWeek.get(key) || { key, start: new Date(cur), points: 0, count: 0 });
    }

    // The oldest bucket is clipped by the 364-day fetch window — drop it so the
    // first column isn't an artefact of where the window happens to start.
    const trimmed = weeks.length > 6 ? weeks.slice(1) : weeks;

    const WINDOW = 4;
    const withTrend = trimmed.map((b, i) => {
      if (i < WINDOW - 1) return { ...b, trend: null };
      let sum = 0;
      for (let j = i - WINDOW + 1; j <= i; j++) sum += trimmed[j].points;
      return { ...b, trend: sum / WINDOW };
    });

    return {
      weeks: withTrend,
      max: Math.max(1, ...withTrend.map(b => Math.max(b.points, b.trend ?? 0))),
      total: withTrend.reduce((s, b) => s + b.points, 0),
    };
  }, [achievements]);

  // ── Mastery timeline — lifetime, straight off the award dates ──
  const timeline = useMemo(() => {
    const byMonth = new Map();
    (gameAwards || []).forEach(a => {
      if (!a.awardedAt) return;
      const d = new Date(a.awardedAt);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) byMonth.set(key, { mastered: 0, beaten: 0 });
      const bucket = byMonth.get(key);
      if (a.type === 'Mastery/Completion') bucket.mastered++; else bucket.beaten++;
    });
    if (!byMonth.size) return { months: [], max: 0, totalMastered: 0, totalBeaten: 0 };

    // Fill empty months so the axis reads as real time, not just months with awards.
    const keys = Array.from(byMonth.keys()).sort();
    let [sy, sm] = keys[0].split('-').map(Number);

    // Always run the axis to the current month — a drought since the last award
    // is exactly the thing worth seeing.
    const nowDate = new Date();
    const ey = nowDate.getFullYear();
    const em = nowDate.getMonth() + 1;

    // Short histories get padded back to a 24-month span so the chart still fills the card.
    const MIN_MONTHS = 24;
    const span = (ey - sy) * 12 + (em - sm) + 1;
    if (span < MIN_MONTHS) {
      let back = MIN_MONTHS - span;
      sm -= back;
      while (sm < 1) { sm += 12; sy -= 1; }
    }

    const months = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      months.push({ key, year: y, month: m, ...(byMonth.get(key) || { mastered: 0, beaten: 0 }) });
      m++; if (m > 12) { m = 1; y++; }
    }
    return {
      months,
      max: Math.max(1, ...months.map(x => x.mastered + x.beaten)),
      totalMastered: months.reduce((s, x) => s + x.mastered, 0),
      totalBeaten:   months.reduce((s, x) => s + x.beaten, 0),
    };
  }, [gameAwards]);

  useEffect(() => {
    if (!timelineRef.current || !timeline.months.length) return;
    requestAnimationFrame(() => {
      if (timelineRef.current) timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
    });
  }, [timeline.months.length]);

  // ── Where the achievements actually came from ──
  const consoles = useMemo(() => {
    // Bar length and segments are both counted in GAMES, so a segment's width is the
    // share of that console's games carrying each award — the same numbers printed
    // beside the bar. Weighting segments by achievements instead let a single large
    // mastered set fill most of a bar that reported "1 mastered".
    const blank = name => ({ name, unlocked: 0, games: 0, mastered: 0, beaten: 0, inProgress: 0 });
    const map = new Map();
    (games || []).forEach(g => {
      if (!g.console || !g.achievementsUnlocked) return;
      if (!map.has(g.console)) map.set(g.console, blank(g.console));
      const c = map.get(g.console);
      c.unlocked += g.achievementsUnlocked;
      c.games++;
      // Mastered wins over beaten — a mastered game is not also counted as beaten.
      if (g.isMastered)    c.mastered++;
      else if (g.isBeaten) c.beaten++;
      else                 c.inProgress++;
    });

    const list = Array.from(map.values()).sort((a, b) => b.games - a.games || b.unlocked - a.unlocked);
    const shown = list.slice(0, 10);
    const rest  = list.slice(10);
    if (rest.length) {
      const roll = blank(`${rest.length} more system${rest.length > 1 ? 's' : ''}`);
      rest.forEach(c => {
        roll.unlocked += c.unlocked; roll.games += c.games;
        roll.mastered += c.mastered; roll.beaten += c.beaten; roll.inProgress += c.inProgress;
      });
      shown.push(roll);
    }
    return {
      list: shown,
      max: Math.max(1, ...shown.map(c => c.games)),
      total: list.length,
      anyMastered: shown.some(c => c.mastered > 0),
      anyBeaten:   shown.some(c => c.beaten > 0),
    };
  }, [games]);

  // ── Rarity profile — TrueRatio/points is RA's own difficulty weight ──
  const rarity = useMemo(() => {
    const buckets = RARITY_BANDS.map(b => ({ ...b, count: 0 }));
    let scored = 0;
    achievements.forEach(a => {
      if (!a.points || !a.trueRatio) return;
      scored++;
      const ratio = a.trueRatio / a.points;
      (buckets.find(b => ratio < b.max) || buckets[buckets.length - 1]).count++;
    });
    return { buckets, scored, max: Math.max(1, ...buckets.map(b => b.count)) };
  }, [achievements]);

  const chunkHint = achLoading ? 'loading…' : 'last 12 months';
  const paceColor = pace.delta === null ? 'var(--ink-2)' : pace.delta >= 0 ? 'var(--accent)' : 'var(--ink-2)';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex md:hidden items-center gap-2 pb-2 border-b border-line">
        <span className="sec-mark" />
        <span className="sec-t">Stats</span>
      </div>

      {/* ── Tiles: 2×2 on mobile, one row on desktop ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Current streak" value={`${streaks.current}d`} Icon={Flame}
          color={streaks.current > 0 ? 'var(--gold)' : 'var(--ink-3)'}
          sub={streaks.current === 0 ? 'no unlocks yesterday' : 'consecutive days'} />
        <StatTile label="Longest streak" value={`${streaks.longest}d`} Icon={Trophy} color="var(--accent)" sub={chunkHint} />
        <StatTile label="Active days" value={streaks.active90} Icon={Activity} color="var(--aqua)" sub="of the last 90" />
        <StatTile label="Points this month" value={pace.currentPts.toLocaleString()} Icon={TrendingUp} color={paceColor}
          sub={pace.median > 0
            ? `${pace.delta >= 0 ? '+' : ''}${pace.delta}% vs ${pace.median.toLocaleString()} median`
            : 'no baseline yet'} />
      </div>

      {/* ── Point acquisition ── */}
      <StatCard title="Point acquisition"
        hint={acquisition ? `${acquisition.total.toLocaleString()} pts · ${chunkHint}` : chunkHint}>
        {achLoading && !acquisition
          ? <div className="shimmer rounded-[2px]" style={{ height: '132px' }} />
          : <PointAcquisitionChart data={acquisition} />}
      </StatCard>

      {/* ── Mastery timeline ── */}
      <StatCard title="Mastery timeline"
        hint={timeline.months.length ? `${timeline.totalMastered} mastered · ${timeline.totalBeaten} beaten` : null}>
        {timeline.months.length === 0 ? (
          <div className="text-[10px] text-ink-3 py-3 text-center">No game awards yet.</div>
        ) : (
          <>
            <div ref={timelineRef} className="overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
              <div className="inline-flex flex-col min-w-full">
                <div className="flex items-end gap-[2px]" style={{ height: '84px' }}>
                  {timeline.months.map(m => {
                    const total = m.mastered + m.beaten;
                    const scale = 76 / timeline.max;
                    return (
                      <div key={m.key} className="flex flex-col justify-end cursor-default"
                        style={{
                          flex: '1 1 0', minWidth: '10px', maxWidth: '22px', height: '84px',
                          opacity: tlHover === null || tlHover === m.key ? 1 : 0.4,
                          transition: 'opacity 0.12s',
                        }}
                        onMouseEnter={() => setTlHover(m.key)}
                        onMouseLeave={() => setTlHover(h => (h === m.key ? null : h))}>
                        {m.mastered > 0 && <div style={{ height: `${Math.max(m.mastered * scale, 2)}px`, background: 'var(--gold)', borderRadius: '4px 4px 0 0', marginBottom: m.beaten > 0 ? '2px' : 0 }} />}
                        {m.beaten > 0   && <div style={{ height: `${Math.max(m.beaten * scale, 2)}px`,   background: 'var(--silver)', borderRadius: m.mastered > 0 ? 0 : '4px 4px 0 0' }} />}
                        {total === 0    && <div style={{ height: '1px', background: 'var(--well)' }} />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-[2px] mt-1">
                  {timeline.months.map((m, i) => (
                    <div key={m.key} className="text-[7px] text-ink-3 whitespace-nowrap leading-none" style={{ flex: '1 1 0', minWidth: '10px', maxWidth: '22px' }}>
                      {(m.month === 1 || i === 0) ? `'${String(m.year).slice(2)}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-line min-h-[16px]">
              {(() => {
                const hovered = tlHover === null ? null : timeline.months.find(x => x.key === tlHover);
                if (!hovered) return (
                  <>
                    <span className="flex items-center gap-1.5 text-[9px] text-ink-3">
                      <span className="w-2 h-2 rounded-[1px] bg-gold" /> Mastered
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] text-ink-3">
                      <span className="w-2 h-2 rounded-[1px] bg-silver" /> Beaten
                    </span>
                  </>
                );
                return (
                  <span className="text-[10px] text-ink tabular-nums">
                    {MONTH_ABBR[hovered.month - 1]} {hovered.year}
                    <span className="text-gold ml-2">{hovered.mastered} mastered</span>
                    <span className="text-silver ml-2">{hovered.beaten} beaten</span>
                  </span>
                );
              })()}
            </div>
          </>
        )}
      </StatCard>

      {/* ── Console split ── */}
      <StatCard title="Consoles" hint={`${consoles.total} system${consoles.total === 1 ? '' : 's'} played`}>
        {consoles.list.length === 0 ? (
          <div className="text-[10px] text-ink-3 py-3 text-center">No achievements unlocked yet.</div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {consoles.list.map(c => (
                <StackedBarRow key={c.name} label={c.name} total={c.games} max={consoles.max}
                  mastered={c.mastered} beaten={c.beaten}
                  segments={[
                    // In progress first so every row anchors on the same series: only 3 of 12
                    // consoles have a mastered game, so a mastered-first order left nine bars
                    // starting on a different colour and nothing comparable at the baseline.
                    // Left-to-right then reads as the progression, gold terminating the bar —
                    // the same language as the blue-to-gold progress bars elsewhere in the app.
                    { key: 'other',    value: c.inProgress, color: AWARD_SEGMENTS.other    },
                    { key: 'beaten',   value: c.beaten,     color: AWARD_SEGMENTS.beaten   },
                    { key: 'mastered', value: c.mastered,   color: AWARD_SEGMENTS.mastered },
                  ]} />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-line flex-wrap">
              <span className="flex items-center gap-1.5 text-[9px] text-ink-3">
                <span className="w-2 h-2 rounded-[1px]" style={{ background: AWARD_SEGMENTS.other }} /> In progress
              </span>
              {consoles.anyBeaten && (
                <span className="flex items-center gap-1.5 text-[9px] text-ink-3">
                  <span className="w-2 h-2 rounded-[1px]" style={{ background: AWARD_SEGMENTS.beaten }} />
                  <Medal size={9} style={{ color: AWARD_SEGMENTS.beaten }} /> Beaten
                </span>
              )}
              {consoles.anyMastered && (
                <span className="flex items-center gap-1.5 text-[9px] text-ink-3">
                  <span className="w-2 h-2 rounded-[1px]" style={{ background: AWARD_SEGMENTS.mastered }} />
                  <Trophy size={9} style={{ color: AWARD_SEGMENTS.mastered }} /> Mastered
                </span>
              )}
              <span className="text-[9px] text-ink-3 ml-auto">bar length = games played</span>
            </div>
          </>
        )}
      </StatCard>

      {/* ── Rarity profile ── */}
      <StatCard title="Rarity profile" hint={chunkHint}>
        {achLoading && rarity.scored === 0 ? (
          <div className="flex flex-col gap-1.5">
            {[...Array(5)].map((_, i) => <div key={i} className="shimmer h-[10px] rounded-[2px]" />)}
          </div>
        ) : rarity.scored === 0 ? (
          <div className="text-[10px] text-ink-3 py-3 text-center">No scored unlocks in the loaded window.</div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {rarity.buckets.map(b => (
                <BarRow key={b.key} label={b.label} value={b.count}
                  sub={`· ${Math.round((b.count / rarity.scored) * 100)}%`}
                  pct={(b.count / rarity.max) * 100} color={b.color} />
              ))}
            </div>
            <p className="text-[9px] text-ink-3 mt-2.5 pt-2 border-t border-line leading-relaxed">
              Banded by RetroPoints ÷ points — RA's own weighting for how few players hold an achievement.
            </p>
          </>
        )}
      </StatCard>
    </div>
  );
};

const CompareModal = ({ otherUser, myGames, compareData, loading, error, onClose, profileMap = new Map() }) => {
  const [sortBy, setSortBy] = useState('diff');
  const rootRef = useRef(null), panelRef = useRef(null), headRef = useRef(null);
  const close = useSheet({ panelRef, dragRef: headRef, rootRef, onClose });

  const sharedGames = useMemo(() => {
    if (!compareData || !myGames) return [];
    const otherMap = new Map(compareData.map(g => [g.gameId, g]));
    return myGames
      .filter(g => otherMap.has(g.gameId) && g.maxPossible > 0)
      .map(g => {
        const them = otherMap.get(g.gameId);
        const myPct   = g.maxPossible   ? (g.numAwarded        / g.maxPossible)        * 100 : 0;
        const theirPct = them.maxPossible ? (them.numAwarded     / them.maxPossible)     * 100 : 0;
        return { ...g, them, myPct, theirPct, diff: myPct - theirPct,
          myHC: (g.numAwardedHardcore || 0) > 0,
          theirHC: (them.numAwardedHardcore || 0) > 0 };
      });
  }, [compareData, myGames]);

  const sorted = useMemo(() => {
    const s = [...sharedGames];
    if (sortBy === 'diff')   s.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    else if (sortBy === 'mine')   s.sort((a, b) => b.myPct - a.myPct);
    else if (sortBy === 'theirs') s.sort((a, b) => b.theirPct - a.theirPct);
    else s.sort((a, b) => a.title.localeCompare(b.title));
    return s;
  }, [sharedGames, sortBy]);

  const meAhead = sharedGames.filter(g => g.myPct > g.theirPct).length;
  const tied    = sharedGames.filter(g => g.myPct === g.theirPct).length;
  const behind  = sharedGames.filter(g => g.myPct < g.theirPct).length;

  const myIsHC    = sharedGames.some(g => g.myHC);
  const theirIsHC = sharedGames.some(g => g.theirHC);

  const ModeIcon = ({ hc, size = 8 }) => hc
    ? <Flame size={size} className="shrink-0" style={{ color: 'var(--hc)' }} />
    : <Feather size={size} className="shrink-0" style={{ color: 'var(--ink-2)' }} />;

  const awardBadge = (kind) => {
    if (!kind) return null;
    if (kind === 'mastered' || kind === 'completed')
      return <span className="text-[7px] font-bold uppercase tracking-[0.05em] px-1 py-[1px] rounded-[2px] bg-gold/15 text-gold border border-gold/30 shrink-0">M</span>;
    if (kind === 'beaten-hardcore' || kind === 'beaten-softcore')
      return <span className="text-[7px] font-bold uppercase tracking-[0.05em] px-1 py-[1px] rounded-[2px] bg-ink-2/10 text-ink-2 border border-ink-2/20 shrink-0">B</span>;
    return null;
  };

  const barColor = (kind, fallback) =>
    (kind === 'mastered' || kind === 'completed') ? 'var(--gold)' : fallback;

  return (
    <div ref={rootRef} className="sheet-root" role="dialog" aria-modal="true" aria-label={`Comparing with ${otherUser}`}>
      <div className="sheet-backdrop" onClick={close} />
      <div ref={panelRef} className="sheet-panel wide">
        <div ref={headRef} className="sheet-head">
        <span className="sheet-grab" aria-hidden="true" />
        <button onClick={close} className="sheet-close" aria-label="Close">
          <X size={15} />
        </button>
        <div className="relative flex items-center gap-3 px-4 pt-3 pb-3 pr-12">
          <img
            src={profileMap.get(otherUser)?.userPic ? getMediaUrl(profileMap.get(otherUser).userPic) : `${MEDIA_URL}/UserPic/${otherUser}.png`}
            alt={otherUser}
            className="w-8 h-8 rounded-full border border-well bg-bar object-cover shrink-0"
            onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
          />
          <div>
            <div className="text-[9px] text-ink-3 uppercase tracking-[0.07em] font-semibold">Comparing with</div>
            <a href={`../profile/?u=${otherUser}`} className="text-[13px] font-semibold text-gold hover:text-gold-hi transition-colors">{otherUser}</a>
          </div>
        </div>
        </div>

        <div className="sheet-scroll p-4">
          {loading && (
            <div className="flex flex-col gap-[2px]">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2 bg-box-hi rounded-[2px]">
                  <div className="shimmer w-7 h-7 rounded-[2px] shrink-0" />
                  <div className="flex-1">
                    <div className="shimmer h-2.5 w-36 rounded mb-1" />
                    <div className="shimmer h-2 w-20 rounded" />
                  </div>
                  <div className="shimmer h-4 w-14 rounded" />
                  <div className="w-px h-6 bg-line" />
                  <div className="shimmer h-4 w-14 rounded" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center text-[12px] text-ink-2 py-10">Failed to load comparison data.</div>
          )}

          {!loading && !error && compareData && (
            <>
              <div className="flex items-center gap-4 mb-4 px-1">
                <div className="text-center">
                  <div className="text-[18px] font-bold text-ink">{sharedGames.length}</div>
                  <div className="text-[8px] text-ink-3 uppercase tracking-[0.07em]">Shared</div>
                </div>
                <div className="w-px h-8 bg-line" />
                <div className="text-center">
                  <div className="text-[18px] font-bold text-accent">{meAhead}</div>
                  <div className="text-[8px] text-ink-3 uppercase tracking-[0.07em]">Ahead</div>
                </div>
                <div className="text-center">
                  <div className="text-[18px] font-bold text-ink-2">{tied}</div>
                  <div className="text-[8px] text-ink-3 uppercase tracking-[0.07em]">Tied</div>
                </div>
                <div className="text-center">
                  <div className="text-[18px] font-bold text-aqua">{behind}</div>
                  <div className="text-[8px] text-ink-3 uppercase tracking-[0.07em]">Behind</div>
                </div>
              </div>

              {sharedGames.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-[8px] uppercase tracking-wider text-ink-3 shrink-0">Sort</span>
                  {[['diff', 'Diff'], ['mine', 'Mine'], ['theirs', 'Theirs'], ['az', 'A–Z']].map(([v, label]) => (
                    <button key={v} onClick={() => setSortBy(v)}
                      className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-sm border transition-colors ${sortBy === v ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink hover:border-ink-3'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {sharedGames.length > 0 && (
                <div className="flex items-center gap-2 px-2 mb-1">
                  <div className="hidden md:block md:flex-1" />
                  <div className="flex items-center w-full md:w-auto">
                    <div className="flex-1 md:flex-none md:w-[120px] flex items-center justify-center gap-1 text-[8px] text-accent uppercase tracking-[0.07em] font-semibold">
                      <ModeIcon hc={myIsHC} size={8} />
                      <span>You</span>
                    </div>
                    <div className="w-px h-3 bg-line shrink-0" />
                    <div className="flex-1 md:flex-none md:w-[120px] flex items-center justify-center gap-1 text-[8px] text-aqua uppercase tracking-[0.07em] font-semibold">
                      <ModeIcon hc={theirIsHC} size={8} />
                      <span>{otherUser}</span>
                    </div>
                  </div>
                </div>
              )}

              {sharedGames.length === 0 ? (
                <div className="text-center text-[12px] text-ink-2 py-10">No shared games found.</div>
              ) : (
                <div className="flex flex-col gap-[2px]">
                  {sorted.map(g => {
                    const myBar    = Math.round(g.myPct);
                    const theirBar = Math.round(g.theirPct);
                    const { baseTitle, subsetName, isSubset, tags } = parseTitle(g.title);
                    return (
                      <div key={g.gameId} className="flex flex-col gap-1 px-2 py-1.5 bg-box-hi hover:bg-box-hover rounded-[2px] transition-colors md:flex-row md:items-center md:gap-2">
                        {/* Icon + title */}
                        <div className="flex items-center gap-2 min-w-0 md:flex-1">
                          <a href={`../game/?id=${g.gameId}&compare=${encodeURIComponent(otherUser)}`} className="shrink-0 w-7 h-7 rounded-[2px] border border-well bg-bar overflow-hidden block hover:scale-105 transition-transform">
                            <img
                              src={getMediaUrl(g.imageIcon)}
                              alt={g.title}
                              className="w-full h-full object-cover"
                              onError={e => { e.currentTarget.style.opacity = '0.3'; }}
                            />
                          </a>
                          <div className="flex-1 min-w-0">
                            <a href={`../game/?id=${g.gameId}&compare=${encodeURIComponent(otherUser)}`} className="text-[10px] font-medium text-ink hover:text-accent transition-colors truncate leading-tight block">{baseTitle}</a>
                            {isSubset && (
                              <div className="flex items-center gap-1 mt-[1px]">
                                <span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>
                                <span className="text-[8px] text-gold-dim truncate">{subsetName}</span>
                              </div>
                            )}
                            {!isSubset && tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-[1px]">{renderTildeTags(tags)}</div>
                            )}
                            <div className="text-[8px] text-ink-3 truncate">{g.consoleName}</div>
                          </div>
                        </div>
                        {/* Progress bars */}
                        <div className="flex items-stretch">
                          <div className="flex-1 md:flex-none md:w-[120px] md:shrink-0 rounded-[2px] px-2 py-1.5 md:py-2.5 transition-colors"
                            style={{ background: g.myPct > g.theirPct ? 'rgb(var(--c-accent) / 0.15)' : 'transparent' }}>
                            <div className="flex items-center justify-between gap-1 mb-[3px]">
                              <div className="flex items-center gap-[3px]">
                                <ModeIcon hc={g.myHC} size={7} />
                                <span className={`text-[9px] font-semibold ${g.myPct > g.theirPct ? 'text-accent' : 'text-ink-2'}`}>{myBar}%</span>
                              </div>
                              {awardBadge(g.highestAwardKind)}
                            </div>
                            <div className="h-[3px] w-full bg-bar rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${myBar}%`, background: barColor(g.highestAwardKind, 'var(--accent)') }} />
                            </div>
                          </div>
                          <div className="w-px self-stretch bg-line shrink-0" />
                          <div className="flex-1 md:flex-none md:w-[120px] md:shrink-0 rounded-[2px] px-2 py-1.5 md:py-2.5 transition-colors"
                            style={{ background: g.theirPct > g.myPct ? 'rgb(var(--c-accent) / 0.15)' : 'transparent' }}>
                            <div className="flex items-center justify-between gap-1 mb-[3px]">
                              <div className="flex items-center gap-[3px]">
                                <ModeIcon hc={g.theirHC} size={7} />
                                <span className={`text-[9px] font-semibold ${g.theirPct > g.myPct ? 'text-aqua' : 'text-ink-2'}`}>{theirBar}%</span>
                              </div>
                              {awardBadge(g.them.highestAwardKind)}
                            </div>
                            <div className="h-[3px] w-full bg-bar rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${theirBar}%`, background: barColor(g.them.highestAwardKind, 'var(--aqua)') }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SocialUserRow = ({ user, isMutual, onCompare, cachedProfile }) => {
  const userPic = cachedProfile?.userPic || user.userPic;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const rawLastPlayed = cachedProfile?.lastPlayed ?? null;
  const lastPlayed = rawLastPlayed?.lastPlayedTs && (Date.now() - rawLastPlayed.lastPlayedTs) < WEEK_MS ? rawLastPlayed : null;
  const isRecentlyActive = lastPlayed?.lastPlayedTs && (Date.now() - lastPlayed.lastPlayedTs) < 60 * 60 * 1000;
  const isSoftcore = cachedProfile ? cachedProfile.totalPoints === 0 : false;
  const displayPoints = isSoftcore ? (cachedProfile.totalSoftcorePoints ?? user.pointsSoftcore ?? 0) : user.points;
  return (
  <div className="flex items-center gap-2.5 px-2.5 py-2 bg-box hover:bg-box-hi rounded-[2px] transition-colors">
    <div className="relative shrink-0">
      <img
        src={userPic ? getMediaUrl(userPic) : `${MEDIA_URL}/UserPic/${user.user}.png`}
        alt={user.user}
        className="w-7 h-7 rounded-full border border-well object-cover bg-bar"
        onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
      />
      {isRecentlyActive && (
        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-online border border-box" />
      )}
    </div>
    <div className="flex flex-col min-w-0 flex-1">
      <div className="flex items-center gap-1 min-w-0">
        <a href={`../profile/?u=${user.user}`}
          className="text-[11px] font-medium text-gold hover:text-gold-hi transition-colors truncate">
          {user.user}
        </a>
        {isMutual && (
          <div className="relative group shrink-0">
            <ArrowLeftRight size={9} className="text-accent" />
            <div className="absolute left-0 bottom-full mb-1.5 z-10 hidden group-hover:block pointer-events-none">
              <div className="text-[9px] font-medium text-ink bg-inset border border-line rounded-[2px] px-1.5 py-[3px] whitespace-nowrap shadow-lg">
                Mutual follow
              </div>
            </div>
          </div>
        )}
      </div>
      {(() => {
        const richPresence = cachedProfile?.richPresenceMsg;
        const hasRichPresence = richPresence && richPresence !== 'Idle' && richPresence !== 'Unknown';
        if (lastPlayed) {
          const { baseTitle, subsetName, isSubset, tags } = parseTitle(lastPlayed.gameTitle);
          return (
            <div className="flex flex-col mt-[2px]">
              <a href={`../game/?id=${lastPlayed.gameId}`}
                className="block w-fit max-w-full hover:opacity-75 transition-opacity"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1 min-w-0">
                  {lastPlayed.gameIcon && (
                    <img src={getMediaUrl(lastPlayed.gameIcon)} alt=""
                      className="w-3 h-3 rounded-[1px] shrink-0 object-cover bg-bar" />
                  )}
                  <span className="text-[9px] text-accent truncate min-w-0">{baseTitle}</span>
                  <span className="text-ink-4 mx-0.5 shrink-0">·</span>
                  <span className="text-[9px] text-ink-3 shrink-0">{timeAgo(lastPlayed.lastPlayedTs)}</span>
                </div>
                {(isSubset || tags.length > 0) && (
                  <div className="flex items-center gap-1 mt-[1px]">
                    {isSubset && <><span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>{subsetName && <span className="text-[9px] text-gold-dim shrink-0">{subsetName}</span>}</>}
                    {tags.length > 0 && renderTildeTags(tags)}
                  </div>
                )}
              </a>
              {hasRichPresence && (
                <span className="text-[9px] text-ink-3 truncate">{richPresence}</span>
              )}
            </div>
          );
        }
        if (rawLastPlayed?.lastPlayedTs) {
          return (
            <span className="text-[9px] text-ink-3 mt-[2px]">Last active {timeAgo(rawLastPlayed.lastPlayedTs)}</span>
          );
        }
        return null;
      })()}
    </div>
    {displayPoints != null && (
      <span className={`text-[10px] shrink-0 ${isSoftcore ? 'text-ink-2' : 'text-gold'}`}>
        {displayPoints.toLocaleString()} pts
      </span>
    )}
    <button
      onClick={() => onCompare(user.user)}
      className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.07em] px-1.5 py-[2px] rounded-[2px] border border-aqua/30 bg-aqua/[0.07] text-aqua hover:bg-aqua/15 transition-colors">
      Compare
    </button>
  </div>
  );
};

const SocialTab = ({ socialData, socialError, onRetry, onCompare, profileMap = new Map() }) => {
  const [sortBy, setSortBy] = useState('az');
  const [subTab, setSubTab] = useState('following');

  const sortUsers = (users) => {
    const s = [...users];
    if (sortBy === 'points') s.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    else s.sort((a, b) => a.user.localeCompare(b.user));
    return s;
  };

  if (socialError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="text-[12px] text-ink-2">Failed to load social data.</span>
        <button onClick={onRetry}
          className="text-[11px] text-accent hover:text-ink transition-colors">
          Try again
        </button>
      </div>
    );
  }

  const followingTotal = socialData?.following?.total ?? 0;
  const followerTotal  = socialData?.followers?.total ?? 0;

  const subTabs = [
    { id: 'following', label: 'Following', count: followingTotal },
    { id: 'followers', label: 'Followers', count: followerTotal },
  ];

  if (!socialData) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 border-b border-line-faint pb-2">
          {subTabs.map(({ id, label }) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`text-[11px] px-3 py-1 rounded-[2px] border font-medium transition-colors uppercase tracking-wider ${subTab === id ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-[2px]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 mb-[2px] bg-box rounded-[2px]">
              <div className="shimmer w-7 h-7 rounded-full shrink-0" />
              <div className="shimmer h-2.5 w-32 rounded flex-1" />
              <div className="shimmer h-2 w-12 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const followingUsers = socialData.following?.results || [];
  const followerUsers  = socialData.followers?.results || [];

  const active = subTab === 'following'
    ? { users: followingUsers, total: followingTotal, isMutual: u => u.isFollowingMe }
    : { users: followerUsers,  total: followerTotal,  isMutual: u => u.amIFollowing };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-line-faint pb-2">
        <div className="flex gap-1">
          {subTabs.map(({ id, label, count }) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`text-[11px] px-3 py-1 rounded-[2px] border font-medium transition-colors uppercase tracking-wider ${subTab === id ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink'}`}>
              {label}
              <span className={`ml-1.5 text-[9px] ${subTab === id ? 'text-ink-3' : 'text-ink-4'}`}>{count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] uppercase tracking-wider text-ink-3 shrink-0">Sort</span>
          {[['az', 'A–Z'], ['points', 'Points']].map(([v, label]) => (
            <button key={v} onClick={() => setSortBy(v)}
              className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-sm border transition-colors ${sortBy === v ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink hover:border-ink-3'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {active.users.length === 0 ? (
        <div className="text-[11px] text-ink-3 py-3">None yet.</div>
      ) : (
        <div className="flex flex-col gap-[2px]">
          {sortUsers(active.users).map(u => <SocialUserRow key={u.user} user={u} isMutual={active.isMutual(u)} onCompare={onCompare} cachedProfile={profileMap.get(u.user)} />)}
        </div>
      )}
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Split data state ─────────────────────────────────────
  const [profileData,   setProfileData]   = useState(null);
  const [backlogData,       setBacklogData]       = useState(null);
  const [backlogLoadingMore, setBacklogLoadingMore] = useState(false);
  const [backlogTs,         setBacklogTs]         = useState(null);
  const [backlogRefreshing, setBacklogRefreshing] = useState(false);
  const [socialData,    setSocialData]    = useState(null);
  const [socialError,   setSocialError]   = useState(false);
  const [socialTs,        setSocialTs]        = useState(null);
  const [socialRefreshing, setSocialRefreshing] = useState(false);
  const [socialProfileMap, setSocialProfileMap] = useState(new Map());
  const [socialProfilesProgress, setSocialProfilesProgress] = useState(null); // null | { done, total }
  const socialProfilesFetchingRef = useRef(false);
  const [compareUser,   setCompareUser]   = useState(null);
  const [compareData,   setCompareData]   = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError,  setCompareError]  = useState(false);
  // gamesData stores only detailedGameProgress, lazy-loaded per game
  const [gamesData,     setGamesData]     = useState({ detailedGameProgress: {} });
  const [loadingGameDetailId, setLoadingGameDetailId] = useState(null);

  const [achievements,           setAchievements]           = useState(null);
  const [achievementsLoadingMore, setAchievementsLoadingMore] = useState(false);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState(null);

  const targetUser = new URLSearchParams(window.location.search).get('u') || null;
  const isVisitorMode = !!targetUser;

  const VALID_TABS = isVisitorMode
    ? ['dex', 'overview', 'recent', 'progress']
    : ['dex', 'overview', 'recent', 'progress', 'activity', 'backlog', 'social', 'stats'];
  const initialTab = (() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    return VALID_TABS.includes(p) ? p : 'dex';
  })();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [progressSearch,  setProgressSearch]  = useState('');
  const [progressFilter,  setProgressFilter]  = useState('all');   // all | nearly | inprogress | abandoned
  const [showMastered,    setShowMastered]    = useState(false);
  const [recentSearch,    setRecentSearch]    = useState('');
  const [dexFilter,       setDexFilter]       = useState('all');
  const [progressSort,    setProgressSort]    = useState('overall');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const tabBarRef = useRef(null);
  const tabContentRef = useRef(null);
  const [gameView, setGameView] = useGameView();
  const [backlogSearch, setBacklogSearch] = useState('');
  const [backlogStatusFilter, setBacklogStatusFilter] = useState('all');
  const [backlogGrouping, setBacklogGrouping] = useState('none');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [selectedGame, setSelectedGame] = useState(null);

  const [socialView,            setSocialView]            = useState(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return v === 'friends' ? 'friends' : 'mine';
  });
  const [friendsActivityStatus, setFriendsActivityStatus] = useState('idle');  // 'idle' | 'loading' | 'updating' | 'done' | 'error'
  const [friendsActivity,       setFriendsActivity]       = useState({});       // { [username]: achievement[] }
  const [friendsFetchProgress,  setFriendsFetchProgress]  = useState(null);     // { done, total } | null
  const [failedFriends,         setFailedFriends]         = useState([]);        // usernames that failed to load
  const [friendsActivityTs,     setFriendsActivityTs]     = useState(null);
  const friendsFetchingRef = useRef(false);                                      // prevents re-entry during async fetch

  // ── Auth helpers ─────────────────────────────────────────
  const handleAuthError = () => {
    clearCredentials();
    window.location.replace('../');
  };

  const refreshFriendsActivity = async () => {
    const cached = socialData ?? await getSocialData(getCredentials()?.username);
    const list = cached?.following?.results ?? [];
    await Promise.all(list.map(({ user }) => staleFriendActivity(user)));
    setFailedFriends([]);
    setFriendsFetchProgress(null);
    setFriendsActivityStatus('updating');
  };

  const resetFriendsActivity = async () => {
    await clearAllFriendActivity();
    setFriendsActivity({});
    setFriendsFetchProgress(null);
    setFailedFriends([]);
    setFriendsActivityTs(null);
    setFriendsActivityStatus('idle');
  };

  const refreshBacklog = async () => {
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    setBacklogRefreshing(true);
    try {
      const data = await fetchBacklog(creds.username, creds.apiKey, null, true);
      setBacklogData(data);
      const rec = await getBacklog(creds.username);
      if (rec) setBacklogTs(rec.ts);
    } catch (err) {
      if (err.message === 'AUTH_ERROR') handleAuthError();
    } finally {
      setBacklogRefreshing(false);
    }
  };

  const startSocialProfilesFetch = async (creds, data, { force = false } = {}) => {
    if (socialProfilesFetchingRef.current) return;
    const allUsers = [...new Set([
      ...(data.following?.results || []),
      ...(data.followers?.results || []),
    ].map(u => u.user))];
    if (!allUsers.length) return;
    if (!force) {
      const lastSynced = await getSocialProfilesSyncTs(creds.username);
      if (lastSynced && Date.now() - lastSynced < PROFILE_SYNC_TTL) return;
    }
    socialProfilesFetchingRef.current = true;
    setSocialProfilesProgress({ done: 0, total: allUsers.length });
    fetchAndCacheSocialProfiles(creds.username, creds.apiKey, allUsers, {
      onProfile: (user, record) => {
        setSocialProfileMap(prev => new Map(prev).set(user, record));
        setSocialProfilesProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
      },
    }).then(() => setSocialProfilesSyncTs(creds.username))
      .finally(() => {
        socialProfilesFetchingRef.current = false;
        setSocialProfilesProgress(null);
      });
  };

  const applySocialData = (creds, data, ts, { force = false } = {}) => {
    setSocialData(data);
    setSocialTs(ts);
    const allUsers = [...new Set([
      ...(data.following?.results || []),
      ...(data.followers?.results || []),
    ].map(u => u.user))];
    if (allUsers.length) getSocialProfileMap(allUsers).then(setSocialProfileMap);
    startSocialProfilesFetch(creds, data, { force });
  };

  const refreshSocial = async () => {
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    setSocialRefreshing(true);
    try {
      const data = await fetchSocial(creds.username, creds.apiKey, true);
      const rec = await getSocialData(creds.username);
      applySocialData(creds, data, rec?.ts ?? Date.now(), { force: true });
    } catch (err) {
      if (err.message === 'AUTH_ERROR') handleAuthError();
    } finally {
      setSocialRefreshing(false);
    }
  };

  // ── Compare progress ──────────────────────────────────────
  const openCompare = async (otherUsername) => {
    setCompareUser(otherUsername);
    setCompareData(null);
    setCompareLoading(true);
    setCompareError(false);
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    try {
      const data = await getUserCompletionProgress(creds.username, creds.apiKey, { u: otherUsername });
      setCompareData(data);
    } catch (err) {
      if (err.message === 'AUTH_ERROR') handleAuthError();
      else setCompareError(true);
    } finally {
      setCompareLoading(false);
    }
  };

  const closeCompare = () => {
    setCompareUser(null);
    setCompareData(null);
    setCompareError(false);
  };

  // ── Per-game detail lazy loader ───────────────────────────
  const openGameDetails = async (game) => {
    setSelectedGame(game);
    if (game.achievements && game.achievements.length > 0) return; // already loaded
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    setLoadingGameDetailId(game.id);
    try {
      const details = await fetchGameDetails(creds.username, creds.apiKey, game.id);
      if (details) {
        setGamesData(prev => ({
          detailedGameProgress: { ...(prev?.detailedGameProgress || {}), [game.id]: details },
        }));
      }
    } catch (err) {
      if (err.message === 'AUTH_ERROR') handleAuthError();
    } finally {
      setLoadingGameDetailId(null);
    }
  };

  // ── Load all achievement chunks (IDB-backed, streams chunk 0 via onPartial) ─
  const loadAchievements = () => {
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    setAchievementsLoadingMore(true);
    fetchAllAchievements(creds.username, creds.apiKey, {
      onPartial: (partial) => setAchievements(partial),
    })
      .then(all => { setAchievements(all); setAchievementsLoadingMore(false); })
      .catch(err => {
        if (err.message === 'AUTH_ERROR') { handleAuthError(); return; }
        setAchievements([]);
        setAchievementsLoadingMore(false);
      });
  };

  const setTab = (tab) => {
    setActiveTab(tab);
    scrollToTabs(tabBarRef);
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    if (tab !== 'activity') url.searchParams.delete('view');
    window.history.replaceState({}, '', url);
  };

  // Tabs in display order: the desktop TabBar and the phone swipe both follow it
  const tabIcon = Icon => <Icon size={15} />;
  const profileTabs = [
    { id: 'dex',      label: 'Dex',      icon: tabIcon(BookMarked) },
    { id: 'overview', label: 'Overview', icon: tabIcon(User) },
    { id: 'recent',   label: 'Recent',   icon: tabIcon(Clock) },
    { id: 'progress', label: 'Progress', icon: tabIcon(BarChart2) },
    ...(!isVisitorMode ? [
      { id: 'activity', label: 'Activity', icon: tabIcon(Activity) },
      { id: 'backlog',  label: 'Backlog',  icon: tabIcon(Star) },
      { id: 'social',   label: 'Social',   icon: tabIcon(Users) },
      { id: 'stats',    label: 'Stats',    icon: tabIcon(PieChart) },
    ] : []),
  ];
  useSwipeTabs(tabContentRef, profileTabs.map(t => t.id), activeTab, setTab, !loadingProfile && !error);

  const setSocialViewUrl = (view) => {
    setSocialView(view);
    const url = new URL(window.location);
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url);
  };

  const toggleGroup = (key) => setCollapsedGroups(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  // ── Fetch profile from RA API on mount; redirect to login if not authed ──
  useEffect(() => {
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    fetchProfile(creds.username, creds.apiKey, targetUser || undefined)
      .then(({ profileData: pd }) => {
        setProfileData(pd);
        setLoadingProfile(false);
      })
      .catch(err => {
        if (err.message === 'AUTH_ERROR') { handleAuthError(); return; }
        setError(err.message || 'Failed to load profile.');
        setLoadingProfile(false);
      });
  }, []);

  // ── Load backlog when Backlog tab opens ──
  useEffect(() => {
    if (isVisitorMode || activeTab !== 'backlog') return;
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    if (backlogData !== null) return;

    (async () => {
      setBacklogLoadingMore(true);
      // Show IDB data instantly if available
      const cached = await getBacklog(creds.username);
      if (cached) {
        setBacklogData({ total: cached.total, results: cached.results });
        setBacklogTs(cached.ts);
        setBacklogLoadingMore(false);
        return; // fresh enough — don't re-fetch until user explicitly refreshes
      }
      // No cache — fetch from API
      fetchBacklog(creds.username, creds.apiKey, partial => setBacklogData(partial))
        .then(data => {
          setBacklogData(data);
          setBacklogLoadingMore(false);
          getBacklog(creds.username).then(rec => { if (rec) setBacklogTs(rec.ts); });
        })
        .catch(err => {
          if (err.message === 'AUTH_ERROR') handleAuthError();
          else { setBacklogData({ total: 0, results: [] }); setBacklogLoadingMore(false); }
        });
    })();
  }, [activeTab]);

  // ── Fetch friends activity when Friends view opens ──
  useEffect(() => {
    if (isVisitorMode || activeTab !== 'activity' || socialView !== 'friends' || (friendsActivityStatus !== 'idle' && friendsActivityStatus !== 'updating') || friendsFetchingRef.current) return;
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    const { username: u, apiKey: k } = creds;
    friendsFetchingRef.current = true;
    (async () => {
      try {
        const social = socialData ?? await fetchSocial(u, k);
        const followingList = social.following.results;
        if (followingList.length === 0) { setFriendsActivityStatus('done'); return; }
        if (socialProfileMap.size === 0)
          getSocialProfileMap(followingList.map(f => f.user)).then(m => { if (m.size > 0) setSocialProfileMap(m); });
        const cached = await allFriendsCached(followingList);
        if (!cached) setFriendsActivityStatus('loading');
        else setFriendsActivityStatus('updating');
        await fetchFriendsActivity(u, k, followingList, {
          onProgress: (done, total) => setFriendsFetchProgress({ done, total }),
          onUser: (friendUser, achievements) =>
            setFriendsActivity(prev => ({ ...prev, [friendUser]: achievements })),
          onError: (friendUser) =>
            setFailedFriends(prev => [...prev, friendUser]),
        });
        setFriendsActivityStatus('done');
        setFriendsActivityTs(Date.now());
      } catch (e) {
        if (e.message === 'AUTH_ERROR') { handleAuthError(); return; }
        setFriendsActivityStatus('error');
      } finally {
        friendsFetchingRef.current = false;
      }
    })();
  }, [activeTab, socialView, friendsActivityStatus]);

  // ── Load social data when Social tab opens ──
  useEffect(() => {
    if (isVisitorMode || activeTab !== 'social' || socialData !== null || socialError) return;
    const creds = getCredentials();
    if (!creds) { handleAuthError(); return; }
    (async () => {
      const SOCIAL_TTL = 24 * 60 * 60 * 1000;
      const cached = await getSocialData(creds.username);
      if (cached) {
        applySocialData(creds, { following: cached.following, followers: cached.followers }, cached.ts);
        if (Date.now() - cached.ts < SOCIAL_TTL) return;
      }
      setSocialRefreshing(true);
      fetchSocial(creds.username, creds.apiKey, true)
        .then(data => {
          applySocialData(creds, data, Date.now());
          setSocialError(false);
        })
        .catch(err => {
          if (err.message === 'AUTH_ERROR') handleAuthError();
          else if (!cached) setSocialError(true);
        })
        .finally(() => setSocialRefreshing(false));
    })();
  }, [activeTab, socialError]);

  // ── Load achievements when the Activity or Stats tab opens (and the wide Overview, for its unlock rows) ──
  useEffect(() => {
    const wideOverview = activeTab === 'overview' && window.matchMedia('(min-width: 1024px)').matches;
    if (isVisitorMode || (activeTab !== 'activity' && activeTab !== 'stats' && !wideOverview)) return;
    if (achievements === null && !achievementsLoadingMore) loadAchievements();
  }, [activeTab]);

  const allLoadedAchievements = achievements || [];

  // ── Compute heatmap from loaded achievements ──────────────
  const heatmapData = useMemo(() => {
    const map = {};
    allLoadedAchievements.forEach(ach => {
      const day = toLocalDay(ach.date || '');
      if (!day) return;
      if (!map[day]) map[day] = { count: 0, points: 0 };
      map[day].count++;
      map[day].points += ach.points || 0;
    });
    return map;
  }, [achievements]);

  // ── Merge profile + backlog + games into the shape transformData expects ──
  const rawData = useMemo(() => {
    if (!profileData) return null;
    return {
      ...profileData,
      wantToPlayList:       backlogData,
      recentAchievements:   [],
      detailedGameProgress: gamesData?.detailedGameProgress ?? {},
    };
  }, [profileData, backlogData, gamesData]);

  const { profile: PROFILE_DATA, games: ALL_GAMES, backlog: BACKLOG } = useMemo(() => transformData(rawData), [rawData]);

  // Game awards for the Overview's CompletionsPanel (assets/completions.js): art from the game's screenshot
  const awardItems = useMemo(() => (PROFILE_DATA?.gameAwards ?? []).map(a => {
    const g = a.gameId ? ALL_GAMES.find(x => x.id === Number(a.gameId)) : null;
    return {
      key: `${a.gameId ?? a.id}-${a.type}`,
      tier: a.type === 'Mastery/Completion' ? 'gold' : 'silver',
      name: a.baseTitle || a.title,
      tags: a.isSubset ? <span className="subset-tag ml-1.5">Subset</span> : renderTildeTags(a.tags),
      title: a.title,
      at: a.awardedAt,
      sub: a.console,
      cover: a.icon, tile: a.icon, pixel: true,
      art: g?.background && g.background !== a.icon ? g.background : null,
      href: a.gameId ? `../game/?id=${a.gameId}${compareParam}` : undefined,
    };
  }), [PROFILE_DATA, ALL_GAMES]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShowScrollTop(y > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loadingProfile) return <ProfileLoadingSkeleton />;
  if (error || !PROFILE_DATA) return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center text-ink p-4">
        <AlertCircle className="text-hc mb-2" size={48} />
        <h1 className="text-xl font-bold mb-2">Data Load Error</h1>
        <p className="text-ink-2 mb-4">{error || "Could not transform profile data."}</p>
    </div>
  );

  // The dex counter (header on phones, identity rail on desktop); tapping a cell opens the Dex on it
  const dex = dexCounts(ALL_GAMES);
  const pickDex = key => { setDexFilter(key); setTab('dex'); };

  let displayedGames = [...ALL_GAMES];
  let progressCounts = null;
  if (activeTab === 'recent') {
    // Recent: the latest 15; a search looks through every game, newest played first (up to 50)
    if (recentSearch) {
      const q = fold(recentSearch);
      displayedGames = displayedGames.filter(g => fold(g.baseTitle || g.title).includes(q) || fold(g.subsetName).includes(q));
    }
    displayedGames.sort((a, b) => raDateMs(b.lastPlayedStr) - raDateMs(a.lastPlayedStr));
    displayedGames = displayedGames.slice(0, recentSearch ? 50 : 15);
  } else if (activeTab === 'progress') {
    displayedGames = displayedGames.filter(g =>
      g.achievementsUnlocked > 0 && g.achievementsTotal > 0
      && (!progressSearch || fold(g.baseTitle || g.title).includes(fold(progressSearch))));
    progressCounts = progressViewCounts(displayedGames, showMastered);
    displayedGames = applyProgressView(displayedGames, progressFilter) ?? displayedGames
      .filter(g => showMastered || !g.isMastered)
      .sort(progressSort === 'recent'
        ? (a, b) => raDateMs(b.lastPlayedStr) - raDateMs(a.lastPlayedStr)
        : (a, b) => b.rawProgress - a.rawProgress);
  }

  return (
    <div className="min-h-screen bg-page text-ink font-sans selection:bg-accent selection:text-page flex flex-col" style={{ overflowX: 'clip' }}>
      
      <Topbar crumbs={isVisitorMode
        ? [{ label: 'Cheevodex', href: '../profile/' }, { label: targetUser }]
        : [{ label: 'Cheevodex' }, { label: 'Profile' }]
      } />

      {/* Header */}
      {/* ── Header (doc-012): latest game's art blurred behind, gold glow left / blue glow right ── */}
      {(() => {
        const lp = profileData?.mostRecentGame?.lastPlayed;
        const lpTs = lp ? new Date(lp.includes('T') ? lp : lp.replace(' ', 'T') + 'Z').getTime() : null;
        const isRecentlyActive = lpTs && (Date.now() - lpTs) < 60 * 60 * 1000;
        const dot = isRecentlyActive ? 'var(--online)'
          : PROFILE_DATA.status === 'Online' ? 'var(--aqua)'
          : PROFILE_DATA.status === 'Playing' ? 'var(--ok)'
          : PROFILE_DATA.status === 'Offline' ? 'var(--ink-3)' : null;
        const games = ALL_GAMES || [];
        const recentId = PROFILE_DATA.mostRecentGame?.id;
        const art = (games.find(g => g.id === recentId) || games[0])?.background;
        const softOnly = PROFILE_DATA.totalPoints === 0;
        return (
        <header className="phead lg:hidden">
          <ArtBg urls={[art]} variant="art-header" />
          <div className="phead-in">
            <div className="phead-main">
              <div className="phead-top">
                <div className="phead-av">
                  <img src={PROFILE_DATA.avatar} alt={PROFILE_DATA.username} />
                  {dot && <span className="dot" style={{ background: dot }} />}
                </div>
                <div className="phead-id">
                  <div className="phead-name">
                    <h1 className="art-shadow">{PROFILE_DATA.username}</h1>
                    <a href={`${SITE_URL}/user/${PROFILE_DATA.username}`} target="_blank" rel="noreferrer" title="View on RetroAchievements" className="phead-link">
                      <img
                        src="https://static.retroachievements.org/assets/images/favicon.webp"
                        onError={(e) => { e.target.onerror = null; e.target.src = "https://avatars.githubusercontent.com/u/49842581?s=32&v=4"; }}
                        alt="RA"
                      />
                    </a>
                  </div>
                  <div className="phead-sub art-shadow">
                    Rank <b className="text-accent num">#{PROFILE_DATA.rank}</b>
                    {PROFILE_DATA.topPercentage !== '--%' && <> · Top <b className="text-accent num">{PROFILE_DATA.topPercentage}</b></>}
                  </div>
                  <div className="phead-sub art-shadow">Last active <b className="text-ink">{PROFILE_DATA.lastActivity}</b></div>
                </div>
              </div>
              {PROFILE_DATA.bio && <p className="phead-motto art-shadow">"{PROFILE_DATA.bio}"</p>}
            </div>

            <div className="phead-side">
              <div className="phead-stats">
                <div className="phead-stat">
                  <b className="num" style={{ color: softOnly ? 'var(--ink-2)' : 'var(--gold)' }}>
                    {(softOnly ? PROFILE_DATA.totalSoftcorePoints : PROFILE_DATA.totalPoints).toLocaleString()}
                  </b>
                  <span>{softOnly ? 'Softcore points' : 'Points'}</span>
                </div>
                <div className="phead-stat">
                  <b className="num text-ink">{PROFILE_DATA.totalUnlocked.toLocaleString()}</b>
                  <span>Achievements</span>
                </div>
                <div className="phead-stat">
                  <b className="num text-accent">#{PROFILE_DATA.rank}</b>
                  <span>Site rank</span>
                </div>
              </div>
              <DexCounter counts={dex} onPick={pickDex} />
              <div className="phead-meta">Member since <b>{PROFILE_DATA.memberSince}</b></div>
            </div>
          </div>
        </header>
        );
      })()}

      <main className="max-w-5xl lg:max-w-[80rem] mx-auto px-4 md:px-8 py-6 flex-1 w-full">
        {/* Desktop (≥1024px): the identity rail pinned on the left, tabs and content on the right */}
        <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {(() => {
          const lp = profileData?.mostRecentGame?.lastPlayed;
          const lpTs = lp ? new Date(lp.includes('T') ? lp : lp.replace(' ', 'T') + 'Z').getTime() : null;
          const dot = lpTs && (Date.now() - lpTs) < 60 * 60 * 1000 ? 'var(--online)'
            : PROFILE_DATA.status === 'Online' ? 'var(--aqua)'
            : PROFILE_DATA.status === 'Playing' ? 'var(--ok)'
            : PROFILE_DATA.status === 'Offline' ? 'var(--ink-3)' : null;
          const recentId = PROFILE_DATA.mostRecentGame?.id;
          const art = (ALL_GAMES.find(g => g.id === recentId) || ALL_GAMES[0])?.background;
          const softOnly = PROFILE_DATA.totalPoints === 0;
          return (
            <aside className="idrail" aria-label="Player">
              <div className="idr-card">
                <ArtBg urls={[art]} variant="art-header" />
                <div className="idr-in">
                  <div className="phead-av">
                    <img src={PROFILE_DATA.avatar} alt={PROFILE_DATA.username} />
                    {dot && <span className="dot" style={{ background: dot }} />}
                  </div>
                  <div>
                    <div className="idr-name">
                      <h1 className="art-shadow">{PROFILE_DATA.username}</h1>
                      <a href={`${SITE_URL}/user/${PROFILE_DATA.username}`} target="_blank" rel="noreferrer" title="View on RetroAchievements" className="phead-link">
                        <img src="https://static.retroachievements.org/assets/images/favicon.webp" alt="RA" />
                      </a>
                    </div>
                    <div className="idr-sub">
                      Rank <b className="text-accent num">#{PROFILE_DATA.rank}</b>
                      {PROFILE_DATA.topPercentage !== '--%' && <> · Top <b className="text-accent num">{PROFILE_DATA.topPercentage}</b></>}
                      <br />Last active <b className="text-ink">{PROFILE_DATA.lastActivity}</b>
                    </div>
                  </div>
                  {PROFILE_DATA.bio && <p className="idr-motto">"{PROFILE_DATA.bio}"</p>}
                </div>
                <div className="idr-nums">
                  <div><b style={{ color: softOnly ? 'var(--ink-2)' : 'var(--gold)' }}>{(softOnly ? PROFILE_DATA.totalSoftcorePoints : PROFILE_DATA.totalPoints).toLocaleString()}</b><span>{softOnly ? 'SC points' : 'Points'}</span></div>
                  <div><b className="text-ink">{PROFILE_DATA.totalUnlocked.toLocaleString()}</b><span>Achievements</span></div>
                  <div><b className="text-accent">#{PROFILE_DATA.rank}</b><span>Site rank</span></div>
                </div>
              </div>
              <div>
                <div className="idr-h">Dex</div>
                <DexCounter counts={dex} onPick={pickDex} />
              </div>
              <div>
                <div className="idr-h">Stats</div>
                <StatTiles items={PROFILE_DATA.statsLeft.filter(st => !['Achievements unlocked', 'Points', 'Site rank'].includes(st.label)).map(st => ({ ...st, label: STAT_LABELS[st.label] ?? st.label }))} />
                {statsExpanded && <div className="mt-2 anim-fade"><StatTiles items={PROFILE_DATA.statsRight} /></div>}
                <button type="button" onClick={() => setStatsExpanded(v => !v)} className="smore" aria-expanded={statsExpanded}>
                  {statsExpanded ? 'Fewer stats' : 'More stats'}
                  <ChevronDown size={13} className={`transition-transform duration-200 ${statsExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <div className="idr-foot">Member since <b>{PROFILE_DATA.memberSince}</b></div>
            </aside>
          );
        })()}
        <div className="min-w-0">
        
        <div className="ptabs-anchor" />
        <TabBar barRef={tabBarRef} className="md:top-[37px] -mx-4 md:-mx-8 lg:mx-0 mb-4 px-2 md:px-6 lg:px-0"
          tabs={profileTabs} active={activeTab} onChange={setTab} />

        <div ref={tabContentRef} className="flex flex-col gap-3">
          {activeTab === 'dex' ? (
            <DexTab games={ALL_GAMES} filter={dexFilter} onFilter={setDexFilter} />
          ) : activeTab === 'overview' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-8">
              <div className="flex flex-col gap-6 min-w-0">
                {/* Last played: the same row as Recent / Progress, with the rich presence inside it */}
                <div>
                  <h2 className="sec-t border-b border-line pb-1.5 flex items-center gap-2 mb-3">
                    <span className="sec-mark" />
                    <Activity size={15} className="text-accent"/> Last played
                  </h2>
                  {(() => {
                    const g = PROFILE_DATA.mostRecentGame && ALL_GAMES.find(x => x.id === PROFILE_DATA.mostRecentGame.id);
                    if (!g) return <div className="text-ink-2 text-[11px] py-2">No recent games found.</div>;
                    return (
                      <GameListRow game={g}
                        extra={PROFILE_DATA.richPresenceMsg && <span className="grow-extra rp" title="Rich presence: what the game reports you're doing"><Radio size={11} className="text-aqua" />{PROFILE_DATA.richPresenceMsg}</span>} />
                    );
                  })()}
                </div>

                {/* Recent unlocks: the newest as a card; wide screens add the next five as compact rows */}
                <div>
                  <h2 className="sec-t border-b border-line pb-1.5 flex items-center gap-2 mb-3">
                    <span className="sec-mark" />
                    <Trophy size={15} className="text-gold"/> Recent unlocks
                  </h2>
                  {PROFILE_DATA.mostRecentAchievement ? (
                    <div className="bg-box/80 border border-line-2 border-l-[3px] border-l-gold rounded-[3px] p-3 flex gap-3 hover:bg-box-hi transition-colors shadow-sm">
                      <a href={`../achievement/?id=${PROFILE_DATA.mostRecentAchievement.id}`} className="shrink-0 w-12 h-12 rounded-[2px] overflow-hidden border border-well bg-black block hover:scale-105 transition-transform">
                        <img src={`${MEDIA_URL}/Badge/${PROFILE_DATA.mostRecentAchievement.badgeName}.png`} alt={PROFILE_DATA.mostRecentAchievement.title} className="w-full h-full object-cover" />
                      </a>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <a href={`../achievement/?id=${PROFILE_DATA.mostRecentAchievement.id}`} className="text-[13px] font-medium text-gold hover:text-gold-hi transition-colors truncate leading-tight">
                            {PROFILE_DATA.mostRecentAchievement.title}
                          </a>
                          <span className="text-[9px] font-bold text-gold num bg-well border border-line-2 px-1.5 py-[1px] rounded-sm shrink-0">{PROFILE_DATA.mostRecentAchievement.points} pts</span>
                          {PROFILE_DATA.mostRecentAchievement.trueRatio > 0 && PROFILE_DATA.mostRecentAchievement.points > 0 && (() => {
                            const ratio = PROFILE_DATA.mostRecentAchievement.trueRatio / PROFILE_DATA.mostRecentAchievement.points;
                            return <span className="text-[9px] shrink-0" style={{ color: ratio >= 30 ? 'var(--hc)' : ratio >= 20 ? 'var(--gold)' : ratio >= 10 ? 'var(--accent)' : 'var(--ink-2)' }}>×{ratio.toFixed(1)}</span>;
                          })()}
                        </div>
                        <p className="text-[10px] text-ink-2 leading-snug mb-1 truncate">{PROFILE_DATA.mostRecentAchievement.description}</p>
                        <div className="flex items-center gap-1.5 text-[10px] min-w-0">
                          <a href={`../game/?id=${PROFILE_DATA.mostRecentAchievement.gameId}${compareParam}`} className="flex items-center gap-1 group min-w-0 shrink truncate">
                            <img src={PROFILE_DATA.mostRecentAchievement.gameIcon} alt="" className="w-3.5 h-3.5 rounded-[1px] border border-well shrink-0" />
                            <span className="text-accent group-hover:text-ink transition-colors truncate">{PROFILE_DATA.mostRecentAchievement.baseTitle || PROFILE_DATA.mostRecentAchievement.gameTitle}</span>
                            {PROFILE_DATA.mostRecentAchievement.isSubset && (
                              <>
                                <span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>
                                <span className="text-[8px] text-gold-dim truncate">{PROFILE_DATA.mostRecentAchievement.subsetName}</span>
                              </>
                            )}
                            {!PROFILE_DATA.mostRecentAchievement.isSubset && renderTildeTags(PROFILE_DATA.mostRecentAchievement.tags)}
                          </a>
                          <span className="text-ink-3 shrink-0">•</span>
                          <span className="text-ink-2 truncate shrink">{PROFILE_DATA.mostRecentAchievement.consoleName}</span>
                          <span className="text-ink-3 shrink-0">•</span>
                          <span className="text-ink-3 shrink-0 whitespace-nowrap">{PROFILE_DATA.mostRecentAchievement.timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-ink-2 text-[11px] py-2 italic">No achievements unlocked in the last 1 year.</div>
                  )}
                  {allLoadedAchievements.some(a => a.achievementId !== PROFILE_DATA.mostRecentAchievement?.id) && (
                    <div className="ulist anim-fade">
                      {[...allLoadedAchievements].sort((x, y) => new Date(y.date) - new Date(x.date))
                        .filter(a => a.achievementId !== PROFILE_DATA.mostRecentAchievement?.id).slice(0, 5).map(a => (
                        <a key={`${a.achievementId}-${a.date}`} href={`../achievement/?id=${a.achievementId}`} className="urow">
                          <img src={`${MEDIA_URL}/Badge/${a.badgeName}.png`} alt="" loading="lazy" />
                          <div className="urow-main">
                            <span className="urow-title">{a.title}</span>
                            <span className="urow-sub"><span className="text-accent">{parseTitle(a.gameTitle).baseTitle || a.gameTitle}</span> · {formatTimeAgo(a.date)}</span>
                          </div>
                          <span className="urow-end num">{a.points} pts</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Rail (wide screens): user stats, then game awards. Phones: below, same order */}
              <div className="prail flex flex-col gap-5 min-w-0">
                <div className="lg:hidden">
                  <h2 className="sec-t border-b border-line pb-1.5 flex items-center gap-2 mb-3">
                    <span className="sec-mark" />
                    <BarChart2 size={15} className="text-accent"/> User stats
                  </h2>
                  {/* The header already shows points, achievements and rank */}
                  <StatTiles items={PROFILE_DATA.statsLeft.filter(st => st.label !== 'Achievements unlocked').map(st => ({ ...st, label: STAT_LABELS[st.label] ?? st.label }))} />
                  {statsExpanded && <div className="mt-2 anim-fade"><StatTiles items={PROFILE_DATA.statsRight} /></div>}
                  <button type="button" onClick={() => setStatsExpanded(v => !v)} className="smore" aria-expanded={statsExpanded}>
                    {statsExpanded ? 'Fewer stats' : 'More stats'}
                    <ChevronDown size={13} className={`transition-transform duration-200 ${statsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <CompletionsPanel title="Game awards" labels={{ gold: 'Mastered', silver: 'Beaten' }} shape="sq" items={awardItems} empty="No game awards yet" />
              </div>
            </div>
          ) : activeTab === 'social' ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="sec-mark" />
                  <span className="sec-t">Social</span>
                </div>
                <div className="flex items-center gap-3">
                  {socialProfilesProgress && (
                    <div className="flex items-center gap-1.5">
                      <Loader2 size={11} className="text-accent animate-spin" />
                      <span className="text-[11px] text-accent font-medium tabular-nums">{socialProfilesProgress.done}/{socialProfilesProgress.total}</span>
                    </div>
                  )}
                  {socialRefreshing && !socialProfilesProgress && (
                    <Loader2 size={11} className="text-accent animate-spin" />
                  )}
                  {!socialProfilesProgress && !socialRefreshing && socialTs && (
                    <span className="text-[9px] text-ink-3">Synced {timeAgo(socialTs)}</span>
                  )}
                  {!socialProfilesProgress && !socialRefreshing && (
                    <button type="button" onClick={refreshSocial}
                      className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3 hover:text-accent transition-colors">
                      <RefreshCw size={11} />
                      Refresh
                    </button>
                  )}
                </div>
              </div>
              <SocialTab socialData={socialData} socialError={socialError} onRetry={() => setSocialError(false)} onCompare={openCompare} profileMap={socialProfileMap} />
            </div>
          ) : activeTab === 'stats' ? (
            <StatsTab
              achievements={allLoadedAchievements}
              achLoading={achievements === null || achievementsLoadingMore}
              games={ALL_GAMES}
              gameAwards={PROFILE_DATA.gameAwards}
              heatmapData={heatmapData}
            />
          ) : activeTab === 'activity' ? (
            achievements === null && achievementsLoadingMore
              ? <ActivitySkeleton />
              : <ActivityTab
                  achievements={allLoadedAchievements}
                  refTime={rawData?.metadata?.extractionTimestamp}
                  heatmapData={heatmapData}
                  games={ALL_GAMES}
                  loadingMore={achievementsLoadingMore}
                  allLoaded={achievements !== null && !achievementsLoadingMore}
                  socialView={socialView}
                  setSocialView={setSocialViewUrl}
                  friendsActivityStatus={friendsActivityStatus}
                  setFriendsActivityStatus={setFriendsActivityStatus}
                  friendsActivity={friendsActivity}
                  friendsFetchProgress={friendsFetchProgress}
                  failedFriends={failedFriends}
                  onRefreshFriends={refreshFriendsActivity}
                  onResetFriends={resetFriendsActivity}
                  friendsActivityTs={friendsActivityTs}
                  ownUsername={PROFILE_DATA.username}
                  socialProfileMap={socialProfileMap}
                />
          ) : activeTab === 'backlog' ? (
            backlogData === null ? (
              <div className="flex flex-col gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-box border border-line-2 rounded-[3px]">
                    <div className="shimmer w-10 h-10 rounded-[2px] shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <div className="shimmer h-3 w-3/4 rounded" />
                      <div className="shimmer h-2 w-1/3 rounded" />
                    </div>
                    <div className="shimmer h-2.5 w-10 rounded shrink-0" />
                  </div>
                ))}
              </div>
            ) : <>{(() => {
              // ── Savepoint's watchlist (.wlist / .wrow / .wstack in assets/ui.css) ──
              const getStatus = g => {
                if (g.achievementsTotal === 0) return 'noach';
                if (g.achievementsTotal > 0 && g.numAwarded === g.achievementsTotal) return 'mastered';
                if (g.inProgress) return 'inprogress';
                return 'notstarted';
              };

              const filtered = BACKLOG.games.filter(g => {
                if (backlogSearch) {
                  const searchable = [g.baseTitle || g.title, g.isSubset ? 'subset' : null, g.subsetName, ...(g.tags || [])].filter(Boolean).join(' ');
                  if (!fold(searchable).includes(fold(backlogSearch))) return false;
                }
                return backlogStatusFilter === 'all' || getStatus(g) === backlogStatusFilter;
              });

              const statusMeta = {
                mastered:   { dot: 'var(--gold)',       label: 'Mastered',        defaultOpen: true  },
                inprogress: { dot: 'var(--accent)',     label: 'In progress',     defaultOpen: true  },
                notstarted: { dot: 'var(--ink-3)',      label: 'Not started',     defaultOpen: false },
                noach:      { dot: 'var(--line-faint)', label: 'No achievements', defaultOpen: false },
              };

              // Subsets sit under their base game (same title and console) when both are in the list;
              // a combined base like "A | B" counts as each of its names. A subset whose base isn't listed stays a row
              const stackSubsets = games => {
                const keyOf = (title, consoleName) => `${title.toLowerCase()}|${consoleName}`;
                const baseFor = new Map();
                games.forEach(g => {
                  if (g.isSubset) return;
                  const title = g.baseTitle || g.title;
                  [title, ...title.split(' | ')].forEach(n => { const k = keyOf(n.trim(), g.console); if (!baseFor.has(k)) baseFor.set(k, g.id); });
                });
                const subsOf = new Map();
                const out = [];
                games.forEach(g => {
                  const baseId = g.isSubset ? baseFor.get(keyOf(g.baseTitle || g.title, g.console)) : undefined;
                  if (baseId != null) { if (!subsOf.has(baseId)) subsOf.set(baseId, []); subsOf.get(baseId).push(g); }
                  else out.push(g);
                });
                return out.map(g => ({ game: g, subsets: subsOf.get(g.id) ?? [] }));
              };

              let groups = [];
              if (backlogGrouping === 'console') {
                const map = {};
                filtered.forEach(g => { (map[g.console] ??= []).push(g); });
                groups = Object.entries(map).sort(([x], [y]) => x.localeCompare(y))
                  .map(([key, games]) => ({ key, label: key, dot: 'var(--accent)', games, defaultOpen: games.length <= 5 }));
              } else if (backlogGrouping === 'status') {
                ['mastered', 'inprogress', 'notstarted', 'noach'].forEach(st => {
                  const games = filtered.filter(g => getStatus(g) === st);
                  if (games.length) groups.push({ key: st, label: statusMeta[st].label, dot: statusMeta[st].dot, games, defaultOpen: statusMeta[st].defaultOpen });
                });
              } else if (backlogGrouping === 'subsets') {
                const entries = stackSubsets(filtered);
                const withSubs = entries.filter(e => e.subsets.length || e.game.isSubset);
                const without  = entries.filter(e => !e.subsets.length && !e.game.isSubset);
                groups = [
                  { key: 'with', label: 'With subsets', dot: 'var(--gold-dim)', count: withSubs.length, games: withSubs.flatMap(e => [e.game, ...e.subsets]), defaultOpen: true },
                  { key: 'without', label: 'Without subsets', dot: 'var(--ink-3)', count: without.length, games: without.map(e => e.game), defaultOpen: false },
                ].filter(g => g.games.length);
              }

              // Same edge ladder as the game rows: gold → silver (beaten) → blue → grey → near-black
              const stripeOf = g => {
                const st = getStatus(g);
                return st === 'mastered' ? 'var(--gold)' : g.isBeaten ? 'var(--silver)' : st === 'inprogress' ? 'var(--accent)' : st === 'noach' ? 'var(--line-faint)' : 'var(--line-2)';
              };
              const statusEnd = (game, status, pct) => <>
                {status === 'inprogress' && <>
                  <span className="gcount num">{game.numAwarded}<span>/{game.achievementsTotal}</span></span>
                  <div className="gbar"><i style={{ width: `${pct}%`, background: 'var(--accent)' }} /></div>
                </>}
                {status === 'mastered' && <span className="text-[9px] font-bold uppercase tracking-[0.07em] px-1.5 py-[1px] rounded-[2px] bg-gold text-well flex items-center gap-1"><Trophy size={9} />Mastered</span>}
                {status === 'notstarted' && <span className="text-[11px] text-ink-2 flex items-center gap-1 num" title={`${game.achievementsTotal} achievements`}><Trophy size={11} className="text-ink-3" />{game.achievementsTotal}</span>}
                {status === 'noach' && <span className="text-[11px] text-ink-3 text-right leading-tight">No achievements</span>}
              </>;

              // Rows are render functions, not components: defined inside App's render, as components
              // React would remount every row on each re-render and replay their fade
              const gameRow = game => {
                const status = getStatus(game);
                const pct = game.achievementsTotal > 0 ? (game.numAwarded / game.achievementsTotal) * 100 : 0;
                return (
                  <a key={game.id} href={`../game/?id=${game.id}${compareParam}`} className={`wrow ${status === 'noach' ? 'dim' : ''}`} style={{ borderLeftColor: stripeOf(game) }}>
                    <img src={game.icon} alt="" loading="lazy" className="wrow-icon" />
                    <div className="wrow-main">
                      <div className="wrow-title">
                        <span title={game.title}>{game.baseTitle || game.title}</span>
                        {game.isSubset && <span className="subset-tag">Subset</span>}
                        {renderTildeTags(game.tags)}
                      </div>
                      <div className="wrow-sub">
                        {backlogGrouping !== 'console' && <span className="text-accent">{game.console}</span>}
                        {game.pointsTotal > 0 && <>{backlogGrouping !== 'console' && <i>·</i>}<span className="num">{game.pointsTotal.toLocaleString()} pts</span></>}
                        {game.isSubset && game.subsetName && <><i>·</i><span className="text-gold-dim shrink">{game.subsetName}</span></>}
                      </div>
                    </div>
                    <div className="wrow-end">{statusEnd(game, status, pct)}</div>
                  </a>
                );
              };
              // One set inside a game's card: its icon, "Base set" or the subset name, points, status
              const setRow = (game, base = false) => {
                const status = getStatus(game);
                const pct = game.achievementsTotal > 0 ? (game.numAwarded / game.achievementsTotal) * 100 : 0;
                return (
                  <a key={game.id} href={`../game/?id=${game.id}${compareParam}`} title={game.title}
                    className={`wsub ${base ? '' : 'subset'} ${status === 'noach' ? 'dim' : ''}`} style={{ borderLeftColor: stripeOf(game) }}>
                    <img src={game.icon} alt="" loading="lazy" className="icon" />
                    <span className="name">{base ? 'Base set' : game.subsetName}</span>
                    {game.pointsTotal > 0 && <span className="pts num">· {game.pointsTotal.toLocaleString()} pts</span>}
                    <span className="end">{statusEnd(game, status, pct)}</span>
                  </a>
                );
              };
              const stackCard = (game, subsets) => (
                <div key={game.id} className="wstack">
                  <a href={`../game/?id=${game.id}${compareParam}`} className="whead">
                    <span className="t"><span>{game.baseTitle || game.title}</span>{renderTildeTags(game.tags)}</span>
                    {backlogGrouping !== 'console' && <span className="c">{game.console}</span>}
                  </a>
                  {setRow(game, true)}
                  {subsets.map(sg => setRow(sg))}
                </div>
              );
              const rows = games => stackSubsets(games).map(({ game, subsets }) => subsets.length ? stackCard(game, subsets) : gameRow(game));
              const toggleGroup = key => setCollapsedGroups(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

              return (
                <>
                  {/* Search + grouping, then the status chips with their counts, then a meta line with the sync */}
                  <div className="flex flex-col gap-2.5 mb-3">
                    <div className="fbar">
                      <div className="fsearch">
                        <Search size={14} />
                        <input type="text" inputMode="search" placeholder={`Search ${BACKLOG.games.length.toLocaleString()} games`} aria-label="Search backlog" value={backlogSearch} onChange={e => setBacklogSearch(e.target.value)} />
                        {backlogSearch && <button type="button" onClick={() => setBacklogSearch('')} aria-label="Clear search"><X size={13} /></button>}
                      </div>
                      <span className="fselect-w">
                        <select value={backlogGrouping} onChange={e => { setBacklogGrouping(e.target.value); setCollapsedGroups(new Set()); }} className="fselect" aria-label="Group">
                          <option value="none">No grouping</option>
                          <option value="console">Group: Console</option>
                          <option value="status">Group: Status</option>
                          <option value="subsets">Group: Subsets</option>
                        </select>
                      </span>
                    </div>
                    <div className="frow" role="group" aria-label="Status">
                      {[
                        { value: 'all',        label: 'All'             },
                        { value: 'notstarted', label: 'Not started'     },
                        { value: 'inprogress', label: 'In progress'     },
                        { value: 'mastered',   label: 'Mastered'        },
                        { value: 'noach',      label: 'No achievements' },
                      ].map(opt => {
                        const n = opt.value === 'all' ? BACKLOG.games.length : BACKLOG.games.filter(g => getStatus(g) === opt.value).length;
                        return (
                          <button type="button" key={opt.value} onClick={() => setBacklogStatusFilter(opt.value)} aria-pressed={backlogStatusFilter === opt.value}
                            className={`fchip ${backlogStatusFilter === opt.value ? 'on' : ''}`}>
                            {opt.label}<span className="n num">{n.toLocaleString()}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="fmeta flex items-center gap-3">
                      <span className="min-w-0">
                        {filtered.length !== BACKLOG.games.length && <><b>{filtered.length.toLocaleString()}</b> of {BACKLOG.games.length.toLocaleString()} shown</>}
                        {backlogLoadingMore && <>{filtered.length !== BACKLOG.games.length && ' · '}Loading {BACKLOG.games.length.toLocaleString()} of {BACKLOG.total.toLocaleString()}…</>}
                        {(backlogSearch || backlogStatusFilter !== 'all') && (
                          <button type="button" onClick={() => { setBacklogSearch(''); setBacklogStatusFilter('all'); }} className="ml-2 text-accent hover:underline">Clear filters</button>
                        )}
                      </span>
                      <span className="ml-auto flex items-center gap-2 shrink-0">
                        {backlogTs && <span>Synced {timeAgo(backlogTs)}</span>}
                        <button type="button" onClick={refreshBacklog} disabled={backlogRefreshing}
                          className="flex items-center gap-1 text-ink-2 hover:text-accent transition-colors disabled:opacity-50">
                          <RefreshCw size={11} className={backlogRefreshing ? 'animate-spin' : ''} />Refresh
                        </button>
                      </span>
                    </div>
                  </div>

                  {/* List (two columns on desktop); groups get a header row that opens and closes */}
                  <div key={`${backlogStatusFilter}-${backlogGrouping}`} className="wlist anim-fade">
                    {filtered.length === 0 ? (
                      <div className="text-center py-6 text-ink-3 text-[12px]" style={{ gridColumn: '1 / -1' }}>No games match the current filters.</div>
                    ) : backlogGrouping === 'none' ? (
                      rows(filtered)
                    ) : (
                      groups.map(group => {
                        const isOpen = collapsedGroups.has(group.key) ? !group.defaultOpen : (group.defaultOpen ?? true);
                        return (
                          <React.Fragment key={group.key}>
                            <button type="button" onClick={() => toggleGroup(group.key)} className="wgroup" aria-expanded={isOpen}>
                              <span className="mark" style={{ background: group.dot }} />
                              <span className="label">{group.label}</span>
                              <span className="n num">{(group.count ?? group.games.length).toLocaleString()}</span>
                              <ChevronDown size={14} className={`text-ink-3 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && <div className="wlist anim-fade" style={{ gridColumn: '1 / -1' }}>{rows(group.games)}</div>}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}</>
          ) : (
              <>
              {activeTab === 'progress' && (
                <ProgressFilterBar
                  view={progressFilter} onView={setProgressFilter}
                  sort={progressSort} onSort={setProgressSort}
                  showMastered={showMastered} onShowMastered={setShowMastered}
                  counts={progressCounts}
                  search={progressSearch} onSearch={setProgressSearch}
                  viewToggle={<ViewToggle view={gameView} onChange={setGameView} />}
                />
              )}
              {/* Recent: a search over the whole library (newest played first) and the list / tiles switch */}
              {activeTab === 'recent' && (
                <div className="fbar">
                  <SearchField value={recentSearch} onChange={setRecentSearch} />
                  <ViewToggle view={gameView} onChange={setGameView} />
                </div>
              )}
              {displayedGames.length === 0 && (
                <div className="text-center py-12 text-ink-3 text-[12px]">
                  {(activeTab === 'recent' ? recentSearch : progressSearch) ? 'No games match your search.' : 'No games in this view.'}
                </div>
              )}
              {/* Re-keyed on sort / view / filter changes so the new order fades in (not on search keystrokes) */}
              <div key={`${progressSort}-${progressFilter}-${showMastered}-${gameView}`} className="anim-fade">
                <div className={gameView === 'tiles' ? 'gtiles' : 'glist'}>
                  {displayedGames.map(game => gameView === 'tiles'
                    ? <GameTile key={game.id} game={game} />
                    : <GameListRow key={game.id} game={game} />)}
                </div>
              </div>
            </>
          )}
        </div>

        </div>
        </div>
        {isVisitorMode && <div className="md:hidden h-14" />}
      </main>

      <Footer
        label={<>Generated from <span className="text-ink-2">RetroAchievements API</span><span className="mx-2 text-line">·</span>Data as of <span className="text-ink-2">{rawData?.metadata?.extractionTimestamp ? new Date(rawData.metadata.extractionTimestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></>}
        right={<a href={SITE_URL} target="_blank" rel="noreferrer" className="text-[10px] text-ink-3 hover:text-accent transition-colors">retroachievements.org ↗</a>}
      />

      {/* Scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="scroll-top-btn fixed right-4 z-[195] w-10 h-10 bg-bar border border-line hover:border-accent hover:text-accent text-ink-2 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-90"
          style={{ bottom: '3.5rem' }}
          title="Scroll to top"
        >
          <ChevronDown size={16} className="rotate-180" />
        </button>
      )}

      <style>{`
        html { background-color: var(--box); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--page); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }

        .pop-wrap { position: relative; display: inline-flex; align-items: center; cursor: help; }
        .pop-wrap .pop-box {
          display: none; position: absolute;
          bottom: calc(100% + 7px); left: 50%; transform: translateX(-50%);
          background: var(--bar); border: 1px solid var(--line); border-radius: 2px;
          padding: 6px 8px; white-space: nowrap; z-index: 200;
          box-shadow: 0 4px 16px rgba(0,0,0,0.7); pointer-events: none;
          min-width: 110px;
        }
        .pop-wrap .pop-box::after {
          content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          border: 4px solid transparent; border-top-color: var(--line);
        }
        .pop-wrap:hover .pop-box { display: block; }
        .pop-name { font-size: 10px; color: var(--ink); font-weight: 600; margin-bottom: 2px; }
        .pop-sub  { font-size: 9px; color: var(--ink-3); margin-bottom: 2px; }
        .pop-val  { font-size: 10px; font-weight: 700; }
        
        .mask-fade {
           mask-image: linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
           -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
        }

        @keyframes feedIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes feedGroupFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .feed-item { animation: feedIn 0.5s ease both; }
        .backlog-item { animation: feedIn 0.3s ease both; }
        .feed-group-container { animation: feedGroupFade 0.2s ease both; }

        /* Shimmer skeleton */
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



      `}</style>

      {selectedGame && (
        <RAchievementModal
          game={ALL_GAMES.find(g => g.id === selectedGame.id) || selectedGame}
          onClose={() => setSelectedGame(null)}
          loadingDetails={loadingGameDetailId === selectedGame.id}
        />
      )}

      {compareUser && (
        <CompareModal
          otherUser={compareUser}
          myGames={profileData?.gameAwardsAndProgress?.results ?? []}
          compareData={compareData}
          loading={compareLoading}
          error={compareError}
          onClose={closeCompare}
          profileMap={socialProfileMap}
        />
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
