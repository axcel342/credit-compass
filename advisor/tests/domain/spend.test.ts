import { describe, it, expect } from "vitest";
import { loadFixture } from "../fixtures";
import type { LedgerRow } from "@/lib/domain/types";
import { isSpend, credits, parseTokens, countHolds } from "@/lib/domain/spend";

const ledger = loadFixture<LedgerRow[]>("ledger/ledger-2026-09-26.json");

describe("spend rules on the real ledger", () => {
  it("counts only usage rows as spend: 126 rows, 1,260 credits, 9 services", () => {
    const spend = ledger.filter(isSpend);
    expect(spend).toHaveLength(126);
    expect(spend.reduce((s, r) => s + credits(r), 0)).toBe(1260);
    expect(new Set(spend.map((r) => r.service)).size).toBe(9);
  });
  it("parses LLM token counts", () => {
    expect(parseTokens("LLM charge: g8_t1 (in:214, out:594)")).toEqual({ tokensIn: 214, tokensOut: 594 });
    expect(parseTokens("Credit charge: ai_enrichment")).toBeNull();
    expect(parseTokens(null)).toBeNull();
  });
  it("finds 8 holds, 3 followed by a charge, so 5 free failed attempts", () => {
    expect(countHolds(ledger)).toEqual({ holds: 8, followedByCharge: 3, freeFailedAttempts: 5 });
  });
});
