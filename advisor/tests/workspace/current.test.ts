import { describe, it, expect } from "vitest";
import { currentCaller } from "@/lib/workspace/current";
import { g8Caller, callerFor } from "@/lib/g8/client";
import { signSession, verifySession } from "@/lib/workspace/session";

describe("currentCaller", () => {
  it("returns the single-org caller until workspaces exist", async () => expect(await currentCaller()).toBe(g8Caller));
});

describe("callerFor", () => {
  it("memoizes a caller per API key without touching the shared caller", () => {
    expect(callerFor("k1")).toBe(callerFor("k1"));
    expect(callerFor("k1")).not.toBe(g8Caller);
  });
});

describe("workspace session", () => {
  it("signs and verifies a workspace id; rejects tampering", () => {
    process.env.SESSION_SECRET = "s".repeat(64);
    const v = signSession("w1");
    expect(verifySession(v)).toBe("w1");
    expect(verifySession(v.replace("w1", "w2"))).toBeNull();
    expect(verifySession("garbage")).toBeNull();
  });
});
