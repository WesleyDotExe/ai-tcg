import { chromium } from 'playwright-core';
const [file, shotPrefix] = process.argv.slice(2);
// Run from a scratch folder with playwright-core installed: node board-fit-check.mjs <replay.html> [shotPrefix]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const w of [360, 390, 430, 540, 560, 600, 680, 768, 900, 1040, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file); await p.waitForTimeout(300);
  const n = await p.evaluate(() => Number(document.getElementById('scrubber').max));
  let worstOverflow = 0, maxLines = 0, minLines = 9, interleave = 0, offRow = 0, fit = '';
  for (let k = 0; k <= n; k += 4) {
    const r = await p.evaluate((k) => {
      const s = document.getElementById('scrubber'); s.value = String(k); s.dispatchEvent(new Event('input'));
      const out = { sw: document.documentElement.scrollWidth, lines: {}, bottomP2: 0, topP1: 0, offRow: 0 };
      for (const pid of ['p1', 'p2']) {
        const row = document.getElementById('board-' + pid);
        const rr = row.getBoundingClientRect();
        const tops = new Set(); let lo = Infinity, hi = -Infinity;
        for (const c of row.children) { const q = c.getBoundingClientRect(); tops.add(Math.round(q.top)); lo = Math.min(lo, q.top); hi = Math.max(hi, q.bottom);
          if (q.left < rr.left - 1 || q.right > rr.right + 1) out.offRow++; }
        out.lines[pid] = tops.size; out[pid] = { lo, hi, fit: row.dataset.fit, cw: row.children[0].getBoundingClientRect().width };
      }
      return out;
    }, k);
    worstOverflow = Math.max(worstOverflow, r.sw - w);
    for (const pid of ['p1','p2']) { maxLines = Math.max(maxLines, r.lines[pid]); minLines = Math.min(minLines, r.lines[pid]); }
    if (r.p2.hi > r.p1.lo) interleave++;
    offRow += r.offRow; fit = r.p1.fit + ' card ' + r.p1.cw.toFixed(1) + 'px';
  }
  console.log(String(w).padStart(5), 'fit', fit, 'lines', minLines + '-' + maxLines, 'overflow', worstOverflow, 'interleave', interleave, 'offRow', offRow, errs.length ? 'ERR ' + errs[0] : 'ok');
  if (shotPrefix && [390, 600, 768].includes(w)) {
    await p.evaluate((k) => { const s = document.getElementById('scrubber'); s.value = String(k); s.dispatchEvent(new Event('input')); }, 90);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${shotPrefix}-${w}.png`, fullPage: true });
  }
  await p.close();
}
await b.close();
