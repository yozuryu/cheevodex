import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Users, Loader2, RefreshCw, RotateCcw, AlertCircle, ArrowLeftRight, ChevronDown, Flame, Feather, Trophy, Crown, AlertTriangle, X } from 'lucide-react';
import { MEDIA_URL, TILDE_TAG_COLORS } from '../profile/utils/constants.js';
import { getMediaUrl, parseTitle } from '../profile/utils/helpers.js';
import {
  getCredentials, clearCredentials,
  fetchSocial, getSocialData, fetchFriendsActivity, allFriendsCached, getUserCompletionProgress,
  staleFriendActivity, clearAllFriendActivity,
  getSocialProfileMap, fetchAndCacheSocialProfiles,
  getSocialProfilesSyncTs, setSocialProfilesSyncTs, PROFILE_SYNC_TTL,
} from '../profile/utils/ra-api.js';
import { Topbar, Footer } from '../assets/ui.js';
import { useSheet } from '../assets/sheet.js';
import { DayHead, UnlockRow, FriendsSkeleton } from '../assets/activity-ui.js';
import { fmtClock } from '../assets/time.js';

// ── Social: your friends' unlocks and the people you follow / who follow you ──────────────────────
// Its own page (was the profile's Social tab and the Activity tab's Friends view). Phone: the friend
// strip and one of Unlocks / Following / Followers (chips, ?view=). Desktop: the unlocks beside a rail
// with the people. Compare opens over the page and loads both players' progress (two calls).

function handleAuthError() {
  clearCredentials();
  window.location.replace('../');
}

