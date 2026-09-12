import type { RawData, WebSocket } from "ws";
import type { Agent, Move, PlayerView } from "@ai-tcg/engine";
import { isClientMessage, type ServerMessage } from "@ai-tcg/protocol";
import { deepEqual } from "./deepEqual.js";

const MOVE_TIMEOUT_MS = 15_000;

/** Raised on any protocol fault by the agent this `RemoteAgent` wraps — see
 * PROTOCOL.md's "Faults" section. Whoever drives the match (`cli.ts`)
 * catches this and ends the match with the *other* agent as winner. Carries
 * the offending `RemoteAgent` itself (rather than just its name) so the
 * catcher can identify the offender by identity, not by parsing the
 * message string. */
export class AgentFault extends Error {
  constructor(
    public readonly agent: RemoteAgent,
    message: string,
  ) {
    super(message);
  }
}

interface PendingMove {
  requestId: string;
  legalMoves: Move[];
  resolve(move: Move): void;
  reject(err: Error): void;
}

/** Implements the engine's `Agent` interface by sending `requestMove` over a
 * real WebSocket and awaiting a `move` reply — the actual process-boundary
 * crossing build-order stage 2 exists to prove. Everything upstream of this
 * class (the engine's `runMatch` loop) has no idea the agent isn't
 * in-process; everything downstream (the connected client) has no idea it's
 * talking to `@ai-tcg/engine` rather than a hand-rolled implementation of
 * PROTOCOL.md in any language. That's the seam working as intended. */
export class RemoteAgent implements Agent {
  readonly name: string;
  private readonly socket: WebSocket;
  private nextRequestId = 0;
  private pending: PendingMove | null = null;

  constructor(name: string, socket: WebSocket) {
    this.name = name;
    this.socket = socket;
    socket.on("message", (data) => this.handleMessage(data));
    socket.on("close", () => this.fault("connection closed while a move was outstanding"));
  }

  decideMove(view: PlayerView, legalMoves: Move[]): Promise<Move> {
    if (this.pending) {
      // The engine only ever asks whoever currently holds priority, and
      // never asks again until that request resolves — this would be an
      // engine/server bug, not a client fault, so it throws rather than
      // routing through `fault()`.
      throw new Error(`${this.name}: a move was requested while one was already outstanding`);
    }
    const requestId = `r${this.nextRequestId++}`;
    const message: ServerMessage = { type: "requestMove", requestId, view, legalMoves };
    return new Promise<Move>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fault(`did not reply within ${MOVE_TIMEOUT_MS}ms`);
      }, MOVE_TIMEOUT_MS);
      this.pending = {
        requestId,
        legalMoves,
        resolve: (move) => {
          clearTimeout(timer);
          resolve(move);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
      this.socket.send(JSON.stringify(message));
    });
  }

  send(message: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.socket.close();
  }

  private handleMessage(data: RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      this.fault("sent malformed JSON");
      return;
    }
    if (!isClientMessage(parsed)) {
      this.fault(`sent an unrecognized message: ${JSON.stringify(parsed)}`);
      return;
    }
    if (parsed.type === "hello") return; // handshake already completed during pairing; ignore late hellos
    // parsed.type === "move"
    if (!this.pending || parsed.requestId !== this.pending.requestId) {
      return; // stale or unsolicited reply — not a fault, just ignored
    }
    const chosen = this.pending.legalMoves.find((m) => deepEqual(m, parsed.move));
    if (!chosen) {
      this.fault(`chose an illegal move: ${JSON.stringify(parsed.move)}`);
      return;
    }
    const resolve = this.pending.resolve;
    this.pending = null;
    resolve(chosen);
  }

  private fault(reason: string): void {
    if (!this.pending) return;
    const reject = this.pending.reject;
    this.pending = null;
    reject(new AgentFault(this, `${this.name}: ${reason}`));
  }
}
