import { WebSocket } from "ws";
import type { ClientMessage, Move, PlayerView, ServerMessage } from "@ai-tcg/protocol";

export interface AgentClientOptions {
  url: string;
  agentName: string;
  decide(view: PlayerView, legalMoves: Move[]): Move;
  log?: (line: string) => void;
}

/** The reference implementation of the CLIENT side of PROTOCOL.md.
 * Deliberately independent of `@ai-tcg/engine`: it only ever sees the JSON
 * messages the spec defines (via `@ai-tcg/protocol`'s types, which are
 * erased to nothing at runtime), the same as a real external agent written
 * in any language would. This is what makes stage 2's process-boundary
 * proof real rather than assumed — swap `decide` for a call to any model's
 * API and this file is a complete agent. */
export function runAgentClient(options: AgentClientOptions): Promise<void> {
  const log = options.log ?? ((line: string) => console.log(`[${options.agentName}] ${line}`));

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(options.url);

    socket.on("open", () => {
      const hello: ClientMessage = { type: "hello", agentName: options.agentName };
      socket.send(JSON.stringify(hello));
      log(`connected to ${options.url}, sent hello`);
    });

    socket.on("message", (data) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(data.toString()) as ServerMessage;
      } catch (err) {
        log(`received malformed message, ignoring: ${String(err)}`);
        return;
      }
      switch (message.type) {
        case "matchStart":
          log(`match started — I am ${message.you}, opponent is "${message.opponent}"`);
          break;
        case "requestMove": {
          const move = options.decide(message.view, message.legalMoves);
          const reply: ClientMessage = { type: "move", requestId: message.requestId, move };
          socket.send(JSON.stringify(reply));
          break;
        }
        case "matchEnd":
          log(`match ended — winner: ${message.winner} (${message.reason})`);
          socket.close();
          break;
        case "error":
          log(`server reported a protocol error: ${message.message}`);
          break;
      }
    });

    socket.on("close", () => resolve());
    socket.on("error", (err) => reject(err));
  });
}
