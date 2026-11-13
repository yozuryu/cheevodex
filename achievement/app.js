import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Trophy, Crown, AlertTriangle, Lock, Flame, Feather, Gamepad2, Star, TrendingUp, User, Calendar, ExternalLink, Loader, Users, MessageSquare, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { MEDIA_URL, SITE_URL } from '../profile/utils/constants.js';
import { parseTitle, formatDate, formatTimeAgo, getMediaUrl } from '../profile/utils/helpers.js';
import { getCredentials, clearCredentials, getAchievementUnlocks, getGameInfoAndUserProgress, getComments } from '../profile/utils/ra-api.js';
import { Topbar, Footer } from '../assets/ui.js';
import { TabBar } from '../assets/tabs.js';
import { ArtBg } from '../assets/sheet.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  progression:   { label: 'Progression',  Icon: Trophy,        color: 'var(--gold)' },
  win_condition: { label: 'Win Condition', Icon: Crown,         color: 'var(--hc)' },
  missable:      { label: 'Missable',      Icon: AlertTriangle, color: 'var(--warn)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function handleAuthError() {
  clearCredentials();
  window.location.replace('../');
}

// ── Main app ──────────────────────────────────────────────────────────────────

function AchievementApp() {
  const params = new URLSearchParams(window.location.search);
  const achId  = params.get('id');

  const VALID_TABS = ['unlocks', 'comments', 'changelog'];
  const initialTab = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'unlocks';

  const [achData, setAchData]         = useState(null);
  const [userGame, setUserGame]       = useState(null);
  const [unlocks, setUnlocks]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState(null);

  const [activeTab, setActiveTab]           = useState(initialTab);

  function switchTab(id) {
    setActiveTab(id);
    const sp = new URLSearchParams(window.location.search);
    sp.set('tab', id);
    history.replaceState(null, '', '?' + sp.toString());
  }
  const [comments, setComments]             = useState(null);
  const [commentsTotal, setCommentsTotal]   = useState(0);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);

  const creds = getCredentials();

  useEffect(() => {
    if (!creds) { handleAuthError(); return; }
    if (!achId) { setError('No achievement ID provided.'); setLoading(false); return; }

    (async () => {
      try {
        const data = await getAchievementUnlocks(creds.username, creds.apiKey, { a: achId, c: 50 });
        setAchData(data);
        setUnlocks(data.unlocks);
        document.title = `Cheevodex · ${data.achievement?.title || 'Achievement'}`;

        if (data.game?.id) {
          const gameData = await getGameInfoAndUserProgress(
            creds.username, creds.apiKey,
            { u: creds.username, g: data.game.id }
          ).catch(() => null);
          setUserGame(gameData || false);
        } else {
          setUserGame(false);
        }
      } catch (e) {
        if (e.message === 'AUTH_ERROR') handleAuthError();
        else setError('Failed to load achievement.');
      } finally {
        setLoading(false);
      }
    })();
  }, [achId]);

  // ── Lazy-load comments when tab opens ────────────────────────────────────────
  useEffect(() => {
    if ((activeTab !== 'comments' && activeTab !== 'changelog') || comments !== null || !achId) return;
    if (!creds) { handleAuthError(); return; }
    getComments(creds.username, creds.apiKey, { i: achId, t: 2, c: 25 })
      .then(data => {
        setComments(data.results);
        setCommentsTotal(data.total);
        setCommentsOffset(25);
      })
      .catch(err => {
        if (err.message === 'AUTH_ERROR') handleAuthError();
        else setComments([]);
      });
  }, [activeTab, achId]);

  async function loadMoreUnlocks() {
    if (!creds || !achId || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await getAchievementUnlocks(creds.username, creds.apiKey,
        { a: achId, c: 50, o: unlocks.length });
      setUnlocks(prev => [...prev, ...more.unlocks]);
    } catch {}
    setLoadingMore(false);
  }

  async function loadMoreComments() {
    if (!creds || loadingMoreComments) return;
    setLoadingMoreComments(true);
    try {
      const data = await getComments(creds.username, creds.apiKey,
        { i: achId, t: 2, c: 25, o: commentsOffset });
      setComments(prev => [...prev, ...data.results]);
      setCommentsOffset(o => o + 25);
    } catch {}
    setLoadingMoreComments(false);
  }

  // Derived values
  const userAch = userGame
    ? (userGame.achievements[String(achId)] ||
       Object.values(userGame.achievements).find(a => String(a.id) === String(achId)) ||
       null)
    : null;

  const ach      = achData?.achievement;
  const typeConf = ach?.type ? TYPE_CONFIG[ach.type] : null;
  const ratio    = ach?.trueRatio && ach?.points ? ach.trueRatio / ach.points : null;
  const hcPct    = achData?.totalPlayers > 0
    ? Math.min(100, (achData.unlocksHardcoreCount / achData.totalPlayers) * 100).toFixed(1)
    : null;
  const anyPct   = achData?.totalPlayers > 0
    ? Math.min(100, (achData.unlocksCount / achData.totalPlayers) * 100).toFixed(1)
    : null;
  const hasMoreUnlocks  = achData && unlocks.length < achData.unlocksCount;
  const userComments    = comments ? comments.filter(c => c.user !== 'Server') : [];
  const changelogEntries = comments ? comments.filter(c => c.user === 'Server') : [];
  const gameId      = achData?.game?.id;
  const gameName    = achData?.game?.title ? parseTitle(achData.game.title).baseTitle : null;
  const consoleId   = achData?.console?.id   || achData?.achievement?.consoleId || null;
  const consoleName = achData?.console?.title || userGame?.consoleName || null;

  // Where this achievement sits in its set (display order), for "n of N" and previous / next
  const setOrder = userGame?.achievements
    ? Object.values(userGame.achievements).sort((a, b) => (a.displayOrder - b.displayOrder) || (a.id - b.id))
    : [];
  const setPos  = setOrder.findIndex(a => String(a.id) === String(achId));
  const prevAch = setPos > 0 ? setOrder[setPos - 1] : null;
  const nextAch = setPos >= 0 && setPos < setOrder.length - 1 ? setOrder[setPos + 1] : null;

  const badgeSrc = userAch?.badgeName
    ? `${MEDIA_URL}/Badge/${userAch.badgeName}.png`
    : ach?.badgeName
      ? `${MEDIA_URL}/Badge/${ach.badgeName}.png`
      : `${MEDIA_URL}/Badge/00001.png`;

  const heroBg = (() => {
    if (!userGame) return null;
    const isFallback = img => !img || img.includes('000002');
    return (!isFallback(userGame.imageIngame) ? userGame.imageIngame : null)
        || (!isFallback(userGame.imageTitle)  ? userGame.imageTitle  : null)
        || null;
  })();

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex flex-col">
        <Topbar crumbs={[{ label: 'Cheevodex', href: '../profile/' }, { label: null }, { label: null }, { label: null }]} />
        <div className="relative overflow-hidden bg-box border-b border-line">
          <div className="relative max-w-3xl mx-auto px-4 md:px-8 pt-8 pb-4 md:pt-5">
            <div className="shimmer h-4 w-40 rounded mb-4" />
            <div className="flex gap-4 items-start">
              <div className="shimmer w-16 h-16 md:w-28 md:h-28 rounded-[3px] shrink-0" />
              <div className="flex-1 flex flex-col gap-2 pt-1">
                <div className="shimmer h-5 w-3/4 rounded" />
                <div className="shimmer h-3 w-full rounded" />
                <div className="shimmer h-3 w-2/3 rounded" />
                <div className="shimmer h-3 w-1/2 rounded mt-1" />
              </div>
            </div>
          </div>
          <div className="border-t border-well bg-bar/50">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-2.5 grid grid-flow-col auto-cols-fr">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex flex-col items-center gap-1 py-1">
                  <div className="shimmer h-4 w-12 rounded" />
                  <div className="shimmer h-2 w-10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-8 py-6">
          <div className="shimmer h-[52px] rounded mb-5" />
          <div className="flex items-center gap-2 mb-4">
            <div className="shimmer h-7 w-32 rounded-sm" />
            <div className="shimmer h-7 w-24 rounded-sm" />
          </div>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="shimmer h-9 rounded mb-1" />
          ))}
        </div>
        <Footer label="cheevodex · retroachievements.org" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-page flex flex-col">
        <Topbar crumbs={[{ label: 'Cheevodex', href: '../profile/' }, { label: null }, { label: null }, { label: null }]} />
        <div className="flex-1 flex items-center justify-center text-ink-2 text-sm">{error}</div>
        <Footer label="cheevodex · retroachievements.org" />
      </div>
    );
  }

  // ── Page ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <Topbar crumbs={[
        { label: 'Cheevodex', href: '../profile/' },
        ...(consoleId && consoleName
          ? [{ label: consoleName, href: `../console/?id=${consoleId}` }]
          : consoleName ? [{ label: consoleName }] : [{ label: null }]),
        ...(gameName && gameId
          ? [{ label: gameName, href: `../game/?id=${gameId}` }]
          : [{ label: null }]),
        { label: ach?.title || 'Achievement' },
      ]} />

      {/* ── Hero ── */}
      <div className="phead">
        {heroBg && <ArtBg urls={[getMediaUrl(heroBg)]} variant="art-header" />}
        <div className="relative max-w-3xl mx-auto px-4 md:px-8 pt-8 pb-4 md:pt-5">

          {/* Game info row */}
          {(gameName || consoleName) && (
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mb-3 text-[10px]">
              {userGame && userGame.imageIcon && (
                <img src={getMediaUrl(userGame.imageIcon)} alt={gameName}
                  className="w-5 h-5 rounded-[2px] border border-well object-cover shrink-0 bg-bar" />
              )}
              {gameName && gameId && (
                <a href={`../game/?id=${gameId}`}
                  className="text-accent hover:text-ink transition-colors font-medium truncate max-w-[220px]">
                  {gameName}
                </a>
              )}
              {consoleName && <>
                <span className="text-line select-none">·</span>
                {consoleId
                  ? <a href={`../console/?id=${consoleId}`}
                      className="flex items-center gap-1 text-ink-2 hover:text-ink transition-colors">
                      <Gamepad2 size={10} className="shrink-0" />{consoleName}
                    </a>
                  : <span className="flex items-center gap-1 text-ink-2">
                      <Gamepad2 size={10} className="shrink-0" />{consoleName}
                    </span>
                }
              </>}
            </div>
          )}

          {/* Part of its game's dex: Dex No., position in the set, previous / next */}
          {gameId && (
            <div className="flex items-center gap-2 mb-3">
              <span className="dex-no lg art-shadow">Dex No.<b>{gameId}</b>{setPos >= 0 && <> · <b>{setPos + 1}</b> of {setOrder.length}</>}</span>
              {setPos >= 0 && (
                <span className="ml-auto flex items-center gap-1.5">
                  <a href={prevAch ? `?id=${prevAch.id}` : undefined} aria-disabled={!prevAch} title={prevAch ? `Previous: ${prevAch.title}` : 'First in the set'}
                    className={`fchip !h-[28px] !px-2 ${prevAch ? '' : 'opacity-40 pointer-events-none'}`}><ChevronLeft size={13} />Prev</a>
                  <a href={nextAch ? `?id=${nextAch.id}` : undefined} aria-disabled={!nextAch} title={nextAch ? `Next: ${nextAch.title}` : 'Last in the set'}
                    className={`fchip !h-[28px] !px-2 ${nextAch ? '' : 'opacity-40 pointer-events-none'}`}>Next<ChevronRight size={13} /></a>
                </span>
              )}
            </div>
          )}

          {/* Badge + info */}
          <div className="flex gap-4 items-start">
            <div className={`relative shrink-0 w-16 h-16 md:w-28 md:h-28 rounded-[3px] overflow-hidden bg-black ${userAch?.dateEarned ? 'border-2 border-gold shadow-[0_0_14px_rgb(var(--c-gold)/0.4)]' : 'border border-well'}`}>
              <img
                src={badgeSrc}
                alt={ach?.title}
                className={`w-full h-full object-cover ${!userAch?.dateEarned ? 'grayscale brightness-40' : ''}`}
              />
              {!userAch?.dateEarned && (
                <Lock size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/40" />
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-start gap-2 flex-wrap mb-1">
                <h1 className={`text-[17px] font-semibold leading-tight ${userAch?.dateEarned ? 'text-gold' : 'text-ink'}`}>
                  {ach?.title}
                </h1>
                {typeConf && (
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.07em] px-1.5 py-[2px] rounded-[2px] shrink-0 mt-[3px]"
                    style={{ color: typeConf.color, background: `color-mix(in srgb, ${typeConf.color} 9.4%, transparent)`, border: `1px solid color-mix(in srgb, ${typeConf.color} 26.7%, transparent)` }}>
                    <typeConf.Icon size={9} /> {typeConf.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-2 leading-snug mb-2">{ach?.description}</p>

              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                <span className="flex items-center gap-1 text-gold num">
                  <Star size={10} className="shrink-0" />{ach?.points} pts
                </span>
                {ratio > 1 && <>
                  <span className="text-line select-none">·</span>
                  <span className="flex items-center gap-1"
                    style={{ color: ratio >= 30 ? 'var(--hc)' : ratio >= 20 ? 'var(--gold)' : ratio >= 10 ? 'var(--accent)' : 'var(--ink-2)' }}>
                    <TrendingUp size={10} className="shrink-0" />×{ratio.toFixed(1)}
                  </span>
                </>}
                {ach?.author && <>
                  <span className="text-line select-none">·</span>
                  <span className="flex items-center gap-1 text-ink-2">
                    <User size={10} className="shrink-0" />{ach.author}
                  </span>
                </>}
                {ach?.dateCreated && <>
                  <span className="text-line select-none">·</span>
                  <span className="flex items-center gap-1 text-ink-2">
                    <Calendar size={10} className="shrink-0" />{formatDate(ach.dateCreated)}
                  </span>
                </>}
                {achId && <>
                  <span className="text-line select-none">·</span>
                  <a href={`${SITE_URL}/achievement/${achId}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-ink-3 hover:text-accent transition-colors">
                    <ExternalLink size={10} className="shrink-0" />RA
                  </a>
                </>}
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        {achData && (
          <div className="relative border-t border-well bg-bar/50">
            <div className="max-w-3xl mx-auto px-2 md:px-8 py-2.5 grid grid-flow-col auto-cols-fr">
              {[
                { label: 'Hardcore',      value: achData.unlocksHardcoreCount, pct: hcPct,  color: 'var(--hc)', Icon: Flame   },
                { label: 'Softcore',      value: achData.unlocksCount,         pct: anyPct, color: 'var(--ink-2)', Icon: Feather },
                { label: 'Total Players', value: achData.totalPlayers,         pct: null,   color: 'var(--ink-3)', Icon: null    },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center py-1 px-2 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[12px] md:text-[14px] font-bold" style={{ color: s.color }}>
                      {s.value.toLocaleString()}
                    </span>
                    {s.pct !== null && (
                      <span className="text-[9px] md:text-[10px] text-ink-3">{s.pct}%</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[8px] md:text-[9px] text-ink-3 uppercase tracking-[0.07em]">
                    {s.Icon && <s.Icon size={8} />}
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-8 py-6">

        {/* Your Status — always visible */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="sec-mark" />
            <span className="sec-t">Your Status</span>
          </div>

          {userGame === null ? (
            <div className="shimmer h-[52px] rounded-[3px]" />
          ) : !userAch || !userAch.dateEarned ? (
            <div className="flex items-center gap-3 p-3 bg-box border border-line rounded-[3px]">
              <Lock size={16} className="text-ink-3 shrink-0" />
              <span className="text-[12px] text-ink-3">Not yet unlocked</span>
            </div>
          ) : (
            <div className={`flex items-center gap-3 p-3 bg-box border rounded-[3px] border-l-[3px] ${
              userAch.dateEarnedHardcore
                ? 'border-line border-l-gold'
                : 'border-line border-l-ink-2'
            }`}>
              <img src={badgeSrc} alt={ach?.title}
                className="w-8 h-8 rounded-[2px] border border-well object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-ink-3 uppercase tracking-[0.07em] mb-0.5">Unlocked at</div>
                <div className="text-[11px] text-accent font-medium">{formatDate(userAch.dateEarned)}</div>
              </div>
              {userAch.dateEarnedHardcore && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-[2px] rounded-sm shrink-0"
                  style={{ color: 'var(--hc)', background: 'rgb(var(--c-hc) / 0.12)', border: '1px solid rgb(var(--c-hc) / 0.3)' }}>
                  <Flame size={8} /> Hardcore
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Tab bar (assets/tabs.js) ── */}
        <TabBar className="md:top-[26px] -mx-4 md:-mx-8 px-2 md:px-6 mb-1" active={activeTab} onChange={switchTab} tabs={[
          { id: 'unlocks',   label: 'Recent Unlocks', icon: <Users size={15} />, count: achData?.unlocksCount != null ? achData.unlocksCount.toLocaleString() : null },
          { id: 'comments',  label: 'Comments',  icon: <MessageSquare size={15} /> },
          { id: 'changelog', label: 'Changelog', icon: <History size={15} /> },
        ]} />

        {/* ── Recent Unlocks tab ── */}
        {activeTab === 'unlocks' && (
          <div>
            <div className="flex flex-col gap-[2px]">
              {unlocks.length === 0 ? (
                <div className="text-[11px] text-ink-3 py-8 text-center">No unlocks recorded.</div>
              ) : unlocks.map((u, i) => (
                <div key={`${u.user}-${i}`}
                  className={`flex items-center gap-2.5 px-2.5 py-2 bg-box hover:bg-box-hi border-l-[3px] transition-colors ${
                    u.hardcoreMode ? 'border-l-gold' : 'border-l-ink-3'
                  }`}>
                  <img
                    src={u.userPic ? getMediaUrl(u.userPic) : `${MEDIA_URL}/UserPic/${u.user}.png`}
                    alt={u.user}
                    className="w-7 h-7 rounded-full border border-well shrink-0 object-cover bg-bar"
                    onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <a href={`../profile/?u=${u.user}`}
                    className="text-[11px] font-medium text-gold hover:text-gold-hi transition-colors truncate flex-1 min-w-0">
                    {u.user}
                  </a>
                  {u.hardcoreMode && (
                    <span className="flex items-center gap-0.5 text-[8px] font-bold px-1 py-[1px] rounded-sm shrink-0"
                      style={{ color: 'var(--hc)', background: 'rgb(var(--c-hc) / 0.12)', border: '1px solid rgb(var(--c-hc) / 0.3)' }}>
                      <Flame size={7} /> Hardcore
                    </span>
                  )}
                  <span className="text-[9px] text-ink-3 shrink-0">{formatTimeAgo(u.dateAwarded, new Date().toISOString())}</span>
                </div>
              ))}
            </div>

            {hasMoreUnlocks && (
              <button onClick={loadMoreUnlocks} disabled={loadingMore}
                className="mt-3 w-full py-2 text-[11px] text-accent bg-box hover:bg-box-hi border border-line rounded-[3px] transition-colors disabled:opacity-50">
                {loadingMore ? 'Loading…' : `Load more (${(achData.unlocksCount - unlocks.length).toLocaleString()} remaining)`}
              </button>
            )}
          </div>
        )}

        {/* ── Comments tab ── */}
        {activeTab === 'comments' && (
          <div>
            {comments === null ? (
              <div className="flex flex-col gap-[2px]">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 py-2.5 border-b border-box">
                    <div className="shimmer w-7 h-7 rounded-full shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col gap-1.5 pt-0.5">
                      <div className="flex gap-2">
                        <div className="shimmer h-2.5 w-20 rounded" />
                        <div className="shimmer h-2.5 w-14 rounded" />
                      </div>
                      <div className="shimmer h-2 w-full rounded" />
                      <div className="shimmer h-2 w-3/4 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : userComments.length === 0 ? (
              <div className="text-[11px] text-ink-3 py-8 text-center">No comments yet.</div>
            ) : (
              <div className="flex flex-col">
                {userComments.map((c, i) => (
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
                        <span className="text-[9px] text-ink-3">{formatTimeAgo(c.submitted)}</span>
                      </div>
                      <p className="text-[11px] text-ink leading-snug break-words">{c.commentText}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {comments !== null && comments.length < commentsTotal && (
              <div className="mt-4 flex justify-center">
                <button type="button" onClick={loadMoreComments} disabled={loadingMoreComments}
                  className="flex items-center gap-2 text-[11px] text-accent border border-accent/40 bg-accent/10 hover:bg-accent/20 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50">
                  {loadingMoreComments
                    ? <><Loader size={12} className="animate-spin" /> Loading…</>
                    : <>Load more ({commentsTotal - comments.length} remaining)</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Changelog tab ── */}
        {activeTab === 'changelog' && (
          <div>
            {comments === null ? (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-line rounded-full opacity-40" />
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="relative flex flex-col gap-1.5 py-2.5">
                    <div className="absolute left-[-21px] top-[13px] w-2.5 h-2.5 rounded-full border-2 border-line bg-page opacity-40" />
                    <div className="shimmer h-2.5 w-3/4 rounded" />
                    <div className="shimmer h-2 w-20 rounded" />
                  </div>
                ))}
              </div>
            ) : changelogEntries.length === 0 ? (
              <div className="text-[11px] text-ink-3 py-8 text-center">No changelog entries.</div>
            ) : (
              <div className="relative pl-6">
                {/* vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-line rounded-full" />
                {changelogEntries.map((c, i) => (
                  <div key={`cl-${i}`} className="relative flex flex-col gap-0.5 py-2.5">
                    {/* dot marker */}
                    <div className="absolute left-[-21px] top-[13px] w-2.5 h-2.5 rounded-full border-2 border-accent bg-page shrink-0" />
                    <p className="text-[11px] text-ink leading-snug break-words">
                      {(() => {
                        const spaceIdx = c.commentText.indexOf(' ');
                        if (spaceIdx === -1) return <span className="text-gold">{c.commentText}</span>;
                        return <><span className="text-gold">{c.commentText.slice(0, spaceIdx)}</span>{c.commentText.slice(spaceIdx)}</>;
                      })()}
                    </p>
                    <span className="text-[9px] text-accent">{formatTimeAgo(c.submitted)}</span>
                  </div>
                ))}
              </div>
            )}

            {comments !== null && comments.length < commentsTotal && (
              <div className="mt-4 flex justify-center">
                <button type="button" onClick={loadMoreComments} disabled={loadingMoreComments}
                  className="flex items-center gap-2 text-[11px] text-accent border border-accent/40 bg-accent/10 hover:bg-accent/20 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50">
                  {loadingMoreComments
                    ? <><Loader size={12} className="animate-spin" /> Loading…</>
                    : <>Load more ({commentsTotal - comments.length} remaining)</>}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      <Footer label="cheevodex · retroachievements.org" />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<AchievementApp />);
