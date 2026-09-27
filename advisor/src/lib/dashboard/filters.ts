import type { AttributedCharge, OutcomeBucket } from "../domain/types";
import { BUCKETS } from "../domain/buckets";

export interface ChargeFilter { outcome: OutcomeBucket | null; list: string | null; service: string | null; small?: boolean }
const SMALL_LIST_SHARE = 0.01; // same rule as the flow diagram's "Other lists"

export function parseChargeFilter(sp: Record<string, string | string[] | undefined>): ChargeFilter {
  const one = (k: string) => { const v = sp[k]; return typeof v === "string" ? v : null; };
  const outcome = one("outcome"), list = one("list"), service = one("service");
  return {
    outcome: outcome && (BUCKETS as string[]).includes(outcome) ? (outcome as OutcomeBucket) : null,
    list: list && /^(\d+|none|other)$/.test(list) ? list : null,
    service: service && /^[a-z_]+$/.test(service) ? service : null,
    small: one("small") === "1",
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

export function listChips(charges: AttributedCharge[]): { ids: number[]; hasOther: boolean } {
  const total = charges.reduce((s, c) => s + c.credits, 0) || 1;
  const perList = new Map<number, number>();
  for (const c of charges) if (c.listId !== null) perList.set(c.listId, (perList.get(c.listId) ?? 0) + c.credits);
  const ids = [...perList].filter(([, v]) => v / total >= SMALL_LIST_SHARE).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return { ids, hasOther: ids.length < perList.size };
}

export function filterHref(f: ChargeFilter, patch: Partial<ChargeFilter>, periodQuery: string): string {
  const m = { ...f, ...patch, small: "small" in patch ? patch.small : false };
  const q = new URLSearchParams();
  if (m.outcome) q.set("outcome", m.outcome);
  if (m.list) q.set("list", m.list);
  if (m.service) q.set("service", m.service);
  if (m.small) q.set("small", "1");
  const s = [q.toString(), periodQuery].filter(Boolean).join("&");
  return s ? `/charges?${s}` : "/charges";
}
