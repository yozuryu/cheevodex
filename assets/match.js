// Typo-tolerant word matching, shared by the command palette (assets/palette.js) and the Consoles page
// (console/app.js). No JSX, no imports. The promo site's demo (cheevodex-site src/components/SearchDemo.tsx)
// has a copy of match(): keep the two in step.
// Word based: every word typed must match a word of the name, from its start (best), inside it, or within a
// typo or two (Damerau–Levenshtein: one for 4–6 letters, two from 7), so "breth of fyre" finds Breath of Fire
// and "pixl" finds pixelmoth; numbers must match exactly ("persona 4" isn't Persona 3). Lower is better;
// names with fewer words beyond the ones typed come first. null = no match.
export const norm = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const words = t => norm(t).split(' ').filter(Boolean);
// Damerau–Levenshtein distance, giving up past `max` (returns max + 1): the length gap alone rules most words out,
// and a row whose best cell is already over `max` can't come back under it
export function dl(a, b, max) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > max) return max + 1;
  let pp = null, p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    let low = i;
    for (let j = 1; j <= n; j++) {
      let v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
      c[j] = v;
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    pp = p; p = c;
  }
  return p[n];
}
// One typed word against a name's words: exact, start, inside first (cheap); a typo only when none of those hit
// and `typos` is on
export function tokenScore(t, ws, typos = true) {
  let best = null;
  for (const w of ws) {
    if (w === t) return 0;
    if (w.startsWith(t)) best = 0.1;
    else if (best == null && t.length >= 3 && w.includes(t)) best = 0.4;
  }
  if (best != null || !typos) return best;
  const allow = /^\d+$/.test(t) ? 0 : t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0;   // three letters is too short to guess a typo
  if (!allow) return null;
  for (const w of ws) {
    // a real typo almost never breaks both of the first two letters: skip words sharing neither (nor a swap of them)
    if (t[0] !== w[0] && t[1] !== w[1] && !(t[0] === w[1] && t[1] === w[0])) continue;
    const d = Math.min(dl(t, w, allow), w.length > t.length ? dl(t, w.slice(0, t.length), allow) : allow + 1);
    if (d <= allow && (best == null || 0.5 + d * 0.2 < best)) best = 0.5 + d * 0.2;
    if (best === 0.7) break;
  }
  return best;
}
// The query, prepared once per search: its words, and whether it can be a title's initials
export const prepare = query => {
  const qs = words(query);
  return { qs, ini: qs.length === 1 && /^[a-z]{2,5}$/.test(qs[0]) ? qs[0] : null };
};
// An item's words (`ws`) and initials (`ini`) are worked out once, when the data loads
export function match(pq, item, typos = true) {
  const { qs, ini } = pq, ws = item.ws;
  if (!qs.length) return null;
  // Initials: "ff" → Final Fantasy, "kh" → Kingdom Hearts (one typed word of 2–5 letters)
  if (ini && ws.length >= ini.length && item.ini.startsWith(ini) && tokenScore(ini, ws) == null) {
    const sc = new Number(0.35 + Math.max(0, ws.length - ini.length) * 0.03); sc.typo = false; return sc;
  }
  let total = 0, typo = false;
  for (const t of qs) { const sc = tokenScore(t, ws, typos); if (sc == null) return null; total += sc; if (sc >= 0.5) typo = true; }
  const score = new Number(total / qs.length + Math.max(0, ws.length - qs.length) * 0.03);
  score.typo = typo;   // matched only with a typo: shown only when nothing matches without one
  return score;
}
export const withIni = item => ({ ...item, ini: item.ws.map(w => w[0]).join('') });

// Every list against the query: clean matches first (cheap), the typo pass only when nothing matched cleanly, since
// typo-only matches are hidden whenever a clean one exists. Returns per list [index, score, typo] rows
export function searchAll(lists, query) {
  const pq = prepare(query);
  const pass = typos => lists.map(list => {
    const out = [];
    for (let i = 0; i < list.length; i++) { const m = match(pq, list[i], typos); if (m != null) out.push([i, +m, m.typo ? 1 : 0]); }
    return out;
  });
  const all = pass(false);
  return all.some(rs => rs.length) ? all : pass(true);
}

// The search runs in a Web Worker built from the functions above, so a long catalog never freezes typing: the
// worker gets the names once ({ ws, ini } per item), then one query at a time. Without workers it runs here
export function makeSearcher(lists) {
  try {
    const src = `const norm = ${norm}; const words = ${words}; ${dl} ${tokenScore} const prepare = ${prepare}; ${match} ${searchAll}
      let lists = []; onmessage = e => { if (e.data.lists) lists = e.data.lists; else postMessage({ id: e.data.id, all: searchAll(lists, e.data.query) }); };`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.postMessage({ lists });
    let seq = 0;
    const waiting = new Map();
    worker.onmessage = e => { waiting.get(e.data.id)?.(e.data.all); waiting.delete(e.data.id); };
    return {
      search: query => new Promise(res => { const id = ++seq; waiting.set(id, res); worker.postMessage({ id, query }); }),
      stop: () => worker.terminate(),
    };
  } catch {
    return { search: query => Promise.resolve(searchAll(lists, query)), stop: () => {} };
  }
}

