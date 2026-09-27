import type { AttributedCharge, OutcomeBucket } from "../domain/types";
import { BUCKETS } from "../domain/buckets";

export interface ChargeFilter { outcome: OutcomeBucket | null; list: string | null; service: string | null }
const SMALL_LIST_SHARE = 0.01; // same rule as the flow diagram's "Other lists"

export function parseChargeFilter(sp: Record<string, string | string[] | undefined>): ChargeFilter {
  const one = (k: string) => { const v = sp[k]; return typeof v === "string" ? v : null; };
  const outcome = one("outcome"), list = one("list"), service = one("service");
  return {
    outcome: outcome && (BUCKETS as string[]).includes(outcome) ? (outcome as OutcomeBucket) : null,
    list: list && /^(\d+|none|other)$/.test(list) ? list : null,
    service: service && /^[a-z_]+$/.test(service) ? service : null,
  };
}

export function applyChargeFilter(charges: AttributedCharge[], f: ChargeFilter, bucketOf: (c: AttributedCharge) => OutcomeBucket): AttributedCharge[] {
  const total = charges.reduce((s, c) => s + c.credits, 0) || 1;
  const perList = new Map<number, number>();
  for (const c of charges) if (c.listId !== null) perList.set(c.listId, (perList.get(c.listId) ?? 0) + c.credits);
  const listMatch = (c: AttributedCharge) => {
    if (!f.list) return true;
    if (f.list === "none") return c.listId === null;
    if (f.list === "other") return c.listId !== null && (perList.get(c.listId) ?? 0) / total < SMALL_LIST_SHARE;
    return String(c.listId) === f.list;
  };
  return charges.filter((c) => listMatch(c) && (!f.service || c.service === f.service) && (!f.outcome || bucketOf(c) === f.outcome));
}

export function filterHref(f: ChargeFilter, patch: Partial<ChargeFilter>, periodQuery: string): string {
  const m = { ...f, ...patch };
  const q = new URLSearchParams();
  if (m.outcome) q.set("outcome", m.outcome);
  if (m.list) q.set("list", m.list);
  if (m.service) q.set("service", m.service);
  const s = [q.toString(), periodQuery].filter(Boolean).join("&");
  return s ? `/charges?${s}` : "/charges";
}
