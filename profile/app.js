import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Gamepad2, Activity, BarChart2, Award, Star, ChevronDown, ChevronUp, AlertCircle, Trophy, Crown, Lock, Unlock, AlertTriangle, Flame, Feather, Medal, ShieldOff, CircleDashed, X, Clock, Layers, Users, Loader2, RefreshCw, RotateCcw, ArrowLeftRight, PieChart, TrendingUp, List, LayoutGrid } from 'lucide-react';
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
import { TabBar, useSwipeTabs } from '../assets/tabs.js';
import { useGameView } from '../assets/game-view.js';

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

const GameCard = ({ game }) => {
  const stripeColor = game.isMastered
    ? 'border-l-gold'
    : game.isBeaten
    ? 'border-l-silver'
    : game.achievementsUnlocked > 0
    ? 'border-l-accent'
    : game.achievementsTotal > 0
    ? 'border-l-line-2'
    : 'border-l-line-faint';

  const hasAchievements = game.achievementsTotal > 0;

  return (
    <div className={`flex flex-col bg-box-hi rounded-[3px] transition-transform duration-200 hover:-translate-y-0.5 border-l-[3px] border border-line-2 shadow-md ${stripeColor}`}>

      <div className="relative flex flex-row p-3 gap-3 md:gap-4 items-center min-h-[90px] z-10 overflow-hidden rounded-t-[3px]">

        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-t-[3px]">
          <img 
            src={game.background} 
            alt="" 
            className="absolute right-0 top-0 h-full w-full md:w-1/2 object-cover opacity-[0.55] object-center mix-blend-screen mask-fade" 
          />
          <div className="absolute inset-0 bg-gradient-to-r from-box-hi via-box-hi/95 to-transparent"></div>
        </div>

        <a href={`../game/?id=${game.id}${compareParam}`} className="relative z-10 shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-[2px] shadow-sm border border-well overflow-hidden bg-well hover:scale-105 transition-transform">
           <img src={game.icon} alt={game.title} className="w-full h-full object-cover" />
        </a>

        <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0">

          <div className="flex flex-col mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`../game/?id=${game.id}${compareParam}`} className="text-[15px] md:text-base text-white font-medium tracking-wide drop-shadow-sm hover:text-accent transition-colors">
                {game.baseTitle || game.title}
              </a>
              {game.isSubset && (
                <span className="text-[8px] font-bold uppercase tracking-[0.07em] px-1.5 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">
                  Subset
                </span>
              )}
              {renderTildeTags(game.tags)}
            </div>
            {game.isSubset && game.subsetName && (
              <span className="text-[10px] text-gold-dim truncate">{game.subsetName}</span>
            )}
          </div>

          <div className="text-[11px] text-accent mb-1.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 shrink-0"><Gamepad2 size={12} /> {game.console}</span>
            <span className="text-ink-3 shrink-0">|</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              
              {!hasAchievements ? (
                <span className="shrink-0 text-[9px] text-ink-3 border border-line-2 bg-well/60 px-1.5 py-[1px] rounded-sm font-semibold uppercase tracking-wider flex items-center gap-1">
                  <ShieldOff size={10} /> No Achievements
                </span>
              ) : game.achievementsUnlocked === 0 ? (
                <span className="shrink-0 text-[9px] text-ink-2 border border-line-2 bg-well/60 px-1.5 py-[1px] rounded-sm font-semibold uppercase tracking-wider flex items-center gap-1">
                  <CircleDashed size={10} /> Not Started
                </span>
              ) : game.hardcore ? (
                <span className="shrink-0 text-[9px] text-hc border border-hc/30 bg-well/60 px-1.5 py-[1px] rounded-sm font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Flame size={10} /> Hardcore
                </span>
              ) : (
                <span className="shrink-0 text-[9px] text-ink-2 border border-line-2 bg-well/60 px-1.5 py-[1px] rounded-sm font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Feather size={10} /> Softcore
                </span>
              )}
              
              {game.isMastered && (
                <span className="shrink-0 text-[9px] text-well bg-gold px-1.5 py-[1px] rounded-sm font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Trophy size={10} /> Mastered
                </span>
              )}
              {game.isBeaten && !game.isMastered && (
                <span className="shrink-0 text-[9px] text-ink bg-chip px-1.5 py-[1px] rounded-sm font-bold uppercase tracking-wider border border-silver/40 flex items-center gap-1">
                  <Medal size={10} /> Beaten
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] md:text-[11px] mb-2">
            {game.playtime !== "Unknown" && <><div className="flex items-center gap-1 text-ink"><Clock size={9} className="text-ink-2 shrink-0" />{game.playtime}</div><span className="text-ink-3">·</span></>}
            <span className="text-ink-3">Last Played <span className="text-ink-2">{game.lastPlayed}</span></span>
          </div>

          {hasAchievements && (() => {
            const progAchs = game.achievements.filter(a => a.type === 'progression' || a.type === 'win_condition');
            const progTotal = progAchs.length;
            const progUnlocked = progAchs.filter(a => a.isUnlocked).length;
            const progPct = progTotal > 0 ? (progUnlocked / progTotal) * 100 : null;
            const labelW = 'w-[70px] shrink-0';
            return (
              <div className="flex flex-col gap-1.5">
                {progPct !== null && (
                  <div className="flex items-center gap-2">
                    <span className={`${labelW} text-[8px] text-ink-3 uppercase tracking-wider text-right`}>Progression</span>
                    <div className="flex-1 bg-well h-[4px] rounded-sm overflow-hidden max-w-full">
                      <div
                        className="h-full transition-all duration-1000 ease-out rounded-sm bg-gold"
                        style={{ width: `${progPct}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-gold shrink-0 whitespace-nowrap" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' }}>
                      <span>{progUnlocked}</span>/{progTotal} <span className="ml-0.5">({progPct.toFixed(2)}%)</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <SegBar pct={game.rawProgress} total={game.achievementsTotal} color={gameStatus(game).color} glow={game.isMastered} />
                  </div>
                  <div className="num text-[10px] text-ink-2 shrink-0 whitespace-nowrap" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' }}>
                    <span className="text-ink">{game.achievementsUnlocked}</span>/{game.achievementsTotal} <span className="ml-0.5">({game.rawProgress.toFixed(2)}%)</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

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

// ── FeedAchRow Component — individual achievement row inside a FeedSession ─

const FeedAchRow = ({ ach }) => {
  const ratio = ach.trueRatio && ach.points ? ach.trueRatio / ach.points : null;
  return (
    <div className={`feed-item flex items-center gap-2 p-2 rounded-[2px] border border-line border-l-[2px] ${ach.hardcoreMode ? 'border-l-gold bg-box-hi' : 'border-l-ink-3 bg-box'} hover:bg-line transition-colors`}>
      <a href={`../achievement/?id=${ach.achievementId}`} className="shrink-0 w-8 h-8 rounded-[2px] overflow-hidden border border-well bg-black block hover:scale-105 transition-transform">
        <img src={`${MEDIA_URL}/Badge/${ach.badgeName}.png`} alt={ach.title} className="w-full h-full object-cover" />
      </a>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <a href={`../achievement/?id=${ach.achievementId}`} className={`text-[11px] font-medium transition-colors truncate ${ach.hardcoreMode ? 'text-gold hover:text-gold-hi' : 'text-ink hover:text-accent'}`}>
            {ach.title}
          </a>
          <span className="text-[9px] font-bold text-gold num bg-well border border-line-2 px-1.5 py-[1px] rounded-sm shrink-0">{ach.points} pts</span>
          {ratio > 0 && <span className="text-[9px] shrink-0" style={{ color: ratio >= 30 ? 'var(--hc)' : ratio >= 20 ? 'var(--gold)' : ratio >= 10 ? 'var(--accent)' : 'var(--ink-2)' }}>×{ratio.toFixed(1)}</span>}
          {ach.type === 'progression' && (
            <span className="pop-wrap">
              <Trophy size={11} className="text-gold" />
              <span className="pop-box">
                <div className="pop-name" style={{color:'var(--gold)'}}>Progression</div>
                <div className="pop-sub">Required to complete the game</div>
              </span>
            </span>
          )}
          {ach.type === 'win_condition' && (
            <span className="pop-wrap">
              <Crown size={11} className="text-hc" />
              <span className="pop-box">
                <div className="pop-name" style={{color:'var(--hc)'}}>Win Condition</div>
                <div className="pop-sub">Triggers game completion</div>
              </span>
            </span>
          )}
          {ach.type === 'missable' && (
            <span className="pop-wrap">
              <AlertTriangle size={11} className="text-warn" />
              <span className="pop-box">
                <div className="pop-name" style={{color:'var(--warn)'}}>Missable</div>
                <div className="pop-sub">Can be permanently missed</div>
              </span>
            </span>
          )}
        </div>
        {ach.description && <p className="text-[9px] text-ink-3 truncate">{ach.description}</p>}
      </div>
      <span className="text-[8px] text-ink-3 shrink-0 ml-auto">{toLocalTime(ach.date)}</span>
    </div>
  );
};

// ── FeedSession Component — session header + achievement list ─────────────

const FeedSession = ({ session, hideUser = false, socialProfileMap = new Map() }) => {
  const { username, isOwn, gameId, gameTitle, gameIcon, consoleName, achievements } = session;
  const sessionPts   = achievements.reduce((s, a) => s + (a.points    || 0), 0);
  const sessionRetro = achievements.reduce((s, a) => s + (a.trueRatio || 0), 0);
  const startTime = achievements[achievements.length - 1]?.date || '';
  const endTime   = achievements[0]?.date || '';
  const fmtT = toLocalTime;
  const { baseTitle, subsetName, isSubset, tags } = parseTitle(gameTitle);
  const gameHref = isOwn ? `../game/?id=${gameId}` : `../game/?id=${gameId}&compare=${username}`;
  const [collapsed, setCollapsed] = React.useState(achievements.length > 3);

  return (
    <div className={`feed-item ${hideUser ? '' : 'mb-3'}`}>
      <div className={hideUser ? '' : 'mb-1.5'}>
        {hideUser ? (<>
          {/* compact: game header row — links navigate, no toggle */}
          <div className="flex items-center gap-2">
            <a href={gameHref} className="w-4 h-4 rounded-[1px] overflow-hidden border border-well bg-black block hover:scale-110 transition-transform shrink-0">
              <img src={getMediaUrl(gameIcon)} alt="" className="w-full h-full object-cover" />
            </a>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <a href={gameHref} className="text-[9px] text-ink hover:text-accent transition-colors uppercase tracking-wider font-medium truncate">
                  {baseTitle}
                </a>
                {isSubset && <><span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span><span className="text-[8px] text-gold-dim shrink-0 truncate">{subsetName}</span></>}
                {!isSubset && renderTildeTags(tags)}
                {consoleName && <span className="hidden md:inline text-[8px] text-ink-3 shrink-0">· {consoleName}</span>}
              </div>
              {consoleName && <span className="md:hidden text-[8px] text-ink-3 truncate block leading-tight mt-[1px]">{consoleName}</span>}
            </div>
            <span className="text-[8px] text-ink-3 shrink-0 ml-auto">{fmtT(startTime)}{startTime !== endTime ? `–${fmtT(endTime)}` : ''}</span>
          </div>
          {collapsed && achievements.length > 0 && (
            <button onClick={() => setCollapsed(false)} className="w-full mt-1.5 flex items-center gap-1.5 bg-box border border-line rounded-[2px] px-2 py-2 hover:bg-box-hi transition-colors outline-none">
              {achievements.slice(0, 8).map((ach, i) => (
                <img key={i} src={`${MEDIA_URL}/Badge/${ach.badgeName}.png`} alt={ach.title} title={ach.title}
                  className={`w-8 h-8 rounded-[2px] border shrink-0 ${i >= 5 ? 'hidden md:block' : ''} ${ach.hardcoreMode ? 'border-gold' : 'border-line'}`} />
              ))}
              {achievements.length > 5 && (
                <span className="text-[10px] text-ink-3 ml-1 shrink-0 md:hidden">+{achievements.length - 5}</span>
              )}
              {achievements.length > 8 && (
                <span className="text-[10px] text-ink-3 ml-1 shrink-0 hidden md:inline">+{achievements.length - 8}</span>
              )}
            </button>
          )}
        </>) : (<>
          {/* Row 1: always visible — user + earned in + [desktop: game info] + time */}
          <div className="flex items-center gap-2 mb-1 md:mb-0">
            <a href={`../profile/?u=${username}`} className="shrink-0">
              <img src={socialProfileMap.get(username)?.userPic ? getMediaUrl(socialProfileMap.get(username).userPic) : `${MEDIA_URL}/UserPic/${username}.png`} alt={username} className="w-5 h-5 rounded-[2px] object-cover" />
            </a>
            <a href={`../profile/?u=${username}`} className="text-[11px] font-medium min-w-0 truncate hover:underline" style={{ color: isOwn ? 'var(--aqua)' : 'var(--gold)' }}>
              {username}
            </a>
            <span className="text-[9px] text-ink-3 shrink-0">earned in</span>
            <div className="hidden md:flex items-center gap-1.5 flex-1 min-w-0">
              <a href={gameHref} className="w-4 h-4 rounded-[1px] overflow-hidden border border-well bg-black block hover:scale-110 transition-transform shrink-0">
                <img src={getMediaUrl(gameIcon)} alt="" className="w-full h-full object-cover" />
              </a>
              <a href={gameHref} className="text-[9px] text-ink hover:text-accent transition-colors uppercase tracking-wider font-medium truncate">
                {baseTitle}
              </a>
              {isSubset && <><span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span><span className="text-[8px] text-gold-dim shrink-0 truncate">{subsetName}</span></>}
              {!isSubset && renderTildeTags(tags)}
              {consoleName && <span className="text-[8px] text-ink-3 shrink-0">· {consoleName}</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <span className="hidden md:inline text-[9px] text-ink-3">{achievements.length} achievement{achievements.length !== 1 ? 's' : ''}</span>
              <span className="hidden md:inline text-[9px] text-line">·</span>
              <span className="text-[9px] text-ink-3">{sessionPts} pts</span>
              {sessionRetro > sessionPts && <><span className="text-[9px] text-line">·</span><span className="text-[9px] text-ink-3">{sessionRetro} RP</span></>}
              <span className="text-[9px] text-line">·</span>
              <span className="text-[8px] text-ink-3">{fmtT(startTime)}{startTime !== endTime ? `–${fmtT(endTime)}` : ''}</span>
            </div>
          </div>
          {/* Row 2: mobile only — game icon + title + console stacked */}
          <div className="md:hidden flex items-center gap-1.5 pl-7">
            <a href={gameHref} className="w-4 h-4 rounded-[1px] overflow-hidden border border-well bg-black block hover:scale-110 transition-transform shrink-0">
              <img src={getMediaUrl(gameIcon)} alt="" className="w-full h-full object-cover" />
            </a>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <a href={gameHref} className="text-[9px] text-ink hover:text-accent transition-colors uppercase tracking-wider font-medium truncate">
                  {baseTitle}
                </a>
                {isSubset && <><span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span><span className="text-[8px] text-gold-dim shrink-0 truncate">{subsetName}</span></>}
                {!isSubset && renderTildeTags(tags)}
              </div>
              {consoleName && <span className="text-[8px] text-ink-3 truncate">{consoleName}</span>}
            </div>
          </div>
        </>)}
      </div>
      {!hideUser && collapsed && achievements.length > 0 && (
        <button onClick={() => setCollapsed(false)} className="w-full mt-1.5 flex items-center gap-1.5 bg-box border border-line rounded-[2px] px-2 py-2 hover:bg-box-hi transition-colors outline-none">
          {achievements.slice(0, 8).map((ach, i) => (
            <img key={i} src={`${MEDIA_URL}/Badge/${ach.badgeName}.png`} alt={ach.title} title={ach.title}
              className={`w-8 h-8 rounded-[2px] border shrink-0 ${i >= 5 ? 'hidden md:block' : ''} ${ach.hardcoreMode ? 'border-gold' : 'border-line'}`} />
          ))}
          {achievements.length > 5 && (
            <span className="text-[10px] text-ink-3 ml-1 shrink-0 md:hidden">+{achievements.length - 5}</span>
          )}
          {achievements.length > 8 && (
            <span className="text-[10px] text-ink-3 ml-1 shrink-0 hidden md:inline">+{achievements.length - 8}</span>
          )}
        </button>
      )}
      {!collapsed && (
        <div className={`flex flex-col gap-1 ${hideUser ? 'mt-1.5' : ''}`}>
          {achievements.map((ach, i) => (
            <FeedAchRow key={`${ach.achievementId}-${i}`} ach={ach} />
          ))}
          {achievements.length > 3 && (
            <button onClick={() => setCollapsed(true)} className="w-full flex items-center justify-center gap-1 py-1 text-[9px] text-ink-3 hover:text-ink-2 transition-colors outline-none">
              <ChevronUp size={10} />
              collapse
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── ActivityTab Component ──────────────────────────────────────────────────

const ActivityTab = ({ achievements, refTime, heatmapData, loadingMore, allLoaded, socialView, setSocialView, friendsActivityStatus, setFriendsActivityStatus, friendsActivity, friendsFetchProgress, failedFriends, onRefreshFriends, onResetFriends, friendsActivityTs, ownUsername, socialProfileMap = new Map() }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [collapsedDays, setCollapsedDays] = useState(new Set());
  const [visibleSessionCount, setVisibleSessionCount] = useState(100);

  const heatmapScrollRef = useRef(null);
  const heatmapKeys = Object.keys(heatmapData).length;
  useEffect(() => {
    if (!heatmapScrollRef.current || heatmapKeys === 0) return;
    requestAnimationFrame(() => { heatmapScrollRef.current.scrollLeft = heatmapScrollRef.current.scrollWidth; });
  }, [heatmapKeys]);

  const toggleDay = (day) => setCollapsedDays(prev => {
    const next = new Set(prev);
    next.has(day) ? next.delete(day) : next.add(day);
    return next;
  });

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
            achievements: [...slice].reverse(), // newest first for FeedSession
            latestDate: slice[slice.length - 1].date,
          });
          start = i;
        }
      }
    });

    return sessions.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [mergedFeed]);

  // Group feed sessions by day only (flat, for "by sessions" mode)
  const feedBySession = useMemo(() => {
    const byDay = {};
    feedGroups.slice(0, visibleSessionCount).forEach(item => {
      const day = toLocalDay(item.latestDate);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(item);
    });
    return Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));
  }, [feedGroups, visibleSessionCount]);

  // Group feed sessions by day → by user for day-header layout (paginated)
  const feedByDay = useMemo(() => {
    const byDay = {};
    feedGroups.slice(0, visibleSessionCount).forEach(item => {
      const day = toLocalDay(item.latestDate);
      if (!byDay[day]) byDay[day] = {};
      if (!byDay[day][item.username]) byDay[day][item.username] = { username: item.username, isOwn: item.isOwn, sessions: [] };
      byDay[day][item.username].sessions.push(item);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, userMap]) => [
        day,
        Object.values(userMap).sort((a, b) => b.sessions[0].latestDate.localeCompare(a.sessions[0].latestDate))
      ]);
  }, [feedGroups, visibleSessionCount]);

  const [collapsedFeedDays, setCollapsedFeedDays] = useState(new Set());
  const toggleFeedDay = (day) => setCollapsedFeedDays(prev => {
    const next = new Set(prev);
    next.has(day) ? next.delete(day) : next.add(day);
    return next;
  });

  const [groupMode, setGroupMode] = useState('sessions');

  const fmtTime = toLocalTime;
  const fmtDay  = (str) => new Date(str + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const tzName  = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Mine / Friends toggle ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          {['mine', 'friends'].map(v => (
            <button key={v} onClick={() => setSocialView(v)}
              className={`text-[11px] px-3 py-1 rounded-[2px] border font-medium transition-colors uppercase tracking-wider ${socialView === v ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink'}`}>
              {v}
            </button>
          ))}
          {socialView === 'friends' && (
            <div className="ml-auto flex items-center gap-3">
              {(friendsActivityStatus === 'loading' || friendsActivityStatus === 'updating') && (
                <div className="flex items-center gap-1.5">
                  <Loader2 size={11} className="text-accent animate-spin" />
                  {friendsFetchProgress && (
                    <span className="text-[11px] text-accent font-medium tabular-nums">{friendsFetchProgress.done}/{friendsFetchProgress.total}</span>
                  )}
                </div>
              )}
              {friendsActivityStatus === 'done' && (<>
                {friendsActivityTs && (
                  <span className="text-[9px] text-ink-3">Synced {timeAgo(friendsActivityTs)}</span>
                )}
                <button onClick={onRefreshFriends}
                  className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3 hover:text-accent transition-colors">
                  <RefreshCw size={11} />
                  Refresh
                </button>
                <button onClick={onResetFriends}
                  className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3 hover:text-danger-hi transition-colors"
                  title="Clear all cached data and re-fetch from scratch">
                  <RotateCcw size={11} />
                  Reset
                </button>
              </>)}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-ink-3 opacity-60">{tzName}</span>
          {socialView === 'friends' && (
            <div className="flex items-center gap-1">
              {[['sessions', 'By Session'], ['users', 'By User']].map(([mode, label]) => (
                <button key={mode} onClick={() => setGroupMode(mode)}
                  className={`text-[9px] px-2 py-0.5 rounded-[2px] border font-medium transition-colors uppercase tracking-wider ${groupMode === mode ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {socialView === 'friends' ? (
        <div className="flex flex-col gap-3">

          {/* ── Loading: shimmer until first data arrives, then inline progress ── */}
          {friendsActivityStatus === 'loading' && Object.keys(friendsActivity).length === 0 && (
            <div className="flex flex-col gap-0">
              {[2, 1].map((userCount, di) => (
                <div key={di} className="mb-4">
                  {/* day header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-line border border-line shrink-0" />
                    <div className="shimmer h-2.5 w-20 rounded" />
                    <div className="flex-1 h-px bg-line opacity-40" />
                    <div className="shimmer h-2 w-16 rounded" />
                  </div>
                  {/* user groups */}
                  <div className="ml-4 border-l border-line pl-3 flex flex-col gap-3">
                    {[...Array(userCount)].map((_, ui) => (
                      <div key={ui}>
                        {/* user row */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="shimmer w-5 h-5 rounded-[2px] shrink-0" />
                          <div className="shimmer h-2.5 rounded shrink-0" style={{ width: `${56 + (di * 17 + ui * 23) % 32}px` }} />
                          <div className="shimmer h-2 w-24 rounded shrink-0" />
                        </div>
                        {/* sessions */}
                        <div className="ml-7 border-l border-line pl-3 flex flex-col gap-2">
                          {[...Array(ui === 0 && di === 0 ? 2 : 1)].map((_, si) => (
                            <div key={si}>
                              {/* session game row */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="shimmer w-4 h-4 rounded-[1px] shrink-0" />
                                <div className="shimmer h-2 rounded flex-1" style={{ maxWidth: `${90 + (ui * 19 + si * 31) % 60}px` }} />
                                <div className="shimmer h-2 w-10 rounded ml-auto shrink-0" />
                              </div>
                              {/* badge strip */}
                              <div className="flex items-center gap-1.5 bg-box border border-line rounded-[2px] px-2 py-2">
                                {[...Array(5)].map((_, bi) => (
                                  <div key={bi} className="shimmer w-8 h-8 rounded-[2px] shrink-0" />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Error state ── */}
          {friendsActivityStatus === 'error' && (
            <div className="flex items-center justify-between gap-3 bg-box border border-line rounded-[2px] p-4">
              <div className="flex items-center gap-2 text-[11px] text-hc">
                <AlertCircle size={14} />
                Failed to load friends activity.
              </div>
              <button
                onClick={() => setFriendsActivityStatus('idle')}
                className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-[2px] border border-line-2 text-ink-2 hover:text-ink hover:border-ink-3 transition-colors"
              >Retry</button>
            </div>
          )}

          {/* ── Warning: some users failed to load ── */}
          {failedFriends.length > 0 && (
            <div className="flex items-start gap-2 bg-box border border-line rounded-[2px] px-3 py-2">
              <AlertCircle size={13} className="text-gold shrink-0 mt-[1px]" />
              <span className="text-[11px] text-ink-2">
                Could not load activity for: <span className="text-ink">{failedFriends.join(', ')}</span>. They may have earned no achievements recently, or the API returned an error.
              </span>
            </div>
          )}

          {/* ── Empty: not following anyone ── */}
          {friendsActivityStatus === 'done' && Object.keys(friendsActivity).length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 border border-line rounded-[2px] bg-box">
              <Users size={24} className="text-ink-3" />
              <div className="text-[11px] text-ink-3">You're not following anyone</div>
            </div>
          )}

          {/* ── Merged feed (streaming in or done) ── */}
          {Object.keys(friendsActivity).length > 0 && (
            <>
              {feedByDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 border border-line rounded-[2px] bg-box">
                  <Users size={24} className="text-ink-3" />
                  <div className="text-[11px] text-ink-3">No activity in the last 30 days</div>
                </div>
              ) : groupMode === 'sessions' ? (
                <div key="sessions" className="feed-group-container flex flex-col gap-0">
                  {feedBySession.map(([day, sessions]) => {
                    const isFeedDayCollapsed = collapsedFeedDays.has(day);
                    const achCount   = sessions.reduce((s, sess) => s + sess.achievements.length, 0);
                    const dayPts     = sessions.reduce((s, sess) => s + sess.achievements.reduce((ss, a) => ss + (a.points    || 0), 0), 0);
                    const dayRetro   = sessions.reduce((s, sess) => s + sess.achievements.reduce((ss, a) => ss + (a.trueRatio || 0), 0), 0);
                    return (
                      <div key={day} className="mb-4">
                        <button onClick={() => toggleFeedDay(day)} className="w-full flex items-center gap-2 mb-2 group outline-none">
                          <div className="w-2 h-2 rounded-full bg-line border border-accent shrink-0"></div>
                          <span className="text-[10px] text-accent font-semibold group-hover:text-ink transition-colors">{fmtDay(day)}</span>
                          <div className="flex-1 h-px bg-line opacity-40"></div>
                          <span className="text-[9px] text-ink-3">{achCount} achievement{achCount !== 1 ? 's' : ''}</span>
                          <span className="text-[9px] text-line">·</span>
                          <span className="text-[9px] text-ink-3">{dayPts} pts</span>
                          {dayRetro > dayPts && <><span className="text-[9px] text-line">·</span><span className="text-[9px] text-ink-3">{dayRetro} RP</span></>}
                          <ChevronDown size={11} className={`text-ink-3 transition-transform duration-200 shrink-0 ${isFeedDayCollapsed ? '' : 'rotate-180'}`} />
                        </button>
                        {!isFeedDayCollapsed && (
                          <div className="ml-4 border-l border-line pl-3 flex flex-col gap-2">
                            {sessions.map(session => (
                              <FeedSession key={`${session.username}-${session.gameId}-${session.latestDate}`} session={session} hideUser={false} socialProfileMap={socialProfileMap} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div key="users" className="feed-group-container flex flex-col gap-0">
                  {feedByDay.map(([day, userGroups]) => {
                    const isFeedDayCollapsed = collapsedFeedDays.has(day);
                    const achCount = userGroups.reduce((s, ug) => s + ug.sessions.reduce((ss, sess) => ss + sess.achievements.length, 0), 0);
                    return (
                      <div key={day} className="mb-4">
                        <button onClick={() => toggleFeedDay(day)} className="w-full flex items-center gap-2 mb-2 group outline-none">
                          <div className="w-2 h-2 rounded-full bg-line border border-accent shrink-0"></div>
                          <span className="text-[10px] text-accent font-semibold group-hover:text-ink transition-colors">{fmtDay(day)}</span>
                          <div className="flex-1 h-px bg-line opacity-40"></div>
                          <span className="text-[9px] text-ink-3">{achCount} achievement{achCount !== 1 ? 's' : ''}</span>
                          <ChevronDown size={11} className={`text-ink-3 transition-transform duration-200 shrink-0 ${isFeedDayCollapsed ? '' : 'rotate-180'}`} />
                        </button>
                        {!isFeedDayCollapsed && (
                          <div className="ml-4 border-l border-line pl-3 flex flex-col gap-3">
                            {userGroups.map(({ username, isOwn, sessions }) => {
                              const userAchCount = sessions.reduce((s, sess) => s + sess.achievements.length, 0);
                              const userPts      = sessions.reduce((s, sess) => s + sess.achievements.reduce((ss, a) => ss + (a.points    || 0), 0), 0);
                              const userRetro    = sessions.reduce((s, sess) => s + sess.achievements.reduce((ss, a) => ss + (a.trueRatio || 0), 0), 0);
                              return (
                                <div key={username}>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <a href={`../profile/?u=${username}`} className="shrink-0">
                                      <img src={socialProfileMap.get(username)?.userPic ? getMediaUrl(socialProfileMap.get(username).userPic) : `${MEDIA_URL}/UserPic/${username}.png`} alt={username} className="w-5 h-5 rounded-[2px] object-cover" />
                                    </a>
                                    <a href={`../profile/?u=${username}`} className="text-[11px] font-medium hover:underline truncate" style={{ color: isOwn ? 'var(--aqua)' : 'var(--gold)' }}>
                                      {username}
                                    </a>
                                    <span className="hidden md:inline text-[9px] text-ink-3 shrink-0">
                                      {sessions.length > 1 ? `${sessions.length} sessions · ` : ''}{userAchCount} achievement{userAchCount !== 1 ? 's' : ''}
                                    </span>
                                    <span className="hidden md:inline text-[9px] text-line shrink-0">·</span>
                                    <span className="text-[9px] text-ink-3 shrink-0">{userPts} pts</span>
                                    {userRetro > userPts && <><span className="text-[9px] text-line shrink-0">·</span><span className="text-[9px] text-ink-3 shrink-0">{userRetro} RP</span></>}
                                  </div>
                                  <div className="ml-7 border-l border-line pl-3 flex flex-col gap-2">
                                    {sessions.map(session => (
                                      <FeedSession key={`${session.gameId}-${session.latestDate}`} session={session} hideUser={true} />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {feedGroups.length > visibleSessionCount && (
                <button
                  onClick={() => setVisibleSessionCount(c => c + 100)}
                  className="w-full mt-2 py-2 text-[11px] text-accent hover:text-ink border border-line hover:border-ink-3 rounded-[2px] transition-colors"
                >
                  Load more · {feedGroups.length - visibleSessionCount} sessions remaining
                </button>
              )}
            </>
          )}


        </div>
      ) : <>

      {/* ── Heatmap ── */}
      <div>
        <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3">
          <span className="sec-mark" />
          <span className="sec-t flex items-center gap-2"><Activity size={15} className="text-accent" /> Activity</span>
          <span className="text-[10px] text-ink-3 ml-auto hidden sm:block">{allLoaded ? '1 year' : '~6 months'} · {achievements.length} achievements · click a day to filter</span>
          <span className="text-[10px] text-ink-3 ml-auto sm:hidden">{achievements.length} achievements</span>
        </div>

        <div className="overflow-x-auto" ref={heatmapScrollRef}>
          <div style={{ minWidth: `${53 * 14}px` }}>
            {/* Month labels */}
            <div className="flex mb-1" style={{ paddingLeft: '28px' }}>
              {weeks.map((_week, wi) => {
                const ml = monthLabels.find(m => m.wi === wi);
                return <div key={wi} style={{ flex: 1, fontSize: '8px', color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{ml ? ml.label : ''}</div>;
              })}
            </div>

            <div className="flex gap-0">
              {/* Day labels */}
              <div className="flex flex-col gap-[2px] mr-1" style={{ paddingTop: '1px' }}>
                {['M','','W','','F','','S'].map((l, i) => (
                  <div key={i} style={{ height: '12px', width: '20px', fontSize: '7px', lineHeight: '12px', textAlign: 'right', color: 'var(--ink-3)', flexShrink: 0 }}>{l}</div>
                ))}
              </div>

              {/* Grid — flex so columns stretch to fill width */}
              <div className="flex flex-1 gap-[2px]">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[2px] flex-1" style={{ minWidth: '10px' }}>
                    {week.map(({ key }) => (
                      <div
                        key={key}
                        onClick={() => setSelectedDay(selectedDay === key ? null : key)}
                        title={`${key}${heatmapData[key] ? ` · ${heatmapData[key].count} achievements · ${heatmapData[key].points} pts` : ''}`}
                        style={{ height: '12px', borderRadius: '1px', background: getColor(key), cursor: heatmapData[key] ? 'pointer' : 'default', outline: selectedDay === key ? '2px solid var(--accent)' : 'none', transition: 'background-color 0.4s ease' }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-1 mt-2" style={{ paddingLeft: '28px' }}>
              <span className="text-[8px] text-ink-3">Less</span>
              {['var(--well)','var(--heat-1)','var(--heat-2)','var(--accent)','var(--gold)'].map(c => (
                <div key={c} style={{ width: '10px', height: '10px', borderRadius: '1px', background: c, flexShrink: 0 }} />
              ))}
              <span className="text-[8px] text-ink-3">More</span>
              <span className="text-[8px] text-gold ml-2">● peak</span>
              {selectedDay && (
                <button onClick={() => setSelectedDay(null)} className="ml-auto text-[8px] text-accent hover:text-ink uppercase tracking-wider">
                  Clear filter ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div>
        <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3">
          <span className="sec-mark" />
          <span className="sec-t flex items-center gap-2"><Trophy size={15} className="text-gold" /> Recent Unlocks</span>
          <span className="text-[10px] text-ink-3 ml-auto flex items-center gap-1.5">
            {selectedDay ? (<>
              <span>{fmtDay(selectedDay)}</span>
              <span className="text-line">·</span>
              <span>{dayMap[selectedDay]?.count || 0} achievements</span>
              <span className="text-line">·</span>
              <span>{dayMap[selectedDay]?.points || 0} pts</span>
              {(dayMap[selectedDay]?.retro || 0) > (dayMap[selectedDay]?.points || 0) && <><span className="text-line">·</span><span>{dayMap[selectedDay].retro} RP</span></>}
            </>) : (<>
              <span>{achievements.length} {allLoaded ? 'total' : 'loaded'}</span>
              <span className="text-line">·</span>
              <span>{totalPts} pts</span>
              {totalRetro > totalPts && <><span className="text-line">·</span><span>{totalRetro} RP</span></>}
            </>)}
          </span>
        </div>

        {selectedDay && heatmapData[selectedDay] && !dayMap[selectedDay] ? (
          <div className="flex flex-col gap-2 py-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-[2px] border border-line bg-box">
                <div className="shimmer w-8 h-8 rounded-[2px] flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="shimmer h-2.5 w-3/4 rounded" />
                  <div className="shimmer h-2 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : timelineGroups.length === 0 ? (
          <div className="text-ink-2 text-[11px] py-4 italic text-center">No achievements unlocked in the last 180 days.</div>
        ) : (
          <div className="flex flex-col gap-0">
            {timelineGroups.map(({ day, dayPts, dayRetro, achCount, sessions }) => {
              const isCollapsed = collapsedDays.has(day);
              return (
              <div key={day} className="mb-4 feed-item">
                {/* Day header — clickable to collapse */}
                <button onClick={() => toggleDay(day)} className="w-full flex items-center gap-2 mb-2 group outline-none">
                  <div className="w-2 h-2 rounded-full bg-line border border-accent shrink-0"></div>
                  <span className="text-[10px] text-accent font-semibold group-hover:text-ink transition-colors">{fmtDay(day)}</span>
                  <div className="flex-1 h-px bg-line opacity-40"></div>
                  <span className="text-[9px] text-ink-3">{achCount} achievement{achCount !== 1 ? 's' : ''} · +{dayPts} pts{dayRetro > dayPts ? ` · ${dayRetro} RP` : ''}</span>
                  <ChevronDown size={11} className={`text-ink-3 transition-transform duration-200 shrink-0 ${isCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {/* Sessions — hidden when collapsed */}
                {!isCollapsed && sessions.map((session, si) => {
                  const sessPts   = session.achievements.reduce((s, a) => s + (a.points    || 0), 0);
                  const sessRetro = session.achievements.reduce((s, a) => s + (a.trueRatio || 0), 0);
                  return (
                  <div key={si} className="ml-4 border-l border-line pl-3 mb-3">
                    {/* Session label */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <a href={`../game/?id=${session.gameId}${compareParam}`} className="w-4 h-4 rounded-[1px] overflow-hidden border border-well bg-black block hover:scale-110 transition-transform shrink-0">
                        <img src={session.gameIcon} alt="" className="w-full h-full object-cover" />
                      </a>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {(() => { const p = parseTitle(session.gameTitle); return (<>
                          <a href={`../game/?id=${session.gameId}${compareParam}`} className="text-[9px] text-ink hover:text-accent transition-colors uppercase tracking-wider font-medium truncate">
                            {p.baseTitle}
                          </a>
                          {p.isSubset && (
                            <>
                              <span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>
                              <span className="text-[8px] text-gold-dim truncate">{p.subsetName}</span>
                            </>
                          )}
                          {!p.isSubset && renderTildeTags(p.tags)}
                        </>); })()}
                        <span className="text-[8px] text-ink-3 shrink-0">· {session.consoleName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        <span className="text-[8px] text-ink-3">+{sessPts} pts</span>
                        {sessRetro > sessPts && <><span className="text-[8px] text-line">·</span><span className="text-[8px] text-ink-3">{sessRetro} RP</span></>}
                        <span className="text-[8px] text-line">·</span>
                        <span className="text-[8px] text-ink-3">{fmtTime(session.startTime)}{session.startTime !== session.endTime ? `–${fmtTime(session.endTime)}` : ''}</span>
                      </div>
                    </div>

                    {/* Achievements in session */}
                    <div className="flex flex-col gap-1">
                      {[...session.achievements].sort((a,b) => b.date.localeCompare(a.date)).map((ach, ai) => {
                        const ratio = ach.trueRatio && ach.points ? ach.trueRatio / ach.points : null;
                        return (
                          <div key={ai} className={`flex items-center gap-2 p-2 rounded-[2px] border border-line border-l-[2px] ${ach.hardcoreMode ? 'border-l-gold bg-box-hi' : 'border-l-ink-2 bg-box'} hover:bg-line transition-colors`}>
                            <a href={`../achievement/?id=${ach.achievementId}`} className="shrink-0 w-8 h-8 rounded-[2px] overflow-hidden border border-well bg-black block hover:scale-105 transition-transform">
                              <img src={`${MEDIA_URL}/Badge/${ach.badgeName}.png`} alt={ach.title} className="w-full h-full object-cover" />
                            </a>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <a href={`../achievement/?id=${ach.achievementId}`} className={`text-[11px] font-medium transition-colors truncate ${ach.hardcoreMode ? 'text-gold hover:text-gold-hi' : 'text-ink hover:text-accent'}`}>
                                  {ach.title}
                                </a>
                                <span className="text-[9px] font-bold text-gold num bg-well border border-line-2 px-1.5 py-[1px] rounded-sm shrink-0">{ach.points} pts</span>
                                {ratio > 0 && <span className="text-[9px] shrink-0" style={{ color: ratio >= 30 ? 'var(--hc)' : ratio >= 20 ? 'var(--gold)' : ratio >= 10 ? 'var(--accent)' : 'var(--ink-2)' }}>×{ratio.toFixed(1)}</span>}
                                {ach.type === 'progression' && (
                                  <span className="pop-wrap">
                                    <Trophy size={11} className="text-gold" />
                                    <span className="pop-box">
                                      <div className="pop-name" style={{color:'var(--gold)'}}>Progression</div>
                                      <div className="pop-sub">Required to complete the game</div>
                                    </span>
                                  </span>
                                )}
                                {ach.type === 'win_condition' && (
                                  <span className="pop-wrap">
                                    <Crown size={11} className="text-hc" />
                                    <span className="pop-box">
                                      <div className="pop-name" style={{color:'var(--hc)'}}>Win Condition</div>
                                      <div className="pop-sub">Triggers game completion</div>
                                    </span>
                                  </span>
                                )}
                                {ach.type === 'missable' && (
                                  <span className="pop-wrap">
                                    <AlertTriangle size={11} className="text-warn" />
                                    <span className="pop-box">
                                      <div className="pop-name" style={{color:'var(--warn)'}}>Missable</div>
                                      <div className="pop-sub">Can be permanently missed</div>
                                    </span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-ink-2 truncate">{ach.description}</p>
                            </div>
                            <span className="text-[9px] text-ink-3 shrink-0">{fmtTime(ach.date)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ); })}
              </div>
              );
            })}
          </div>
        )}

        {/* ── Loading / done indicator ── */}
        {!selectedDay && (
          loadingMore ? (
            <div className="flex flex-col gap-2 mt-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-[2px] border border-line bg-box">
                  <div className="shimmer w-8 h-8 rounded-[2px] flex-shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="shimmer h-2.5 w-3/4 rounded" />
                    <div className="shimmer h-2 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : allLoaded && achievements.length > 0 ? (
            <div className="text-center py-3 mt-2 border-t border-line-faint text-[9px] text-ink-3 uppercase tracking-wider">
              {achievements.length} achievements · last 12 months loaded
            </div>
          ) : null
        )}
      </div>
      </>}
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

const GameCardSkeleton = () => (
  <div className="bg-box-hi border border-line-2 border-l-[3px] border-l-line-2 rounded-[3px] p-3 flex gap-4">
    <div className="shimmer w-16 h-16 md:w-20 md:h-20 rounded-[2px] flex-shrink-0" />
    <div className="flex-1 flex flex-col gap-2 justify-center">
      <Sk w="w-3/4" h="h-3.5" /><Sk w="w-1/2" h="h-2.5" />
      <div className="flex gap-2 mt-1"><Sk w="w-20" h="h-2" /><Sk w="w-16" h="h-2" /></div>
    </div>
  </div>
);

const ActivitySkeleton = () => (
  <div className="flex flex-col gap-6">
    {/* Heatmap */}
    <div>
      <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3">
        <div className="shimmer w-[3px] h-[14px] rounded-[1px]" />
        <Sk w="w-24" h="h-3.5" /><Sk w="w-48" h="h-2.5" cls="ml-auto" />
      </div>
      <div className="shimmer w-full h-[96px] rounded-[2px]" />
    </div>
    {/* Timeline */}
    <div>
      <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3">
        <div className="shimmer w-[3px] h-[14px] rounded-[1px]" />
        <Sk w="w-32" h="h-3.5" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-4">
          <div className="flex items-center gap-2 mb-2"><div className="shimmer w-2 h-2 rounded-full" /><Sk w="w-32" h="h-2.5" /></div>
          <div className="ml-4 border-l border-line pl-3 flex flex-col gap-1.5">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="flex items-center gap-2 p-2 bg-box border border-line rounded-[2px]">
                <div className="shimmer w-8 h-8 rounded-[2px] flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5"><Sk w="w-3/4" h="h-2.5" /><Sk w="w-1/2" h="h-2" /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SeriesProgressTab
// ─────────────────────────────────────────────────────────────────────────────

function SeriesProgressTab({ seriesData, gamesData, backlogData }) {
  const cards = useMemo(() => {
    const visible = seriesData.filter(s => s.showProgress);

    // Build a flat icon lookup from any source we have: detailedGameProgress + backlog
    const gameProgress = gamesData?.detailedGameProgress ?? {};
    const wlMap = Object.fromEntries((backlogData?.results ?? []).map(g => [g.id, g]));
    const getGameInfo = (id) => gameProgress[id] ?? wlMap[id] ?? null;

    return visible.map(series => {
      const total = series.gameIds.length;

      let tracked = 0, inProgress = 0, mastered = 0;
      let pointsEarned = 0, pointsTotal = 0;
      let achEarned = 0, achTotal = 0;
      let latestAch = null; // { title, gameTitle, date }
      const icons = [];

      const iconsNoAch = [];
      series.gameIds.forEach(id => {
        const g  = gameProgress[id];
        const wl = wlMap[id];

        const numAchs = g?.numAchievements ?? wl?.achievementsPublished ?? 0;
        const hasAch  = numAchs > 0;

        if (hasAch) {
          tracked++;
          // Points total: sum from achievement data if available, else backlog pointsTotal
          if (g?.achievements) {
            Object.values(g.achievements).forEach(a => {
              pointsTotal += a.points ?? 0;
              achTotal++;
              if (a.dateEarned) {
                pointsEarned += a.points ?? 0;
                achEarned++;
                const t = new Date(a.dateEarned);
                if (!latestAch || t > new Date(latestAch.date)) {
                  latestAch = { title: a.title, badgeName: a.badgeName, achId: a.id, gameTitle: g.title, gameId: id, date: a.dateEarned };
                }
              }
            });
          } else if (wl) {
            if (wl.pointsTotal)           pointsTotal += wl.pointsTotal;
            if (wl.achievementsPublished) achTotal    += wl.achievementsPublished;
          }

          if (g) {
            const numAwarded = g.numAwardedToUser ?? 0;
            if (numAwarded === g.numAchievements) mastered++;
            else if (numAwarded > 0)              inProgress++;
          }
        }

        const imageIcon    = g?.imageIcon ?? wl?.imageIcon ?? null;
        const title        = g?.title ?? wl?.title ?? String(id);
        const isMastered   = hasAch && g && g.numAwardedToUser === g.numAchievements && g.numAchievements > 0;
        const isInProgress = hasAch && g && g.numAwardedToUser > 0 && !isMastered;
        const lastUnlockDate = (isMastered || isInProgress) && g?.achievements
          ? Math.max(...Object.values(g.achievements).filter(a => a.dateEarned).map(a => new Date(a.dateEarned).getTime()))
          : 0;
        const sortBucket = isMastered ? 0 : isInProgress ? 1 : hasAch ? 2 : 3;
        if (imageIcon) {
          const entry = { id, icon: getMediaUrl(imageIcon), title, hasAch, isMastered, lastUnlockDate, sortBucket };
          if (hasAch) icons.push(entry);
          else        iconsNoAch.push(entry);
        }
      });
      const allIcons = [...icons, ...iconsNoAch].sort((a, b) => {
        if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
        if (a.sortBucket <= 1) return b.lastUnlockDate - a.lastUnlockDate;
        return a.title.localeCompare(b.title);
      });

      // Cover game: explicitly set, or fall back to first game in series
      // Check both detailedGameProgress and backlog so unplayed games still resolve
      const coverId   = series.coverGameId ?? series.gameIds[0];
      const coverGame = getGameInfo(coverId);
      const coverBg   = coverGame
        ? getMediaUrl(coverGame.imageIngame || coverGame.imageTitle || coverGame.imageIcon)
        : null;
      const coverIcon = coverGame ? getMediaUrl(coverGame.imageIcon) : null;

      return { series, total, tracked, inProgress, mastered, pointsEarned, pointsTotal, achEarned, achTotal, latestAch, icons: allIcons, coverBg, coverIcon, coverId };
    }).sort((a, b) => {
      const key = n => /^[a-zA-Z]/.test(n) ? '2' + n.toLowerCase() : /^\d/.test(n) ? '1' + n.toLowerCase() : '0' + n.toLowerCase();
      return key(a.series.name).localeCompare(key(b.series.name));
    });
  }, [seriesData, gamesData, backlogData]);

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-ink-3 text-[12px]">
        No series flagged for progress tracking yet.<br />
        <span className="text-[11px]">Enable <strong className="text-ink-2">📊 Progress</strong> on a series in the admin panel.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map(({ series, total, tracked, inProgress, mastered, pointsEarned, pointsTotal, achEarned, achTotal, latestAch, icons, coverBg, coverIcon, coverId }) => {
        const achPct = achTotal > 0 ? (achEarned / achTotal) * 100 : 0;
        const ICON_LIMIT   = 8;
        const shownIcons   = icons.slice(0, ICON_LIMIT);
        const extraIcons   = icons.length - ICON_LIMIT;
        const latestAchTimeAgo = latestAch ? formatTimeAgo(latestAch.date) : null;

        return (
          <div key={series.id} className="flex flex-col bg-box-hi rounded-[3px] border-l-[3px] border border-line-2 shadow-md overflow-hidden" style={{ borderLeftColor: 'var(--gold)' }}>

            {/* Top section: bg image + cover icon + title (mirrors GameCard header) */}
            <div className="relative flex flex-row p-3 gap-3 md:gap-4 items-center min-h-[90px] overflow-hidden rounded-t-[3px]">
              {/* Background image */}
              {coverBg && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-t-[3px]">
                  <img src={coverBg} alt="" className="absolute right-0 top-0 h-full w-full md:w-1/2 object-cover opacity-[0.55] object-center mix-blend-screen mask-fade" />
                  <div className="absolute inset-0 bg-gradient-to-r from-box-hi via-box-hi/95 to-transparent" />
                </div>
              )}

              {/* Cover icon */}
              <a href={`../game/?id=${coverId}${compareParam}`}
                className="relative z-10 shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-[2px] shadow-sm border border-well overflow-hidden bg-well hover:scale-105 transition-transform">
                {coverIcon
                  ? <img src={coverIcon} alt={series.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-head flex items-center justify-center text-ink-3 text-[20px]">🗂</div>
                }
              </a>

              {/* Title + points */}
              <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0 gap-1">
                <span className="text-[15px] md:text-base text-white font-medium tracking-wide drop-shadow-sm truncate">{series.name}</span>
                {pointsTotal > 0 && (
                  <span className="text-[11px] text-gold font-medium tabular-nums drop-shadow-sm">
                    {pointsEarned.toLocaleString()} <span className="text-ink-2 font-normal">/ {pointsTotal.toLocaleString()} pts</span>
                  </span>
                )}
                {latestAch && (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="shrink-0 w-3.5 h-3.5 rounded-[1px] overflow-hidden border border-well bg-black block">
                      <img src={`${MEDIA_URL}/Badge/${latestAch.badgeName}.png`} alt="" className="w-full h-full object-cover" />
                    </span>
                    <a href={`../achievement/?id=${latestAch.achId}`}
                      className="text-[9px] text-ink-2 hover:text-ink truncate transition-colors">{latestAch.title}</a>
                    <span className="text-[9px] text-ink-3 shrink-0">in</span>
                    <a href={`../game/?id=${latestAch.gameId}${compareParam}`}
                      className="text-[9px] text-accent hover:text-ink truncate transition-colors">{parseTitle(latestAch.gameTitle).baseTitle}</a>
                    <span className="text-[9px] text-ink-3 shrink-0">at {latestAchTimeAgo}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-3 pb-3 pt-2 border-t border-line">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-2 border border-line-2 bg-well/60 px-1.5 py-[1px] rounded-sm">{total} games</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-ink border border-line-2 bg-well/60 px-1.5 py-[1px] rounded-sm">{tracked} tracked</span>
                  {inProgress > 0 && <span className="text-[9px] font-semibold uppercase tracking-wider text-accent border border-accent/30 bg-well/60 px-1.5 py-[1px] rounded-sm">{inProgress} in progress</span>}
                  {mastered > 0 && <span className="text-[9px] font-bold uppercase tracking-wider text-well bg-gold px-1.5 py-[1px] rounded-sm">{mastered} mastered</span>}
                </div>
                <span className="text-[10px] text-ink-2 tabular-nums shrink-0">{achEarned.toLocaleString()} / {achTotal.toLocaleString()}</span>
                <span className="text-[10px] font-semibold tabular-nums shrink-0" style={{ color: achPct > 0 ? 'var(--gold)' : 'var(--ink-3)' }}>
                  {achPct.toFixed(2)}%
                </span>
              </div>
              <div className="h-[7px] bg-well rounded-full overflow-hidden border border-well-edge">
                <div style={{ width: `${achPct}%`, background: achPct === 100 ? 'linear-gradient(90deg,var(--gold),var(--gold-hi))' : 'var(--gold)' }}
                  className="h-full rounded-full transition-all" />
              </div>
            </div>

            {/* Icon strip */}
            {shownIcons.length > 0 && (
              <div className="flex items-center gap-1 px-3 pb-2.5 flex-wrap border-t border-line pt-2.5">
                {shownIcons.map(g => (
                  <a key={g.id} href={`../game/?id=${g.id}${compareParam}`}
                    className={`shrink-0 w-8 h-8 rounded-[2px] overflow-hidden bg-black hover:scale-110 transition-transform block ${g.isMastered ? 'border-2 border-gold' : 'border border-well'}`}>
                    <img src={g.icon} alt={g.title} className={`w-full h-full object-cover ${g.hasAch ? '' : 'brightness-[0.35] grayscale'}`} />
                  </a>
                ))}
                {extraIcons > 0 && (
                  <span className="text-[10px] text-ink-3 ml-1 shrink-0">+{extraIcons}</span>
                )}
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}

// ── Social Tab ────────────────────────────────────────────────────────────────

// ── Stats tab ─────────────────────────────────────────────
// Every number here is derived from data already in memory — the profile fetch
// (games, awards) and the achievement chunks the Activity tab loads. No extra API calls.

// Rarity has its own palette rather than the generic accents or a single-hue ramp.
// The three warm tiers are neighbours on the hue wheel, so they are separated by
// LIGHTNESS — mid orange, pale yellow, deep red. At equal saturation they measure
// ΔE 8–11 against each other and collapse entirely under red-green CVD; spread
// across lightness they clear it. The shades are also pulled away from meanings the
// app already owns: --very-rare is far from the --gold that means *mastered*, and
// --ultra-rare is far from the --hc red that means *error*.
// Nothing here encodes the order — the labels, counts and percentages do that.
// Checked with the dataviz skill's validate_palette.js against the --box surface:
// CVD ΔE 12.4 (deutan), contrast all ≥ 3:1. The one sub-floor pair is grey↔blue at
// ΔE 13.9, the same pair already accepted on the Consoles card.
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
    ? ['recent', 'progress', 'series']
    : ['recent', 'progress', 'series', 'activity', 'backlog', 'social', 'stats'];
  const initialTab = (() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    return VALID_TABS.includes(p) ? p : 'recent';
  })();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [progressSearch,  setProgressSearch]  = useState('');
  const [progressFilter,  setProgressFilter]  = useState('all');   // all | nearly | inprogress | abandoned
  const [showMastered,    setShowMastered]    = useState(false);
  const [showAllRecent,   setShowAllRecent]   = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFloatingTabs, setShowFloatingTabs] = useState(false);
  const [pillLeaving, setPillLeaving] = useState(false);
  const pillLeaveTimer = useRef(null);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [awardsExpanded, setAwardsExpanded] = useState(false);
  const tabBarRef = useRef(null);
  const tabContentRef = useRef(null);
  const [gameView, setGameView] = useGameView();
  const [backlogSearch, setBacklogSearch] = useState('');
  const [backlogStatusFilter, setBacklogStatusFilter] = useState('all');
  const [backlogGrouping, setBacklogGrouping] = useState('none');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [backlogPage, setBacklogPage] = useState(1);
  const [backlogPageSize, setBacklogPageSize] = useState(50);
  const [selectedGame, setSelectedGame] = useState(null);
  const [seriesData, setSeriesData] = useState([]);

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
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    if (tab !== 'activity') url.searchParams.delete('view');
    window.history.replaceState({}, '', url);
  };

  // Tabs in display order: the desktop TabBar and the phone swipe both follow it
  const profileTabs = [
    { id: 'recent',   label: 'Recent Games' },
    { id: 'progress', label: 'Completion Progress' },
    ...(seriesData.some(s => s.showProgress) ? [{ id: 'series', label: 'Series Progress' }] : []),
    ...(!isVisitorMode ? [
      { id: 'activity', label: 'Activity' },
      { id: 'backlog',  label: 'Backlog' },
      { id: 'social',   label: 'Social' },
      { id: 'stats',    label: 'Stats' },
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

  // ── Load achievements when the Activity or Stats tab opens ──
  useEffect(() => {
    if (isVisitorMode || (activeTab !== 'activity' && activeTab !== 'stats')) return;
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

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShowScrollTop(y > 400);
      if (isVisitorMode && window.innerWidth < 768) {
        if (y > 150) {
          if (pillLeaveTimer.current) { clearTimeout(pillLeaveTimer.current); pillLeaveTimer.current = null; }
          setPillLeaving(false);
          setShowFloatingTabs(true);
        } else {
          setShowFloatingTabs(prev => {
            if (prev && !pillLeaveTimer.current) {
              setPillLeaving(true);
              pillLeaveTimer.current = setTimeout(() => {
                setShowFloatingTabs(false);
                setPillLeaving(false);
                pillLeaveTimer.current = null;
              }, 210);
            }
            return prev;
          });
        }
      }
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

  let displayedGames = [...ALL_GAMES];
  if (activeTab === 'recent') {
    displayedGames.sort((a, b) => new Date(b.lastPlayedStr || 0) - new Date(a.lastPlayedStr || 0));
    displayedGames = displayedGames.slice(0, 15);
  } else if (activeTab === 'progress') {
    // Progression buckets. Applied to started-but-unfinished games, first match wins:
    // nearly there → in progress → abandoned. "Nearly there" is deliberately
    // recency-neutral — a game you dropped at 80% is the one most worth resurrecting,
    // so it should not disappear into the abandoned pile.
    const NEARLY_PCT = 75;
    const STALE_MS   = 30 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const isNearly = g => !g.isMastered && g.rawProgress >= NEARLY_PCT;
    const isStale  = g => !g.lastPlayedStr || (nowMs - new Date(g.lastPlayedStr).getTime()) > STALE_MS;
    const byRecency = (a, b) => new Date(b.lastPlayedStr || 0) - new Date(a.lastPlayedStr || 0);

    displayedGames = displayedGames.filter(g =>
      g.achievementsUnlocked > 0 && g.achievementsTotal > 0
      && (!progressSearch || (g.baseTitle || g.title || '').toLowerCase().includes(progressSearch.toLowerCase())));

    if (progressFilter === 'nearly') {
      displayedGames = displayedGames
        .filter(isNearly)
        // Fewest achievements left first — a set at 81% with 18 to go is not a tonight job.
        .sort((a, b) =>
          ((a.achievementsTotal - a.achievementsUnlocked) - (b.achievementsTotal - b.achievementsUnlocked))
          || (b.rawProgress - a.rawProgress));
    } else if (progressFilter === 'inprogress') {
      displayedGames = displayedGames
        .filter(g => !g.isMastered && !isNearly(g) && !isStale(g))
        .sort(byRecency);
    } else if (progressFilter === 'abandoned') {
      displayedGames = displayedGames
        .filter(g => !g.isMastered && !isNearly(g) && isStale(g))
        .sort(byRecency);
    } else {
      displayedGames = displayedGames
        .filter(g => showMastered || !g.isMastered)
        .sort((a, b) => b.rawProgress - a.rawProgress);
    }
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
        const mastered = games.filter(g => g.isMastered).length;
        const beaten = games.filter(g => g.isBeaten && !g.isMastered).length;
        const started = games.filter(g => g.achievementsUnlocked > 0 && !g.isMastered && !g.isBeaten).length;
        const softOnly = PROFILE_DATA.totalPoints === 0;
        return (
        <header className={`phead${(!isVisitorMode && activeTab !== 'recent') ? ' hidden md:block' : ''}`}>
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
              <div className="pstatus" role="list" aria-label="Game status">
                <div role="listitem" className="pstatus-cell" style={{ '--c': 'var(--c-gold)' }}><Trophy size={12} /><b className="num">{mastered}</b> mastered</div>
                <div role="listitem" className="pstatus-cell" style={{ '--c': 'var(--c-silver)' }}><Medal size={12} /><b className="num">{beaten}</b> beaten</div>
                <div role="listitem" className="pstatus-cell" style={{ '--c': 'var(--c-accent)' }}><Gamepad2 size={12} /><b className="num">{started}</b> in progress</div>
              </div>
              <div className="phead-meta">Member since <b>{PROFILE_DATA.memberSince}</b></div>
            </div>
          </div>
        </header>
        );
      })()}

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-6 flex-1 w-full">
        
        <div className={`grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 mb-8${(!isVisitorMode && activeTab !== 'recent') ? ' hidden md:grid' : ''}`}>
          
          <div className="flex flex-col gap-6">
            
            <div>
              <h2 className="sec-t border-b border-line pb-1.5 flex items-center gap-2 mb-3">
                <span className="sec-mark" />
                <Activity size={15} className="text-accent"/> Most Recently Played
              </h2>
              
              <div className="flex flex-col gap-2">
                {PROFILE_DATA.mostRecentGame ? (
                  <div className="bg-box/80 border border-line-2 border-l-[3px] border-l-accent rounded-[3px] p-3 flex gap-4 hover:bg-box-hi transition-colors shadow-sm">
                    <a href={`../game/?id=${PROFILE_DATA.mostRecentGame.id}${compareParam}`} className="w-14 h-14 shrink-0 rounded-[2px] overflow-hidden border border-well bg-black block hover:scale-105 transition-transform">
                      <img src={PROFILE_DATA.mostRecentGame.icon} alt="Icon" className="w-full h-full object-cover"/>
                    </a>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <a href={`../game/?id=${PROFILE_DATA.mostRecentGame.id}${compareParam}`} className="text-ink hover:text-accent font-medium text-[14px] truncate leading-tight">
                          {PROFILE_DATA.mostRecentGame.baseTitle}
                        </a>
                        {PROFILE_DATA.mostRecentGame.isSubset && (
                          <span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>
                        )}
                        {renderTildeTags(PROFILE_DATA.mostRecentGame.tags)}
                      </div>
                      {PROFILE_DATA.mostRecentGame.isSubset && (
                        <div className="text-[10px] text-gold-dim mb-0.5 truncate">{PROFILE_DATA.mostRecentGame.subsetName}</div>
                      )}
                      <div className="text-[10px] mb-1 flex items-center gap-1.5">
                         <span className="text-accent">{PROFILE_DATA.mostRecentGame.console}</span>
                         <span className="text-ink-3">•</span>
                         <span className="text-ink-2">{PROFILE_DATA.mostRecentGame.timeAgo}</span>
                      </div>
                      
                      {PROFILE_DATA.richPresenceMsg && (
                         <p className="text-ink text-[11px] leading-snug italic border-l-2 border-line-2 pl-2 mt-1">
                           {PROFILE_DATA.richPresenceMsg}
                         </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-ink-2 text-[11px] py-2">No recent games found.</div>
                )}
              </div>
            </div>

            {/* Most Recently Unlocked Achievement */}
            <div>
              <h2 className="sec-t border-b border-line pb-1.5 flex items-center gap-2 mb-3">
                <span className="sec-mark" />
                <Trophy size={15} className="text-gold"/> Most Recently Unlocked
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
            </div>

            <div>
              <h2 className="sec-t border-b border-line pb-1.5 flex items-center gap-2 mb-2">
                <span className="sec-mark" />
                <BarChart2 size={15} className="text-accent"/> User Stats
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 px-1">

                <div className="flex flex-col">
                  {PROFILE_DATA.statsLeft.map((stat, i) => (
                    <div key={`left-${i}`} className="flex items-end text-[11px] py-[3px] group hover:bg-box-hi/40 rounded-sm px-1 transition-colors">
                      <span className="text-ink-2 font-medium leading-tight whitespace-nowrap">{stat.label}</span>
                      <div className="flex-1 border-b-[1.5px] border-dotted border-line-2 mx-2 relative top-[-4px] opacity-60 group-hover:border-ink-3"></div>
                      <span className={`${stat.dim ? 'text-ink-3 italic' : 'text-ink num'} font-medium whitespace-nowrap leading-tight text-right`}>{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Right column: always visible on sm+, hidden on mobile until expanded */}
                <div className={`flex flex-col ${statsExpanded ? '' : 'hidden sm:flex'}`}>
                  {PROFILE_DATA.statsRight.map((stat, i) => (
                    <div key={`right-${i}`} className="flex items-end text-[11px] py-[3px] group hover:bg-box-hi/40 rounded-sm px-1 transition-colors">
                      <span className="text-ink-2 font-medium leading-tight whitespace-nowrap">{stat.label}</span>
                      <div className="flex-1 border-b-[1.5px] border-dotted border-line-2 mx-2 relative top-[-4px] opacity-60 group-hover:border-ink-3"></div>
                      <span className={`${stat.dim ? 'text-ink-3 italic' : 'text-ink num'} font-medium whitespace-nowrap leading-tight text-right`}>{stat.value}</span>
                    </div>
                  ))}
                </div>

              </div>

              {/* Mobile-only expand/collapse toggle */}
              <button
                onClick={() => setStatsExpanded(v => !v)}
                className="sm:hidden mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3 hover:text-ink-2 transition-colors border-t border-line-soft"
              >
                <ChevronDown size={13} className={`transition-transform duration-200 ${statsExpanded ? 'rotate-180' : ''}`} />
                {statsExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>

          </div>

          <div className="flex flex-col gap-5">

            {(() => {
              const collapseLimit = window.innerWidth >= 640 ? 20 : 10;
              const visibleAwards = awardsExpanded ? PROFILE_DATA.gameAwards : PROFILE_DATA.gameAwards.slice(0, collapseLimit);
              const hasMore = PROFILE_DATA.gameAwards.length > collapseLimit;
              return (
            <div className="bg-box border border-line rounded-[3px] shadow-sm h-fit">
              <div className="p-2.5 bg-head border-b border-line rounded-t-[2px] text-ink flex items-center gap-2">
                <span className="sec-mark sm" />
                <span className="card-t flex items-center gap-2">
                  <Star size={13} /> Game Awards
                </span>
                {PROFILE_DATA.gameAwards.length > 0 && (() => {
                  const mastered = PROFILE_DATA.gameAwards.filter(a => a.type === 'Mastery/Completion').length;
                  const beaten   = PROFILE_DATA.gameAwards.length - mastered;
                  return (
                    <div className="ml-auto flex items-center gap-2">
                      {mastered > 0 && <span className="flex items-center gap-0.5 text-[9px] font-semibold" style={{ color: 'var(--gold)' }}><Trophy size={9} />{mastered}</span>}
                      {beaten   > 0 && <span className="flex items-center gap-0.5 text-[9px] font-semibold" style={{ color: 'var(--silver)' }}><Medal size={9} />{beaten}</span>}
                    </div>
                  );
                })()}
              </div>
              <div className="p-3 grid grid-cols-5 gap-2 min-h-[60px]">
                {PROFILE_DATA.gameAwards.length > 0 ? visibleAwards.map(award => (
                  <div key={award.id} className="relative group cursor-help">
                    <img
                      src={award.icon}
                      alt={award.title}
                      className={`w-full aspect-square rounded-[2px] border transition-all duration-200 bg-black relative z-10 group-hover:scale-110 ${award.type === 'Mastery/Completion' ? 'border-2 border-gold' : 'border border-silver'}`}
                    />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[200px] bg-box border border-line rounded-[2px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] shadow-xl pointer-events-none overflow-hidden">
                      <div className="h-[2px] bg-gradient-to-r from-gold to-gold/20"></div>
                      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-line bg-head">
                        <img src={award.icon} alt="" className="w-8 h-8 rounded-[2px] border border-gold/30 bg-black shrink-0" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[11px] text-white font-semibold leading-tight">{award.baseTitle || award.title}</span>
                            {award.isSubset && <span className="text-[8px] font-bold uppercase tracking-[0.07em] px-1.5 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>}
                            {!award.isSubset && renderTildeTags(award.tags)}
                          </div>
                          {award.isSubset && award.subsetName && <span className="text-[9px] text-gold-dim truncate">{award.subsetName}</span>}
                        </div>
                      </div>
                      <div className="px-2.5 py-2 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-ink-3 uppercase tracking-[0.08em]">Console</span>
                          <span className="text-[9px] text-accent font-medium">{award.console}</span>
                        </div>
                        <div className="h-px bg-line"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-ink-3 uppercase tracking-[0.08em]">Award</span>
                          {award.type === 'Mastery/Completion'
                            ? <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-[2px] bg-gold text-well">Mastered</span>
                            : <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-[2px] bg-chip text-ink border border-silver/40">Beaten</span>
                          }
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-ink-3 uppercase tracking-[0.08em]">Earned</span>
                          <span className="text-[9px] text-ink">{award.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full text-center text-ink-3 text-[10px] py-2">No game awards yet.</div>
                )}
              </div>
              {hasMore && (
                <button
                  onClick={() => setAwardsExpanded(v => !v)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 border-t border-line-soft text-[10px] text-ink-3 hover:text-ink-2 transition-colors"
                >
                  <ChevronDown size={11} className={`transition-transform duration-200 ${awardsExpanded ? 'rotate-180' : ''}`} />
                  {awardsExpanded ? 'Show less' : `${PROFILE_DATA.gameAwards.length - collapseLimit} more`}
                </button>
              )}
            </div>
              );
            })()}

          </div>
        </div>

        {/* ── Tab bar (assets/tabs.js): desktop only; phones use the floating pill and swipe ── */}
        <TabBar barRef={tabBarRef} className="hidden md:block md:top-[37px] -mx-4 md:-mx-8 mb-4 px-2 md:px-6"
          tabs={profileTabs} active={activeTab} onChange={setTab} />

        <div ref={tabContentRef} className="flex flex-col gap-3">
          {activeTab === 'social' ? (
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
          ) : activeTab === 'series' ? (
            <SeriesProgressTab seriesData={seriesData} gamesData={gamesData} backlogData={backlogData} />
          ) : activeTab === 'activity' ? (
            achievements === null && achievementsLoadingMore
              ? <ActivitySkeleton />
              : <ActivityTab
                  achievements={allLoadedAchievements}
                  refTime={rawData?.metadata?.extractionTimestamp}
                  heatmapData={heatmapData}
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
              // ── helpers ──────────────────────────────────────────────
              const getStatus = g => {
                if (g.achievementsTotal === 0) return 'noach';
                if (g.achievementsTotal > 0 && g.numAwarded === g.achievementsTotal) return 'mastered';
                if (g.inProgress) return 'inprogress';
                return 'notstarted';
              };

              const filtered = BACKLOG.games.filter(g => {
                const status = getStatus(g);
                if (backlogSearch) {
                  const q = backlogSearch.toLowerCase();
                  const searchable = [
                    g.baseTitle || g.title,
                    g.isSubset ? 'subset' : null,
                    g.subsetName,
                    ...(g.tags || []),
                  ].filter(Boolean).join(' ').toLowerCase();
                  if (!searchable.includes(q)) return false;
                }
                if (backlogStatusFilter !== 'all' && status !== backlogStatusFilter) return false;
                return true;
              });

              const statusMeta = {
                mastered:   { dot: 'var(--gold)', label: 'Mastered',        defaultOpen: true  },
                inprogress: { dot: 'var(--accent)', label: 'In Progress',     defaultOpen: true  },
                notstarted: { dot: 'var(--ink-3)', label: 'Not Started',     defaultOpen: false },
                noach:      { dot: 'var(--line-faint)', label: 'No Achievements', defaultOpen: false },
              };

              // Build groups
              let groups = [];
              if (backlogGrouping === 'console') {
                const map = {};
                filtered.forEach(g => { if (!map[g.console]) map[g.console] = []; map[g.console].push(g); });
                groups = Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
                  .map(([key, games]) => ({ key, label: key, dot: 'var(--accent)', games, defaultOpen: games.length <= 5 }));
              } else if (backlogGrouping === 'status') {
                ['mastered','inprogress','notstarted','noach'].forEach(s => {
                  const games = filtered.filter(g => getStatus(g) === s);
                  if (games.length > 0) groups.push({ key: s, label: statusMeta[s].label, dot: statusMeta[s].dot, games, defaultOpen: statusMeta[s].defaultOpen });
                });
              }

              // ── Pagination ──────────────────────────────────────────
              let pagedFiltered = filtered;
              let pagedGroups = groups;
              let totalPages = 1;

              if (backlogGrouping === 'none') {
                totalPages = Math.max(1, Math.ceil(filtered.length / backlogPageSize));
                const safePage = Math.min(backlogPage, totalPages);
                pagedFiltered = filtered.slice((safePage - 1) * backlogPageSize, safePage * backlogPageSize);
              } else if (groups.length > 0) {
                // snap to group boundary: accumulate until pageSize reached
                const pages = [];
                let start = 0, count = 0;
                for (let i = 0; i < groups.length; i++) {
                  count += groups[i].games.length;
                  if (count >= backlogPageSize || i === groups.length - 1) {
                    pages.push([start, i]);
                    start = i + 1;
                    count = 0;
                  }
                }
                totalPages = Math.max(1, pages.length);
                const safePage = Math.min(backlogPage, totalPages);
                const [s, e] = pages[safePage - 1] || [0, groups.length - 1];
                pagedGroups = groups.slice(s, e + 1);
              }

              // Table columns — responsive via CSS classes, not inline styles
              const showConsole  = backlogGrouping === 'none';
              const colClass = showConsole ? 'wl-row-full' : 'wl-row-noconsole';
              const headers = [
                { label: '', cls: '' },
                { label: 'Title', cls: '' },
                ...(showConsole ? [{ label: 'Console', cls: '' }] : []),
                { label: 'Pts', cls: 'wl-hide-mobile text-right' },
                { label: 'Progress', cls: 'text-right' },
              ];

              const GameRow = ({ game }) => {
                const status = getStatus(game);
                const isMastered   = status === 'mastered';
                const isInProgress = status === 'inprogress';
                const hasNoAch     = status === 'noach';
                const stripe = isMastered ? 'border-l-gold' : isInProgress ? 'border-l-accent' : hasNoAch ? 'border-l-line-faint' : 'border-l-ink-3';
                return (
                  <div key={game.id} className={`backlog-item grid gap-2 px-3 py-[5px] border-b border-box last:border-b-0 items-center hover:bg-box transition-colors border-l-[2px] ${stripe} ${hasNoAch ? 'opacity-50' : ''} ${colClass}`}>
                    <a href={`../game/?id=${game.id}${compareParam}`} className="shrink-0 w-6 h-6 rounded-[2px] overflow-hidden border border-well bg-black block hover:scale-110 transition-transform">
                      <img src={game.icon} alt={game.title} className="w-full h-full object-cover" />
                    </a>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a href={`../game/?id=${game.id}${compareParam}`} className="text-[11px] text-ink font-medium hover:text-accent transition-colors truncate leading-tight">{game.baseTitle || game.title}</a>
                        {game.isSubset && <span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>}
                        {renderTildeTags(game.tags)}
                      </div>
                      {game.isSubset && game.subsetName && <span className="text-[9px] text-gold-dim truncate block">{game.subsetName}</span>}
                      {backlogGrouping === 'status'
                        ? <span className="text-[9px] text-accent truncate block">{game.console}</span>
                        : <>
                          {isMastered   && <span className="text-[8px] text-gold flex items-center gap-1"><Trophy size={8}/> Mastered</span>}
                          {isInProgress && <span className="text-[8px] text-accent flex items-center gap-1"><Activity size={8}/> In Progress</span>}
                          {status === 'notstarted' && <span className="text-[8px] text-ink-3 flex items-center gap-1"><CircleDashed size={8}/> Not Started</span>}
                          {hasNoAch && <span className="text-[8px] text-line-2 flex items-center gap-1"><ShieldOff size={8}/> No Achievements</span>}
                        </>
                      }
                    </div>
                    {showConsole && <span className="text-[10px] text-accent truncate">{game.console}</span>}
                    <span className="wl-hide-mobile text-[10px] text-ink-2 text-right">{game.pointsTotal > 0 ? game.pointsTotal.toLocaleString() : <span className="text-line-2">—</span>}</span>
                    <div className="flex items-center justify-end">
                      {hasNoAch ? <span className="text-[10px] text-line-2">—</span>
                        : isMastered   ? <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-[2px] bg-gold text-well">{game.numAwarded}/{game.achievementsTotal}</span>
                        : isInProgress ? <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-[2px] bg-accent text-well">{game.numAwarded}/{game.achievementsTotal}</span>
                        : <span className="text-[10px] text-ink-2">{game.achievementsTotal}</span>}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {/* ── Header row ── */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="sec-mark" />
                      <span className="sec-t">Backlog</span>
                      <span className="text-[10px] text-ink-3">{BACKLOG.games.length.toLocaleString()} games</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {backlogTs && (
                        <span className="text-[9px] text-ink-3">Synced {timeAgo(backlogTs)}</span>
                      )}
                      <button type="button" onClick={refreshBacklog} disabled={backlogRefreshing}
                        className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3 hover:text-accent transition-colors disabled:opacity-40">
                        <RefreshCw size={11} className={backlogRefreshing ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                    </div>
                  </div>
                  {/* ── Filter + Group bar ── */}
                  <div className="flex flex-col gap-2 mb-2 md:flex-row md:flex-wrap md:items-center md:gap-2">
                    {/* Search */}
                    <div className="relative">
                      <input type="text" placeholder="Search games…" value={backlogSearch} onChange={e => { setBacklogSearch(e.target.value); setBacklogPage(1); }}
                        className="bg-well border border-line-2 hover:border-ink-3 focus:border-accent outline-none text-[10px] text-ink placeholder-ink-3 px-2 py-[4px] rounded-[2px] w-full md:w-44 transition-colors" />
                      {backlogSearch && <button onClick={() => setBacklogSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink text-[10px]">×</button>}
                    </div>

                    {/* Status filters */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <span className="text-[9px] text-ink-3 uppercase tracking-wider shrink-0">Status</span>
                      <span className="text-line text-[10px] select-none shrink-0 hidden md:inline">|</span>
                      {[
                        { value: 'all',        label: 'All',             cls: 'bg-ink-3 text-well border-ink-3' },
                        { value: 'noach',      label: 'No Ach',          cls: 'bg-line-2 text-ink-2 border-line-2' },
                        { value: 'notstarted', label: 'Not Started',     cls: 'bg-ink-3 text-well border-ink-3' },
                        { value: 'inprogress', label: 'In Progress',     cls: 'bg-accent text-well border-accent' },
                        { value: 'mastered',   label: 'Mastered',        cls: 'bg-gold text-well border-gold' },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => { setBacklogStatusFilter(opt.value); setBacklogPage(1); }}
                          className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-[2px] border transition-colors ${backlogStatusFilter === opt.value ? opt.cls : 'bg-well text-ink-2 border-line-2 hover:text-ink hover:border-ink-3'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Group filters */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <span className="text-[9px] text-ink-3 uppercase tracking-wider shrink-0">Group</span>
                      <span className="text-line text-[10px] select-none shrink-0 hidden md:inline">|</span>
                      {[
                        { value: 'none',    label: 'None'    },
                        { value: 'console', label: 'Console' },
                        { value: 'status',  label: 'Status'  },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => { setBacklogGrouping(opt.value); setCollapsedGroups(new Set()); setBacklogPage(1); }}
                          className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-[2px] border transition-colors ${backlogGrouping === opt.value ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink hover:border-ink-3'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {(backlogSearch || backlogStatusFilter !== 'all') && (
                      <button onClick={() => { setBacklogSearch(''); setBacklogStatusFilter('all'); setBacklogPage(1); }} className="md:ml-auto text-[9px] text-ink-3 hover:text-accent uppercase tracking-wider transition-colors self-start md:self-auto">Clear ×</button>
                    )}
                  </div>

                  {/* Stats line */}
                  <p className="text-[10px] text-ink-3 px-1 mb-1">
                    <span className="text-ink-2">{BACKLOG.total.toLocaleString()}</span> games in backlog
                    {backlogLoadingMore && <Loader2 size={11} className="text-ink-3 animate-spin inline-block ml-1.5" />}
                    <span className="mx-2 text-line">|</span>
                    <span className="text-ink">{BACKLOG.games.filter(g => g.achievementsTotal > 0).length}</span> with achievements
                    <span className="mx-1.5 text-line">·</span>
                    <span className="text-ink-3">{BACKLOG.games.filter(g => g.achievementsTotal === 0).length}</span> without
                    <span className="mx-2 text-line">|</span>
                    <span className="text-accent">{BACKLOG.games.filter(g => g.inProgress && g.numAwarded !== g.achievementsTotal).length}</span> in progress
                    <span className="mx-1.5 text-line">·</span>
                    <span className="text-gold">{BACKLOG.games.filter(g => g.achievementsTotal > 0 && g.numAwarded === g.achievementsTotal).length}</span> mastered
                    {filtered.length !== BACKLOG.games.length && <><span className="mx-2 text-line">|</span><span className="text-ink-2">{filtered.length}</span> shown</>}
                  </p>

                  {/* Table */}
                  <div className="border border-line rounded-[2px] overflow-hidden">
                    {/* Header */}
                    <div className={`grid gap-2 px-3 py-2 bg-head border-b border-line items-center ${colClass}`}>
                      {headers.map((h, i) => (
                        <span key={i} className={`text-[9px] font-bold uppercase tracking-[0.1em] text-ink-2 whitespace-nowrap ${h.cls}`}>{h.label}</span>
                      ))}
                    </div>

                    {filtered.length === 0 ? (
                      <div className="text-center py-6 text-ink-3 text-[11px]">No games match the current filters.</div>
                    ) : backlogGrouping === 'none' ? (
                      pagedFiltered.map(game => GameRow({ game }))
                    ) : (
                      pagedGroups.map(group => {
                        const isOpen = collapsedGroups.has(group.key)
                          ? !group.defaultOpen  // toggled: flip from default
                          : (group.defaultOpen ?? true); // not toggled: use default
                        return (
                          <div key={group.key}>
                            <button onClick={() => toggleGroup(group.key)} className="w-full flex items-center gap-2 px-3 py-[6px] bg-box border-b border-line hover:bg-box-hi transition-colors group outline-none">
                              <div className="w-2 h-2 rounded-[1px] shrink-0" style={{background: group.dot}}></div>
                              <span className="text-[10px] text-white font-semibold flex-1 text-left">{group.label}</span>
                              <span className="text-[9px] text-ink-3">{group.games.length} game{group.games.length !== 1 ? 's' : ''}</span>
                              <ChevronDown size={11} className={`text-ink-3 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && group.games.map(game => GameRow({ game }))}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Pagination footer */}
                  <div className="flex items-center justify-between mt-3 px-1 gap-2 pb-16 md:pb-0">
                    <button
                      onClick={() => setBacklogPage(p => Math.max(1, p - 1))}
                      disabled={backlogPage <= 1 || totalPages <= 1}
                      className="text-[9px] font-semibold uppercase tracking-wider px-2.5 py-[4px] rounded-[2px] border border-line-2 bg-well text-ink-2 hover:text-ink hover:border-ink-3 transition-colors disabled:opacity-30 disabled:pointer-events-none">
                      ← Prev
                    </button>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <span className="text-[9px] text-ink-3">
                        Page <span className="text-ink">{Math.min(backlogPage, totalPages)}</span> of <span className="text-ink">{totalPages}</span>
                      </span>
                      <span className="text-line text-[10px] select-none hidden md:inline">|</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-ink-3 uppercase tracking-wider">Per page</span>
                        {[50, 100, 150].map(n => (
                          <button key={n} onClick={() => { setBacklogPageSize(n); setBacklogPage(1); }}
                            className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-[2px] border transition-colors ${backlogPageSize === n ? 'bg-box text-ink border-line' : 'bg-well text-ink-3 border-line-2 hover:text-ink hover:border-ink-3'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setBacklogPage(p => Math.min(totalPages, p + 1))}
                      disabled={backlogPage >= totalPages || totalPages <= 1}
                      className="text-[9px] font-semibold uppercase tracking-wider px-2.5 py-[4px] rounded-[2px] border border-line-2 bg-well text-ink-2 hover:text-ink hover:border-ink-3 transition-colors disabled:opacity-30 disabled:pointer-events-none">
                      Next →
                    </button>
                  </div>
                </>
              );
            })()}</>
          ) : (
            false
              ? <>{[...Array(5)].map((_, i) => <GameCardSkeleton key={i} />)}</>
              : <>
              {/* Filter bar — only for Completion Progress */}
              {activeTab === 'progress' && (
                <>
                  <div className="flex md:hidden items-center gap-2 pb-2 mb-3 border-b border-line">
                    <span className="sec-mark" />
                    <span className="sec-t">Completion Progress</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className="text-[9px] text-ink-3 uppercase tracking-wider shrink-0">View</span>
                    {[
                      { value: 'all',        label: 'All'          },
                      { value: 'nearly',     label: 'Nearly there' },
                      { value: 'inprogress', label: 'In progress'  },
                      { value: 'abandoned',  label: 'Abandoned'    },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setProgressFilter(opt.value)}
                        className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-[2px] border transition-colors ${
                          progressFilter === opt.value
                            ? 'bg-accent text-well border-accent'
                            : 'bg-well text-ink-2 border-line-2 hover:text-ink hover:border-ink-3'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {progressFilter === 'all' ? (
                      <>
                        <span className="text-[9px] text-ink-3 uppercase tracking-wider">Filter</span>
                        <button
                          onClick={() => setShowMastered(v => !v)}
                          className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-[2px] border transition-colors ${
                            showMastered
                              ? 'bg-gold text-well border-gold'
                              : 'bg-well text-ink-2 border-line-2 hover:text-ink hover:border-ink-3'
                          }`}
                        >
                          Mastered
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-ink-3 leading-snug">
                        {progressFilter === 'nearly'
                          ? '75%+ done · fewest achievements left first'
                          : progressFilter === 'inprogress'
                          ? 'Active in the last 30 days · most recent first'
                          : 'Started, unfinished, quiet for 30+ days'}
                      </span>
                    )}
                    <span className="ml-auto text-[9px] text-ink-3 shrink-0">{displayedGames.length} games</span>
                  </div>
                  <div className="relative mb-4">
                    <input
                      type="text"
                      value={progressSearch}
                      onChange={e => setProgressSearch(e.target.value)}
                      placeholder="Search games…"
                      className="w-full bg-well border border-line-2 rounded-[2px] px-2.5 py-1.5 text-[11px] text-ink placeholder-ink-3 outline-none focus:border-ink-3"
                    />
                    {progressSearch && <button onClick={() => setProgressSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink text-[10px]">×</button>}
                  </div>
                </>
              )}
              {activeTab === 'recent' && (
                <div className="flex md:hidden items-center gap-2 pb-2 mb-3 border-b border-line">
                  <span className="sec-mark" />
                  <span className="sec-t">Recently Played</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 -mt-1">
                <span className="text-[9px] uppercase tracking-[0.07em] text-ink-3">View</span>
                <ViewToggle view={gameView} onChange={setGameView} />
              </div>
              {(() => {
                const list = activeTab === 'recent' ? displayedGames.slice(0, showAllRecent ? displayedGames.length : (gameView === 'tiles' ? 8 : 5)) : displayedGames;
                return gameView === 'tiles'
                  ? <div className="gtiles">{list.map(game => <GameTile key={game.id} game={game} />)}</div>
                  : list.map(game => <GameCard key={game.id} game={game} />);
              })()}
              {activeTab === 'recent' && displayedGames.length > (gameView === 'tiles' ? 8 : 5) && (
                <button
                  onClick={() => setShowAllRecent(v => !v)}
                  className="w-full py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3 hover:text-ink border border-line hover:border-ink-3 rounded-[2px] bg-box transition-colors"
                >
                  {showAllRecent ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )}
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
          style={{ bottom: showFloatingTabs ? 'calc(120px + env(safe-area-inset-bottom, 0px))' : '3.5rem' }}
          title="Scroll to top"
        >
          <ChevronDown size={16} className="rotate-180" />
        </button>
      )}

      {/* Floating tab pill — mobile only, appears after scrolling 150px */}
      {(showFloatingTabs || pillLeaving) && (
        <div
          className="md:hidden fixed left-1/2 z-[210]"
          style={{
            bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
            transform: 'translateX(-50%)',
            animation: pillLeaving
              ? 'slideDownPill 0.21s ease forwards'
              : 'slideUpPill 0.18s ease forwards',
          }}
        >
          <div className="flex items-center gap-0.5 px-1.5 py-1.5 bg-bar border border-line rounded-[4px] shadow-xl">
            {[
              { id: 'recent',   Icon: Clock,     label: 'Recent',   color: 'var(--accent)' },
              { id: 'progress', Icon: BarChart2,  label: 'Progress', color: 'var(--accent)' },
              ...(seriesData.some(s => s.showProgress) ? [{ id: 'series', Icon: Layers, label: 'Series', color: 'var(--gold)' }] : []),
              ...(!isVisitorMode ? [
                { id: 'activity', Icon: Activity, label: 'Activity', color: 'var(--accent)' },
                { id: 'backlog',  Icon: Star,     label: 'Backlog',  color: 'var(--accent)' },
                { id: 'social',   Icon: Users,    label: 'Social',   color: 'var(--aqua)' },
              ] : []),
            ].map(({ id, Icon, label, color }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-[3px] transition-colors ${activeTab === id ? 'bg-box' : 'hover:bg-box/50'}`}
                style={{ color: activeTab === id ? color : 'var(--ink-3)' }}
              >
                <Icon size={13} />
                <span className="text-[7px] font-bold uppercase tracking-wider leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>
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

        @keyframes slideUpPill {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideDownPill {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to   { opacity: 0; transform: translateX(-50%) translateY(12px); }
        }

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

        /* Watchlist responsive grid */
        .wl-row-full    { grid-template-columns: 28px 1fr 90px 50px 80px; }
        .wl-row-noconsole { grid-template-columns: 28px 1fr 50px 80px; }
        @media (max-width: 639px) {
          .wl-row-full      { grid-template-columns: 28px 1fr 70px 65px; }
          .wl-row-noconsole { grid-template-columns: 28px 1fr 65px; }
          .wl-hide-mobile   { display: none !important; }
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
