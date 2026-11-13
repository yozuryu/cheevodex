import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Trophy, Crown, Medal, Lock, ExternalLink, AlertCircle, AlertTriangle, Flame, Feather, Gamepad2, Tag, Code, Calendar, BookOpen, MessageSquare, Loader, X, MapPin, ArrowUpCircle, Egg, Sparkles, ChevronDown, CheckCircle2, Compass, Info, ListOrdered, Hash, Users } from 'lucide-react';
import { MEDIA_URL, SITE_URL, TILDE_TAG_COLORS } from '../profile/utils/constants.js';
import { getMediaUrl, parseTitle, formatDate, formatTimeAgo } from '../profile/utils/helpers.js';
import { getCredentials, clearCredentials, getGameInfoAndUserProgress, getGameHashes, getGameProgression, getGameExtended, getActiveClaims, getGameRankAndScore, getComments, getGameLeaderboards, getUserGameLeaderboards, getLeaderboardEntries, getGame, fetchSocial, getSocialProfileMap } from '../profile/utils/ra-api.js';
import { Topbar, Footer } from '../assets/ui.js';
import { TabBar, useSwipeTabs } from '../assets/tabs.js';
import { ArtBg } from '../assets/sheet.js';
import { findPocSubset, buildPocCheckpoints, checkPocTargets } from './utils/poc.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  progression:   { label: 'Progression',  Icon: Trophy,        color: 'var(--gold)', tip: 'Required to complete the game' },
  win_condition: { label: 'Win Condition', Icon: Crown,         color: 'var(--hc)', tip: 'Triggers game completion'      },
  missable:      { label: 'Missable',      Icon: AlertTriangle, color: 'var(--warn)', tip: 'Can be permanently missed'     },
};

const AWARD_CONFIG = {
  'mastered':        { label: 'Mastered',    color: 'var(--gold)', Icon: Trophy },
  'completed':       { label: 'Completed',   color: 'var(--gold)', Icon: Trophy },
  'beaten-hardcore': { label: 'Beaten',      color: 'var(--silver)', Icon: Medal  },
  'beaten-softcore': { label: 'Beaten (SC)', color: 'var(--ink-2)', Icon: Medal  },
};

