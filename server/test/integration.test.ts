// The real automated protocol test named as missing since stage 2
// (quality-debt.md: "no automated protocol test... this should graduate to
// a real committed test"). Unlike remoteAgent.test.ts (a fake in-process
// socket), this drives `startServer` with real `ws` WebSocket connections
// and the actual reference clients from @ai-tcg/agents — the same
// process-boundary proof session 3 did by hand (three separate `tsx`
// processes, sample-match-003-networked.txt), now repeatable on every
// `npm test`.

import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { makeRandomDecision, runAgentClient } from "@ai-tcg/agents";
import { startServer } from "../src/server.js";

describe("server integration (real sockets, real engine match)", () => {
  it("plays a full match end-to-end between two independent client processes-in-miniature", async () => {
    const server = await startServer({ port: 0, seed: 48 });
    const url = `ws://localhost:${server.port}`;

    const clientA = runAgentClient({ url, agentName: "Random-A", decide: makeRandomDecision(1), log: () => {} });
    const clientB = runAgentClient({ url, agentName: "Random-B", decide: makeRandomDecision(2), log: () => {} });

    const [outcome] = await Promise.all([server.matchEnded, clientA, clientB]);

    expect(outcome.kind).toBe("resolved");
    if (outcome.kind !== "resolved") throw new Error("unreachable");
    expect(["p1", "p2", "draw"]).toContain(outcome.winner);
    expect(outcome.turns).toBeGreaterThan(0);
    expect(outcome.movesPlayed).toBeGreaterThan(0);
  }, 20_000);

  it("assigns an OS-chosen port when started with port 0, and it's actually reachable", async () => {
    const server = await startServer({ port: 0, seed: 1 });
    expect(server.port).toBeGreaterThan(0);
    expect(server.port).not.toBe(0);

    const probe = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      probe.once("open", () => resolve());
      probe.once("error", reject);
    });
    probe.close();
    server.close();
  }, 10_000);

  it("forfeits a client that replies with an illegal move, real socket round trip", async () => {
    const server = await startServer({ port: 0, seed: 7 });
    const url = `ws://localhost:${server.port}`;

    // A legitimate reference client on one side...
    const goodClient = runAgentClient({ url, agentName: "Good", decide: makeRandomDecision(3), log: () => {} });

    // ...and a deliberately misbehaving raw client on the other, which
    // always replies with a move that can never be legal (an absurd hand
    // index), to prove the real wire path faults it rather than the
    // in-process fake-socket path remoteAgent.test.ts already covers.
    const badSocket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      badSocket.once("open", () => {
        badSocket.send(JSON.stringify({ type: "hello", agentName: "Bad" }));
        resolve();
      });
      badSocket.once("error", reject);
    });
    badSocket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as { type: string; requestId?: string };
      if (message.type === "requestMove") {
        badSocket.send(
          JSON.stringify({ type: "move", requestId: message.requestId, move: { type: "playCard", handIndex: 9999 } }),
        );
      }
    });

    const outcome = await server.matchEnded;
    expect(outcome.kind).toBe("fault");
    if (outcome.kind !== "fault") throw new Error("unreachable");
    expect(outcome.message).toMatch(/chose an illegal move/);

    badSocket.close();
    await goodClient;
  }, 20_000);

  it("closes a third connecting socket instead of hosting a second concurrent match", async () => {
    const server = await startServer({ port: 0, seed: 2 });
    const url = `ws://localhost:${server.port}`;

    const clientA = runAgentClient({ url, agentName: "A", decide: makeRandomDecision(4), log: () => {} });
    const clientB = runAgentClient({ url, agentName: "B", decide: makeRandomDecision(5), log: () => {} });

    // Wait until the server has actually paired A and B before the third
    // connects, then confirm the third socket gets closed by the server
    // rather than queued. (This used to be a fixed 50ms sleep, which raced on
    // slow CI runners: if A's or B's hello landed after C's, C was paired into
    // the match instead of being turned away.)
    await server.matchStarted;
    const thirdSocket = new WebSocket(url);
    const thirdClosed = await new Promise<boolean>((resolve) => {
      thirdSocket.once("open", () => {
        thirdSocket.send(JSON.stringify({ type: "hello", agentName: "C" }));
      });
      thirdSocket.once("close", () => resolve(true));
      setTimeout(() => resolve(false), 5_000);
    });
    expect(thirdClosed).toBe(true);

    await Promise.all([server.matchEnded, clientA, clientB]);
  }, 20_000);
});
