import { writeFileSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import { buildCortexDeck, buildPlayerView, buildSwarmDeck, formatLog, runMatch, type PlayerId } from "@ai-tcg/engine";
import type { ClientMessage } from "@ai-tcg/protocol";
import { AgentFault, RemoteAgent } from "./remoteAgent.js";

// Stage-2 scope, named plainly rather than hidden (see PROTOCOL.md "Not yet
// covered"): this server hosts exactly one 1v1 match between the first two
// agents that connect, on fixed built-in test decks, then the returned
// `matchEnded` promise settles. Real matchmaking, deck submission, and a
// long-lived multi-match server are stage 4/5 work.
const HELLO_TIMEOUT_MS = 10_000;

export interface StartServerOptions {
  /** Port to listen on. 0 lets the OS assign a free port — `RunningServer.port`
   * reports what was actually bound, which is what makes this safely usable
   * from parallel automated tests. Defaults to 8080. */
  port?: number;
  seed?: number;
  /** If set, the resolved match's formatted log is written here, same as
   * `cli.ts`'s optional fourth argument. */
  logPath?: string;
}

export type MatchOutcome =
  | { kind: "resolved"; winner: PlayerId | "draw"; turns: number; movesPlayed: number }
  | { kind: "fault"; winner: PlayerId; message: string }
  | { kind: "error"; message: string };

export interface RunningServer {
  readonly port: number;
  readonly wss: WebSocketServer;
  /** Resolves once the single hosted match has settled — resolved normally,
   * forfeited on a protocol fault, or hit an unexpected engine error. */
  readonly matchEnded: Promise<MatchOutcome>;
  close(): void;
}

function awaitHello(socket: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no hello within ${HELLO_TIMEOUT_MS}ms`)), HELLO_TIMEOUT_MS);
    socket.once("message", (data) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(data.toString()) as ClientMessage;
        if (parsed.type !== "hello") {
          reject(new Error(`expected hello, got "${parsed.type}"`));
          return;
        }
        resolve(parsed.agentName);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

/** Starts the match server and resolves once it's actually listening.
 * Factored out of `cli.ts` (which is now a thin argv-parsing wrapper around
 * this function) so an automated test can drive a real WebSocket match
 * end-to-end — real sockets, real engine, no process spawning — instead of
 * only being provable by hand. See `server/test/integration.test.ts`, and
 * `progress/quality-debt.md`'s long-standing "no automated protocol test"
 * entry that this closes. */
export function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const seed = options.seed ?? Date.now();
  const wss = new WebSocketServer({ port: options.port ?? 8080 });
  const waiting: { socket: WebSocket; name: string }[] = [];

  let resolveMatchEnded!: (outcome: MatchOutcome) => void;
  const matchEnded = new Promise<MatchOutcome>((resolve) => {
    resolveMatchEnded = resolve;
  });

  return new Promise<RunningServer>((resolveReady) => {
    wss.once("listening", () => {
      const address = wss.address();
      const port = typeof address === "object" && address !== null ? address.port : (options.port ?? 8080);
      console.log(`[server] listening on ws://localhost:${port} — match seed ${seed}`);
      resolveReady({ port, wss, matchEnded, close: () => wss.close() });
    });

    wss.on("connection", (socket) => {
      void (async () => {
        let name: string;
        try {
          name = await awaitHello(socket);
        } catch (err) {
          console.error(`[server] connection failed handshake: ${(err as Error).message}`);
          socket.close();
          return;
        }
        console.log(`[server] "${name}" connected`);

        if (waiting.length >= 2) {
          console.warn(`[server] a third agent ("${name}") connected; this server hosts one 1v1 match, closing it`);
          socket.close();
          return;
        }
        waiting.push({ socket, name });
        if (waiting.length === 2) {
          const [a, b] = waiting as [{ socket: WebSocket; name: string }, { socket: WebSocket; name: string }];
          const outcome = await playMatch(a, b, seed, options.logPath);
          resolveMatchEnded(outcome);
          wss.close();
        }
      })();
    });
  });
}

async function playMatch(
  a: { socket: WebSocket; name: string },
  b: { socket: WebSocket; name: string },
  seed: number,
  logPath?: string,
): Promise<MatchOutcome> {
  const agentA = new RemoteAgent(a.name, a.socket);
  const agentB = new RemoteAgent(b.name, b.socket);
  const deckA = buildCortexDeck("p1", "Cortex Deck");
  const deckB = buildSwarmDeck("p2", "Swarm Deck");

  console.log(`[server] match starting: ${a.name} (p1, Cortex) vs ${b.name} (p2, Swarm)`);

  try {
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed, {
      onMatchStart: (initial) => {
        agentA.send({ type: "matchStart", you: "p1", opponent: b.name, view: buildPlayerView(initial, "p1") });
        agentB.send({ type: "matchStart", you: "p2", opponent: a.name, view: buildPlayerView(initial, "p2") });
      },
    });

    const winner: PlayerId | "draw" = state.winner ?? "draw";
    const reason = `resolved after ${movesPlayed} moves over ${state.turnNumber} turns`;
    agentA.send({ type: "matchEnd", winner, turns: state.turnNumber, reason });
    agentB.send({ type: "matchEnd", winner, turns: state.turnNumber, reason });

    console.log(`[server] match complete — winner: ${winner}, turns: ${state.turnNumber}, moves: ${movesPlayed}`);
    const log = formatLog(state.log);
    console.log(log);
    if (logPath) {
      writeFileSync(logPath, `${log}\n`);
      console.log(`[server] log written to ${logPath}`);
    }
    return { kind: "resolved", winner, turns: state.turnNumber, movesPlayed };
  } catch (err) {
    if (err instanceof AgentFault) {
      const offenderIsA = err.agent === agentA;
      const offender = offenderIsA ? agentA : agentB;
      const other = offenderIsA ? agentB : agentA;
      const winner: PlayerId = offenderIsA ? "p2" : "p1";
      console.error(`[server] protocol fault, forfeiting: ${err.message}`);
      offender.send({ type: "error", message: err.message });
      other.send({ type: "matchEnd", winner, turns: 0, reason: `opponent forfeited: ${err.message}` });
      return { kind: "fault", winner, message: err.message };
    }
    console.error("[server] unexpected error running match:", err);
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  } finally {
    agentA.close();
    agentB.close();
  }
}