// Same rarity ladder as the profile Stats tab's RARITY_BANDS — loot-tier colours,
// kept in sync so one concept reads the same on both pages. See the comment there.
const DIFFICULTY_BANDS = [
  { key: 'common',    label: 'Common',     min: 0.50, color: 'var(--ink-2)' },
  { key: 'uncommon',  label: 'Uncommon',   min: 0.25, color: 'var(--accent)' },
  { key: 'rare',      label: 'Rare',       min: 0.10, color: 'var(--rare)' },
  { key: 'veryrare',  label: 'Very rare',  min: 0.05, color: 'var(--very-rare)' },
  { key: 'ultrarare', label: 'Ultra rare', min: 0,    color: 'var(--ultra-rare)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function handleAuthError() {
  clearCredentials();
  window.location.replace('../');
}

function fmtPlaytime(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Achievement row ───────────────────────────────────────────────────────────

function AchievementRow({ ach, totalPlayersCasual, totalPlayersHardcore, extAch, friendAch, friendUser }) {
  const unlocked    = !!ach.dateEarned;
  const hardcore    = !!ach.dateEarnedHardcore;
  const typeConf    = ach.type ? TYPE_CONFIG[ach.type] : null;
  const ratio       = ach.trueRatio && ach.points ? ach.trueRatio / ach.points : null;
  const casualPct   = totalPlayersCasual   > 1 ? Math.min(100, (ach.numAwarded         / totalPlayersCasual)   * 100).toFixed(1) : null;
  const hardcorePct = totalPlayersHardcore > 1 ? Math.min(100, (ach.numAwardedHardcore / totalPlayersHardcore) * 100).toFixed(1) : null;

  return (
    <div className={`flex items-center gap-3 p-2 rounded-[2px] border border-transparent border-l-[3px] transition-colors ${
      unlocked
        ? hardcore
          ? 'border-l-gold bg-box-hi hover:bg-box-hover'
          : 'border-l-ink-2 bg-box-hi hover:bg-box-hover'
        : 'border-l-line-2 bg-box opacity-60'
    }`}>

      {/* Badge */}
      <a href={`../achievement/?id=${ach.id}`}
        className="relative shrink-0 w-10 h-10 rounded-[2px] border border-well overflow-hidden bg-black hover:scale-105 transition-transform block">
        <img
          src={`${MEDIA_URL}/Badge/${ach.badgeName || '00001'}.png`}
          alt={ach.title}
          className={`w-full h-full object-cover ${!unlocked ? 'grayscale brightness-40' : ''}`}
        />
        {!unlocked && <Lock size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-ink/50" />}
      </a>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <a href={`../achievement/?id=${ach.id}`}
            className={`text-[12px] font-medium tracking-wide leading-tight transition-colors ${unlocked ? 'text-gold hover:text-gold-hi' : 'text-ink-2 hover:text-ink'}`}>
            {ach.title}
          </a>
          <span className="text-[10px] font-bold text-gold num bg-well border border-line-2 px-1.5 py-[1px] rounded-sm shrink-0">{ach.points} pts</span>
          {ratio > 1 && (
            <span className="text-[10px] shrink-0"
              style={{ color: ratio >= 30 ? 'var(--hc)' : ratio >= 20 ? 'var(--gold)' : ratio >= 10 ? 'var(--accent)' : 'var(--ink-2)' }}>
              ×{ratio.toFixed(1)}
            </span>
          )}
          {typeConf && (
            <span className="pop-wrap shrink-0">
              <typeConf.Icon size={11} style={{ color: typeConf.color }} strokeWidth={2} />
              <span className="pop-box">
                <div className="pop-name" style={{ color: typeConf.color }}>{typeConf.label}</div>
                <div className="pop-sub">{typeConf.tip}</div>
              </span>
            </span>
          )}
        </div>

        <p className="text-[10px] text-ink-2 leading-snug mb-1">{ach.description}</p>
        {extAch?.author && (
          <p className="text-[10px] text-ink-3 mb-1">by {extAch.author}{extAch.dateCreated ? ` · added ${formatDate(extAch.dateCreated)}` : ''}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <div className="relative h-1.5 bg-well rounded-full overflow-hidden w-full max-w-[180px]">
              {casualPct !== null && <div className="absolute top-0 left-0 h-full bg-ink-3" style={{ width: `${casualPct}%` }} />}
              {hardcorePct !== null && <div className="absolute top-0 left-0 h-full bg-gold" style={{ width: `${hardcorePct}%` }} />}
            </div>
            <div className="flex gap-3 text-[10px] font-medium w-full max-w-[180px]">
              {hardcorePct !== null && <span className="flex items-center gap-0.5 text-gold"><Flame size={8} />{hardcorePct}%</span>}
              {casualPct   !== null && <span className="flex items-center gap-0.5 text-ink-3"><Feather size={8} />{casualPct}%</span>}
            </div>
          </div>
          {unlocked && (
            <p className="text-[10px] text-accent shrink-0">Unlocked: {formatDate(ach.dateEarned)}</p>
          )}
        </div>
      </div>

      {/* Friend comparison column */}
      {friendUser !== undefined && (
        <>
          <div className="w-[3px] self-stretch rounded-full shrink-0" style={{
            background: friendUser === null ? 'var(--line)'
              : friendAch?.dateEarnedHardcore ? 'var(--gold)'
              : friendAch?.dateEarned         ? 'var(--ink-2)'
              : 'var(--line-2)'
          }} />
          <div className="w-[44px] shrink-0 flex items-center justify-center">
            {friendUser === null ? (
              <Loader size={10} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
            ) : (
              <img
                src={`${MEDIA_URL}/Badge/${ach.badgeName || '00001'}.png`}
                alt={ach.title}
                className={`w-7 h-7 rounded-[2px] border border-well object-cover ${friendAch?.dateEarned ? '' : 'grayscale brightness-40'}`}
              />
            )}
          </div>
        </>
      )}

    </div>
  );
}

// ── Professor Oak Challenge rows ────────────────────────────────────────────────

function getPocHint(name, reference, version) {
  const ref = reference?.[name];
  if (!ref) return null;
  if (ref.evolvesFrom) return { icon: 'evolve', text: `Evolves from ${ref.evolvesFrom} — ${ref.evolveMethod}` };
  const locs = ref.locations?.[version];
  if (locs && locs.length) return { icon: 'location', text: locs.slice(0, 3).join('; ') };
  if (ref.breeding) return { icon: 'breed', text: ref.breeding };
  if (ref.legendary || ref.mythical) return { icon: 'legendary', text: 'Legendary encounter — check the guide for details' };
  return null;
}

const POC_HINT_STYLE = {
  evolve:    { Icon: ArrowUpCircle, color: 'var(--ink-2)' },
  location:  { Icon: MapPin,        color: 'var(--accent)' },
  breed:     { Icon: Egg,           color: 'var(--warn)' },
  legendary: { Icon: Sparkles,      color: 'var(--gold)' },
};

function PocHintLine({ icon, text }) {
  const { Icon, color } = POC_HINT_STYLE[icon] || POC_HINT_STYLE.location;
  return (
    <p className="flex items-start gap-1.5 text-[10px] text-ink-2 leading-snug">
      <Icon size={10} className="shrink-0 mt-[1px]" style={{ color }} />
      <span>{text}</span>
    </p>
  );
}

function PocEntryRow({ entry, reference, version }) {
  const unlocked = !!entry.ach.dateEarned;
  const displayName = entry.names.join(' / ');
  const structuredHints = entry.isChoice
    ? entry.names.map(n => ({ name: n, hint: getPocHint(n, reference, version) })).filter(x => x.hint)
    : [{ name: entry.names[0], hint: getPocHint(entry.names[0], reference, version) }].filter(x => x.hint);

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2 ${unlocked ? 'bg-box-hi' : ''}`}>
      <a href={`../achievement/?id=${entry.ach.id}`}
        className="relative shrink-0 w-8 h-8 rounded-[2px] border border-well overflow-hidden bg-black hover:scale-105 transition-transform block">
        <img
          src={`${MEDIA_URL}/Badge/${entry.ach.badgeName || '00001'}.png`}
          alt={displayName}
          className={`w-full h-full object-cover ${!unlocked ? 'grayscale brightness-40' : ''}`}
        />
      </a>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className={`text-[11px] font-medium ${unlocked ? 'text-gold' : 'text-ink'}`}>{displayName}</span>
          {unlocked && <CheckCircle2 size={11} className="shrink-0" style={{ color: 'var(--gold)' }} />}
        </div>
        {!unlocked && (
          structuredHints.length > 0 ? (
            <div className="flex flex-col gap-1 mt-0.5">
              {structuredHints.map(({ name, hint }) => (
                <PocHintLine key={name} icon={hint.icon} text={entry.isChoice ? `${name}: ${hint.text}` : hint.text} />
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-ink-3 italic mt-0.5">{entry.ach.description}</p>
          )
        )}
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────

function GameApp() {
  const params          = new URLSearchParams(window.location.search);
  const gameId          = params.get('id');
  const compareUsername = params.get('compare') || null;

  const [game, setGame]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [tab, setTab]           = useState(() => {
    const t = params.get('tab');
    return ['achievements', 'details', 'leaderboards', 'community', 'hashes', 'poc'].includes(t) ? t : 'achievements';
  });
  const [filter, setFilter]     = useState('all');          // all | unlocked | locked
  const [typeFilter, setTypeFilter] = useState('all');      // all | progression | win_condition | missable
  const [sort, setSort]         = useState('order');        // order | points | date
  const [hashes, setHashes]     = useState(null);
  const [loadingHashes, setLoadingHashes] = useState(false);
  const [gameProgression, setGameProgression] = useState(null);
  const [gameExtended, setGameExtended]       = useState(null);
  const [activeClaims, setActiveClaims]         = useState([]);
  const [loadingInfoExtra, setLoadingInfoExtra] = useState(false);
  const [communityMasters, setCommunityMasters] = useState(null);
  const [communityComments, setCommunityComments] = useState(null);
  const [commentsTotal, setCommentsTotal]       = useState(0);
  const [commentsOffset, setCommentsOffset]     = useState(0);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [leaderboards, setLeaderboards]         = useState(null);
  const [topScorers, setTopScorers]             = useState(null);
  const [userLbMap, setUserLbMap]               = useState({});
  const [boardEntries, setBoardEntries]         = useState({});
  const [expandedBoardId, setExpandedBoardId]   = useState(null);
  const [loadingLeaderboards, setLoadingLeaderboards] = useState(false);
  const [loadingBoardId, setLoadingBoardId]     = useState(null);
  const [parentGame, setParentGame]             = useState(null);
  const [followingList, setFollowingList]         = useState(null);
  const [loadingFollowing, setLoadingFollowing]   = useState(false);
  const [socialProfileMap, setSocialProfileMap]   = useState(new Map());
  const [selectedFriend, setSelectedFriend]       = useState(null);
  const [friendGameData, setFriendGameData]       = useState(null);
  const [loadingFriendData, setLoadingFriendData] = useState(false);
  const [showFriendPicker, setShowFriendPicker]   = useState(false);
  const [pocReference, setPocReference]             = useState(null);
  const [expandedCheckpoint, setExpandedCheckpoint] = useState(null);

  const creds = getCredentials();
  const pocSubset = findPocSubset(gameId);

  useEffect(() => {
    if (!creds) { handleAuthError(); return; }
    if (!gameId) { setError('No game ID provided.'); setLoading(false); return; }

    Promise.all([
      getGameInfoAndUserProgress(creds.username, creds.apiKey, { u: creds.username, g: gameId }),
      getGameExtended(creds.username, creds.apiKey, { i: gameId }),
      getActiveClaims(creds.username, creds.apiKey),
    ])
      .then(([data, ext, claims]) => {
        if (!data) { setError('Game not found.'); return; }
        setGame(data);
        setGameExtended(ext);
        setActiveClaims(claims.filter(c => String(c.gameId) === String(gameId)));
        document.title = `Cheevodex · ${data.title}`;
        if (data.parentGameId) {
          getGame(creds.username, creds.apiKey, { i: data.parentGameId })
            .then(pg => setParentGame(pg))
            .catch(() => {});
        }
      })
      .catch(err => {
        if (err.message === 'AUTH_ERROR') handleAuthError();
        else setError('Failed to load game data.');
      })
      .finally(() => setLoading(false));
  }, [gameId]);

  useEffect(() => {
    if (tab !== 'hashes' || hashes !== null || loadingHashes || !gameId || !creds) return;
    setLoadingHashes(true);
    getGameHashes(creds.username, creds.apiKey, { i: gameId })
      .then(data => setHashes(data))
      .catch(err => { if (err.message === 'AUTH_ERROR') handleAuthError(); else setHashes([]); })
      .finally(() => setLoadingHashes(false));
  }, [tab, gameId]);

  useEffect(() => {
    if (tab !== 'community' || communityMasters !== null || loadingCommunity || !gameId || !creds) return;
    setLoadingCommunity(true);
    Promise.all([
      getGameRankAndScore(creds.username, creds.apiKey, { g: gameId, t: 1 }),
      getComments(creds.username, creds.apiKey, { i: gameId, t: 1, c: 25 }),
    ])
      .then(([masters, comments]) => {
        setCommunityMasters(masters);
        setCommunityComments(comments.results);
        setCommentsTotal(comments.total);
        setCommentsOffset(25);
      })
      .catch(err => { if (err.message === 'AUTH_ERROR') handleAuthError(); })
      .finally(() => setLoadingCommunity(false));
  }, [tab, gameId]);

  async function loadMoreComments() {
    if (!creds || loadingMoreComments) return;
    setLoadingMoreComments(true);
    try {
      const data = await getComments(creds.username, creds.apiKey, { i: gameId, t: 1, c: 25, o: commentsOffset });
      setCommunityComments(prev => [...prev, ...data.results]);
      setCommentsOffset(prev => prev + 25);
    } catch (err) {
      if (err.message === 'AUTH_ERROR') handleAuthError();
    } finally {
      setLoadingMoreComments(false);
    }
  }

  useEffect(() => {
    if (tab !== 'leaderboards' || leaderboards !== null || loadingLeaderboards || !gameId || !creds) return;
    setLoadingLeaderboards(true);
    Promise.all([
      getGameLeaderboards(creds.username, creds.apiKey, { i: gameId }),
      getUserGameLeaderboards(creds.username, creds.apiKey, { i: gameId, u: creds.username }).catch(() => ({ results: [] })),
      getGameRankAndScore(creds.username, creds.apiKey, { g: gameId, t: 0 }),
    ])
      .then(([lbs, userLbs, scorers]) => {
        setLeaderboards(lbs.results);
        setTopScorers(scorers);
        const map = {};
        for (const lb of userLbs.results) {
          if (lb.userEntry) map[lb.id] = lb.userEntry;
        }
        setUserLbMap(map);
      })
      .catch(err => { if (err.message === 'AUTH_ERROR') handleAuthError(); })
      .finally(() => setLoadingLeaderboards(false));
  }, [tab, gameId]);

  async function toggleBoard(boardId) {
    if (expandedBoardId === boardId) { setExpandedBoardId(null); return; }
    setExpandedBoardId(boardId);
    if (boardEntries[boardId] !== undefined) return;
    setLoadingBoardId(boardId);
    try {
      const data = await getLeaderboardEntries(creds.username, creds.apiKey, { i: boardId, c: 25 });
      setBoardEntries(prev => ({ ...prev, [boardId]: data.results }));
    } catch (err) {
      if (err.message === 'AUTH_ERROR') handleAuthError();
      else setBoardEntries(prev => ({ ...prev, [boardId]: [] }));
    } finally {
      setLoadingBoardId(null);
    }
  }

  async function loadFollowing() {
    if (followingList !== null || loadingFollowing) return;
    setLoadingFollowing(true);
    try {
      const social = await fetchSocial(creds.username, creds.apiKey);
      const list = social.following?.results || [];
      setFollowingList(list);
      if (list.length) getSocialProfileMap(list.map(f => f.user)).then(setSocialProfileMap);
    } catch (err) {
      if (err?.message === 'AUTH_ERROR') handleAuthError();
      else setFollowingList([]);
    } finally {
      setLoadingFollowing(false);
    }
  }

  async function selectFriendForCompare(f) {
    setSelectedFriend(f);
    setShowFriendPicker(false);
    setFriendGameData(null);
    setLoadingFriendData(true);
    const u = new URL(window.location.href);
    u.searchParams.set('compare', f.user);
    history.replaceState(null, '', u.toString());
    try {
      const key = `ra_fg_${f.user}_${gameId}`;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < 5 * 60 * 1000) { setFriendGameData(data); return; }
        }
      } catch {}
      const data = await getGameInfoAndUserProgress(creds.username, creds.apiKey, { u: f.user, g: gameId });
      try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
      setFriendGameData(data);
    } catch (err) {
      if (err?.message === 'AUTH_ERROR') handleAuthError();
    } finally {
      setLoadingFriendData(false);
    }
  }

  useEffect(() => {
    if (!compareUsername || !creds) return;
    getSocialProfileMap([compareUsername]).then(m => setSocialProfileMap(m));
    selectFriendForCompare({ user: compareUsername });
  }, []);

  useEffect(() => {
    if (tab !== 'details' || gameProgression !== null || loadingInfoExtra || !gameId || !creds) return;
    setLoadingInfoExtra(true);
    getGameProgression(creds.username, creds.apiKey, { i: gameId })
      .then(prog => setGameProgression(prog))
      .catch(err => { if (err.message === 'AUTH_ERROR') handleAuthError(); })
      .finally(() => setLoadingInfoExtra(false));
  }, [tab, gameId]);

  useEffect(() => {
    if (tab !== 'poc' || !pocSubset || pocReference !== null) return;
    fetch('./data/poc-pokemon.json')
      .then(r => r.json())
      .then(setPocReference)
      .catch(() => setPocReference({}));
  }, [tab, pocSubset, pocReference]);

  function switchTab(id) {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    history.replaceState(null, '', url.toString());
  }

  // Phone swipe between tabs, in the same order as the TabBar
  const tabContentRef = useRef(null);
  const tabIds = ['achievements', 'details', 'leaderboards', 'community', 'hashes', ...(pocSubset ? ['poc'] : [])];
  useSwipeTabs(tabContentRef, tabIds, tab, switchTab, !loading && !error && !!game);

  useEffect(() => {
    if (expandedCheckpoint === null && currentCheckpointKey) setExpandedCheckpoint(currentCheckpointKey);
  }, [currentCheckpointKey]);

  const parsed   = useMemo(() => game ? parseTitle(game.title) : null, [game]);
  const achList  = useMemo(() => game ? Object.values(game.achievements) : [], [game]);

  const pocCheckpoints = useMemo(
    () => {
      if (!game || !pocSubset) return [];
      const cps = buildPocCheckpoints(achList, pocSubset);
      // Debug mode: flag checkpoints whose species count doesn't match their target
      if (localStorage.getItem('raDebugMode') === 'true') {
        const issues = checkPocTargets(cps);
        if (issues.length) console.warn('[POC] checkpoint counts off target — an achievement is likely grouped wrong:', issues);
      }
      return cps;
    },
    [game, pocSubset, achList]
  );
  const currentCheckpointKey = useMemo(() => {
    const active = pocCheckpoints.find(cp => !cp.markerAch || !cp.markerAch.dateEarned);
    return active ? active.key : (pocCheckpoints[pocCheckpoints.length - 1]?.key ?? null);
  }, [pocCheckpoints]);

  const friendAchMap = useMemo(() => {
    if (!friendGameData?.achievements) return new Map();
    return new Map(Object.values(friendGameData.achievements).map(a => [a.id, a]));
  }, [friendGameData]);

  const filteredSorted = useMemo(() => {
    let list = achList;
    if (filter === 'unlocked') list = list.filter(a => !!a.dateEarned);
    if (filter === 'locked')   list = list.filter(a => !a.dateEarned);
    if (typeFilter === 'progression') list = list.filter(a => a.type === 'progression' || a.type === 'win_condition');
    else if (typeFilter !== 'all')   list = list.filter(a => a.type === typeFilter);
    return [...list].sort((a, b) => {
      if (sort === 'points') return b.points - a.points;
      if (sort === 'date') {
        if (a.dateEarned && b.dateEarned) return new Date(b.dateEarned) - new Date(a.dateEarned);
        if (a.dateEarned) return -1;
        if (b.dateEarned) return 1;
        return a.displayOrder - b.displayOrder;
      }
      return a.displayOrder - b.displayOrder;
    });
  }, [achList, filter, sort, typeFilter]);

  // ── Difficulty curve: the set bucketed by unlock rate, with your share filled in ──
  const difficulty = useMemo(() => {
    const players = game?.numDistinctPlayersCasual || 0;
    if (!players || !achList.length) return null;
    const bands = DIFFICULTY_BANDS.map(b => ({ ...b, total: 0, unlocked: 0 }));
    achList.forEach(a => {
      const rate = (a.numAwarded || 0) / players;
      const band = bands.find(b => rate >= b.min) || bands[bands.length - 1];
      band.total++;
      if (a.dateEarned) band.unlocked++;
    });
    if (bands.every(b => b.total === 0)) return null;
    return { bands, max: Math.max(1, ...bands.map(b => b.total)) };
  }, [achList, game]);

  const unlockedCount   = useMemo(() => achList.filter(a => !!a.dateEarned).length, [achList]);
  const totalPoints     = useMemo(() => achList.reduce((s, a) => s + a.points, 0), [achList]);
  const earnedPoints    = useMemo(() => achList.filter(a => !!a.dateEarned).reduce((s, a) => s + a.points, 0), [achList]);
  const completionPct   = achList.length > 0 ? (unlockedCount / achList.length) * 100 : 0;
  const award           = game?.highestAwardKind ? AWARD_CONFIG[game.highestAwardKind] : null;
  const playtime        = game ? fmtPlaytime(game.userTotalPlaytime) : null;

  const crumbs = [
    { label: 'Cheevodex', href: '../profile/' },
    ...(game?.consoleId
      ? [{ label: game.consoleName, href: `../console/?id=${game.consoleId}` }]
      : [{ label: null }]),
    { label: loading ? null : (parsed?.baseTitle || game?.title || null) },
  ];

  return (
    <div className="min-h-screen bg-page flex flex-col [overflow-x:clip]">
      <Topbar crumbs={crumbs} />

      {loading && (
        <div className="flex-1 px-4 md:px-8 pt-6 max-w-4xl mx-auto w-full">
          <div className="shimmer h-40 rounded-[3px] mb-4" />
          <div className="flex gap-3 mb-4">
            {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-14 flex-1 rounded-[3px]" />)}
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-3 py-3 border-b border-box">
              <div className="shimmer w-12 h-12 rounded-[3px] shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="shimmer h-3 w-40 rounded" />
                <div className="shimmer h-2.5 w-64 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-hc text-[12px]">
            <AlertCircle size={16} /> {error}
          </div>
        </div>
      )}

      {game && !loading && (
        <>
          {/* ── Hero ── */}
          <div className="phead">
            {/* Background: the game's art blurred (doc-012); plain charcoal if none loads */}
            {(() => {
              const isFallback = img => !img || img.includes('000002');
              const heroBg = (!isFallback(game.imageIngame) ? game.imageIngame : null)
                          || (!isFallback(game.imageTitle)  ? game.imageTitle  : null)
                          || parentGame?.imageIngame || parentGame?.imageTitle;
              return heroBg ? <ArtBg urls={[getMediaUrl(heroBg)]} variant="art-header" /> : null;
            })()}
            <div className="relative max-w-4xl mx-auto px-4 md:px-8 pt-8 pb-4 md:pt-5">
              <div className="flex gap-4 items-start">

                {/* Icon */}
                <div className={`phead-av game !w-16 !h-16 md:!w-20 md:!h-20 ${['mastered', 'completed'].includes(game.highestAwardKind) ? 'mastered' : game.highestAwardKind?.startsWith('beaten') ? 'beaten' : ''}`}>
                  <img src={getMediaUrl(game.imageIcon)} alt={game.title} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Dex number: the RA game ID, in the pixel face (doc-012) */}
                  <div className="dex-no lg art-shadow mb-1.5">Dex No.<b>{gameId}</b></div>
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <h1 className="text-[18px] md:text-[22px] font-semibold text-ink leading-tight art-shadow">
                      {parsed?.baseTitle || game.title}
                    </h1>
                    {parsed?.isSubset && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.07em] px-1.5 py-[2px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0 mt-1">
                        Subset
                      </span>
                    )}
                    {parsed?.tags?.map(tag => {
                      const tc = TILDE_TAG_COLORS[tag] || TILDE_TAG_COLORS['Prototype'];
                      return (
                        <span key={tag} className="shrink-0 mt-1" style={{
                          fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                          padding: '2px 6px', borderRadius: '2px',
                          border: `1px solid ${tc.border}`, background: tc.bg, color: tc.color,
                        }}>
                          {tag}
                        </span>
                      );
                    })}
                    {activeClaims.length > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.07em] px-1.5 py-[2px] rounded-[2px] border shrink-0 mt-1"
                        style={{ color: 'var(--gold)', borderColor: 'rgb(var(--c-gold) / 0.3)', background: 'rgb(var(--c-gold) / 0.1)' }}>
                        In Dev
                      </span>
                    )}
                    {award && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.07em] px-1.5 py-[2px] rounded-[2px] flex items-center gap-1 shrink-0 mt-1"
                        style={{ color: award.color, background: `color-mix(in srgb, ${award.color} 9.4%, transparent)`, border: `1px solid color-mix(in srgb, ${award.color} 26.7%, transparent)` }}
                      >
                        <award.Icon size={9} /> {award.label}
                      </span>
                    )}
                  </div>

                  {parsed?.isSubset && parsed?.subsetName && (
                    <div className="text-[11px] text-gold-dim mb-1">{parsed.subsetName}</div>
                  )}

                  {parsed?.isSubset && parentGame && (
                    <div className="flex items-center gap-1.5 mb-2 bg-black/40 backdrop-blur-sm rounded-[3px] px-1.5 py-[3px] w-fit">
                      <img src={getMediaUrl(parentGame.imageIcon)} alt={parentGame.title}
                        className="w-4 h-4 rounded-[2px] border border-well object-cover shrink-0 bg-black" />
                      <span className="text-[10px] text-ink-2">Subset of</span>
                      <a href={`?id=${game.parentGameId}`}
                        className="text-[10px] text-ink hover:text-ink transition-colors truncate max-w-[200px]">
                        {parseTitle(parentGame.title).baseTitle}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap text-[10px] mb-3">
                    <span className="flex items-center gap-1 text-accent"><Gamepad2 size={10} className="shrink-0" />{game.consoleName}</span>
                    <span className="text-ink-3 select-none">·</span>
                    <a href={`${SITE_URL}/game/${gameId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-ink-3 hover:text-accent transition-colors"><ExternalLink size={10} className="shrink-0" />RA</a>
                  </div>

                  {/* Mode: hardcore once any unlock was hardcore */}
                  {unlockedCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {game.numAwardedToUserHardcore > 0
                        ? <span className="text-[10px] font-bold uppercase tracking-[0.07em] px-1.5 py-[1px] rounded-[2px] border border-gold/40 text-gold bg-well/60 flex items-center gap-1"><Flame size={10} />Hardcore</span>
                        : <span className="text-[10px] font-bold uppercase tracking-[0.07em] px-1.5 py-[1px] rounded-[2px] border border-line-2 text-ink-2 bg-well/60 flex items-center gap-1"><Feather size={10} />Softcore</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Dex record (Cheevodex's own, CHV-040): completion ring, the numbers as index lines,
                 and the progression path as diamonds on a line ── */}
            {(() => {
              const done = completionPct >= 100;
              const color = done ? 'var(--gold)' : 'var(--accent)';
              const prog = achList.filter(a => a.type === 'progression' || a.type === 'win_condition');
              const progDone = prog.filter(a => !!a.dateEarned).length;
              const MAX = 20;
              let marks = [];
              if (prog.length > 0) {
                const n = prog.length;
                if (n <= MAX) marks = Array.from({ length: n }, (_, i) => (i < progDone ? 'on' : ''));
                else {
                  const per = Math.ceil(n / MAX), segs = Math.ceil(n / per);
                  marks = Array.from({ length: segs }, (_, i) => {
                    const size = Math.min(per, n - i * per), part = Math.max(0, Math.min(size, progDone - i * per)) / size;
                    return part >= 1 ? 'on' : part > 0 ? 'part' : '';
                  });
                }
              }
              const lit = marks.filter(m => m === 'on').length;
              const rows = [
                { k: 'Achievements', v: <>{unlockedCount}<em>/{achList.length}</em></>, c: 'var(--accent)' },
                { k: 'Points', v: <>{earnedPoints.toLocaleString()}<em>/{totalPoints.toLocaleString()}</em></>, c: 'var(--gold)' },
                playtime ? { k: 'Played', v: playtime } : { k: 'Players', v: game.numDistinctPlayersCasual.toLocaleString() },
              ];
              return (
                <div className="relative max-w-4xl mx-auto px-4 md:px-8 pb-4">
                  <div className="drec">
                    <div className="drec-top">
                      <div className={`dring ${done ? 'full' : ''}`} style={{ '--p': Math.min(100, completionPct), '--c': color, '--s': '68px', '--w': '6px' }}
                        role="img" aria-label={`${Math.floor(completionPct)}% complete`}>
                        <b style={{ fontSize: 20 }}>{Math.floor(completionPct)}<small>%</small></b>
                      </div>
                      <div className="dledger">
                        {rows.map(r => (
                          <div key={r.k} className="dl-row">
                            <span className="dl-k">{r.k}</span><span className="dl-dots" />
                            <span className="dl-v" style={r.c ? { color: r.c } : undefined}>{r.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {marks.length > 0 && (
                      <div className="dpath">
                        <span className="dpath-l"><Trophy size={12} className="text-gold" />Progression</span>
                        <span className="dpath-t" style={{ '--done': marks.length > 1 ? `calc((100% - 8px) * ${Math.max(0, lit - 1) / (marks.length - 1)})` : '0%' }}>
                          {marks.map((m, i) => <i key={i} className={m} />)}
                        </span>
                        <span className="dpath-n">{progDone}<span>/{prog.length}</span></span>
                      </div>
                    )}
                  </div>
                  {/* The dex's facts, like the summary box at the top of a guide entry: one line on phones, labelled from md */}
                  {(() => {
                    const rel = game.released ? (formatDate(game.released) && !formatDate(game.released).includes('Invalid') ? formatDate(game.released) : game.released) : null;
                    const facts = [game.developer, game.genre, rel, game.numDistinctPlayersCasual ? `${game.numDistinctPlayersCasual.toLocaleString()} players` : null].filter(Boolean);
                    return facts.length > 0 && <p className="md:hidden mt-2.5 px-0.5 text-[11.5px] text-ink-2 leading-snug art-shadow">{facts.join(' · ')}</p>;
                  })()}
                  <dl className="dsum hidden md:grid">
                    {[
                      ['Developer', game.developer],
                      ['Publisher', game.publisher],
                      ['Genre', game.genre],
                      ['Released', game.released ? (formatDate(game.released) && !formatDate(game.released).includes('Invalid') ? formatDate(game.released) : game.released) : null],
                      ['Players', game.numDistinctPlayersCasual ? game.numDistinctPlayersCasual.toLocaleString() : null],
                    ].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd title={v}>{v}</dd></div>)}
                  </dl>
                </div>
              );
            })()}
          </div>

          {/* ── Claims banner ── */}
          {activeClaims.length > 0 && (
            <div className="border-b border-line bg-gold/[0.06]">
              <div className="max-w-4xl mx-auto px-4 md:px-8 py-2 flex items-center gap-2.5">
                <AlertTriangle size={13} className="shrink-0" style={{ color: 'var(--gold)' }} />
                <span className="text-[11px] text-ink-2 leading-snug">
                  Achievement set actively claimed by{' '}
                  {activeClaims.map((c, i, arr) => (
                    <span key={c.user}>
                      <a href={`../profile/?u=${c.user}`}
                        className="transition-colors hover:text-gold-hi" style={{ color: 'var(--gold)' }}>{c.user}</a>
                      {i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                  {' '}— set may still be changing
                </span>
              </div>
            </div>
          )}

          {/* ── Tab bar (assets/tabs.js) ── */}
          <TabBar className="md:top-[26px] px-2 md:px-[max(1.375rem,calc((100%_-_56rem)/2_+_1.375rem))]" active={tab} onChange={switchTab} tabs={[
            { id: 'achievements', label: 'Achievements', count: achList.length, icon: <Trophy size={15} /> },
            { id: 'details',      label: 'Info',         icon: <Info size={15} /> },
            { id: 'leaderboards', label: 'Leaderboards', icon: <ListOrdered size={15} /> },
            { id: 'community',    label: 'Community',    icon: <MessageSquare size={15} /> },
            { id: 'hashes',       label: 'Hashes',       icon: <Hash size={15} /> },
            ...(pocSubset ? [{ id: 'poc', label: 'Professor Oak', icon: <Compass size={15} /> }] : []),
          ]} />

          <div ref={tabContentRef} className="flex-1 flex flex-col">
          {/* ── Achievements tab ── */}
          {tab === 'achievements' && (
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-4">
              {/* ── Difficulty curve ── */}
              {difficulty && (
                <div className="mb-3 bg-box border border-line rounded-[3px] p-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-ink-3">Difficulty curve</span>
                    <span className="text-[10px] text-ink-3 ml-auto">share of {game.numDistinctPlayersCasual.toLocaleString()} players who unlocked each</span>
                  </div>
                  {/* Columns are capped at 46px and centred rather than stretched across the
                      card — filling the width rendered them as 157×40px slabs with no readable
                      silhouette, and the silhouette is the point of a curve. `flex-1` with a
                      max-width keeps them from overflowing on narrow phones. */}
                  {/* items-start, not items-end: every plot is a fixed 80px, so aligning tops
                      aligns the baselines. With items-end a wrapped label ("Ultra rare") makes its
                      column taller and shunts that bar upward off the baseline. */}
                  <div className="flex items-start justify-center gap-2 sm:gap-4">
                    {difficulty.bands.map(b => (
                      <div key={b.key} className="flex-1 max-w-[46px] flex flex-col items-center gap-1 min-w-0">
                        <div className="w-full flex items-end" style={{ height: '80px' }}>
                          <div className="w-full flex flex-col justify-end rounded-t-[3px] overflow-hidden"
                            style={{ height: `${Math.max((b.total / difficulty.max) * 80, b.total ? 4 : 1)}px`, background: 'var(--track)' }}>
                            <div style={{ height: `${b.total ? (b.unlocked / b.total) * 100 : 0}%`, background: b.color }} />
                          </div>
                        </div>
                        <span className="text-[10px] tabular-nums leading-none" style={{ color: b.unlocked > 0 ? b.color : 'var(--ink-3)' }}>
                          {b.unlocked}<span className="text-ink-3">/{b.total}</span>
                        </span>
                        <span className="text-[7px] uppercase tracking-wider text-ink-3 text-center w-full" style={{ lineHeight: 1.15 }}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Controls (Savepoint's filter chips; .frow / .fchip / .fbar in assets/ui.css): status and type chips
                   with counts in one row, then the count, sort and compare */}
              <div className="flex flex-col mb-3 gap-2.5">
                <div className="frow" role="group" aria-label="Show">
                  {[
                    { value: 'all',      label: 'All',      n: achList.length },
                    { value: 'unlocked', label: 'Unlocked', n: unlockedCount, Icon: Trophy },
                    { value: 'locked',   label: 'Locked',   n: achList.length - unlockedCount, Icon: Lock },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setFilter(opt.value)} aria-pressed={filter === opt.value}
                      className={`fchip ${filter === opt.value ? 'on' : ''}`}>
                      {opt.Icon && <opt.Icon size={12} />}{opt.label}<span className="n num">{opt.n}</span>
                    </button>
                  ))}
                  <span className="fsep" />
                  {[
                    { value: 'progression', label: 'Progression', n: achList.filter(a => a.type === 'progression' || a.type === 'win_condition').length, Icon: Trophy, color: TYPE_CONFIG.progression.color },
                    { value: 'missable',    label: 'Missable',    n: achList.filter(a => a.type === 'missable').length, Icon: AlertTriangle, color: TYPE_CONFIG.missable.color },
                  ].filter(opt => opt.n > 0).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setTypeFilter(typeFilter === opt.value ? 'all' : opt.value)} aria-pressed={typeFilter === opt.value}
                      className={`fchip ${typeFilter === opt.value ? 'on' : ''}`}>
                      <opt.Icon size={12} style={{ color: opt.color }} />{opt.label}<span className="n num">{opt.n}</span>
                    </button>
                  ))}
                </div>
                <div className="fbar">
                  <span className="fmeta flex-1 min-w-0"><b className="num">{filteredSorted.length}</b> of {achList.length}</span>
                  <span className="fselect-w">
                    <select value={sort} onChange={e => setSort(e.target.value)} className="fselect" aria-label="Sort">
                      <option value="order">Default order</option>
                      <option value="points">Points</option>
                      <option value="date">Unlock date</option>
                    </select>
                  </span>
                {/* Compare with a friend */}
                <div className="relative shrink-0">
                  <button type="button"
                    onClick={() => { loadFollowing(); setShowFriendPicker(true); }}
                    className={`fchip !h-[34px] ${selectedFriend ? 'on' : ''}`}>
                    {loadingFollowing ? <Loader size={12} className="animate-spin" /> : <Users size={12} />}
                    {selectedFriend ? 'Change' : 'Compare'}
                    <ChevronDown size={12} />
                  </button>
                  {showFriendPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowFriendPicker(false)} />
                      <div className="absolute top-full right-0 z-50 mt-1 w-56 bg-bar border border-line rounded-[3px] shadow-2xl overflow-hidden">
                        {!followingList || followingList.length === 0 ? (
                          <div className="px-3 py-4 text-[10px] text-ink-3 text-center">
                            {loadingFollowing ? 'Loading…' : 'No following found.'}
                          </div>
                        ) : (
                          <div className="max-h-56 overflow-y-auto">
                            {followingList.map(f => (
                              <button key={f.user} type="button"
                                onClick={() => selectFriendForCompare(f)}
                                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-box transition-colors text-left">
                                <img src={(socialProfileMap.get(f.user)?.userPic || f.userPic) ? getMediaUrl(socialProfileMap.get(f.user)?.userPic || f.userPic) : `${MEDIA_URL}/UserPic/${f.user}.png`}
                                  alt={f.user}
                                  className="w-5 h-5 rounded-full border border-well shrink-0 object-cover bg-box"
                                  onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                                <span className="text-[11px] text-ink truncate">{f.user}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                </div>
              </div>

              {/* Selected friend banner */}
              {selectedFriend && (
                <div className="flex items-center gap-2.5 px-3 py-2 mb-2 bg-box-hi border border-line rounded-sm">
                  <img
                    src={(socialProfileMap.get(selectedFriend.user)?.userPic || selectedFriend.userPic) ? getMediaUrl(socialProfileMap.get(selectedFriend.user)?.userPic || selectedFriend.userPic) : `${MEDIA_URL}/UserPic/${selectedFriend.user}.png`}
                    alt={selectedFriend.user}
                    className="w-6 h-6 rounded-full border border-well shrink-0 object-cover bg-bar"
                    onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-ink-3">Comparing with</div>
                    <div className="text-[11px] font-semibold text-gold truncate">{selectedFriend.user}</div>
                    {!loadingFriendData && friendAchMap.size > 0 && (() => {
                      const total = achList.length;
                      const hc    = [...friendAchMap.values()].filter(a => a.dateEarnedHardcore).length;
                      const sc    = [...friendAchMap.values()].filter(a => a.dateEarned && !a.dateEarnedHardcore).length;
                      const hcPct = total > 0 ? (hc / total) * 100 : 0;
                      const scPct = total > 0 ? ((hc + sc) / total) * 100 : 0;
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 relative h-[3px] bg-bar rounded-full overflow-hidden">
                            <div className="absolute top-0 left-0 h-full rounded-full bg-ink-2" style={{ width: `${scPct}%` }} />
                            <div className="absolute top-0 left-0 h-full rounded-full bg-gold" style={{ width: `${hcPct}%` }} />
                          </div>
                          <span className="text-[10px] shrink-0 tabular-nums" style={{ color: hcPct > 0 ? 'var(--gold)' : 'var(--ink-2)' }}>
                            {(hcPct > 0 ? hcPct : scPct).toFixed(1)}%
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  {loadingFriendData && <Loader size={10} className="animate-spin shrink-0" style={{ color: 'var(--ink-3)' }} />}
                  <button type="button"
                    onClick={() => { setSelectedFriend(null); setFriendGameData(null); const u = new URL(window.location.href); u.searchParams.delete('compare'); history.replaceState(null, '', u.toString()); }}
                    className="text-ink-3 hover:text-ink transition-colors shrink-0">
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* List */}
              <div className="flex flex-col gap-1.5">
                {filteredSorted.length === 0 ? (
                  <div className="py-10 text-center text-[11px] text-ink-3">
                    {achList.length === 0 ? 'This game has no achievements yet.' : 'No achievements match this filter.'}
                  </div>
                ) : (() => {
                  const row = ach => (
                    <AchievementRow
                      key={ach.id}
                      ach={ach}
                      totalPlayersCasual={game.numDistinctPlayersCasual}
                      totalPlayersHardcore={game.numDistinctPlayersHardcore}
                      extAch={gameExtended?.achievements?.[ach.id]}
                      friendUser={selectedFriend ? selectedFriend.user : undefined}
                      friendAch={selectedFriend ? (loadingFriendData ? null : friendAchMap.get(ach.id)) : undefined}
                    />
                  );
                  // Default view reads like a guide: the progression path in set order, then the rest.
                  // Any filter, type or sort shows the plain list
                  const isProg = a => a.type === 'progression' || a.type === 'win_condition';
                  const prog = filteredSorted.filter(isProg);
                  const chaptered = filter === 'all' && typeFilter === 'all' && sort === 'order' && prog.length > 0 && prog.length < filteredSorted.length;
                  if (!chaptered) return filteredSorted.map(row);
                  const side = filteredSorted.filter(a => !isProg(a));
                  const chapter = (title, sub, list) => {
                    const done = list.filter(a => !!a.dateEarned).length;
                    const missable = list.filter(a => a.type === 'missable').length;
                    return (
                      <React.Fragment key={title}>
                        <div className="dchap">
                          <span className="dchap-t">{title}</span>
                          <span className="dchap-s">{sub}{missable > 0 && <> · <span className="text-warn">{missable} missable</span></>}</span>
                          <span className="dchap-n"><b>{done}</b>/{list.length}</span>
                        </div>
                        {list.map(row)}
                      </React.Fragment>
                    );
                  };
                  return [
                    chapter('Progression', 'needed to beat the game', prog),
                    chapter('Everything else', 'side content and extras', side),
                  ];
                })()}
              </div>

              {/* See also: related dexes (the parent game of a subset, the other Professor Oak subsets) */}
              {(() => {
                const related = [
                  ...(parsed?.isSubset && parentGame ? [{ id: game.parentGameId, title: parseTitle(parentGame.title).baseTitle, icon: parentGame.imageIcon, kind: 'Base game' }] : []),
                  ...(pocSubset?.siblings ?? []).map(sb => ({ id: sb.id, title: `Professor Oak Challenge (${sb.label})`, icon: null, kind: 'Related subset' })),
                ].filter(r => r.id);
                if (!related.length) return null;
                return (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3">
                      <span className="sec-mark" />
                      <span className="sec-t">See also</span>
                    </div>
                    <div className="seealso">
                      {related.map(r => (
                        <a key={r.id} href={`?id=${r.id}`}>
                          {r.icon ? <img src={getMediaUrl(r.icon)} alt="" /> : <span className="w-8 h-8 shrink-0 rounded-[2px] bg-well" />}
                          <span className="min-w-0 flex flex-col">
                            <span className="dex-no">Dex No.<b>{r.id}</b> · {r.kind}</span>
                            <span className="t">{r.title}</span>
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Details tab ── */}
          {tab === 'details' && (
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-4">

              {/* Media gallery */}
              {(game.imageBoxArt || game.imageTitle || game.imageIngame) && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-line">
                    <span className="sec-mark" />
                    <span className="sec-t">Media</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { src: game.imageBoxArt  && !game.imageBoxArt.includes('000002')  ? game.imageBoxArt  : parentGame?.imageBoxArt,  label: 'Box Art'      },
                      { src: game.imageTitle   && !game.imageTitle.includes('000002')   ? game.imageTitle   : parentGame?.imageTitle,   label: 'Title Screen' },
                      { src: game.imageIngame  && !game.imageIngame.includes('000002')  ? game.imageIngame  : parentGame?.imageIngame,  label: 'In-Game'      },
                    ].filter(m => m.src).map(m => (
                      <div key={m.label} className="flex flex-col gap-1">
                        <a href={getMediaUrl(m.src)} target="_blank" rel="noreferrer"
                          className="block rounded-[2px] border border-line overflow-hidden hover:border-ink-3 transition-colors bg-bar">
                          <img src={getMediaUrl(m.src)} alt={m.label} className="w-full object-cover" />
                        </a>
                        <span className="text-[10px] text-ink-3 uppercase tracking-wider text-center">{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time to Beat */}
              {loadingInfoExtra && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-line">
                    <span className="sec-mark" />
                    <span className="sec-t">Time to Beat</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="shimmer h-14 rounded-[2px]" />
                    ))}
                  </div>
                </div>
              )}
              {gameProgression && [
                { label: 'Beat',           value: gameProgression.medianTimeToBeat,          color: 'var(--accent)' },
                { label: 'Beat (Hardcore)', value: gameProgression.medianTimeToBeatHardcore,  color: 'var(--gold)' },
                { label: 'Complete',        value: gameProgression.medianTimeToComplete,       color: 'var(--accent)' },
                { label: 'Master',          value: gameProgression.medianTimeToMaster,         color: 'var(--gold)' },
              ].some(c => c.value) && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-line">
                    <span className="sec-mark" />
                    <span className="sec-t">Time to Beat</span>
                    <span className="text-[10px] text-ink-3 ml-1">median</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'Beat',           value: gameProgression.medianTimeToBeat,          color: 'var(--accent)' },
                      { label: 'Beat (Hardcore)', value: gameProgression.medianTimeToBeatHardcore,  color: 'var(--gold)' },
                      { label: 'Complete',        value: gameProgression.medianTimeToComplete,       color: 'var(--accent)' },
                      { label: 'Master',          value: gameProgression.medianTimeToMaster,         color: 'var(--gold)' },
                    ].filter(c => c.value).map(c => (
                      <div key={c.label} className="bg-box border border-line rounded-[2px] flex flex-col items-center py-2.5 px-2">
                        <span className="text-[14px] font-bold" style={{ color: c.color }}>{fmtPlaytime(c.value)}</span>
                        <span className="text-[10px] uppercase tracking-[0.07em] text-ink-3 mt-0.5">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="mb-5">
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-line">
                  <span className="sec-mark" />
                  <span className="sec-t">Info</span>
                </div>
                <div className="bg-box border border-line rounded-[2px] divide-y divide-line">
                  {[
                    { label: 'Console',    value: game.consoleName,   icon: <Gamepad2 size={11} /> },
                    { label: 'Developer',  value: game.developer,     icon: <Code     size={11} /> },
                    { label: 'Publisher',  value: game.publisher,     icon: <BookOpen size={11} /> },
                    { label: 'Genre',      value: game.genre,         icon: <Tag      size={11} /> },
                    { label: 'Released',   value: game.released,      icon: <Calendar size={11} /> },
                    gameExtended?.updated
                      ? { label: 'Updated', value: formatDate(gameExtended.updated), icon: <Calendar size={11} /> }
                      : null,
                  ].filter(Boolean).filter(r => r.value).map(r => (
                    <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-ink-3 shrink-0">{r.icon}</span>
                      <span className="text-[10px] uppercase tracking-wider text-ink-3 w-20 shrink-0">{r.label}</span>
                      <span className="text-[11px] text-ink break-words min-w-0">{r.value}</span>
                    </div>
                  ))}
                </div>

              </div>

              {/* Links */}
              {(game.guideUrl || game.forumTopicId) && (
                <div>
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-line">
                    <span className="sec-mark" />
                    <span className="sec-t">Links</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {game.guideUrl && (
                      <a href={game.guideUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-ink-2 hover:text-accent border border-line hover:border-accent bg-bar px-3 py-1.5 rounded-[2px] transition-colors">
                        <BookOpen size={12} /> Game Guide
                      </a>
                    )}
                    {game.forumTopicId && (
                      <a href={`${SITE_URL}/viewtopic.php?t=${game.forumTopicId}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-ink-2 hover:text-accent border border-line hover:border-accent bg-bar px-3 py-1.5 rounded-[2px] transition-colors">
                        <MessageSquare size={12} /> Forum Thread
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Leaderboards tab ── */}
          {tab === 'leaderboards' && (
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-4">

              {loadingLeaderboards && (
                <div className="flex items-center gap-2 py-8 justify-center text-ink-3 text-[11px]">
                  <Loader size={14} className="animate-spin" /> Loading leaderboards…
                </div>
              )}

              {leaderboards && leaderboards.length === 0 && (
                <div className="py-8 text-center text-[11px] text-ink-3">No leaderboards for this game.</div>
              )}

              {leaderboards && leaderboards.length > 0 && (
                <div className="flex flex-col md:flex-row gap-5 md:items-start">

                  {/* Top Scorers */}
                  {topScorers && topScorers.length > 0 && (
                    <div className="w-full md:w-[200px] md:shrink-0">
                      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-line">
                        <span className="sec-mark" />
                        <span className="sec-t">Top Scorers</span>
                      </div>
                      <div className="bg-box border border-line rounded-[2px] divide-y divide-line overflow-y-auto max-h-[220px]">
                        {topScorers.map((s, i) => (
                          <div key={s.ulid || s.user} className="flex items-center gap-3 px-3 py-2">
                            <span className="text-[10px] font-bold w-5 text-right shrink-0"
                              style={{ color: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--ink-2)' : i === 2 ? 'var(--bronze)' : 'var(--ink-3)' }}>
                              #{i + 1}
                            </span>
                            <img src={s.userPic ? getMediaUrl(s.userPic) : `${MEDIA_URL}/UserPic/${s.user}.png`} alt={s.user}
                              className="w-6 h-6 rounded-full border border-line bg-bar object-cover shrink-0" />
                            <a href={`../profile/?u=${s.user}`}
                              className="flex-1 text-[11px] font-medium transition-colors hover:text-ink truncate"
                              style={{ color: s.user === creds?.username ? 'var(--aqua)' : 'var(--ink)' }}>
                              {s.user}
                            </a>
                            <span className="text-[11px] font-bold text-gold shrink-0">{s.totalScore.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Board list */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-line">
                      <span className="sec-mark" />
                      <span className="sec-t">Boards</span>
                      <span className="text-[11px] text-ink-3">({leaderboards.length})</span>
                    </div>
                  <div className="flex flex-col gap-1.5">
                    {leaderboards.map(lb => {
                      const fmtColor = lb.format === 'SCORE' ? 'var(--gold)' : ['TIME', 'TIMESECS', 'MILLISECS'].includes(lb.format) ? 'var(--accent)' : 'var(--ink-2)';
                      const userEntry = userLbMap[lb.id];
                      const isExpanded = expandedBoardId === lb.id;
                      const entries = boardEntries[lb.id];
                      const isLoadingThis = loadingBoardId === lb.id;

                      return (
                        <div key={lb.id} className="bg-box border border-line rounded-[2px] overflow-hidden">
                          {/* Collapsed header — clickable */}
                          <button type="button" onClick={() => toggleBoard(lb.id)}
                            className="w-full text-left px-3 py-2.5 hover:bg-box-hi transition-colors">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-[12px] font-medium text-ink leading-snug">{lb.title}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-[2px] rounded-sm border"
                                  style={{ color: fmtColor, borderColor: `color-mix(in srgb, ${fmtColor} 25.1%, transparent)`, background: `color-mix(in srgb, ${fmtColor} 7.8%, transparent)` }}>
                                  {({ SCORE: 'Score', TIME: 'Time', TIMESECS: 'Time (s)', MILLISECS: 'Time (ms)', VALUE: 'Value' })[lb.format] ?? lb.format}
                                </span>
                                <span className="text-ink-3" style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>
                            {lb.description && (
                              <p className="text-[10px] text-ink-3 leading-snug mb-1.5">{lb.description}</p>
                            )}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              {userEntry ? (
                                <span className="text-[10px] px-1.5 py-[2px] rounded-sm border"
                                  style={{ color: 'var(--aqua)', borderColor: 'rgb(var(--c-aqua) / 0.3)', background: 'rgb(var(--c-aqua) / 0.08)' }}>
                                  Your Entry: #{userEntry.rank} · {userEntry.formattedScore}
                                </span>
                              ) : <span />}
                              {lb.topEntry && (
                                <span className="text-[10px] text-ink-3">
                                  👑 {lb.topEntry.user} · {lb.topEntry.formattedScore}
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Expanded entries */}
                          {isExpanded && (
                            <div className="border-t border-line">
                              {isLoadingThis && (
                                <div className="flex items-center gap-2 py-4 justify-center text-ink-3 text-[11px]">
                                  <Loader size={12} className="animate-spin" /> Loading…
                                </div>
                              )}
                              {entries && entries.length === 0 && (
                                <div className="py-4 text-center text-[11px] text-ink-3">No entries yet.</div>
                              )}
                              {entries && entries.length > 0 && (
                                <div className="divide-y divide-line">
                                  {entries.map(e => {
                                    const isMe = e.user === creds?.username;
                                    return (
                                      <div key={e.ulid || e.user}
                                        className={`flex items-center gap-3 px-3 py-2 border-l-[3px] ${isMe ? 'bg-box-hi' : ''}`}
                                        style={{ borderLeftColor: isMe ? 'var(--aqua)' : 'transparent' }}>
                                        <span className="text-[10px] font-bold w-5 text-right shrink-0 text-ink-3">#{e.rank}</span>
                                        <img src={e.userPic ? getMediaUrl(e.userPic) : `${MEDIA_URL}/UserPic/${e.user}.png`} alt={e.user}
                                          className="w-6 h-6 rounded-full border border-line bg-bar object-cover shrink-0" />
                                        <a href={`../profile/?u=${e.user}`}
                                          className="flex-1 text-[11px] transition-colors hover:text-ink"
                                          style={{ color: isMe ? 'var(--aqua)' : 'var(--ink)' }}>
                                          {e.user}
                                        </a>
                                        <span className="text-[11px] font-bold text-gold">{e.formattedScore}</span>
                                        <span className="text-[10px] text-ink-3 shrink-0">{formatDate(e.dateSubmitted)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Community tab ── */}
          {tab === 'community' && (
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-4">

              {/* Loading skeleton */}
              {loadingCommunity && (
                <div className="flex flex-col gap-4">
                  <div className="shimmer h-5 w-32 rounded mb-1" />
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="shimmer w-7 h-7 rounded-full shrink-0" />
                      <div className="flex flex-col gap-1.5 flex-1">
                        <div className="shimmer h-2.5 w-24 rounded" />
                        <div className="shimmer h-2 w-40 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingCommunity && communityMasters !== null && (
                <div className="flex flex-col md:flex-row gap-5 md:items-start">

                  {/* Recent Masters — fixed width, scrollable */}
                  {communityMasters.length > 0 && (
                    <div className="w-full md:w-[200px] md:shrink-0">
                      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-line">
                        <span className="sec-mark" />
                        <span className="sec-t">Recent Masters</span>
                      </div>
                      <div className="flex flex-col divide-y divide-box overflow-y-auto max-h-[220px]">
                        {communityMasters.map(m => (
                          <div key={m.ulid || m.user} className="flex items-center gap-2 py-2">
                            <a href={`../profile/?u=${m.user}`} className="shrink-0">
                              <img
                                src={m.userPic ? getMediaUrl(m.userPic) : `${MEDIA_URL}/UserPic/${m.user}.png`}
                                alt={m.user}
                                className="w-6 h-6 rounded-full border border-line bg-bar object-cover"
                              />
                            </a>
                            <div className="flex-1 min-w-0">
                              <a href={`../profile/?u=${m.user}`}
                                className="block text-[11px] font-medium text-gold hover:text-gold-hi transition-colors truncate">{m.user}</a>
                              <span className="text-[10px] text-ink-3">{formatTimeAgo(m.lastAward)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-line">
                      <span className="sec-mark" />
                      <span className="sec-t">Comments</span>
                      {commentsTotal > 0 && <span className="text-[11px] text-ink-3">({commentsTotal})</span>}
                    </div>

                    {communityComments.length === 0 && (
                      <div className="py-8 text-center text-[11px] text-ink-3">No comments yet.</div>
                    )}

                    {communityComments.length > 0 && (
                      <div className="flex flex-col">
                        {communityComments.map((c, i) => (
                          <div key={`${c.ulid || c.user}-${i}`} className="flex gap-3 py-2.5 border-b border-box">
                            <a href={`../profile/?u=${c.user}`} className="shrink-0 mt-0.5">
                              <img
                                src={c.userPic ? getMediaUrl(c.userPic) : `${MEDIA_URL}/UserPic/${c.user}.png`}
                                alt={c.user}
                                className="w-7 h-7 rounded-full border border-line bg-bar object-cover"
                              />
                            </a>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1">
                                <a href={`../profile/?u=${c.user}`}
                                  className="text-[11px] font-medium text-gold hover:text-gold-hi transition-colors shrink-0">{c.user}</a>
                                <span className="text-[10px] text-ink-3">{formatTimeAgo(c.submitted)}</span>
                              </div>
                              <p className="text-[11px] text-ink leading-snug break-words">{c.commentText}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Load more */}
                    {communityComments.length < commentsTotal && (
                      <div className="mt-4 flex justify-center">
                        <button type="button" onClick={loadMoreComments} disabled={loadingMoreComments}
                          className="flex items-center gap-2 text-[11px] text-accent border border-accent/40 bg-accent/10 hover:bg-accent/20 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50">
                          {loadingMoreComments
                            ? <><Loader size={12} className="animate-spin" /> Loading…</>
                            : <>Load more ({commentsTotal - communityComments.length} remaining)</>
                          }
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ── Hashes tab ── */}
          {tab === 'hashes' && (
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-4">
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-line">
                <span className="sec-mark" />
                <span className="sec-t">Supported ROMs</span>
                {hashes && <span className="text-[11px] text-ink-3">({hashes.length})</span>}
              </div>
              {loadingHashes && (
                <div className="flex items-center gap-2 py-8 justify-center text-ink-3 text-[11px]">
                  <Loader size={14} className="animate-spin" /> Loading hashes…
                </div>
              )}
              {hashes && hashes.length === 0 && (
                <div className="py-8 text-center text-[11px] text-ink-3">No hashes found for this game.</div>
              )}
              {hashes && hashes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {hashes.map((h, i) => (
                    <div key={i} className="bg-box border border-line rounded-[2px] px-3 py-2.5 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-ink leading-snug break-all">{h.name || '—'}</span>
                        {h.patchUrl && (
                          <a href={h.patchUrl} target="_blank" rel="noreferrer"
                            className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-accent border border-accent/40 bg-accent/10 px-2 py-[2px] rounded-sm hover:bg-accent/20 transition-colors flex items-center gap-1">
                            <ExternalLink size={9} /> Patch
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-[10px] text-ink-3 font-mono tracking-wider break-all">{h.md5}</code>
                        {h.labels.map(l => {
                          const lc = l.toLowerCase();
                          const color = lc === 'nointro' ? 'var(--accent)' : lc === 'rapatches' ? 'var(--gold)' : lc === 'unverified' ? 'var(--hc)' : 'var(--ink-2)';
                          return (
                            <span key={l} className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-sm border"
                              style={{ color, borderColor: `color-mix(in srgb, ${color} 25.1%, transparent)`, background: `color-mix(in srgb, ${color} 7.8%, transparent)` }}>{l}</span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Professor Oak Challenge tab ── */}
          {tab === 'poc' && pocSubset && (
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-4">

              {/* Sibling version links */}
              {pocSubset.siblings.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-ink-3">Also see</span>
                  {pocSubset.siblings.map(s => (
                    <a key={s.id} href={`?id=${s.id}&tab=poc`}
                      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-sm border bg-well text-ink-2 border-line-2 hover:text-ink hover:border-ink-3 transition-colors">
                      {s.label}
                    </a>
                  ))}
                </div>
              )}

              {/* Rules blurb */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 mb-4 bg-accent/[0.06] border border-line rounded-[2px]">
                <Compass size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-ink leading-snug">
                    Catch (and evolve to the required stage) every available Pokémon in this version before each checkpoint below — no trading in unavailable Pokémon, no version exclusives from the other game, no glitches.
                  </p>
                  {game.forumTopicId && (
                    <a href={`${SITE_URL}/viewtopic.php?t=${game.forumTopicId}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-accent hover:text-accent-hi transition-colors">
                      <MessageSquare size={10} /> Full rules on the forum thread
                    </a>
                  )}
                </div>
              </div>

              {(() => {
                const totalAch    = achList.length;
                const unlockedAch = unlockedCount;
                const pct = totalAch > 0 ? (unlockedAch / totalAch) * 100 : 0;
                const version = pocSubset.version;

                return (
                  <>
                    {/* Overall progress */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex-1 bg-well h-[5px] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--gold)' : 'var(--accent)' }} />
                      </div>
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: pct === 100 ? 'var(--gold)' : 'var(--accent)' }}>
                        {unlockedAch} / {totalAch}
                      </span>
                    </div>

                    {/* Checkpoint accordion */}
                    <div className="flex flex-col gap-1.5">
                      {pocCheckpoints.map(cp => {
                        const caught = cp.entries.filter(e => e.ach.dateEarned).length;
                        const cleared = !!cp.markerAch?.dateEarned;
                        const isOpen = expandedCheckpoint === cp.key;
                        return (
                          <div key={cp.key} className="bg-box border border-line rounded-[2px] overflow-hidden">
                            <button type="button" onClick={() => setExpandedCheckpoint(isOpen ? null : cp.key)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-box-hi transition-colors text-left">
                              {cleared
                                ? <CheckCircle2 size={14} className="shrink-0" style={{ color: 'var(--gold)' }} />
                                : <span className="shrink-0 w-[14px] h-[14px] rounded-full border border-ink-3" />}
                              <div className="flex-1 min-w-0">
                                <span className="text-[12px] font-medium text-ink">{cp.leader}</span>
                                {cp.title !== cp.leader && <span className="text-[10px] text-ink-3 ml-1.5">{cp.title}</span>}
                              </div>
                              {cp.entries.length > 0 && (
                                <span className="text-[10px] font-semibold shrink-0" style={{ color: caught === cp.entries.length ? 'var(--gold)' : 'var(--accent)' }}>
                                  {caught} / {cp.entries.length}
                                </span>
                              )}
                              <ChevronDown size={13} className="shrink-0 text-ink-3 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                            </button>

                            {isOpen && (
                              <div className="border-t border-line divide-y divide-box">
                                {cp.entries.map(entry => (
                                  <PocEntryRow key={entry.ach.id} entry={entry} reference={pocReference} version={version} />
                                ))}
                                {cp.entries.length === 0 && (
                                  <div className="py-3 text-center text-[10px] text-ink-3">No new species required for this checkpoint.</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          </div>
        </>
      )}

      <style>{`
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
        .pop-sub  { font-size: 10.5px; color: var(--ink-3); margin-bottom: 2px; }
      `}</style>

      <Footer
        label={game ? `${parsed?.baseTitle || game.title} · ${game.consoleName}` : 'Cheevodex · Game'}
        right={game
          ? React.createElement('a', {
              href: `${SITE_URL}/game/${gameId}`,
              target: '_blank',
              rel: 'noreferrer',
              className: 'text-[10px] text-ink-3 hover:text-accent transition-colors flex items-center gap-1',
            }, 'retroachievements.org ↗')
          : null
        }
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<GameApp />);
