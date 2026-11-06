// The demos' fetch (session 81, hardening; owner 2026-11-06 after PR #141's
// `ladder-demo-002-live` crash in CI). The race it handles: a request is
// written on a reused keep-alive socket just as the server closes it, after a
// long synchronous ladder tick made the server's keep-alive timeout overdue,
// so the client gets `read ECONNRESET`. Here on a real server in this process.

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { demoFetch, isConnectionReset } from "../src/dev/demoFetch.js";

let server: Server | null = null;
let handled = 0;

/** A server that answers `ok <n>`, but destroys the socket the moment the
 * `dropAt`-th request arrives, without answering: what the client sees when
 * the server's overdue keep-alive timeout closes the socket it has just
 * written to (the race in the session 81 trace: the server's `_onTimeout` ->
 * `destroy`, then the client's `read ECONNRESET`). The timing of the real race
 * depends on which timer fires first after a blocked loop, so the test makes
 * it happen on purpose rather than by blocking. */
async function start(dropAt: number): Promise<string> {
  handled = 0;
  let seen = 0;
  server = createServer((req, res) => {
    if (++seen === dropAt) {
      req.socket.destroy();
      return;
    }
    handled++;
    req.resume();
    req.on("end", () => res.writeHead(200, { "Content-Type": "text/plain" }).end(`ok ${handled}`));
  });
  await new Promise<void>((r) => server!.listen(0, r));
  return `http://localhost:${(server.address() as AddressInfo).port}/`;
}

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((r) => server!.close(() => r()));
    server = null;
  }
});

describe("demoFetch: a reset keep-alive socket is retried on a fresh connection", () => {
  it("plain fetch fails when the server closes the reused socket under the request (the CI failure)", async () => {
    const url = await start(2);
    expect(await (await fetch(url)).text()).toBe("ok 1");
    const err = await fetch(url).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).not.toBeNull();
    expect(isConnectionReset(err)).toBe(true);
    expect(handled).toBe(1); // the server never answered the dropped request
  });

  it("demoFetch gets the answer in the same situation, on a fresh connection, and it is answered exactly once", async () => {
    const url = await start(2);
    expect(await (await demoFetch(url)).text()).toBe("ok 1");
    const res = await demoFetch(url, { method: "POST", body: "{}" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok 2");
    expect(handled).toBe(2);
  });

  it("an HTTP error status is returned, not retried", async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response("no", { status: 500 });
    }) as typeof fetch;
    const res = await demoFetch("http://x/", undefined, fake);
    expect(res.status).toBe(500);
    expect(calls).toBe(1);
  });

  it("any other error (a refused connection) is thrown at once, not retried", async () => {
    let calls = 0;
    const refused = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
    const fake = (async () => {
      calls++;
      throw refused;
    }) as typeof fetch;
    await expect(demoFetch("http://x/", undefined, fake)).rejects.toBe(refused);
    expect(calls).toBe(1);
  });

  it("a reset that keeps happening gives up after 3 retries and throws the reset", async () => {
    let calls = 0;
    const reset = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET", syscall: "read" }) });
    const fake = (async () => {
      calls++;
      throw reset;
    }) as typeof fetch;
    await expect(demoFetch("http://x/", undefined, fake)).rejects.toBe(reset);
    expect(calls).toBe(4);
  });
});

describe("every demo that calls its own server goes through demoFetch", () => {
  it("no file in src/dev calls a bare fetch(", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dev = join(dirname(fileURLToPath(import.meta.url)), "../src/dev");
    const bare = readdirSync(dev)
      .filter((f) => f.endsWith(".ts") && f !== "demoFetch.ts")
      .filter((f) => /(?<![\w.])fetch\(/.test(readFileSync(join(dev, f), "utf8")));
    expect(bare).toEqual([]);
  });
});
