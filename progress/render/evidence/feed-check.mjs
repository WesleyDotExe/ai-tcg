// Render session 21: the match feed in a real browser. Not a repo dependency:
// run from a scratch folder with playwright-core installed, against the
// preinstalled Chromium: node feed-check.mjs <shotDir> <replay.html>...
// For each replay at 1280 and 390 px, on every 5th move and the last:
//   - the feed shows exactly the entries the replay carries up to that move;
//   - no feed or turn-bar text names a seat (p1 / p2) or a priority pass;
//   - the page never scrolls sideways; no page errors;
//   - the "engine log" switch shows the raw lines (one per engine event).
import { chromium } from 'playwright-core';
const [shotDir, ...files] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
for (const file of files) {
  for (const w of [1280, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 1000 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + file); await p.waitForTimeout(300);
    const n = await p.evaluate(() => Number(document.getElementById('scrubber').max));
    const problems = [];
    let checked = 0, maxOverflow = 0;
    const ks = []; for (let k = 0; k <= n; k += 5) ks.push(k); if (ks[ks.length - 1] !== n) ks.push(n);
    for (const k of ks) {
      const r = await p.evaluate((k) => {
        const s = document.getElementById('scrubber'); s.value = String(k); s.dispatchEvent(new Event('input'));
        const replay = JSON.parse(document.getElementById('match-data').textContent);
        let want = 0; for (let f = 0; f <= k; f++) want += replay.frames[f].feed.length;
        const shown = document.querySelectorAll('#eventlog-body .fe').length;
        const text = document.getElementById('eventlog-body').innerText + '\n' + document.getElementById('turnbar').innerText + '\n' + document.getElementById('momentum').innerText;
        return { want, shown, seat: /\b[pP][12]\b/.test(text), pass: /passes priority/.test(text), sw: document.documentElement.scrollWidth };
      }, k);
      checked++;
      if (r.want !== r.shown) problems.push(`move ${k}: ${r.shown} entries shown, ${r.want} in the replay`);
      if (r.seat) problems.push(`move ${k}: a seat name (p1/p2) is shown`);
      if (r.pass) problems.push(`move ${k}: a priority pass is shown`);
      maxOverflow = Math.max(maxOverflow, r.sw - w);
    }
    const raw = await p.evaluate((n) => {
      const box = document.getElementById('raw-log'); box.click();
      const replay = JSON.parse(document.getElementById('match-data').textContent);
      let want = 0; for (let f = 0; f <= n; f++) want += replay.frames[f].newEvents.length;
      const shown = document.querySelectorAll('#eventlog-body .ev').length;
      box.click();
      return { want, shown, back: document.querySelectorAll('#eventlog-body .fe').length > 0 };
    }, n);
    if (raw.want !== raw.shown) problems.push(`engine log: ${raw.shown} lines shown, ${raw.want} events`);
    if (!raw.back) problems.push('engine log: switching back did not restore the feed');
    if (maxOverflow > 0) problems.push(`${maxOverflow} px sideways overflow`);
    if (errs.length) problems.push('page errors: ' + errs.slice(0, 2).join('; '));
    const name = file.split('/').pop();
    console.log(`${name} @${w}px: ${checked} moves checked, raw ${raw.shown} lines vs feed — ${problems.length ? 'FAIL ' + problems.join(' | ') : 'ok'}`);
    if (problems.length) fails++;
    await p.close();
  }
}
console.log(fails ? `${fails} FAILED` : 'all passed');
await b.close();
