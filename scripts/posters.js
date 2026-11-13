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
 *
 * Output: docs/images/shots/*.webp (screenshots, 2x) and docs/images/{hero,phones,desktop}.jpg (posters)
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
    const shots = [
        ['dex', '/profile/?tab=dex', PHONE], ['activity', '/profile/?tab=activity', PHONE], ['backlog', '/profile/?tab=backlog', PHONE],
        ['overview', '/profile/?tab=overview', PHONE], ['d-dex', '/profile/?tab=dex', DESK], ['d-activity', '/profile/?tab=activity', DESK],
        ['d-stats', '/profile/?tab=stats', DESK], ['game', null, PHONE], ['d-game', null, DESK],
    ];
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
        if (name === 'activity' || name === 'backlog') {   // phones: start at the tab's content, under the profile header
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

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@600&family=Geist:wght@400;500;600&display=swap');
* { box-sizing: border-box; margin: 0; }
body { width: 1600px; height: 900px; overflow: hidden; background: #111111; color: #e8e5df; font-family: Geist, system-ui, sans-serif; }
.px { font-family: 'Pixelify Sans', Geist, sans-serif; font-weight: 600; }
.blue { color: #2c97fa; } .gold { color: #f2b731; }
.brand { display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 700; }
.brand img { width: 36px; height: 36px; image-rendering: pixelated; }
.desk { border-radius: 10px; box-shadow: 0 0 0 1px #363431, 0 40px 80px -24px rgba(0,0,0,.9); display: block; }
.phone { border-radius: 26px; box-shadow: 0 0 0 10px #1a1918, 0 0 0 11px #363431, 0 40px 80px -24px rgba(0,0,0,.9); display: block; }
.label { font-size: 22px; color: #9b968e; }
`;

const posters = {
    hero: () => `
<div style="position:absolute;inset:0;padding:96px 0 0 96px">
  <div class="brand"><img src="${mark}"><span>Cheevo<span class="blue">dex</span></span></div>
  <h1 class="px" style="font-size:84px;line-height:1;margin-top:56px">Every <span class="gold">unlock,</span><br>in your own<br><span class="blue">dex.</span></h1>
  <p style="font-size:26px;line-height:1.45;color:#9b968e;margin-top:36px;max-width:22ch">A pocket companion for RetroAchievements. Every game you have played, numbered, ringed and ready on your phone.</p>
</div>
<img class="desk" src="${shot('d-dex')}" style="position:absolute;left:760px;top:120px;width:1000px">
<img class="phone" src="${shot('game')}" style="position:absolute;left:690px;top:330px;width:260px">`,

    phones: () => {
        const cols = [['dex', 'The Dex'], ['game', 'A dex record'], ['activity', 'Activity'], ['backlog', 'Backlog']];
        return `
<div style="display:flex;justify-content:center;gap:56px;padding-top:70px">
  ${cols.map(([s, l]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:26px"><span class="label px" style="color:#e8e5df;font-size:26px">${l}</span><img class="phone" src="${shot(s)}" style="width:300px"></div>`).join('')}
</div>`;
    },

    desktop: () => `
<img class="desk" src="${shot('d-game')}" style="position:absolute;left:70px;top:70px;width:900px">
<img class="desk" src="${shot('d-stats')}" style="position:absolute;left:630px;top:290px;width:900px">
<span class="label px" style="position:absolute;left:70px;top:640px;font-size:28px;color:#e8e5df">A game's dex record</span>
<span class="label px" style="position:absolute;right:70px;top:230px;font-size:28px;color:#e8e5df">Your year in stats</span>`,
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
    const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 180000 });
    try {
        if (CAPTURE) await capture(browser);
        await render(browser);
    } finally {
        await browser.close();
    }
})();
