// `fetch` for the demos that call their own owner API in the same process
// (session 81, hardening; owner 2026-11-06 after PR #141's failed CI run).
//
// The cause it handles: a demo's server and client share one event loop, and
// the work between two calls (a ladder tick building decks and playing
// matches) can block that loop for longer than the server's keep-alive
// timeout (Node's default, 5 s). When the loop frees up, the demo's next
// request is written on the idle keep-alive socket first, and then the
// server's overdue timeout closes that socket with the request unread, so the
// client sees `read ECONNRESET`. On GitHub's runners, with four demos at
// once, `ladder-demo-002-live`'s first round blocked long enough; locally it
// didn't. Reproduced by pinning the demo and three busy loops to one core: an
// 11 s gap, then the reset, every run (progress/demo-reliability-001.txt).
//
// What a real client does about it: a browser retries a request when a
// reused connection is reset or closed before any of the response arrived,
// because the server never handled it. This does the same, on a fresh
// connection, up to 3 times; any other error, or an HTTP error status, is
// returned or thrown as before. Nothing is printed to stdout, so a demo's
// output is unchanged; each retry is noted on stderr.

const RETRYABLE = new Set(["ECONNRESET", "EPIPE", "ECONNABORTED", "UND_ERR_SOCKET", "UND_ERR_CLOSED"]);
const MAX_RETRIES = 3;

/** The connection was reset or closed before a response: the request was never handled. */
export function isConnectionReset(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 4; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && RETRYABLE.has(code)) return true;
  }
  return false;
}

/** How many requests were retried this process (for a demo's own checks, if it wants them). */
export let demoFetchRetries = 0;

export async function demoFetch(input: string | URL, init?: RequestInit, fetchImpl: typeof fetch = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchImpl(input, init);
    } catch (err) {
      if (!isConnectionReset(err) || attempt >= MAX_RETRIES) throw err;
      demoFetchRetries++;
      process.stderr.write(`[demoFetch] ${init?.method ?? "GET"} ${String(input)}: connection reset before a response; retry ${attempt + 1} of ${MAX_RETRIES}\n`);
    }
  }
}
