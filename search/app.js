import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, X, RefreshCw, Database, Loader2, Gamepad2, ChevronRight, ChevronDown,
} from 'lucide-react';
import { parseTitle, getMediaUrl } from '../profile/utils/helpers.js';
import { TILDE_TAG_COLORS } from '../profile/utils/constants.js';
import {
  getCredentials, clearCredentials,
  fetchConsoles, fetchConsoleGames,
  getAllGamesFromDB, markAllGamesFullFetch,
} from '../profile/utils/ra-api.js';
import { Topbar, Footer } from '../assets/ui.js';

function handleAuthError() {
  clearCredentials();
  window.location.replace('../');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function relativeTime(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SearchApp() {
  const creds = getCredentials();

  const [store, setStore]                   = useState(null);
  const [storeLoading, setStoreLoading]     = useState(true);
  const [query, setQuery]                   = useState(() => new URLSearchParams(window.location.search).get('q') || '');   // ?q= from the palette's "See all results"
  const [achFilter, setAchFilter]           = useState('all');   // 'all' | 'with' | 'without'
  const [consoleFilter, setConsoleFilter]   = useState(new Set()); // empty = all consoles
  const [showConsolePanel, setShowConsolePanel] = useState(false);
  const [consoleSearch, setConsoleSearch]   = useState('');
  const [fetchStatus, setFetchStatus]       = useState('idle');  // 'idle' | 'fetching' | 'error'
  const [progress, setProgress]             = useState(null);
  const [page, setPage]                     = useState(1);
  const PAGE_SIZE = 50;

  const cancelRef        = useRef(false);
  const inputRef         = useRef(null);
  const consolePanelRef  = useRef(null);
  const consoleSearchRef = useRef(null);

  // Load index from IDB on mount
  useEffect(() => {
    if (!creds) { handleAuthError(); return; }
    getAllGamesFromDB()
      .then(data => { setStore(data.games.length ? data : null); setStoreLoading(false); })
      .catch(() => setStoreLoading(false));
  }, []);

  // Reset to page 1 when any filter/query changes
  useEffect(() => { setPage(1); }, [query, achFilter, consoleFilter]);

  // Close console dropdown on outside click; auto-focus search when opening
  useEffect(() => {
    if (!showConsolePanel) { setConsoleSearch(''); return; }
    setTimeout(() => consoleSearchRef.current?.focus(), 0);
    const handler = e => {
      if (consolePanelRef.current && !consolePanelRef.current.contains(e.target))
        setShowConsolePanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showConsolePanel]);

  // Derived: sorted list of consoles present in the index
  const availableConsoles = useMemo(() => {
    if (!store?.games?.length) return [];
    const map = {};
    store.games.forEach(g => { if (!map[g.consoleId]) map[g.consoleId] = g.consoleName; });
    return Object.entries(map)
      .map(([id, name]) => ({ id: Number(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store]);

  const filteredConsoles = useMemo(() => {
    if (!consoleSearch.trim()) return availableConsoles;
    const q = consoleSearch.toLowerCase();
    return availableConsoles.filter(c => c.name.toLowerCase().includes(q));
  }, [availableConsoles, consoleSearch]);

  const { items: results, total: resultTotal, totalPages } = useMemo(() => {
    if (!store?.games?.length || !query.trim()) return { items: null, total: 0, totalPages: 1 };
    const q = query.toLowerCase();
    let all = store.games.filter(g => g.title.toLowerCase().includes(q));
    if (achFilter === 'with')    all = all.filter(g => g.numAchievements > 0);
    if (achFilter === 'without') all = all.filter(g => g.numAchievements === 0);
    if (consoleFilter.size > 0)  all = all.filter(g => consoleFilter.has(g.consoleId));
    const tp = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    const sp = Math.min(page, tp);
    return { items: all.slice((sp - 1) * PAGE_SIZE, sp * PAGE_SIZE), total: all.length, totalPages: tp };
  }, [store, query, page, achFilter, consoleFilter]);

  const indexedConsoles = store ? Object.keys(store.consolesFetched || {}).length : 0;
  const totalGames      = store?.games?.length || 0;
  const pct = progress?.total > 0 ? Math.round(progress.done / progress.total * 100) : 0;
  const hasSomeData = store && totalGames > 0;
  const hasActiveFilters = achFilter !== 'all' || consoleFilter.size > 0;

  function toggleConsole(id) {
    setConsoleFilter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function startFetch(forceRefresh) {
    if (!creds) { handleAuthError(); return; }
    cancelRef.current = false;
    setFetchStatus('fetching');
    setProgress({ done: 0, total: 0, current: 'Loading console list…' });

    try {
      const consoles = await fetchConsoles(creds.username, creds.apiKey);
      setProgress({ done: 0, total: consoles.length, current: consoles[0]?.name || '' });

      for (let i = 0; i < consoles.length; i++) {
        if (cancelRef.current) { setFetchStatus('idle'); setProgress(null); return; }
        const c = consoles[i];
        setProgress({ done: i, total: consoles.length, current: c.name });
        await fetchConsoleGames(creds.username, creds.apiKey, c.id, forceRefresh);
        if (i < consoles.length - 1) await sleep(1000);
      }

      await markAllGamesFullFetch();
      const data = await getAllGamesFromDB();
      setStore(data.games.length ? data : null);
      setFetchStatus('idle');
      setProgress(null);
      inputRef.current?.focus();
    } catch (e) {
      if (e?.message === 'AUTH_ERROR') handleAuthError();
      else setFetchStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <Topbar crumbs={[{ label: 'Cheevodex', href: '../profile/' }, { label: 'Search' }]} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 pt-8 pb-16 md:pt-5 md:pb-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="sec-mark" />
            <span className="sec-t">Search Games</span>
          </div>
          {hasSomeData && fetchStatus !== 'fetching' && (
            <div className="ml-auto flex items-center gap-3">
              {store.lastFullFetch && (
                <span className="text-[11px] text-ink-3">Synced {relativeTime(store.lastFullFetch)}</span>
              )}
              <button type="button" onClick={() => startFetch(true)} className="fchip">
                <RefreshCw size={12} />
                Refresh all
              </button>
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder={hasSomeData ? `Search ${totalGames.toLocaleString()} games…` : 'Search games…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={!hasSomeData || fetchStatus === 'fetching'}
            className="w-full bg-box border border-line focus:border-accent outline-none text-[12px] text-ink placeholder-ink-3 pl-9 pr-8 py-2.5 rounded-[3px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters */}
        {hasSomeData && fetchStatus !== 'fetching' && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Achievement filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-ink-3 shrink-0">Achievements</span>
              {[
                { value: 'all',     label: 'All'     },
                { value: 'with',    label: 'With'    },
                { value: 'without', label: 'Without' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setAchFilter(opt.value)} aria-pressed={achFilter === opt.value}
                  className={`fchip ${achFilter === opt.value ? 'on' : ''}`}>{opt.label}</button>
              ))}
            </div>

            {/* Console multi-select */}
            <div className="relative" ref={consolePanelRef}>
              <button type="button" onClick={() => setShowConsolePanel(v => !v)}
                aria-expanded={showConsolePanel} className={`fchip ${consoleFilter.size > 0 ? 'on' : ''}`}>
                Console{consoleFilter.size > 0 && <span className="n num">{consoleFilter.size}</span>}
                <ChevronDown size={12} className={`transition-transform duration-150 ${showConsolePanel ? 'rotate-180' : ''}`} />
              </button>
              {showConsolePanel && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-box border border-line rounded-[3px] z-20 shadow-xl overflow-hidden">
                  <div className="px-2 py-1.5 border-b border-line flex items-center gap-1.5">
                    <Search size={10} className="text-ink-3 shrink-0" />
                    <input
                      ref={consoleSearchRef}
                      type="text"
                      value={consoleSearch}
                      onChange={e => setConsoleSearch(e.target.value)}
                      placeholder="Filter consoles…"
                      className="flex-1 bg-transparent outline-none text-[12px] text-ink placeholder-ink-3 min-w-0"
                    />
                    {consoleFilter.size > 0 && (
                      <button type="button" onClick={() => setConsoleFilter(new Set())}
                        className="text-[11px] text-accent hover:text-ink transition-colors shrink-0">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredConsoles.length === 0 && (
                      <div className="px-3 py-3 text-[11px] text-ink-3 text-center">No match</div>
                    )}
                    {filteredConsoles.map(c => (
                      <label key={c.id} className="flex items-center gap-2 px-3 py-[5px] hover:bg-box-hi cursor-pointer">
                        <input type="checkbox" checked={consoleFilter.has(c.id)}
                          onChange={() => toggleConsole(c.id)}
                          className="accent-accent w-3 h-3 shrink-0" />
                        <span className="text-[12px] text-ink truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <button type="button" onClick={() => { setAchFilter('all'); setConsoleFilter(new Set()); }}
                className="fchip on">
                Clear filters ✕
              </button>
            )}
          </div>
        )}

        {/* Fetch status / index stats */}
        {fetchStatus === 'fetching' ? (
          <div className="mb-4 p-3 bg-box border border-line rounded-[3px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 size={13} className="text-accent animate-spin shrink-0" />
                <span className="text-[11px] text-ink truncate">{progress?.current || 'Fetching…'}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {progress?.total > 0 && (
                  <span className="text-[10px] text-ink-3">{progress.done}/{progress.total}</span>
                )}
                <button type="button" onClick={() => { cancelRef.current = true; }}
                  className="fchip" style={{ height: 26 }}>
                  Cancel
                </button>
              </div>
            </div>
            {progress?.total > 0 && (
              <div className="h-[3px] bg-bar rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        ) : fetchStatus === 'error' ? (
          <div className="mb-4 p-3 bg-box border border-danger-edge rounded-[3px] flex items-center justify-between gap-2">
            <span className="text-[11px] text-danger">Fetch failed — check your connection and try again.</span>
            <button type="button" onClick={() => setFetchStatus('idle')}
              className="text-ink-3 hover:text-ink transition-colors shrink-0"><X size={13} /></button>
          </div>
        ) : storeLoading ? (
          <div className="mb-4 flex items-center gap-2 px-1">
            <Loader2 size={12} className="text-ink-3 animate-spin" />
            <span className="text-[10px] text-ink-3">Loading index…</span>
          </div>
        ) : hasSomeData ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 px-1">
            <span className="text-[10px] text-ink-3">
              <span className="text-ink-2">{totalGames.toLocaleString()}</span> games
              <span className="mx-1.5 text-line">·</span>
              <span className="text-ink-2">{indexedConsoles}</span> consoles indexed
            </span>
            {!store.lastFullFetch && (
              <>
                <span className="text-line">·</span>
                <button type="button" onClick={() => startFetch(false)}
                  className="text-[11px] text-accent hover:text-ink transition-colors">
                  fetch remaining consoles
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mb-4 p-6 bg-box border border-line rounded-[3px] flex flex-col items-center gap-3 text-center">
            <Database size={28} color="var(--line)" />
            <div>
              <p className="text-[12px] text-ink font-medium">No game data indexed yet</p>
              <p className="text-[10px] text-ink-3 mt-1">
                Fetch all console game lists to enable search.<br />
                Takes about 1–2 minutes at 1 request per second.
              </p>
            </div>
            <button type="button" onClick={() => startFetch(false)}
              className="fchip on">
              <Database size={12} />
              Fetch all consoles
            </button>
          </div>
        )}

        {/* Results */}
        {results !== null ? (
          results.length === 0 ? (
            <div className="text-[11px] text-ink-3 py-8 text-center">
              No games match your search{hasActiveFilters ? ' and filters' : ''}.
            </div>
          ) : (
            <>
              <p className="text-[10px] text-ink-3 mb-2 px-1">
                <span className="text-ink">{resultTotal.toLocaleString()}</span> result{resultTotal !== 1 ? 's' : ''}
                {totalPages > 1 && <span> — page <span className="text-ink">{Math.min(page, totalPages)}</span> of <span className="text-ink">{totalPages}</span></span>}
              </p>
              <div className="flex flex-col gap-[2px]">
                {results.map(g => {
                  const { baseTitle, tags, subsetName, isSubset } = parseTitle(g.title);
                  return (
                    <a key={g.id} href={`../game/?id=${g.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 bg-box hover:bg-box-hi active:bg-box-hi rounded-[2px] transition-colors group">
                      {g.imageIcon
                        ? <img src={getMediaUrl(g.imageIcon)} alt={baseTitle}
                            className="w-8 h-8 rounded-[2px] border border-well object-cover shrink-0 bg-bar"
                            onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                        : <span className="w-8 h-8 rounded-[2px] border border-well bg-bar flex items-center justify-center shrink-0">
                            <Gamepad2 size={14} color="var(--ink-3)" />
                          </span>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] font-medium text-ink group-hover:text-accent-hi transition-colors leading-snug">{baseTitle}</span>
                          {isSubset && (
                            <span className="text-[7px] font-bold uppercase tracking-[0.07em] px-1 py-[1px] rounded-[2px] border border-gold/30 bg-gold/10 text-gold-dim shrink-0">Subset</span>
                          )}
                          {tags.map(tag => {
                            const tc = TILDE_TAG_COLORS[tag] || TILDE_TAG_COLORS['Prototype'];
                            return (
                              <span key={tag} style={{
                                fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                                padding: '1px 4px', borderRadius: '2px',
                                border: `1px solid ${tc.border}`, background: tc.bg, color: tc.color,
                              }}>{tag}</span>
                            );
                          })}
                        </div>
                        {isSubset && subsetName && (
                          <span className="text-[11px] text-gold-dim block truncate">{subsetName}</span>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                          <span className="dex-no">No.{g.id}</span>
                          <span className="text-accent">{g.consoleName}</span>
                          {g.numAchievements > 0 ? (
                            <>
                              <span className="text-line">·</span>
                              <span className="text-ink-3">
                                <span className="text-ink-2">{g.numAchievements}</span> achievements
                                <span className="text-line mx-1">·</span>
                                <span className="text-gold">{(g.points || 0).toLocaleString()}</span> pts
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-line">·</span>
                              <span className="text-ink-3">No achievements</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={12} color="var(--line)" className="shrink-0" />
                    </a>
                  );
                })}
              </div>

              {/* Pagination nav */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 px-1 pb-4 md:pb-0">
                  <button type="button"
                    onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                    disabled={page <= 1}
                    className="fchip disabled:opacity-30 disabled:pointer-events-none">
                    ← Prev
                  </button>
                  <span className="text-[11px] text-ink-3">
                    Page <span className="text-ink">{Math.min(page, totalPages)}</span> of <span className="text-ink">{totalPages}</span>
                  </span>
                  <button type="button"
                    onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
                    disabled={page >= totalPages}
                    className="fchip disabled:opacity-30 disabled:pointer-events-none">
                    Next →
                  </button>
                </div>
              )}
            </>
          )
        ) : hasSomeData && !query.trim() ? (
          <div className="text-center py-10 text-ink-3 text-[11px]">
            Type to search across {totalGames.toLocaleString()} games
          </div>
        ) : null}
      </main>

      <Footer label="Cheevodex · Search" />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<SearchApp />);
