import { describe, it, expect } from "vitest";
import { API_OPERATION_IDS } from "@graph8/sdk";
import { OPS } from "@/lib/g8/ops";

describe("SDK contract", () => {
  it("contains every operation the app calls", () => {
    const known = new Set<string>(API_OPERATION_IDS as readonly string[]);
    const missing = Object.values(OPS).filter((id) => !known.has(id));
    expect(missing).toEqual([]);
  });
});
