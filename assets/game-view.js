// List / tiles choice for the profile game lists (ES module, no JSX). Ported from Savepoint.
// Remembered per device in localStorage so it survives reloads; private mode, or storage that
// throws, just falls back to the list view.
import { useState, useCallback } from 'react';

const KEY = 'cheevodex:gameView';
const VIEWS = ['list', 'tiles'];

const read = () => {
  try { const v = localStorage.getItem(KEY); return VIEWS.includes(v) ? v : 'list'; }
  catch { return 'list'; }
};

export function useGameView() {
  const [view, setView] = useState(read);
  const set = useCallback(v => {
    setView(v);
    try { localStorage.setItem(KEY, v); } catch { /* storage unavailable */ }
  }, []);
  return [view, set];
}

// "12h", "9d", "4w", "1mo", "2y" since a timestamp (ms); '' when unknown
export function shortAgo(ms, now = Date.now()) {
  if (!ms) return '';
  const min = Math.max(0, (now - ms) / 60000);
  if (min < 60) return `${Math.max(1, Math.floor(min))}m`;
  const h = min / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}
