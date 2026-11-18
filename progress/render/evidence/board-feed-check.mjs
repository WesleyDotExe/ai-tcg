// Render session 23: the board agrees with the feed, and floating labels
// shrink with a zoomed row. Not a repo dependency: since render session 81
// Playwright comes from render/ci/pw.mjs (PW_CHROME names another browser):
//   node board-feed-check.mjs <shotDir> <replay.html>...
// For each replay, stepping move by move with ArrowRight (so every FX plays):
//   - every cast tag the board spawns is counted; per move it must equal the
//     feed-side count: casts, plus triggers the feed kept (frame.quietTriggers
//     lists the ones it dropped);
//   - at 580 px (rows zoomed to keep six cards on one line) every label
//     floated over a board card (.fx-number, .fx-cast-tag) must carry the
//     card's zoom as its scale; at 1280 px none is scaled;
//   - no page errors.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
const [shotDir, ...files] = process.argv.slice(2);
const b = await chromium.launch(launchOpts({}));
let fails = 0;
for (const file of files) {
  for (const w of [1280, 580]) {
    const p = await b.newPage({ viewport: { width: w, height: 1100 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + file); await p.waitForTimeout(300);
    await p.evaluate(() => {
      window.__tags = []; window.__labels = [];
      // The zoom of the row the label's card sits in (both rows fit alike).
      const card = () => Number(document.getElementById('board-p1').style.zoom) || 1;
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.classList.contains('fx-cast-tag')) window.__tags.push(n.textContent);
        if (n.classList.contains('fx-cast-tag') || n.classList.contains('fx-number')) window.__labels.push({ cls: n.className, text: n.textContent, scale: n.style.scale || '1', zoom: card() });
      }))).observe(document.body, { childList: true, subtree: true });
    });
    const n = await p.evaluate(() => Number(document.getElementById('scrubber').max));
    const problems = [];
    let tags = 0, want = 0, quiet = 0;
    for (let k = 1; k <= n; k++) {
      await p.evaluate(() => { window.__tags.length = 0; });
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(40);
      // Tags can wait on a strike or a "cast, then effect" beat; the next
      // step flushes anything still waiting, so read after a full window.
      const r = await p.evaluate((k) => new Promise((res) => setTimeout(() => {
        const f = JSON.parse(document.getElementById('match-data').textContent).frames[k];
        const q = new Set(f.quietTriggers || []);
        const evs = f.newEvents.map((e) => e.event);
        const want = evs.filter((e, j) => e.type === 'cast' || (e.type === 'abilityTrigger' && !q.has(j))).length;
        res({ got: window.__tags.length, want, quiet: q.size });
      }, 1700)), k);
      tags += r.got; want += r.want; quiet += r.quiet;
      if (r.got !== r.want) problems.push(`move ${k}: ${r.got} cast tags, feed says ${r.want}`);
    }
    const labels = await p.evaluate(() => window.__labels);
    const zoomed = await p.evaluate(() => Number(document.getElementById('board-p1').style.zoom) || 1);
    let scaled = 0, unscaled = 0;
    for (const l of labels) { if (Number(l.scale) < 0.999) scaled++; else unscaled++; }
    if (w === 1280 && scaled) problems.push(`${scaled} labels scaled at full size`);
    if (w === 580 && Math.abs(zoomed - 1) > 0.01) {
      const wrong = labels.filter((l) => Number(l.scale) < 0.999 && Math.abs(Number(l.scale) - l.zoom) > 0.01);
      if (wrong.length) problems.push(`${wrong.length} labels scaled to something other than the row zoom: ` + wrong.slice(0, 3).map((l) => `${l.text} ${l.scale}`).join(', '));
      if (!scaled) problems.push('no label scaled on a zoomed row');
    }
    if (errs.length) problems.push('page errors: ' + errs.slice(0, 2).join('; '));
    const name = file.split('/').pop();
    console.log(`${name} @${w}px (card zoom ${zoomed.toFixed(3)}): ${n} moves, ${tags} cast tags (feed: ${want}), ${quiet} quiet triggers with no tag; labels ${scaled} scaled / ${unscaled} full — ${problems.length ? 'FAIL ' + problems.slice(0, 4).join(' | ') : 'ok'}`);
    if (problems.length) fails++;
    await p.close();
  }
}
console.log(fails ? `${fails} FAILED` : 'all passed');
await b.close();
