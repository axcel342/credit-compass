import { describe, it, expect } from "vitest";
import { currentCaller } from "@/lib/workspace/current";
import { g8Caller } from "@/lib/g8/client";

describe("currentCaller", () => {
  it("returns the single-org caller until workspaces exist", async () => expect(await currentCaller()).toBe(g8Caller));
});
