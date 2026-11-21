#!/usr/bin/env node
/**
 * README posters: screenshots of Cheevodex composed into the images in docs/images/.
 * Dev script, not part of the app (the app has no build step).
 *
 * Setup (one time):
 *   cd scripts && npm install
 *
 * Posters from the screenshots already in docs/images/shots/:
 *   node scripts/posters.js
 *
 * Fresh screenshots first (the app must be running, e.g. `npx serve . -l 3000` from the project root):
 *   RA_USERNAME=you RA_API_KEY=yourkey RA_GAME_ID=1234 node scripts/posters.js --capture
 *
 * Options (env vars, for --capture):
 *   APP_URL      Base URL of the running app (default: http://localhost:3000)
 *   RA_USERNAME  Your RetroAchievements username
 *   RA_API_KEY   Your RetroAchievements web API key (stays on this machine)
 *   RA_GAME_ID   A game you have progress in, for the dex record (default: your most recent game)
 *   ONLY         Comma-separated shot names to retake (default: all)
 *   CHROME_PATH  The browser to drive (default: the installed Google Chrome, else puppeteer's download)
 *
 * Output: docs/images/shots/*.webp (screenshots, 2x) and docs/images/{hero,record,friends,year,contents}.jpg (posters).
 * d-friends also writes d-friends.json: where the friend row, the feed and the details the poster labels sit on the
 * Social page (CSS pixels), so the friends poster follows the page's layout instead of fixed positions.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs', 'images', 'shots');
const OUT = path.join(ROOT, 'docs', 'images');
const CAPTURE = process.argv.includes('--capture');

// ── Screenshots ──────────────────────────────────────────────────────────────

const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESK = { width: 1440, height: 900, deviceScaleFactor: 2 };

async function capture(browser) {
    const BASE = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const USER = process.env.RA_USERNAME, KEY = process.env.RA_API_KEY;
    if (!USER || !KEY) {
        console.error('\n--capture needs RA_USERNAME and RA_API_KEY:\n  RA_USERNAME=you RA_API_KEY=yourkey node scripts/posters.js --capture\n');
        process.exit(1);
    }
    let game = process.env.RA_GAME_ID;
    const ONLY = process.env.ONLY && process.env.ONLY.split(',');   // retake only these shots, e.g. ONLY=friends,d-friends
    const shots = [
        ['dex', '/profile/?tab=dex', PHONE], ['activity', '/profile/?tab=activity', PHONE], ['backlog', '/profile/?tab=backlog', PHONE],
        ['overview', '/profile/?tab=overview', PHONE], ['d-dex', '/profile/?tab=dex', DESK], ['d-activity', '/profile/?tab=activity', DESK],
        ['d-stats', '/profile/?tab=stats', DESK], ['game', null, PHONE], ['d-game', null, DESK],
        ['friends', '/social/', PHONE], ['d-friends', '/social/', DESK],
        ['compare', '/social/?view=following', PHONE], ['social-people', '/social/?view=following', PHONE],
        ['consoles', '/console/', PHONE], ['console', '/console/?id=21', PHONE], ['d-console', '/console/?id=21', DESK],
        ['stats', '/profile/?tab=stats', PHONE], ['d-backlog', '/profile/?tab=backlog', DESK], ['d-overview', '/profile/?tab=overview', DESK],
    ].filter(([name]) => !ONLY || ONLY.includes(name));
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [name, route, view] of shots) {
        const page = await browser.newPage();
        await page.setViewport(view);
        await page.evaluateOnNewDocument((u, k) => {
            localStorage.setItem('raCredentials', JSON.stringify({ username: u, apiKey: k }));
            localStorage.setItem('ra_pwa_dismissed_at', String(Date.now()));   // no install banner in the shot
        }, USER, KEY);
        if (!route && !game) {   // the game record: the most recent game on the Recent tab
            await page.goto(`${BASE}/profile/?tab=recent`, { waitUntil: 'networkidle0', timeout: 120000 });
            game = await page.evaluate(() => (document.querySelector('a.grow[href*="game/?id="]')?.href.match(/id=(\d+)/) || [])[1]);
        }
        const url = BASE + (route || `/game/?id=${game}&tab=achievements`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
        await new Promise(r => setTimeout(r, 2500));
        if (name.endsWith('friends')) await page.waitForFunction(() => !document.querySelector('.animate-spin') && document.querySelector('.fposts'), { timeout: 240000 });   // every friend loaded
        if (name === 'd-friends') {   // where the poster's pieces and labels are, in CSS pixels
            const layout = await page.evaluate(() => {
                const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.width, b.height]; };
                const feed = document.querySelector('.fposts')?.closest('section');
                const top = feed ? feed.getBoundingClientRect().top + scrollY : 0;
                const within = sel => [...document.querySelectorAll(sel)].find(el => { const y = el.getBoundingClientRect().top + scrollY; return y > top && y < top + 420; });
                const mid = (el, side) => { const b = el?.getBoundingClientRect(); return b ? [Math.round(side === 'r' ? b.right + scrollX : b.left + scrollX), Math.round(b.top + scrollY + b.height / 2)] : null; };
                const hcRun = within('.frun.hc');
                return { strip: r(document.querySelector('.fstrip')), feed: r(feed),
                    pts: { avatar: mid(within('.fpost-av'), 'l'), hc: hcRun ? [Math.round(hcRun.getBoundingClientRect().left + scrollX), Math.round(hcRun.getBoundingClientRect().top + scrollY + Math.min(110, hcRun.getBoundingClientRect().height - 20))] : null,
                        subset: mid(within('.frun-h .subset-tag'), 'r'), badge: mid(within('.frun-b img:last-of-type'), 'r') } };
            });
            fs.writeFileSync(path.join(SHOTS, 'd-friends.json'), JSON.stringify(layout, null, 1));
        }
        if (name === 'compare') {   // open Compare on the first person and wait for both players' progress
            await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Compare')), { timeout: 120000 });
            await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Compare')).click());
            await page.waitForSelector('.cmpr', { timeout: 120000 });
            await new Promise(r => setTimeout(r, 1500));
        }
        if (name === 'console' || name === 'd-console') await page.waitForSelector('.cn-game', { timeout: 240000 });   // the console's list saved and shown
        if (name === 'activity' || name === 'backlog' || name === 'friends' || name === 'stats' || name === 'social-people') {   // phones: start at the tab's content, under the header
            await page.evaluate(() => { const t = document.querySelector('[role=tablist]'); if (t) window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 8); });
            await new Promise(r => setTimeout(r, 800));
        }
        const png = await page.screenshot({ type: 'png' });
        fs.writeFileSync(path.join(SHOTS, name + '.png'), png);
        console.log('shot', name);
        await page.close();
    }
    console.log('Screenshots are PNG; the posters read PNG or WebP (convert to WebP to keep the repo small).');
}

// ── Posters ──────────────────────────────────────────────────────────────────

// The newest of name.png / name.webp: a fresh capture wins over an older converted copy
const shot = name => {
    const found = ['webp', 'png'].map(ext => path.join(SHOTS, `${name}.${ext}`)).filter(f => fs.existsSync(f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!found.length) throw new Error(`Missing screenshot ${name}: run with --capture`);
    const ext = path.extname(found[0]).slice(1);
    return `data:image/${ext};base64,${fs.readFileSync(found[0]).toString('base64')}`;
};
const mark = `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, 'assets', 'favicon.svg')).toString('base64')}`;

// The dex numbers of real games in the dex: the texture behind the hero
const NUMBERS = [449, 503, 508, 515, 519, 559, 575, 668, 676, 723, 748, 767, 792, 810, 1451, 2279, 3470, 11206, 14363, 16244, 19012, 19015, 19016, 19017, 19021, 20345, 17166];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&family=Silkscreen&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 1600px; height: 900px; overflow: hidden; position: relative; background: #111111; color: #e8e5df; font-family: Geist, system-ui, sans-serif; }
.px { font-family: 'Pixelify Sans', Geist, sans-serif; font-weight: 600; }
.ss { font-family: Silkscreen, monospace; }
.blue { color: #2c97fa; } .gold { color: #f2b731; } .mute { color: #9b968e; } .dim { color: #6b665f; }
.abs { position: absolute; }
.brand { display: flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 600; }
.brand img { width: 34px; height: 34px; image-rendering: pixelated; }
.desk { border-radius: 10px; box-shadow: 0 0 0 1px #363431, 0 40px 80px -24px rgba(0,0,0,.9); display: block; }
.phone { border-radius: 30px; box-shadow: 0 0 0 10px #1a1918, 0 0 0 11px #363431, 0 50px 90px -20px rgba(0,0,0,.95); display: block; }
.numbers { position: absolute; inset: -20px; display: flex; flex-wrap: wrap; gap: 18px 34px; font-family: Silkscreen, monospace; font-size: 22px; color: #191918; line-height: 1; transform: rotate(0deg); }
.leader { display: flex; align-items: baseline; gap: 12px; }
.leader i { flex: 1; border-bottom: 2px dotted #3a3835; transform: translateY(-5px); }
`;

const ring = (size, stroke, frac, color) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#1d1c1b" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c * frac} ${c}"/></svg>`;
};
// A piece of a desktop screenshot (2880 x 1800 pixels), x/y/w/h in screenshot pixels, shown dw wide
const crop = (name, x, y, w, h, dw, style = '') => {
    const k = dw / w;
    return `<div class="desk abs" style="width:${dw}px;height:${Math.round(h * k)}px;background:url('${shot(name)}') ${-x * k}px ${-y * k}px / ${2880 * k}px auto no-repeat;${style}"></div>`;
};
// A labelled callout: dotted leader from the text to a gold diamond on the target
const callout = (side, ty, tx, n, t, edge) => {
    const line = side === 'l'
        ? `<div class="abs" style="left:${edge}px;top:${ty}px;width:${tx - edge}px;border-top:2px dotted #f2b731;opacity:.7"></div>`
        : `<div class="abs" style="left:${tx}px;top:${ty}px;width:${edge - tx}px;border-top:2px dotted #f2b731;opacity:.7"></div>`;
    const box = side === 'l'
        ? `<div class="abs" style="right:${1600 - edge + 18}px;width:270px;top:${ty}px;transform:translateY(-50%);text-align:right">`
        : `<div class="abs" style="left:${edge + 18}px;width:250px;top:${ty}px;transform:translateY(-50%)">`;
    return `${line}<div class="abs" style="left:${tx - 5}px;top:${ty - 4}px;width:10px;height:10px;background:#f2b731;transform:rotate(45deg)"></div>${box}<div class="px" style="font-size:26px">${n}</div><div class="mute" style="font-size:18px;line-height:1.4;margin-top:6px">${t}</div></div>`;
};
const brand = () => `<div class="brand"><img src="${mark}"><span>Cheevo<span class="blue">dex</span></span></div>`;

const posters = {
    // Three phones standing in one big completion ring, the dex numbers behind them
    hero: () => {
        const nums = Array.from({ length: 160 }, (_, k) => `<span>No.${NUMBERS[(k * 7) % NUMBERS.length]}</span>`).join('');
        return `
<div class="numbers">${nums}</div>
<div class="abs" style="inset:0;background:radial-gradient(ellipse 60% 70% at 50% 18%, #111111 30%, rgba(17,17,17,.6) 60%, rgba(17,17,17,0) 100%)"></div>
<div class="abs" style="left:180px;top:340px;filter:drop-shadow(0 0 36px rgba(242,183,49,.3))">${ring(1240, 22, 0.83, '#f2b731')}</div>
<div class="abs" style="left:0;right:0;top:54px;display:flex;flex-direction:column;align-items:center;gap:26px">
  ${brand()}
  <h1 class="px" style="font-size:74px;line-height:1;white-space:nowrap">Every <span class="gold">unlock,</span> in your own <span class="blue">dex.</span></h1>
  <p style="font-size:24px" class="mute">A pocket companion for RetroAchievements. Free, open source, all in your browser.</p>
</div>
<img class="phone abs" src="${shot('dex')}" style="left:318px;top:404px;width:290px">
<img class="phone abs" src="${shot('activity')}" style="left:992px;top:404px;width:290px">
<img class="phone abs" src="${shot('game')}" style="left:630px;top:322px;width:340px">`;
    },

    // One dex record, taken apart: the card in the middle, what each part means around it
    record: () => {
        const X = 410, Y = 196;   // where the card's top-left sits; part positions below are in card pixels
        const parts = [
            { side: 'r', y: 75, to: 400, n: 'The dex number', t: "The game's RetroAchievements ID. Every game you touch gets one." },
            { side: 'l', y: 268, to: 190, n: 'Hardcore', t: 'Gold for hardcore, grey for softcore.' },
            { side: 'l', y: 422, to: 62, n: 'The ring', t: 'Blue in progress, silver beaten, gold mastered.' },
            { side: 'r', y: 373, to: 724, n: 'The ledger', t: 'Achievements, points and time played.' },
            { side: 'r', y: 533, to: 724, n: 'The path', t: 'A diamond per progression achievement. Light them all and it is beaten.' },
        ];
        const call = p => {
            const y = Y + p.y;
            const line = p.side === 'l'
                ? `<div class="abs" style="left:372px;top:${y}px;width:${X + p.to - 372}px;border-top:2px dotted #f2b731;opacity:.7"></div><div class="abs" style="left:${X + p.to - 5}px;top:${y - 4}px;width:10px;height:10px;background:#f2b731;transform:rotate(45deg)"></div>`
                : `<div class="abs" style="left:${X + p.to}px;top:${y}px;width:${1228 - X - p.to}px;border-top:2px dotted #f2b731;opacity:.7"></div><div class="abs" style="left:${X + p.to - 5}px;top:${y - 4}px;width:10px;height:10px;background:#f2b731;transform:rotate(45deg)"></div>`;
            const box = p.side === 'l'
                ? `<div class="abs" style="left:64px;width:290px;top:${y}px;transform:translateY(-50%);text-align:right">`
                : `<div class="abs" style="left:1246px;width:300px;top:${y}px;transform:translateY(-50%)">`;
            return `${line}${box}<div class="px" style="font-size:28px">${p.n}</div><div class="mute" style="font-size:19px;line-height:1.4;margin-top:6px">${p.t}</div></div>`;
        };
        return `
<div class="abs" style="left:0;right:0;top:58px;text-align:center">
  <h2 class="px" style="font-size:56px;line-height:1">Every game opens as a <span class="blue">record.</span></h2>
</div>
<div class="abs desk" style="left:${X}px;top:${Y}px;width:780px;height:660px;background:url('${shot('game')}') top left / 780px auto no-repeat;border-radius:16px;overflow:hidden">
  <div class="abs" style="left:0;right:0;bottom:0;height:90px;background:linear-gradient(transparent,#111111)"></div>
</div>
${parts.map(call).join('')}`;
    },

    // The Friends timeline: who you follow in a row, then their evening as posts, with what each part means
    friends: () => {
        // Placed from d-friends.json when the capture wrote one (the Social page); else the old fixed positions
        const lf = path.join(SHOTS, 'd-friends.json');
        const L = fs.existsSync(lf) ? JSON.parse(fs.readFileSync(lf, 'utf8')) : null;
        if (L && L.strip && L.feed) {
            const x0 = Math.min(L.strip[0], L.feed[0]), w = Math.max(L.strip[0] + L.strip[2], L.feed[0] + L.feed[2]) - x0;   // one column, one scale
            const DW = 960, k = DW / (w * 2), X = 320, stripH = Math.round(L.strip[3] * 2 * k), Y = 168 + stripH + 22, FH = 860;
            const at = p => p && [Math.round(X + (p[0] - x0) * 2 * k), Math.round(Y + (p[1] - L.feed[1]) * 2 * k)];
            const P = L.pts || {}, [a, b, sb, g] = [at(P.avatar), at(P.hc), at(P.subset), at(P.badge)];
            // Labels on one side need ~120px each: push a label down along its target's edge (a gold run's edge is tall)
            if (a && b && b[1] - a[1] < 130) b[1] = a[1] + 130;
            if (sb && g && Math.abs(g[1] - sb[1]) < 130) g[1] = Math.max(g[1], sb[1] + 130);
            return `
<div class="abs" style="left:0;right:0;top:52px;text-align:center"><h2 class="px" style="font-size:54px;line-height:1">Everyone you follow, on <span class="blue">one timeline.</span></h2></div>
${crop('d-friends', x0 * 2, L.strip[1] * 2, w * 2, L.strip[3] * 2, DW, `left:${X}px;top:168px`)}
${crop('d-friends', x0 * 2, L.feed[1] * 2, w * 2, FH, DW, `left:${X}px;top:${Y}px;-webkit-mask-image:linear-gradient(#000 80%,transparent)`)}
${a ? callout('l', a[1], a[0], 'A colour each', "Worked out from their name, so it never changes.", 296) : ''}
${b ? callout('l', b[1], b[0], 'Hardcore in gold', 'A gold run is hardcore, a grey one softcore.', 296) : ''}
${sb ? callout('r', sb[1], sb[0], 'Subsets tagged', 'Subset sets say so.', 1304) : ''}
${g ? callout('r', g[1], g[0], 'Every badge', 'Each run shows what it unlocked.', 1304) : ''}`;
        }
        const X = 320, Y = 290, f = 960 / 1767 * 1.44;   // timeline crop origin; f turns screen points (1440 wide) into poster pixels
        const at = (dx, dy) => [Math.round(X + (dx - 618) * f), Math.round(Y + (dy - 530) * f)];
        const [ax, ay] = at(626, 555), [bx, by] = at(693, 880), [gx, gy] = at(1150, 708), [sx, sy] = at(974, 823);
        return `
<div class="abs" style="left:0;right:0;top:52px;text-align:center"><h2 class="px" style="font-size:54px;line-height:1">Everyone you follow, on <span class="blue">one timeline.</span></h2></div>
${crop('d-friends', 890, 355, 1767, 180, 960, `left:${X}px;top:168px`)}
${crop('d-friends', 890, 763, 1767, 886, 960, `left:${X}px;top:${Y}px;-webkit-mask-image:linear-gradient(#000 80%,transparent)`)}
${callout('l', ay, ax, 'A colour each', "Worked out from their name, so it never changes.", 296)}
${callout('l', by, bx, 'Hardcore in gold', 'A gold run is hardcore, a grey one softcore.', 296)}
${callout('r', sy, sx, 'Subsets tagged', 'Subset sets say so.', 1304)}
${callout('r', gy, gx, 'Every badge', 'Each run shows what it unlocked.', 1304)}`;
    },

    // The year: the headline numbers, points month by month, and every day as a heatmap
    year: () => `
<h2 class="px abs" style="left:70px;top:72px;font-size:54px;line-height:1">Your year, <span class="gold">day by day.</span></h2>
<div class="abs" style="left:70px;top:196px;width:440px;display:flex;flex-direction:column;gap:22px">
  ${[['Unlocks', '628', 'blue'], ['Points', '2,576', 'gold'], ['Best day', '33', ''], ['Best streak', '9 days', '']].map(([k, v, c]) =>
      `<div class="leader" style="font-size:24px"><span class="mute">${k}</span><i></i><span class="${c}" style="font-family:'Geist Mono',monospace;font-weight:500;font-size:36px">${v}</span></div>`).join('')}
</div>
${crop('d-stats', 890, 410, 1767, 464, 960, 'left:570px;top:176px')}
${crop('d-activity', 890, 886, 1767, 364, 1460, 'left:70px;top:510px')}`,

    // The contents page: every part as an index line, one of them open on a desktop screen
    contents: () => {
        const lines = [['The Dex', 'every game, numbered'], ['Records', 'ring, ledger, path'], ['Activity', 'the last 14 days', true],
            ['Friends', 'one timeline'], ['Backlog', 'want to play'], ['Stats', 'the year in charts'], ['Consoles', 'every system']];
        return `
<img class="desk abs" src="${shot('d-activity')}" style="left:64px;top:132px;width:1000px">
<div class="abs" style="left:1130px;right:64px;top:150px">
  <div class="px" style="font-size:52px;line-height:1">Contents</div>
  <p class="mute" style="font-size:20px;line-height:1.45;margin-top:18px">Everything RetroAchievements knows about your games, on your phone and on your desk.</p>
  <div style="display:flex;flex-direction:column;gap:20px;margin-top:40px">
    ${lines.map(([k, v, on]) => `<div class="leader" style="font-size:22px${on ? '' : ';opacity:.55'}">
      <span class="px" style="${on ? 'color:#2c97fa' : ''}">${on ? '<span class="gold">&#9670;</span> ' : ''}${k}</span><i></i><span class="${on ? '' : 'mute'}" style="font-size:18px">${v}</span></div>`).join('')}
  </div>
</div>`;
    },
};

async function render(browser) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.5 });
    for (const [name, body] of Object.entries(posters)) {
        await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body()}</body></html>`, { waitUntil: 'load', timeout: 90000 });
        await page.evaluate(() => document.fonts.ready);
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86 });
        console.log('poster', name);
    }
    await page.close();
}

(async () => {
    // The installed Google Chrome when there is one (CHROME_PATH overrides), else puppeteer's own download
    const SYS = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const executablePath = process.env.CHROME_PATH || (fs.existsSync(SYS) ? SYS : undefined);
    const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 180000, ...(executablePath ? { executablePath } : {}) });
    try {
        if (CAPTURE) await capture(browser);
        await render(browser);
    } finally {
        await browser.close();
    }
})();
