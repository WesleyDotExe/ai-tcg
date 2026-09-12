import { writeFileSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import { buildCortexDeck, buildPlayerView, buildSwarmDeck, formatLog, runMatch, type PlayerId } from "@ai-tcg/engine";
import type { ClientMessage } from "@ai-tcg/protocol";
import { AgentFault, RemoteAgent } from "./remoteAgent.js";

// Stage-2 scope, named plainly rather than hidden (see PROTOCOL.md "Not yet
// covered"): this server hosts exactly one 1v1 match between the first two
// agents that connect, on fixed built-in test decks, then exits. Real
// matchmaking, deck submission, and a long-lived multi-match server are
// stage 4/5 work.
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const SEED = Number(process.argv[3] ?? Date.now());
const LOG_PATH = process.argv[4];

const HELLO_TIMEOUT_MS = 10_000;

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

console.log(`[server] listening on ws://localhost:${PORT} — match seed ${SEED}`);
const wss = new WebSocketServer({ port: PORT });

const waiting: { socket: WebSocket; name: string }[] = [];

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
      console.warn(`[server] a third agent ("${name}") connected; this stage-2 server hosts one 1v1 match, closing it`);
      socket.close();
      return;
    }
    waiting.push({ socket, name });
    if (waiting.length === 2) {
      const [a, b] = waiting as [{ socket: WebSocket; name: string }, { socket: WebSocket; name: string }];
      await playMatch(a, b);
    }
  })();
});

async function playMatch(a: { socket: WebSocket; name: string }, b: { socket: WebSocket; name: string }): Promise<void> {
  const agentA = new RemoteAgent(a.name, a.socket);
  const agentB = new RemoteAgent(b.name, b.socket);
  const deckA = buildCortexDeck("p1", "Cortex Deck");
  const deckB = buildSwarmDeck("p2", "Swarm Deck");

  console.log(`[server] match starting: ${a.name} (p1, Cortex) vs ${b.name} (p2, Swarm)`);

  try {
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, SEED, {
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
    if (LOG_PATH) {
      writeFileSync(LOG_PATH, `${log}\n`);
      console.log(`[server] log written to ${LOG_PATH}`);
    }
  } catch (err) {
    if (err instanceof AgentFault) {
      const offenderIsA = err.agent === agentA;
      const offender = offenderIsA ? agentA : agentB;
      const other = offenderIsA ? agentB : agentA;
      const winner: PlayerId = offenderIsA ? "p2" : "p1";
      console.error(`[server] protocol fault, forfeiting: ${err.message}`);
      offender.send({ type: "error", message: err.message });
      other.send({ type: "matchEnd", winner, turns: 0, reason: `opponent forfeited: ${err.message}` });
    } else {
      console.error("[server] unexpected error running match:", err);
    }
  } finally {
    agentA.close();
    agentB.close();
    wss.close();
  }
}
