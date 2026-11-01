// Render session 46: what the widget board's glass costs the liquid
// background, in software WebGL (SwiftShader; this machine has no GPU, so
// these are floors, not what a Mac's GPU does). Home with the recommended
// board, the liquid left 8 s to step its resolution down, then its frames
// counted over 3 s, once as built and once with each suspect switched off.
// Found: the tiles' backdrop-filter is the cost (session 45's two panels drew
// 25 fps; the nine-tile board 16). The blur radius doesn't matter (16 px drew
// the same as 30 px); its presence does.
//
//   node progress/render/evidence/board-glass-cost-s46.mjs
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PW_CORE ?? '/opt/node-tools/node_modules/playwright-core/index.mjs');
const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: new URL('../../../render/', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'ignore'], detached: true });
const url = await new Promise((ok) => { let b=''; demo.stdout.on('data', d => { b+=d; const m=/\[site-demo\] (http:\/\/\S+)/.exec(b); if (m) ok(m[1]); }); });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const variants = {
  as_built: '',
  no_grid: '#wgrid{display:none!important}',
  no_backdrop: '.wg{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  no_before_blend: '.wg::before{display:none!important}',
  no_backdrop_no_before: '.wg{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.wg::before{display:none!important}',
  no_mc_pk: '.mc,.pk,.ring{display:none!important}',
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));
for (const [name, css] of Object.entries(variants)) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(url); await page.fill('#si-login','nova'); await page.fill('#si-pass','a long demo password'); await page.click('#si-go');
  await page.waitForSelector('#wgrid'); if (css) await page.addStyleTag({ content: css });
  await wait(8000); // let it step down
  const a = await page.evaluate(() => window.__site.liquid()); await wait(3000); const b = await page.evaluate(() => window.__site.liquid());
  console.log(name.padEnd(24), 'scale', b.scale, 'fps', ((b.frames - a.frames) / 3).toFixed(1));
  await page.context().close();
}
await browser.close(); process.kill(-demo.pid); process.exit(0);
