import type { LedgerRow } from "./types";
import { toMs } from "./time";

const HOLD_CONSUMERS = new Set(["waterfall_enrichment"]);
const HOLD_MATCH_MS = 90_000;

export function isSpend(r: LedgerRow): boolean { return r.type === "usage" && r.amount < 0; }
export function credits(r: LedgerRow): number { return Math.abs(r.amount); }

export function parseTokens(desc: string | null): { tokensIn: number; tokensOut: number } | null {
  const m = desc ? /in:(\d+), out:(\d+)/.exec(desc) : null;
  return m ? { tokensIn: Number(m[1]), tokensOut: Number(m[2]) } : null;
}

export function countHolds(rows: LedgerRow[]): { holds: number; followedByCharge: number; freeFailedAttempts: number } {
  const sorted = [...rows].sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
  const charges = sorted.filter((r) => isSpend(r) && r.service !== null && HOLD_CONSUMERS.has(r.service));
  const used = new Set<string>();
  let followed = 0;
  const holds = sorted.filter((r) => r.type === "hold");
  for (const h of holds) {
    const t = toMs(h.created_at);
    const c = charges.find((x) => !used.has(x.id) && toMs(x.created_at) - t >= 0 && toMs(x.created_at) - t <= HOLD_MATCH_MS);
    if (c) { used.add(c.id); followed++; }
  }
  return { holds: holds.length, followedByCharge: followed, freeFailedAttempts: holds.length - followed };
}
