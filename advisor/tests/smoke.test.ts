import { describe, it, expect } from "vitest";
import { loadFixture } from "./fixtures";

describe("fixtures", () => {
  it("loads the real ledger with 144 rows", () => {
    const rows = loadFixture<unknown[]>("ledger/ledger-2026-09-26.json");
    expect(rows).toHaveLength(144);
  });
});
