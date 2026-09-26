import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { fetchLedgerSince } from "@/lib/sync/ledger";
import { loadFixture } from "../fixtures";
import type { LedgerRow } from "@/lib/domain/types";

const ledger = loadFixture<LedgerRow[]>("ledger/ledger-2026-09-26.json");
const newestFirst = [...ledger].reverse();
function fake() {
  const c = new FakeG8();
  c.handlers.set(OPS.listUsageTransactions, (i) => { const p = Number(i.query?.page), l = Number(i.query?.limit); return newestFirst.slice((p - 1) * l, p * l); });
  return c;
}

describe("fetchLedgerSince", () => {
  it("pulls all 144 rows on first sync", async () => expect(await fetchLedgerSince(fake(), new Set())).toHaveLength(144));
  it("stops at the first known row and returns only newer ones", async () => {
    const known = new Set(ledger.slice(0, 140).map((r) => r.id));
    const c = fake();
    const rows = await fetchLedgerSince(c, known);
    expect(rows.map((r) => r.id)).toEqual(newestFirst.slice(0, 4).map((r) => r.id));
    expect(c.calls.filter((x) => x.op === OPS.listUsageTransactions)).toHaveLength(1);
  });
});
