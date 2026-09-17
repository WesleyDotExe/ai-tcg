// Public barrel so this package's reference client + decision logic is
// reusable as `@ai-tcg/agents` (e.g. by server/'s integration tests, which
// drive a real server with real reference clients rather than reimplementing
// a socket client of their own) — mirrors the barrel pattern already used by
// @ai-tcg/engine and @ai-tcg/protocol.
export * from "./client.js";
export * from "./randomDecision.js";
export * from "./aggressiveDecision.js";
export * from "./rng.js";
