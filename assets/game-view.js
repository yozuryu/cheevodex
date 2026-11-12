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
