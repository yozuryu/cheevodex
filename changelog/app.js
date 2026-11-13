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
            ? <code key={i} className="clog-code">{part.slice(1, -1)}</code>
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

// "v26.11.13" → "13 Nov 2026" (versions are YY.MM.DD dates)
const versionDate = (v) => {
    const m = v.match(/^v(\d{2})\.(\d{2})\.(\d{2})/);
    if (!m) return null;
    const d = new Date(2000 + +m[1], +m[2] - 1, +m[3]);
    return isNaN(d) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const splitTitle = (date) => {
    const [rawVersion, ...labelParts] = date.split('—');
    return { version: rawVersion.trim(), label: labelParts.join('—').trim() };
};
const slug = (v) => 'r-' + v.replace(/[^\w]+/g, '-');

const Entry = ({ text }) => (
    <li className="clog-e">
        <i style={{ background: 'var(--line-2)' }} />
        <span>{renderText(text)}</span>
    </li>
);

// A section as an index line: diamond in the section's colour, name, dotted leader, change count; opens to its entries
const Section = ({ title, entries, defaultOpen }) => {
    const [open, setOpen] = useState(defaultOpen);
    const color = sectionColor(title);
    return (
        <div className="clog-s">
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="dl-row clog-sh">
                <span className="dl-k"><i style={{ background: color }} />{title}</span>
                <span className="dl-dots" />
                <span className="dl-v">{entries.length}</span>
                <ChevronDown size={12} className={`text-ink-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul className="clog-es anim-fade">
                    {entries.map((e, i) => <Entry key={i} text={e} />)}
                </ul>
            )}
        </div>
    );
};

// A release as a volume: sticky heading with the version in mono, its date and change count; opens to its sections
const Release = ({ date, summary, sections, defaultOpen }) => {
    const [open, setOpen] = useState(defaultOpen);
    const totalEntries = sections.reduce((s, sec) => s + sec.entries.length, 0);
    const { version, label } = splitTitle(date);
    const when = versionDate(version);
    return (
        <section id={slug(version)} className="dvol clog-r">
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="dvol-h clog-rh">
                <span className="sec-mark sm" />
                <span className="clog-v">{version}</span>
                <span className="dvol-t">{label || when}</span>
                <span className="dvol-m">
                    <span><b className="text-ink-2">{totalEntries}</b> change{totalEntries !== 1 ? 's' : ''}</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>
            {(open || summary || (label && when)) && (
                <div className="clog-meta">
                    {label && when && <span className="num">{when}</span>}
                    {summary && <p>{renderText(summary)}</p>}
                </div>
            )}
            {open && (
                <div className="dledger clog-ss anim-fade">
                    {sortSections(sections).map(sec => <Section key={sec.title} title={sec.title} entries={sec.entries} defaultOpen={defaultOpen} />)}
                </div>
            )}
        </section>
    );
};

// ── App ───────────────────────────────────────────────────────────────────────

const App = () => {
    const [releases, setReleases] = useState(null);
    const [allJumps, setAllJumps] = useState(false);

    useEffect(() => {
        fetch('../changelog.md')
            .then(r => r.text())
            .then(md => setReleases(parseChangelog(md)))
            .catch(() => setReleases([]));
    }, []);

    const total = releases ? releases.reduce((t, r) => t + r.sections.reduce((s, sec) => s + sec.entries.length, 0), 0) : 0;
    const first = releases?.length ? splitTitle(releases[releases.length - 1].date).version : null;
    const jumps = releases ? (allJumps ? releases : releases.slice(0, 6)) : [];

    return (
        <div className="bg-page text-ink min-h-screen flex flex-col font-sans selection:bg-accent selection:text-page">

            <Topbar crumbs={[{ label: 'Cheevodex', href: '../profile/' }, { label: 'Changelog' }]} />

            <header className="phead">
                <div className="phead-in max-w-3xl">
                    <div className="flex items-center gap-2.5">
                        <span className="sec-mark" />
                        <h1 className="text-[22px] font-semibold text-ink leading-tight tracking-[-0.01em] flex items-center gap-2.5">
                            <GitCommit size={20} className="text-accent" /> Changelog
                        </h1>
                    </div>
                    {releases && releases.length > 0 && (
                        <div className="dledger clog-sum">
                            <div className="dl-row"><span className="dl-k">Releases</span><span className="dl-dots" /><span className="dl-v">{releases.length}</span></div>
                            <div className="dl-row"><span className="dl-k">Changes</span><span className="dl-dots" /><span className="dl-v">{total.toLocaleString()}</span></div>
                            <div className="dl-row"><span className="dl-k">Since</span><span className="dl-dots" /><span className="dl-v">{versionDate(first) ?? first}</span></div>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 md:px-8 py-5 flex-1 w-full clog">
                {releases === null ? (
                    <div className="flex flex-col gap-3">
                        {[...Array(5)].map((_, i) => <div key={i} className="shimmer h-[34px] rounded-[2px]" />)}
                    </div>
                ) : releases.length === 0 ? (
                    <div className="text-center py-16 text-ink-3 text-[12px]">The changelog didn't load. Check your connection and reload the page.</div>
                ) : (
                    <>
                        <nav className="dindex clog-jump" aria-label="Jump to a release">
                            <span>Jump to</span>
                            {jumps.map(r => {
                                const { version } = splitTitle(r.date);
                                return <a key={version} href={`#${slug(version)}`}><b>{version}</b></a>;
                            })}
                            {releases.length > 6 && (
                                <button type="button" onClick={() => setAllJumps(o => !o)}>{allJumps ? 'fewer' : `all ${releases.length}`}</button>
                            )}
                        </nav>
                        <div className="flex flex-col">
                            {releases.map((r, i) => (
                                <Release key={r.date} date={r.date} summary={r.summary} sections={r.sections} defaultOpen={i === 0} />
                            ))}
                        </div>
                    </>
                )}
            </main>

            <Footer label="Cheevodex · Changelog" />

        </div>
    );
};

createRoot(document.getElementById('root')).render(<App />);
