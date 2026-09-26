import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { LedgerRow } from "../domain/types";

export async function fetchLedgerSince(c: G8Caller, known: Set<string>): Promise<LedgerRow[]> {
  const out: LedgerRow[] = [];
  for (let page = 1; page < 500; page++) {
    const rows = await c.call<LedgerRow[]>(OPS.listUsageTransactions, { query: { page, limit: 100 } });
    for (const r of rows) { if (known.has(r.id)) return out; out.push(r); }
    if (rows.length < 100) return out;
  }
  return out;
}
