// RemoteAgent is the class that turns "a socket sent us some JSON" into the
// engine's in-process Agent interface, and is the single place every
// protocol fault (PROTOCOL.md's "Faults" section) is actually detected. This
// was previously verified only by hand (session 3's log: "live-tested both
// fault paths... not committed as a repeatable script") — this file is the
// repeatable script that debt entry asked for.
//
// Drives the real RemoteAgent class against a minimal fake socket (an
// EventEmitter exposing just the subset of the `ws` WebSocket API
// RemoteAgent actually touches: on/send/close/readyState/OPEN) rather than a
// real network connection, so every fault path is fast and deterministic.
// server/test/integration.test.ts covers the same class over a real socket.

import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import type { Move, PlayerView } from "@ai-tcg/engine";
import { AgentFault, RemoteAgent } from "../src/remoteAgent.js";

class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  readonly sent: unknown[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    this.closed = true;
    this.emit("close");
  }
}

const dummyView = {} as PlayerView;
const legalMoves: Move[] = [{ type: "passPriority" }, { type: "playCard", handIndex: 0 }];

function socketReply(socket: FakeSocket, body: unknown): void {
  socket.emit("message", JSON.stringify(body));
}

let socket: FakeSocket;
let agent: RemoteAgent;

beforeEach(() => {
  socket = new FakeSocket();
  // Short timeout so the timeout-fault test doesn't slow the suite down —
  // production code (server.ts) never passes this option, so the real 15s
  // default is what actually ships.
  agent = new RemoteAgent("Test-Agent", socket as unknown as WebSocket, { timeoutMs: 30 });
});

describe("RemoteAgent", () => {
  it("sends a requestMove with an incrementing requestId and resolves on a matching legal reply", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    expect(socket.sent).toEqual([{ type: "requestMove", requestId: "r0", view: dummyView, legalMoves }]);

    socketReply(socket, { type: "move", requestId: "r0", move: { type: "passPriority" } });
    await expect(promise).resolves.toEqual({ type: "passPriority" });
  });

  it("resolves with the same legalMoves entry regardless of the reply's key order", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    socketReply(socket, { move: { handIndex: 0, type: "playCard" }, requestId: "r0", type: "move" });
    await expect(promise).resolves.toEqual({ type: "playCard", handIndex: 0 });
  });

  it("faults on a move that isn't in the legalMoves list", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    socketReply(socket, { type: "move", requestId: "r0", move: { type: "playCard", handIndex: 99 } });
    await expect(promise).rejects.toThrow(AgentFault);
    await expect(promise).rejects.toThrow(/chose an illegal move/);
  });

  it("faults on malformed JSON", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    socket.emit("message", "{not valid json");
    await expect(promise).rejects.toThrow(/malformed JSON/);
  });

  it("faults on a well-formed but unrecognized message type", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    socketReply(socket, { type: "surrender" });
    await expect(promise).rejects.toThrow(/unrecognized message/);
  });

  it("ignores a late hello handshake without faulting or resolving", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    socketReply(socket, { type: "hello", agentName: "Test-Agent" });
    socketReply(socket, { type: "move", requestId: "r0", move: { type: "passPriority" } });
    await expect(promise).resolves.toEqual({ type: "passPriority" });
  });

  it("ignores a reply to a stale requestId, then resolves once the real one arrives", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    socketReply(socket, { type: "move", requestId: "r-not-this-one", move: { type: "passPriority" } });
    // still pending — a stale reply is not a fault (remoteAgent.ts's own
    // comment: "stale or unsolicited reply — not a fault, just ignored")
    socketReply(socket, { type: "move", requestId: "r0", move: { type: "passPriority" } });
    await expect(promise).resolves.toEqual({ type: "passPriority" });
  });

  it("faults when the socket closes while a move is outstanding", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    socket.close();
    await expect(promise).rejects.toThrow(/connection closed while a move was outstanding/);
  });

  it("does not fault on close when no move is outstanding", () => {
    expect(() => socket.close()).not.toThrow();
  });

  it("throws synchronously if asked to decide a move while one is already pending", () => {
    void agent.decideMove(dummyView, legalMoves).catch(() => {});
    expect(() => agent.decideMove(dummyView, legalMoves)).toThrow(/already outstanding/);
  });

  it("faults if the client never replies within the timeout", async () => {
    const promise = agent.decideMove(dummyView, legalMoves);
    await expect(promise).rejects.toThrow(/did not reply within 30ms/);
  });

  it("send() is a no-op once the socket is no longer open", () => {
    socket.readyState = 3; // CLOSED, in real `ws` terms
    expect(() => agent.send({ type: "error", message: "unused" })).not.toThrow();
    expect(socket.sent).toHaveLength(0);
  });
});