const toLocalDay = (str) => {
  if (!str) return '';
  const s = str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
const RunStrip = ({ href, gameId, gameTitle, icon, consoleName, achs, mode, runTitle }) => {
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
          {gameId && <span className="dex-no shrink-0">No.{gameId}</span>}
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
      <RunStrip href={`../game/?id=${session.gameId}`} gameId={session.gameId} gameTitle={session.gameTitle} icon={session.gameIcon}
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
      <RunStrip href={`../game/?id=${run.gameId}&compare=${user}`} gameId={run.gameId} gameTitle={run.gameTitle} icon={getMediaUrl(run.gameIcon)}
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
    else s.sort((a, b) => parseTitle(a.title).baseTitle.localeCompare(parseTitle(b.title).baseTitle));  // by the shown title, not RA's ~tags~
    return s;
  }, [sharedGames, sortBy]);

  const meAhead = sharedGames.filter(g => g.myPct > g.theirPct).length;
  const tied    = sharedGames.filter(g => g.myPct === g.theirPct).length;
  const behind  = sharedGames.filter(g => g.myPct < g.theirPct).length;

  const ModeIcon = ({ hc, size = 8 }) => hc
    ? <Flame size={size} className="shrink-0" style={{ color: 'var(--gold)' }} />
    : <Feather size={size} className="shrink-0" style={{ color: 'var(--ink-2)' }} />;

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
            <div className="text-[11px] text-ink-3">Comparing with</div>
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
              <div className="sledger dledger mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 20 }}>
                {[['Shared', sharedGames.length, 'var(--ink)'], ['You ahead', meAhead, 'var(--accent)'], ['Tied', tied, 'var(--ink-2)'], [`${otherUser} ahead`, behind, 'var(--aqua)']].map(([k, v, c]) => (
                  <div key={k} className="dl-row"><span className="dl-k truncate" style={{ minWidth: 0 }}>{k}</span><span className="dl-dots" /><span className="dl-v" style={{ color: c }}>{v}</span></div>
                ))}
              </div>

              {sharedGames.length > 0 && (
                <div className="frow mb-3">
                  <span className="text-[11px] text-ink-3 shrink-0">Sort</span>
                  {[['diff', 'Biggest gap'], ['mine', 'Mine'], ['theirs', 'Theirs'], ['az', 'A–Z']].map(([v, label]) => (
                    <button type="button" key={v} onClick={() => setSortBy(v)} aria-pressed={sortBy === v} className={`fchip ${sortBy === v ? 'on' : ''}`}>{label}</button>
                  ))}
                </div>
              )}

              {sharedGames.length === 0 ? (
                <div className="text-center text-[12px] text-ink-2 py-10">No shared games found.</div>
              ) : (
                <div className="flex flex-col gap-[2px]">
                  {sorted.map(g => {
                    const { baseTitle, subsetName, isSubset, tags } = parseTitle(g.title);
                    const side = (pct, hc, kind, base, lead, label) => {
                      const mastered = kind === 'mastered' || kind === 'completed';
                      const c = mastered ? 'var(--gold)' : base;
                      return (
                        <span className={`cmpx ${lead ? 'lead' : ''}`} style={{ '--lc': base }} title={`${label}: ${Math.round(pct)}%${mastered ? ' · mastered' : ''}`}>
                          <span className={`dring ${mastered ? 'full' : ''}`} style={{ '--p': pct, '--c': c, '--s': '24px', '--w': '3.5px' }} />
                          <span className="cmpx-v">
                            <b style={{ color: lead || mastered ? c : 'var(--ink-2)' }}>{Math.round(pct)}%</b>
                            <ModeIcon hc={hc} size={10} />
                          </span>
                        </span>
                      );
                    };
                    return (
                      <div key={g.gameId} className="cmpr">
                        <a href={`../game/?id=${g.gameId}&compare=${encodeURIComponent(otherUser)}`} className="cmpr-g">
                          <img src={getMediaUrl(g.imageIcon)} alt="" loading="lazy" onError={e => { e.currentTarget.style.opacity = '0.3'; }} />
                          <span className="min-w-0 flex flex-col gap-[2px]">
                            <span className="cmpr-t"><span className="truncate">{baseTitle}</span>{isSubset && <span className="subset-tag">Subset</span>}{!isSubset && renderTildeTags(tags)}</span>
                            {isSubset && <span className="text-[11px] text-gold-dim truncate">{subsetName}</span>}
                            <span className="cmpr-s"><span className="dex-no">No.{g.gameId}</span><span className="truncate">{g.consoleName}</span></span>
                          </span>
                        </a>
                        <div className="cmpr-p">
                          {side(g.myPct, g.myHC, g.highestAwardKind, 'var(--accent)', g.myPct > g.theirPct, 'You')}
                          {side(g.theirPct, g.theirHC, g.them.highestAwardKind, 'var(--aqua)', g.theirPct > g.myPct, otherUser)}
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
              <div className="text-[10px] font-medium text-ink bg-inset border border-line rounded-[2px] px-1.5 py-[3px] whitespace-nowrap shadow-lg">
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
                  <span className="text-[10px] text-accent truncate min-w-0">{baseTitle}</span>
                  <span className="text-ink-4 mx-0.5 shrink-0">·</span>
                  <span className="text-[10px] text-ink-3 shrink-0">{timeAgo(lastPlayed.lastPlayedTs)}</span>
                </div>
                {(isSubset || tags.length > 0) && (
                  <div className="flex items-center gap-1 mt-[1px]">
                    {isSubset && <><span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>{subsetName && <span className="text-[10px] text-gold-dim shrink-0">{subsetName}</span>}</>}
                    {tags.length > 0 && renderTildeTags(tags)}
                  </div>
                )}
              </a>
              {hasRichPresence && (
                <span className="text-[10px] text-ink-3 truncate">{richPresence}</span>
              )}
            </div>
          );
        }
        if (rawLastPlayed?.lastPlayedTs) {
          return (
            <span className="text-[10px] text-ink-3 mt-[2px]">Last active {timeAgo(rawLastPlayed.lastPlayedTs)}</span>
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
    <button type="button" onClick={() => onCompare(user.user)} className="fchip shrink-0" style={{ height: 26, padding: '0 9px' }}>
      <ArrowLeftRight size={12} /> Compare
    </button>
  </div>
  );
};

// subTab / hideTabs: on phones the page's own chips (Unlocks · Following · Followers) pick the list
const SocialTab = ({ socialData, socialError, onRetry, onCompare, profileMap = new Map(), subTab: subTabProp, hideTabs = false }) => {
  const [sortBy, setSortBy] = useState('az');
  const [ownTab, setSubTab] = useState('following');
  const subTab = subTabProp ?? ownTab;

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
        <div className="frow">
          {!hideTabs && subTabs.map(({ id, label }) => (
            <button type="button" key={id} onClick={() => setSubTab(id)} aria-pressed={subTab === id} className={`fchip ${subTab === id ? 'on' : ''}`}>{label}</button>
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
      <div className="flex items-center gap-x-1.5 gap-y-2 flex-wrap">
        {!hideTabs && subTabs.map(({ id, label, count }) => (
          <button type="button" key={id} onClick={() => setSubTab(id)} aria-pressed={subTab === id} className={`fchip ${subTab === id ? 'on' : ''}`}>
            {label}<span className="n num">{count}</span>
          </button>
        ))}
        {/* Sort is one unit: on the right, or on its own line when the row is too narrow for it */}
        <span className={`flex items-center gap-1.5 ${hideTabs ? '' : 'ml-auto'}`}>
          <span className="text-[11px] text-ink-3">Sort</span>
          {[['az', 'A–Z'], ['points', 'Points']].map(([v, label]) => (
            <button type="button" key={v} onClick={() => setSortBy(v)} aria-pressed={sortBy === v} className={`fchip ${sortBy === v ? 'on' : ''}`}>{label}</button>
          ))}
        </span>
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

// ── The friends' unlocks: who's been active (tap one to narrow), then days → posts ──────────────────
const FriendsFeed = ({ friendsActivity, status, onRetry, failedFriends, profileMap }) => {
  const [visibleSessionCount, setVisibleSessionCount] = useState(100);
  // Each friend's unlocks in one game, split where more than an hour passes between two: a run
  const runs = useMemo(() => {
    const out = [];
    Object.entries(friendsActivity).forEach(([username, achs]) => {
      const byGame = {};
      achs.forEach(a => { (byGame[a.gameId] ??= { gameId: a.gameId, gameTitle: a.gameTitle, gameIcon: a.gameIcon, consoleName: a.consoleName, achs: [] }).achs.push(a); });
      Object.values(byGame).forEach(g => {
        const sorted = [...g.achs].sort((a, b) => a.date.localeCompare(b.date));
        let start = 0;
        for (let i = 1; i <= sorted.length; i++) {
          if (i === sorted.length || new Date(sorted[i].date) - new Date(sorted[i - 1].date) > 3600000) {
            const slice = sorted.slice(start, i);
            out.push({ username, gameId: g.gameId, gameTitle: g.gameTitle, gameIcon: g.gameIcon, consoleName: g.consoleName,
              achievements: [...slice].reverse(), latestDate: slice[slice.length - 1].date });
            start = i;
          }
        }
      });
    });
    return out.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [friendsActivity]);

  const [friendSel, setFriendSel] = useState(null);
  const party = useMemo(() => {
    const m = new Map();
    runs.forEach(run => {
      const f = m.get(run.username) ?? { username: run.username, n: 0, last: run.latestDate };
      f.n += run.achievements.length;
      if (run.latestDate > f.last) f.last = run.latestDate;
      m.set(run.username, f);
    });
    return [...m.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [runs]);
  const shownRuns = useMemo(() => runs.filter(r => !friendSel || r.username === friendSel), [runs, friendSel]);
  const days = useMemo(() => {
    const byDay = new Map();
    shownRuns.slice(0, visibleSessionCount).forEach(run => {
      const day = toLocalDay(run.latestDate);
      if (!byDay.has(day)) byDay.set(day, []);
      const posts = byDay.get(day);
      const last = posts[posts.length - 1];
      if (last && last.username === run.username) last.runs.push(run);
      else posts.push({ username: run.username, runs: [run] });
    });
    return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [shownRuns, visibleSessionCount]);
  const userPic = u => profileMap.get(u)?.userPic ? getMediaUrl(profileMap.get(u).userPic) : `${MEDIA_URL}/UserPic/${u}.png`;

  // One unlock row: badge, name in gold when hardcore, type mark, time, points and RetroRatio
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
  const runTitle = gameTitle => ({ p: parseTitle(gameTitle) });
  const any = Object.keys(friendsActivity).length > 0;

  return (
    <div className="flex flex-col gap-4 tl-tabs">
      {status === 'error' && (
        <div className="flex items-center justify-between gap-3 bg-box border border-line rounded-[3px] px-3 py-2.5">
          <span className="flex items-center gap-2 text-[12px] text-ink-2"><AlertCircle size={14} className="text-hc" /> Friends activity didn't load.</span>
          <button type="button" onClick={onRetry} className="fchip">Try again</button>
        </div>
      )}
      {status === 'done' && !any && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 border border-line rounded-[3px] bg-box">
          <Users size={22} className="text-ink-3" />
          <div className="text-[12px] text-ink-3">You're not following anyone yet</div>
        </div>
      )}
      {(status === 'idle' || status === 'loading') && !any && <FriendsSkeleton />}
      {any && (<>
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
        {friendSel && (
          <div className="flex items-center gap-2 -mt-1 anim-fade">
            <span className="text-[12px] text-ink-2 truncate">{friendSel}'s unlocks</span>
            <a href={`../profile/?u=${friendSel}`} className="ml-auto text-[11.5px] text-accent hover:text-ink shrink-0">Profile ›</a>
          </div>
        )}
        {days.length === 0 ? (
          <div className="text-ink-2 text-[11px] py-4 italic text-center">No unlocks from friends in the last 30 days.</div>
        ) : (
          <div key={friendSel ?? 'all'} className="flex flex-col gap-3">
            {days.map(([day, posts]) => {
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
            {shownRuns.length > visibleSessionCount && (
              <button type="button" onClick={() => setVisibleSessionCount(c => c + 100)} className="smore">Show more days</button>
            )}
          </div>
        )}
      </>)}
    </div>
  );
};

// Sync state beside a heading: progress while loading, else the sync time and the controls
const SyncBar = ({ busy, progress, ts, children }) => (
  <div className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-3 min-w-0">
    {busy ? (
      <span className="flex items-center gap-1.5 text-accent">
        <Loader2 size={12} className="animate-spin" />
        {progress ? <span className="num">{progress.done}/{progress.total}</span> : 'Loading'}
      </span>
    ) : (<>
      {ts && <span className="truncate mr-1">Synced {timeAgo(ts)}</span>}
      {children}
    </>)}
  </div>
);

const Heading = ({ title, icon, children }) => (
  <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-3 min-h-[30px]">
    <span className="sec-mark" />
    <span className="sec-t flex items-center gap-2 min-w-0">{icon}<span className="truncate">{title}</span></span>
    {children}
  </div>
);

const MD = '(min-width: 768px)';
const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia(MD).matches);
  useEffect(() => {
    const m = window.matchMedia(MD), on = e => setWide(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
};

const VIEWS = ['unlocks', 'following', 'followers'];

function SocialApp() {
  const creds = getCredentials();
  const wide = useWide();
  const [view, setViewState] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return VIEWS.includes(v) ? v : 'unlocks';
  });
  const setView = v => {
    setViewState(v);
    const url = new URL(window.location);
    if (v === 'unlocks') url.searchParams.delete('view'); else url.searchParams.set('view', v);
    window.history.replaceState({}, '', url);
  };

  // People: following / followers (cached a day), their profiles (cached an hour) for pictures and last played
  const [socialData, setSocialData] = useState(null);
  const [socialError, setSocialError] = useState(false);
  const [socialTs, setSocialTs] = useState(null);
  const [socialRefreshing, setSocialRefreshing] = useState(false);
  const [profileMap, setProfileMap] = useState(new Map());
  const [profilesProgress, setProfilesProgress] = useState(null);
  const profilesFetchingRef = useRef(false);

  const startProfilesFetch = async (data, { force = false } = {}) => {
    if (profilesFetchingRef.current) return;
    const allUsers = [...new Set([...(data.following?.results || []), ...(data.followers?.results || [])].map(u => u.user))];
    if (!allUsers.length) return;
    if (!force) {
      const lastSynced = await getSocialProfilesSyncTs(creds.username);
      if (lastSynced && Date.now() - lastSynced < PROFILE_SYNC_TTL) return;
    }
    profilesFetchingRef.current = true;
    setProfilesProgress({ done: 0, total: allUsers.length });
    fetchAndCacheSocialProfiles(creds.username, creds.apiKey, allUsers, {
      onProfile: (user, record) => {
        setProfileMap(prev => new Map(prev).set(user, record));
        setProfilesProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
      },
    }).then(() => setSocialProfilesSyncTs(creds.username))
      .finally(() => { profilesFetchingRef.current = false; setProfilesProgress(null); });
  };
  const applySocial = (data, ts, opts) => {
    setSocialData(data);
    setSocialTs(ts);
    const allUsers = [...new Set([...(data.following?.results || []), ...(data.followers?.results || [])].map(u => u.user))];
    if (allUsers.length) getSocialProfileMap(allUsers).then(m => setProfileMap(prev => prev.size ? prev : m));
    startProfilesFetch(data, opts);
  };
  const refreshSocial = async () => {
    setSocialRefreshing(true);
    try {
      const data = await fetchSocial(creds.username, creds.apiKey, true);
      const rec = await getSocialData(creds.username);
      applySocial(data, rec?.ts ?? Date.now(), { force: true });
    } catch (err) {
      if (err.message === 'AUTH_ERROR') handleAuthError();
    } finally {
      setSocialRefreshing(false);
    }
  };

  useEffect(() => {
    if (!creds) { handleAuthError(); return; }
    if (socialData !== null || socialError) return;
    (async () => {
      const SOCIAL_TTL = 24 * 60 * 60 * 1000;
      const cached = await getSocialData(creds.username);
      if (cached) {
        applySocial({ following: cached.following, followers: cached.followers }, cached.ts);
        if (Date.now() - cached.ts < SOCIAL_TTL) return;
      }
      setSocialRefreshing(true);
      fetchSocial(creds.username, creds.apiKey, true)
        .then(data => { applySocial(data, Date.now()); setSocialError(false); })
        .catch(err => {
          if (err.message === 'AUTH_ERROR') handleAuthError();
          else if (!cached) setSocialError(true);
        })
        .finally(() => setSocialRefreshing(false));
    })();
  }, [socialError]);

  // Friends' unlocks (last 30 days, one friend at a time, cached per friend), once the following list is in
  const [status, setStatus] = useState('idle');   // 'idle' | 'loading' | 'updating' | 'done' | 'error'
  const [friendsActivity, setFriendsActivity] = useState({});
  const [fetchProgress, setFetchProgress] = useState(null);
  const [failedFriends, setFailedFriends] = useState([]);
  const [activityTs, setActivityTs] = useState(null);
  const fetchingRef = useRef(false);
  useEffect(() => {
    if (!creds || !socialData || (status !== 'idle' && status !== 'updating') || fetchingRef.current) return;
    const { username: u, apiKey: k } = creds;
    fetchingRef.current = true;
    (async () => {
      try {
        const followingList = socialData.following?.results ?? [];
        if (followingList.length === 0) { setStatus('done'); return; }
        const cached = await allFriendsCached(followingList);
        setStatus(cached ? 'updating' : 'loading');
        await fetchFriendsActivity(u, k, followingList, {
          onProgress: (done, total) => setFetchProgress({ done, total }),
          onUser: (friendUser, achievements) => setFriendsActivity(prev => ({ ...prev, [friendUser]: achievements })),
          onError: friendUser => setFailedFriends(prev => [...prev, friendUser]),
        });
        setStatus('done');
        setActivityTs(Date.now());
      } catch (e) {
        if (e.message === 'AUTH_ERROR') { handleAuthError(); return; }
        setStatus('error');
      } finally {
        fetchingRef.current = false;
      }
    })();
  }, [socialData, status]);
  const refreshFriends = async () => {
    const list = socialData?.following?.results ?? [];
    await Promise.all(list.map(({ user }) => staleFriendActivity(user)));
    setFailedFriends([]); setFetchProgress(null); setStatus('updating');
  };
  const resetFriends = async () => {
    await clearAllFriendActivity();
    setFriendsActivity({}); setFetchProgress(null); setFailedFriends([]); setActivityTs(null); setStatus('idle');
  };

  // Compare: both players' progress, fetched when it opens
  const [compare, setCompare] = useState(null);   // { user, mine, theirs, loading, error }
  const openCompare = async (other) => {
    setCompare({ user: other, mine: null, theirs: null, loading: true, error: false });
    try {
      const [mine, theirs] = await Promise.all([
        getUserCompletionProgress(creds.username, creds.apiKey),
        getUserCompletionProgress(creds.username, creds.apiKey, { u: other }),
      ]);
      setCompare(c => c && c.user === other ? { ...c, mine, theirs, loading: false } : c);
    } catch (err) {
      if (err.message === 'AUTH_ERROR') { handleAuthError(); return; }
      setCompare(c => c && c.user === other ? { ...c, loading: false, error: true } : c);
    }
  };

  if (!creds) return null;
  const feedBusy = status === 'loading' || status === 'updating';
  const feedSync = (
    <SyncBar busy={feedBusy} progress={fetchProgress} ts={activityTs}>
      {status === 'done' && <>
        <button type="button" onClick={refreshFriends} className="fchip" title="Fetch new unlocks" aria-label="Refresh friends activity"><RefreshCw size={12} /></button>
        <button type="button" onClick={resetFriends} className="fchip" title="Clear the saved friends activity and fetch it all again" aria-label="Reset friends activity"><RotateCcw size={12} /></button>
      </>}
    </SyncBar>
  );
  const peopleSync = (
    <SyncBar busy={socialRefreshing || !!profilesProgress} progress={profilesProgress} ts={socialTs}>
      <button type="button" onClick={refreshSocial} className="fchip" title="Fetch who you follow and who follows you" aria-label="Refresh people"><RefreshCw size={12} /></button>
    </SyncBar>
  );
  const feed = <FriendsFeed friendsActivity={friendsActivity} status={status} onRetry={() => setStatus('idle')} failedFriends={failedFriends} profileMap={profileMap} />;
  const people = (props = {}) => <SocialTab socialData={socialData} socialError={socialError} onRetry={() => setSocialError(false)} onCompare={openCompare} profileMap={profileMap} {...props} />;
  const counts = { following: socialData?.following?.total, followers: socialData?.followers?.total };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <Topbar crumbs={[{ label: 'Cheevodex', href: '../profile/' }, { label: 'Social' }]} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 pt-8 pb-16 md:pt-5 md:pb-8">
        {wide ? (
          <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
            <section className="min-w-0">
              <Heading title="Friends' unlocks" icon={<Users size={15} className="text-accent shrink-0" />}>{feedSync}</Heading>
              {feed}
            </section>
            <aside className="min-w-0 sticky top-[42px]">
              <Heading title="People">{peopleSync}</Heading>
              {people()}
            </aside>
          </div>
        ) : (
          <>
            <Heading title="Social" icon={<Users size={15} className="text-accent shrink-0" />}>{view === 'unlocks' ? feedSync : peopleSync}</Heading>
            <div className="frow mb-4" role="group" aria-label="Show">
              {[['unlocks', 'Unlocks'], ['following', 'Following'], ['followers', 'Followers']].map(([v, label]) => (
                <button type="button" key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`fchip ${view === v ? 'on' : ''}`}>
                  {label}{counts[v] != null && <span className="n num">{counts[v]}</span>}
                </button>
              ))}
            </div>
            <div key={view} className="anim-fade">
              {view === 'unlocks' ? feed : people({ subTab: view, hideTabs: true })}
            </div>
          </>
        )}
      </main>
      <Footer label="Cheevodex · Social" raHref={`https://retroachievements.org/user/${creds.username}`} />
      {compare && (
        <CompareModal otherUser={compare.user} myGames={compare.mine} compareData={compare.theirs}
          loading={compare.loading} error={compare.error} onClose={() => setCompare(null)} profileMap={profileMap} />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<SocialApp />);
