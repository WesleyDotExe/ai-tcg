// Serves the owner website (Season 0 render item 1, render session 44).
//
// OWNER_API.md says the website is served from the same origin as the API
// (no CORS). The owner API itself serves only /api, and it is the game
// lane's; so until it serves the page too, this small host does: the page
// at / and every /api request passed through, unchanged, to the owner API.
// One origin for the browser, nothing added to the server. If the game lane
// later serves the page from the owner API, this host is no longer needed
// (raised in progress/render/notes-for-owner.md).
//
//   npm run site -w @ai-tcg/render -- [--api http://localhost:8081] [--port 8080] [--host 127.0.0.1]

import { createServer, request, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { renderSiteLoadoutPage, renderSitePackPage, renderSitePage } from "./sitePage.js";
import { renderMatchHtml } from "../renderHtml.js";
import { replayOfFile } from "./siteReplay.js";
import type { SiteMatchView } from "./siteApi.js";
import type { ReplayFile } from "../../../server/src/ladder/ladderRunner.js";

export interface SiteHostOptions {
  /** The owner API's origin, e.g. "http://localhost:8081". */
  api: string;
  /** 0 lets the OS pick (tests). Defaults to 8080. */
  port?: number;
  /** Defaults to 127.0.0.1; "0.0.0.0" serves the home network. */
  host?: string;
  /** The page to serve (defaults to renderSitePage()). */
  page?: string;
  /** The full-screen pack opening's page (defaults to renderSitePackPage()). */
  packPage?: string;
  /** The full-screen loadout picker's page (defaults to renderSiteLoadoutPage()). */
  loadoutPage?: string;
  /** How many built replay pages are kept (default 6; each is about 2 MB). */
  replayPages?: number;
}

/** A built replay page lives this long after it was built (10 min). */
export const REPLAY_PAGE_TTL_MS = 10 * 60_000;

export interface RunningSiteHost {
  readonly port: number;
  close(): Promise<void>;
}

/** The page runs only its own inline script and styles and talks only to
 * its own origin (2026-10-05 A: no external services). */
const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  // frame-src 'self': the full-screen pack opening is this host's own
  // /pack-opening page in a frame (session 47), and the loadout picker its
  // /loadout page (session 49).
  "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
/** The pack opening's page and the loadout picker's (session 49): the same
 * rules, but they may only be framed by this origin (the website), and they
 * fetch nothing at all (the website hands them what to show and makes the
 * server calls). */
const PACK_PAGE_HEADERS = {
  ...PAGE_HEADERS,
  "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
};

/** The request headers passed to the API: what the owner API reads. */
const FORWARD = ["authorization", "content-type", "content-length", "accept"];

export function startSiteHost(options: SiteHostOptions): Promise<RunningSiteHost> {
  const page = options.page ?? renderSitePage();
  const packPage = options.packPage ?? renderSitePackPage();
  const loadoutPage = options.loadoutPage ?? renderSiteLoadoutPage();
  const api = new URL(options.api);

  // Render session 50: a recorded match's full arena replay. The website
  // asks with the owner's token (`POST /replay-page/:matchId`); the host
  // reads the record and the replay file over the API with that same
  // token (so the API's own rules decide who may see it), rebuilds the
  // match in the engine, and keeps the page under a random key for a few
  // minutes. The website frames `/replay/<key>`. Nothing is kept on
  // disk, and a key opens one page, not the API.
  const built = new Map<string, { html: string; at: number }>();
  const keep = options.replayPages ?? 6;
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const buildReplay = async (req: IncomingMessage, res: ServerResponse, matchId: string) => {
    const auth = req.headers.authorization;
    const get = async (path: string): Promise<{ status: number; body: unknown }> => {
      const r = await fetch(new URL(path, api), { headers: auth ? { authorization: auth } : {} });
      const text = await r.text();
      let body: unknown = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: `the owner API's answer wasn't JSON (HTTP ${r.status})` };
      }
      return { status: r.status, body };
    };
    let view: { status: number; body: unknown };
    let file: { status: number; body: unknown };
    try {
      const id = encodeURIComponent(matchId);
      view = await get(`/api/matches/${id}`);
      if (view.status !== 200) return json(res, view.status, view.body);
      file = await get(`/api/matches/${id}/replay`);
      if (file.status !== 200) return json(res, file.status, file.body);
    } catch {
      return json(res, 502, { error: "the owner API can't be reached" });
    }
    let html: string;
    let frames: number;
    let turns: number;
    try {
      const replay = await replayOfFile(file.body as ReplayFile, view.body as SiteMatchView);
      html = renderMatchHtml(replay);
      frames = replay.movesPlayed;
      turns = replay.frames[replay.frames.length - 1]!.turnNumber;
    } catch (err) {
      // The file doesn't rebuild in this engine: say so, never show another match.
      return json(res, 422, { error: `this replay can't be rebuilt: ${err instanceof Error ? err.message : String(err)}` });
    }
    const now = Date.now();
    for (const [k, v] of built) if (now - v.at > REPLAY_PAGE_TTL_MS) built.delete(k);
    while (built.size >= keep) built.delete(built.keys().next().value!);
    const key = randomBytes(18).toString("base64url");
    built.set(key, { html, at: now });
    return json(res, 201, { url: `/replay/${key}`, moves: frames, turns });
  };

  const proxy = (req: IncomingMessage, res: ServerResponse) => {
    const headers: Record<string, string> = {};
    for (const h of FORWARD) {
      const v = req.headers[h];
      if (typeof v === "string") headers[h] = v;
    }
    const up = request(
      { protocol: api.protocol, hostname: api.hostname, port: api.port, method: req.method, path: req.url, headers },
      (answer) => {
        const out: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(answer.headers)) if (v !== undefined && k !== "connection" && k !== "keep-alive" && k !== "transfer-encoding") out[k] = v;
        res.writeHead(answer.statusCode ?? 502, out);
        answer.pipe(res);
      },
    );
    up.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ error: "the owner API can't be reached" }));
      } else res.destroy();
    });
    req.pipe(up);
  };

  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://site").pathname;
    if (path === "/api" || path.startsWith("/api/")) return proxy(req, res);
    const ask = /^\/replay-page\/([A-Za-z0-9_-]{1,128})$/.exec(path);
    if (ask) {
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST" });
        return res.end();
      }
      req.resume();
      void buildReplay(req, res, ask[1]!);
      return;
    }
    const shown = /^\/replay\/([A-Za-z0-9_-]{24})$/.exec(path);
    if (shown) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD" });
        return res.end();
      }
      const page = built.get(shown[1]!);
      if (!page || Date.now() - page.at > REPLAY_PAGE_TTL_MS) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        return res.end("This replay page has expired. Open the replay again from Match history.");
      }
      res.writeHead(200, PACK_PAGE_HEADERS);
      return res.end(req.method === "HEAD" ? undefined : page.html);
    }
    const served = path === "/" || path === "/index.html" ? { body: page, headers: PAGE_HEADERS } : path === "/pack-opening" ? { body: packPage, headers: PACK_PAGE_HEADERS } : path === "/loadout" ? { body: loadoutPage, headers: PACK_PAGE_HEADERS } : null;
    if (served) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD" });
        return res.end();
      }
      res.writeHead(200, served.headers);
      return res.end(req.method === "HEAD" ? undefined : served.body);
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 8080, options.host ?? "127.0.0.1", () => {
      resolveStart({
        port: (server.address() as AddressInfo).port,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const host = await startSiteHost({ api: arg("api") ?? "http://localhost:8081", port: Number(arg("port") ?? 8080), host: arg("host") });
  console.log(`[site] http://${arg("host") ?? "127.0.0.1"}:${host.port}/  (API: ${arg("api") ?? "http://localhost:8081"})`);
}
