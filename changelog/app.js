import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, GitCommit } from 'lucide-react';
import { Topbar, Footer } from '../assets/ui.js';

// ── Parser ─────────────────────────────────────────────────────────────────────
// Parses the changelog markdown into: [{ date, sections: [{ title, entries[] }] }]

const parseChangelog = (md) => {
    const releases = [];
    let current = null;
    let currentSection = null;

    for (const raw of md.split('\n')) {
        const line = raw.trim();
        if (!line || line === '---') continue;

        if (line.startsWith('## ')) {
            currentSection = null;
            current = { date: line.slice(3).trim(), summary: null, sections: [] };
            releases.push(current);
        } else if (line.startsWith('### ') && current) {
            currentSection = { title: line.slice(4).trim(), entries: [] };
            current.sections.push(currentSection);
        } else if (line.startsWith('- ') && currentSection) {
            currentSection.entries.push(line.slice(2).trim());
        } else if (current && !currentSection && !line.startsWith('#')) {
            current.summary = line;
        }
    }

    return releases;
};

// Inline markdown: `foo` → <code>, **foo** → <strong>
const renderText = (text) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`')
            ? <code key={i} className="text-aqua bg-well border border-line px-1 py-px rounded-[2px] text-[10px] font-mono">{part.slice(1, -1)}</code>
        : part.startsWith('**') && part.endsWith('**') && part.length > 4
            ? <strong key={i} className="text-ink font-semibold">{part.slice(2, -2)}</strong>
            : part
    );
};

// ── Section order + colors ─────────────────────────────────────────────────────

const SECTION_ORDER = [
    'RetroAchievements API',
    'Auth',
    'Cache',
    'Structure',
    'Profile',
    'Social',
    'Game Page',
    'Console Page',
    'Achievement Page',
    'Backlog',
    'Settings',
    'Search',
    'Navigation',
    'Polish',
    'User Page',
];

const sortSections = (sections) => {
    const idx = (title) => {
        const i = SECTION_ORDER.indexOf(title);
        return i === -1 ? SECTION_ORDER.length : i;
    };
    return [...sections].sort((a, b) => idx(a.title) - idx(b.title));
};

const SECTION_COLORS = {
    'RetroAchievements API': 'var(--gold)',
    'Auth':                  'var(--aqua)',
    'Cache':                 'var(--aqua)',
    'Structure':             'var(--ink-2)',
    'Profile':               'var(--accent)',
    'Social':                'var(--accent)',
    'Game Page':             'var(--ink-2)',
    'Console Page':          'var(--gold)',
    'Achievement Page':      'var(--aqua)',
    'Backlog':               'var(--accent)',
    'Settings':              'var(--ink-2)',
    'Search':                'var(--accent)',
    'Navigation':            'var(--accent)',
    'Polish':                'var(--ink-3)',
    'User Page':             'var(--gold)',
};

const sectionColor = (title) =>
    SECTION_COLORS[title] ?? 'var(--ink-2)';

// ── Components ────────────────────────────────────────────────────────────────

const Entry = ({ text }) => (
    <li className="flex items-start gap-2 text-[11px] text-ink-2 leading-relaxed py-[3px]">
        <span className="mt-[5px] w-[4px] h-[4px] rounded-full bg-line shrink-0" />
        <span>{renderText(text)}</span>
    </li>
);

const Section = ({ title, entries }) => {
    const color = sectionColor(title);
    return (
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="w-[3px] h-[12px] rounded-[1px] shrink-0" style={{ background: color }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color }}>
                    {title}
                </span>
            </div>
            <ul className="ml-3 border-l border-line-soft pl-3 flex flex-col">
                {entries.map((e, i) => <Entry key={i} text={e} />)}
            </ul>
        </div>
    );
};

const Release = ({ date, summary, sections, defaultOpen }) => {
    const [open, setOpen] = useState(defaultOpen);
    const totalEntries = sections.reduce((s, sec) => s + sec.entries.length, 0);

    // Handle "vYYYY.MM.DD — Label" or plain version strings
    const [rawVersion, ...labelParts] = date.split('—');
    const label = labelParts.join('—').trim();
    const formatted = rawVersion.trim();

    return (
        <div className="mb-3">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 group outline-none"
            >
                <div className="w-2.5 h-2.5 rounded-full border-2 border-accent bg-page shrink-0 group-hover:bg-accent transition-colors" />
                <div className="flex flex-col items-start min-w-0">
                    <span className="text-[13px] font-semibold text-ink group-hover:text-white transition-colors leading-snug">
                        {formatted}
                    </span>
                    {label && <span className="text-[10px] text-ink-3 font-normal leading-snug truncate max-w-full">{label}</span>}
                </div>
                <div className="flex-1 h-px bg-line-soft" />
                <span className="text-[9px] text-ink-3 shrink-0">
                    {totalEntries} change{totalEntries !== 1 ? 's' : ''}
                </span>
                <ChevronDown
                    size={12}
                    className={`text-ink-3 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="ml-[18px] border-l-2 border-line-soft pl-4 pt-3 mt-2">
                    {summary && (
                        <p className="text-[11px] text-ink-3 italic mb-4">{renderText(summary)}</p>
                    )}
                    {sortSections(sections).map((sec, i) => <Section key={i} title={sec.title} entries={sec.entries} />)}
                </div>
            )}
        </div>
    );
};

// ── App ───────────────────────────────────────────────────────────────────────

const App = () => {
    const [releases, setReleases] = useState(null);

    useEffect(() => {
        fetch('../changelog.md')
            .then(r => r.text())
            .then(md => setReleases(parseChangelog(md)))
            .catch(() => setReleases([]));
    }, []);

    return (
        <div className="bg-page text-ink min-h-screen flex flex-col font-sans selection:bg-accent selection:text-page">

            <Topbar crumbs={[{ label: 'Cheevodex', href: '../profile/' }, { label: 'Changelog' }]} />

            {/* Header */}
            <header className="bg-box border-b border-line px-4 md:px-8 pt-8 pb-5 md:pt-5 shadow-md">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <span className="w-[3px] h-6 bg-accent rounded-[1px] shrink-0" />
                        <h1 className="text-2xl md:text-[26px] text-white font-medium tracking-wide leading-none flex items-center gap-3">
                            <GitCommit size={22} className="text-accent" /> Changelog
                        </h1>
                        {releases && (
                            <span className="ml-2 text-[9px] font-semibold uppercase tracking-[0.07em] px-2 py-[3px] rounded-[2px] border border-line-2 bg-well text-ink-3">
                                <span className="text-ink">{releases.length}</span> releases
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 flex-1 w-full">
                {releases === null ? (
                    <div className="flex flex-col gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="shimmer w-2.5 h-2.5 rounded-full shrink-0" />
                                <div className="shimmer h-3 w-28 rounded" />
                                <div className="flex-1 h-px bg-line-soft" />
                                <div className="shimmer h-2.5 w-16 rounded" />
                            </div>
                        ))}
                    </div>
                ) : releases.length === 0 ? (
                    <div className="text-center py-16 text-ink-3 text-[11px]">Could not load changelog.</div>
                ) : (
                    <div className="flex flex-col">
                        {releases.map((r, i) => (
                            <Release key={r.date} date={r.date} summary={r.summary} sections={r.sections} defaultOpen={i === 0} />
                        ))}
                    </div>
                )}
            </main>

            <Footer label="Cheevodex · Changelog" />

        </div>
    );
};

createRoot(document.getElementById('root')).render(<App />);
