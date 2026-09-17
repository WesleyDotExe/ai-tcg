// The only real runtime logic this package has is `isClientMessage` — every
// other export is a type, erased at compile time. This is the guard the
// server trusts to decide "is this JSON a real client message or garbage
// (or an unrecognized/server-only message type) that should fault the
// connection" — see server/src/remoteAgent.ts's handleMessage. Getting it
// wrong either lets malformed input through as if it were a hello/move, or
// rejects a legitimate one.

import { describe, expect, it } from "vitest";
import { isClientMessage } from "../src/messages.js";

describe("isClientMessage", () => {
  it("accepts a well-formed hello message", () => {
    expect(isClientMessage({ type: "hello", agentName: "Random-Client" })).toBe(true);
  });

  it("accepts a well-formed move message", () => {
    expect(
      isClientMessage({
        type: "move",
        requestId: "r0",
        move: { type: "passPriority" },
      }),
    ).toBe(true);
  });

  it("rejects a server-only message type (matchStart) sent by a client", () => {
    expect(isClientMessage({ type: "matchStart", you: "p1", opponent: "x", view: {} })).toBe(false);
  });

  it("rejects an unrecognized type string", () => {
    expect(isClientMessage({ type: "surrender" })).toBe(false);
  });

  it("rejects an object with no type field at all", () => {
    expect(isClientMessage({ requestId: "r0", move: { type: "passPriority" } })).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isClientMessage(null)).toBe(false);
    expect(isClientMessage(undefined)).toBe(false);
    expect(isClientMessage("hello")).toBe(false);
    expect(isClientMessage(42)).toBe(false);
    expect(isClientMessage(["hello"])).toBe(false);
  });

  it("rejects malformed JSON's typical parse results (empty object)", () => {
    expect(isClientMessage({})).toBe(false);
  });
});
