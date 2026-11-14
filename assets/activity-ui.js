// Activity timeline pieces for the profile Activity tab (ES module, no JSX: modules imported by
// the pages aren't run through Babel). Ported from Savepoint's assets/activity-ui.js; links stay in
// the app (no new tab) unless they point off-site. Styles: the "Activity timelines" block in
// assets/ui.css, the same classes the Activity page uses.
//   computeStreak(heatmapData, minValue)  current / longest run and the last 14 days
//   useSummaryOpen()                      folded on phones, open from md, remembered per device
//   ActivitySummary                       the dex entries that moved (page-built rows), opening to the year,
//                                         streaks and heatmap
//   DayHead                               sticky day heading
//   UnlockRow                             one unlock
//   SummarySkeleton / TimelineSkeleton / FriendsSkeleton / ActivitySkeleton   loading placeholders in the same shapes
//                                         (the summary folded or open, as it will open)
import { createElement as h, Fragment, useState } from 'react';
import { todayKey, addDays, keyToDate, fmtDayKey, TZ } from './time.js';

// Lucide paths (the pages load lucide-react, but a module can't use their JSX components here)
const ICON = {
  chevron: [['path', { d: 'm6 9 6 6 6-6' }]],
  flame: [['path', { d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' }]],
  trophy: [
    ['path', { d: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6' }], ['path', { d: 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18' }], ['path', { d: 'M4 22h16' }],
    ['path', { d: 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22' }], ['path', { d: 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22' }],
    ['path', { d: 'M18 2H6v7a6 6 0 0 0 12 0V2Z' }],
  ],
};
export const Icon = ({ name, size = 12, ...rest }) => h('svg', {
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...rest,
}, ...ICON[name].map(([tag, attrs], i) => h(tag, { key: i, ...attrs })));

// Off-site links open in a new tab; the app's own pages don't
const offsite = href => /^https?:/.test(href ?? '') ? { target: '_blank', rel: 'noreferrer' } : {};

// ── Streak ────────────────────────────────────────────────────────────────────

// Current / longest run of days reaching minValue; today never breaks a streak until it's over
export function computeStreak(heatmapData, minValue = 1) {
  const active = new Set(Object.entries(heatmapData).filter(([, d]) => (d.count ?? d) >= minValue).map(([k]) => k));
  const today = todayKey();
  let current = 0;
  for (let c = addDays(today, -1); active.has(c); c = addDays(c, -1)) current++;
  if (active.has(today)) current++;
  let longest = 0, longestStart = null, longestEnd = null, runStart = null, runLen = 0, prev = null;
  for (const day of [...active].sort()) {
    if (prev && day === addDays(prev, 1)) runLen++;
    else {
      if (runLen > longest) { longest = runLen; longestStart = runStart; longestEnd = prev; }
      runStart = day; runLen = 1;
    }
    prev = day;
  }
  if (runLen > longest) { longest = runLen; longestStart = runStart; longestEnd = prev; }
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const key = addDays(today, -i);
    last14.push({ key, label: keyToDate(key).toLocaleDateString('en-GB', { weekday: 'short' }), active: active.has(key), isToday: i === 0 });
  }
  return { current, longest, longestStart, longestEnd, last14 };
}

// ── Summary ───────────────────────────────────────────────────────────────────

const OPEN_KEY = 'cheevodex:activitySummary';
const initialOpen = () => {
  try { const v = localStorage.getItem(OPEN_KEY); if (v) return v === 'open'; } catch {}
  return window.matchMedia('(min-width: 768px)').matches;
};
export function useSummaryOpen() {
  const [open, setOpen] = useState(initialOpen);
  const toggle = () => setOpen(o => {
    try { localStorage.setItem(OPEN_KEY, o ? 'closed' : 'open'); } catch {}
    return !o;
  });
  return [open, toggle];
}

// Index lines: label, dotted leader, value (+ a quiet note)
const Ledger = ({ rows, cls = '' }) => h('div', { className: `dledger ${cls}` }, rows.map(r =>
  h('div', { key: r.l, className: `dl-row ${r.cls ?? ''}` },
    h('span', { className: 'dl-k' }, r.icon, r.l),
    h('span', { className: 'dl-dots' }),
    h('span', { className: 'dl-v', style: { color: r.color ?? 'var(--ink)' } }, r.v, r.sub && h('small', null, r.sub)))));

function StreakLines({ streak }) {
  const on = streak.current > 0;
  const days = n => `${n} day${n !== 1 ? 's' : ''}`;
  return h(Ledger, { cls: 'astreak', rows: [
    { l: 'Current streak', icon: h(Icon, { name: 'flame', size: 12, style: { color: on ? 'var(--gold)' : 'var(--ink-4)', ...(on ? { animation: 'flameFlicker 1.8s ease-in-out infinite' } : {}) } }),
      v: on ? days(streak.current) : 'None', color: on ? 'var(--gold)' : 'var(--ink-3)' },
    streak.longestStart && { l: 'Best streak', icon: h(Icon, { name: 'trophy', size: 12, style: { color: 'var(--silver)' } }),
      v: days(streak.longest),
      sub: `${fmtDayKey(streak.longestStart, { day: 'numeric', month: 'short' })} – ${fmtDayKey(streak.longestEnd, { day: 'numeric', month: 'short' })}` },
  ].filter(Boolean) });
}

// Cheevodex's summary is about dex entries, not days: `children` are the page's rows for the games that moved in
// the last 14 days, `totals` one line over them. The toggle opens the year: past-year index lines, streaks, heatmap
export function ActivitySummary({ open, onToggle, title, totals, children, stats, streak, selectedDay, onSelectDay, heatmap }) {
  return h('section', { className: 'asum mdex' },
    h('div', { className: 'mdex-h' },
      h('span', { className: 'sec-mark sm' }),
      h('span', { className: 'mdex-t' }, title),
      totals && h('span', { className: 'mdex-tot' }, totals)),
    children,
    h('button', { className: 'mdex-open', onClick: onToggle, 'aria-expanded': open },
      open ? 'Hide the year' : 'The year, streaks and heatmap',
      h(Icon, { name: 'chevron', size: 13, style: open ? { transform: 'rotate(180deg)' } : undefined })),
    open && h('div', { className: 'anim-fade' },
      h('div', { className: 'asum-top' },
        h('div', { className: 'asum-sec' },
          h('div', { className: 'asum-h' }, h('span', { className: 'sec-mark sm' }), h('span', null, 'Past year')),
          h(Ledger, { cls: 'astats-l', rows: stats })),
        h('div', { className: 'asum-sec' },
          h('div', { className: 'asum-h' }, h('span', { className: 'sec-mark sm' }), h('span', null, 'Streaks')),
          h(StreakLines, { streak }))),
      h('div', { className: 'asum-sec' },
        h('div', { className: 'asum-h' },
          h('span', { className: 'sec-mark sm' }),
          h('span', null, 'Heatmap'),
          h('em', { title: 'Days and times are shown in your timezone' }, TZ),
          selectedDay && h('button', { onClick: () => onSelectDay(null), className: 'fchip on anim-fade', style: { height: 22 } },
            `${fmtDayKey(selectedDay, { day: '2-digit', month: 'short' })} ✕`)),
        heatmap)));
}

// Past-year numbers of a heatmap { day: { count, ...sums } }: total of a field, active days, busiest day
export function yearOf(heatmapData, field = 'count') {
  const from = addDays(todayKey(), -364);
  let total = 0, active = 0, best = null;
  for (const [k, d] of Object.entries(heatmapData)) {
    if (k < from) continue;
    total += d[field] ?? 0;
    if (d.count > 0) active++;
    if (!best || d.count > best.count) best = { key: k, count: d.count };
  }
  return { total, active, best };
}

// ── Timeline ──────────────────────────────────────────────────────────────────

// "Sat 01 Nov" (+ the year when it isn't this year) with Today / Yesterday, and the day's totals
export function DayHead({ day, children }) {
  const today = todayKey();
  const rel = day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : null;
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return h('div', { className: 'tday' },
    h('span', { className: 'tday-name' },
      fmtDayKey(day, { weekday: 'short', day: '2-digit', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }),
      rel && h('em', null, rel)),
    h('span', { className: 'tday-meta' }, children));
}

// One unlock: badge, name (+ marks), description, and time with its value (points, rarity…) under it
export function UnlockRow({ href, icon, title, titleStyle, marks, desc, time, value }) {
  const img = icon ? h('img', { src: icon, alt: '', loading: 'lazy' }) : h('span', { className: 'trow-ph' });
  return h('div', { className: 'trow' },
    href ? h('a', { href, ...offsite(href), className: 'contents' }, img) : img,
    h('div', { className: 'trow-main' },
      h('span', { className: 'trow-title flex items-center gap-1.5' }, h('span', { className: 'truncate', style: titleStyle }, title), marks),
      desc && h('span', { className: 'trow-sub' }, desc)),
    h('span', { className: 'trow-end' }, time, value));
}

export { Fragment };

// ── Loading placeholders ──────────────────────────────────────────────────────
// Same boxes as the real summary (folded on phones unless opened before) and run cards, so nothing
// jumps when the data lands

const sk = (style, cls = '', key) => h('div', { key, className: `shimmer ${cls}`, style: { borderRadius: 2, ...style } });

export function SummarySkeleton() {
  return h('section', { className: 'asum mdex', 'aria-busy': true },
    h('div', { className: 'mdex-h' }, sk({ height: 12, width: 180 })),
    [0, 1].map(i => h('div', { key: i, className: 'mrow' },
      sk({ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }),
      h('div', { className: 'flex-1 flex flex-col gap-1.5' }, sk({ height: 12, width: `${55 - i * 15}%` }), sk({ height: 10, width: 90 })),
      sk({ width: 48, height: 22 }))),
    h('span', { className: 'mdex-open' }, 'The year, streaks and heatmap'));
}

// A run's game strip while loading (the .frun shape Mine and Friends share)
const runStripSk = i => h('div', { className: 'frun-h' }, sk({ width: 30, height: 30, flexShrink: 0 }),
  h('div', { className: 'flex-1 flex flex-col gap-1.5' }, sk({ height: 12, width: `${50 + i * 12}%` }), sk({ height: 10, width: 120 })),
  sk({ width: 32, height: 22 }));

// Your runs (Mine): strip, then two unlock rows
export function TimelineSkeleton() {
  return h('div', { className: 'flex flex-col gap-4' },
    [0, 1, 2].map(i => h('div', { key: i, className: 'flex flex-col gap-2' },
      h('div', { className: 'flex justify-between py-1' }, sk({ height: 12, width: 96 }), sk({ height: 10, width: 80 })),
      h('div', { className: 'frun mine' }, runStripSk(i),
        h('div', { className: 'frun-rows' },
          [0, 1].map(j => h('div', { key: j, className: 'trow' }, sk({ width: 36, height: 36, flexShrink: 0 }),
            h('div', { className: 'flex-1 flex flex-col gap-1.5' }, sk({ height: 10, width: `${40 + j * 20}%` }), sk({ height: 8, width: '50%' })))))))));
}

// Friends: a day heading, then posts on the rail (avatar node, name, a run strip and its badges)
export function FriendsSkeleton() {
  return h('div', { className: 'flex flex-col gap-3', 'aria-busy': true },
    h('div', { className: 'flex gap-1' }, [0, 1, 2, 3, 4, 5].map(i => h('div', { key: i, className: 'fpal' },
      sk({ width: 42, height: 42, borderRadius: '50%' }), sk({ width: 44, height: 9 })))),
    h('div', { className: 'flex justify-between py-1' }, sk({ height: 12, width: 96 }), sk({ height: 10, width: 80 })),
    h('div', { className: 'fposts' }, [0, 1, 2].map(i => h('div', { key: i, className: 'fpost' },
      sk({ width: 36, height: 36, borderRadius: '50%', position: 'relative', zIndex: 1 }),
      h('div', { className: 'fpost-main' }, sk({ height: 12, width: 110 }),
        h('div', { className: 'frun' }, runStripSk(i),
          h('div', { className: 'frun-b' }, [0, 1, 2, 3, 4].map(j => sk({ width: 28, height: 28, flexShrink: 0 }, '', j)))))))));
}

// A profile Activity tab while its chunks load: summary, the section heading, run cards
export function ActivitySkeleton() {
  return h('div', { className: 'flex flex-col gap-4 tl-tabs' },
    h(SummarySkeleton),
    h('div', null,
      h('div', { className: 'flex items-center gap-2 border-b border-line pb-1.5 mt-2 mb-3' },
        h('span', { className: 'sec-mark' }),
        h('span', { className: 'sec-t' }, 'Recent unlocks')),
      h(TimelineSkeleton)));
}
