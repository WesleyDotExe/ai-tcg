// Render session 19: sideways-overflow check for a replay page. Not a repo dependency:
// run from a scratch folder with playwright-core installed, against the
// preinstalled Chromium: node narrow-overflow-check.mjs <replay.html> [shotPrefix]
import { chromium } from 'playwright-core';
const [file, shotPrefix] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const w of [360, 390, 600, 768, 900, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file); await p.waitForTimeout(400);
  const n = await p.evaluate(() => Number(document.getElementById('scrubber').max));
  let worst = 0, worstAt = -1;
  for (let k = 0; k <= n; k += 3) {
    const sw = await p.evaluate((k) => { const s = document.getElementById('scrubber'); s.value = String(k); s.dispatchEvent(new Event('input')); return document.documentElement.scrollWidth; }, k);
    if (sw - w > worst) { worst = sw - w; worstAt = k; }
  }
  console.log(w, 'frames', n + 1, 'max overflow px', worst, 'at', worstAt, errs.length ? 'ERRORS ' + errs.slice(0, 2).join(';') : 'no errors');
  if (shotPrefix && [390, 768].includes(w)) {
    await p.evaluate((k) => { const s = document.getElementById('scrubber'); s.value = String(k); s.dispatchEvent(new Event('input')); }, Math.floor(n * 0.7));
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${shotPrefix}-${w}.png`, fullPage: true });
  }
  await p.close();
}
await b.close();
