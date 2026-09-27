import type { AttributedCharge, ContactInfo, Outcome } from "./types";
import { smoothedRate } from "./prespend";

export type Fit = "high" | "medium" | "low" | "unknown";
export type FitLevel = "segment" | "role" | "seniority" | "list" | "org";
export interface RateCell { reached: number; meetings: number }
export interface RateTables { segment: Map<string, RateCell>; role: Map<string, RateCell>; seniority: Map<string, RateCell>; list: Map<string, RateCell>; org: RateCell }

const role = (seg: string) => seg.split("|").slice(0, 2).join("|");
const seniority = (seg: string) => seg.split("|")[0];

export function rateTables(charges: AttributedCharge[], outcomes: Outcome[], contacts: Map<number, ContactInfo>): RateTables {
  const t: RateTables = { segment: new Map(), role: new Map(), seniority: new Map(), list: new Map(), org: { reached: 0, meetings: 0 } };
  const bump = (m: Map<string, RateCell>, k: string, f: keyof RateCell) => { const c = m.get(k) ?? { reached: 0, meetings: 0 }; c[f]++; m.set(k, c); };
  const reached = new Set(charges.map((c) => c.contactId).filter((x): x is number => x !== null && contacts.has(x)));
  const booked = new Map<number, number>();
  for (const o of outcomes) if (o.type === "meeting_booked" && o.contactId !== null && contacts.has(o.contactId)) booked.set(o.contactId, (booked.get(o.contactId) ?? 0) + 1);
  for (const id of reached) {
    const i = contacts.get(id)!;
    bump(t.segment, i.segmentKey, "reached"); bump(t.role, role(i.segmentKey), "reached"); bump(t.seniority, seniority(i.segmentKey), "reached");
    for (const l of i.listIds) bump(t.list, String(l), "reached");
    t.org.reached++;
  }
  for (const [id, k] of booked) {
    const i = contacts.get(id)!;
    for (let j = 0; j < k; j++) {
      bump(t.segment, i.segmentKey, "meetings"); bump(t.role, role(i.segmentKey), "meetings"); bump(t.seniority, seniority(i.segmentKey), "meetings");
      for (const l of i.listIds) bump(t.list, String(l), "meetings");
      t.org.meetings++;
    }
  }
  return t;
}

export function classifyWithBackoff(info: ContactInfo, t: RateTables, minN = 3): { fit: Fit; level: FitLevel | null } {
  if (info.consistency === "flagged") return { fit: "low", level: null };
  const orgRate = t.org.reached > 0 ? t.org.meetings / t.org.reached : 0;
  if (orgRate <= 0) return { fit: "unknown", level: null };
  const bestList = info.listIds.map((l) => t.list.get(String(l))).filter((c): c is RateCell => !!c).sort((a, b) => b.reached - a.reached)[0];
  const levels: [FitLevel, RateCell | undefined][] = [["segment", t.segment.get(info.segmentKey)], ["role", t.role.get(role(info.segmentKey))],
    ["seniority", t.seniority.get(seniority(info.segmentKey))], ["list", bestList]];
  for (const [level, cell] of levels) {
    if (!cell || cell.reached < minN) continue;
    const rate = smoothedRate(cell.meetings, cell.reached, orgRate);
    return { fit: rate >= 1.5 * orgRate ? "high" : rate <= 0.5 * orgRate ? "low" : "medium", level };
  }
  return { fit: "medium", level: "org" };
}
