// The one Playwright lookup for the render lane's by-hand browser checks
// (render session 80, a hardening pass). The old checks under
// progress/render/evidence/ each imported Playwright their own way (a bare
// 'playwright-core', which doesn't resolve from that folder, or one machine's
// /opt path) and launched one machine's Chromium build by path
// (chromium-1194), so most of them no longer started at all. They import this
// instead: the same lookup as render/ci/browser-check.mjs (PW_CORE first), and
// Playwright's own browser unless PW_CHROME names another.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadChromium() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); if (m.chromium) return m.chromium; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

/** Launch options for a check: its own args, plus PW_CHROME's binary when set. */
export function launchOpts(opts = {}) {
  return { ...opts, ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) };
}

export const chromium = await loadChromium();
