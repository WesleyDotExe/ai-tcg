import type { Card, Move, PlayerId, PlayerView, StackItem, TargetRef, UnitCard, UnitInstance } from "@ai-tcg/engine";

// Re-exported so a TypeScript reference agent (see agents/) can be typed
// against these shapes by depending on @ai-tcg/protocol alone — it never
// needs @ai-tcg/engine itself. The `import type`/`export type` forms here
// are fully erased at compile time: nothing about this file causes the
// engine's actual code to be loaded at runtime by anything that imports
// only @ai-tcg/protocol.
export type { Card, Move, PlayerId, PlayerView, StackItem, TargetRef, UnitCard, UnitInstance };

// TypeScript mirror of PROTOCOL.md — that file is the source of truth (it's
// language-agnostic; anything speaking JSON over a WebSocket can implement
// it). These types exist so this project's own TypeScript server and
// reference agents get compile-time checking against the same shapes.
//
// `Move`/`PlayerView` are imported (type-only — erased at compile time, no
// runtime dependency) from `@ai-tcg/engine` rather than redeclared here,
// because they are already exactly the wire shapes: plain JSON, no
// functions, no class instances. Redeclaring them by hand would risk silent
// drift between "what the engine actually produces" and "what the spec
// says the wire carries" — importing the real type makes drift a compile
// error instead of a runtime surprise.

export interface HelloMessage {
  type: "hello";
  agentName: string;
}

export interface MoveMessage {
  type: "move";
  requestId: string;
  move: Move;
}

/** Every message a client (agent) may send. */
export type ClientMessage = HelloMessage | MoveMessage;

export interface MatchStartMessage {
  type: "matchStart";
  you: PlayerId;
  opponent: string;
  view: PlayerView;
}

export interface RequestMoveMessage {
  type: "requestMove";
  requestId: string;
  view: PlayerView;
  legalMoves: Move[];
}

export interface MatchEndMessage {
  type: "matchEnd";
  winner: PlayerId | "draw";
  turns: number;
  reason: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

/** Every message the server may send. */
export type ServerMessage = MatchStartMessage | RequestMoveMessage | MatchEndMessage | ErrorMessage;

export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return type === "hello" || type === "move";
}
