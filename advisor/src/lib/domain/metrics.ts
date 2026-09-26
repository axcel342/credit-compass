import type { AttributedCharge, Confidence, ContactInfo, Dimension, Outcome, Stat } from "./types";
import { EXACT_METHODS } from "./attribution";
import { toMs } from "./time";

export function confidenceFor(p: { outcomes: number; credits: number; exactShare: number }): Confidence {
  if (p.outcomes >= 10 && p.credits >= 500 && p.exactShare >= 0.5) return "high";
  if (p.outcomes >= 3) return "medium";
  return "low";
}

type Keyed = { key: string; weight: number };

function keysForContact(dimension: Dimension, contactId: number | null, listId: number | null, contacts: Map<number, ContactInfo>): Keyed[] {
  if (dimension === "org") return [{ key: "all", weight: 1 }];
  if (dimension === "list") {
    if (listId !== null) return [{ key: String(listId), weight: 1 }];
    const lists = contactId !== null ? contacts.get(contactId)?.listIds ?? [] : [];
    return lists.map((l) => ({ key: String(l), weight: 1 / lists.length }));
  }
  if (dimension === "segment") {
    const seg = contactId !== null ? contacts.get(contactId)?.segmentKey : undefined;
    return seg ? [{ key: seg, weight: 1 }] : [];
  }
  return [];
}

interface Acc { credits: number; exact: number; meetings: number; deals: number; won: number; contacts: Set<number>; simulated: boolean }

export function computeStats(p: { charges: AttributedCharge[]; outcomes: Outcome[]; contacts: Map<number, ContactInfo>; dimension: Dimension;
  period: string; from: number; to: number; now: string }): Stat[] {
  const inRange = (iso: string) => { const t = toMs(iso); return t >= p.from && t < p.to; };
  const accs = new Map<string, Acc>();
  const acc = (k: string) => { let a = accs.get(k); if (!a) { a = { credits: 0, exact: 0, meetings: 0, deals: 0, won: 0, contacts: new Set(), simulated: false }; accs.set(k, a); } return a; };
  const dims: Dimension[] = p.dimension === "org" ? ["org"] : ["org", p.dimension];
  for (const d of dims) {
    for (const c of p.charges.filter((x) => inRange(x.chargedAt))) {
      const keys = d === "service" ? [{ key: c.service, weight: 1 }] : keysForContact(d, c.contactId, c.listId, p.contacts);
      for (const { key, weight } of keys) {
        const a = acc(`${d}|${key}`);
        a.credits += c.credits * weight;
        if (EXACT_METHODS.has(c.method)) a.exact += c.credits * weight;
        if (c.contactId !== null) a.contacts.add(c.contactId);
        a.simulated ||= c.simulated;
      }
    }
    for (const o of p.outcomes.filter((x) => inRange(x.occurredAt))) {
      for (const { key, weight } of keysForContact(d, o.contactId, o.listId, p.contacts)) {
        const a = acc(`${d}|${key}`);
        if (o.type === "meeting_booked") a.meetings += weight;
        if (o.type === "deal_won") { a.deals += weight; a.won += (o.amount ?? 0) * weight; }
        a.simulated ||= o.simulated;
      }
    }
  }
  const orgAcc = accs.get("org|all") ?? { credits: 0, exact: 0, meetings: 0, deals: 0, won: 0, contacts: new Set<number>(), simulated: false };
  const orgCpm = orgAcc.meetings > 0 ? orgAcc.credits / orgAcc.meetings : null;
  const toStat = (dimension: Dimension, value: string, a: Acc): Stat => {
    const cpm = a.meetings > 0 ? a.credits / a.meetings : null;
    return {
      period: p.period, dimension, value, credits: round(a.credits), creditsExact: round(a.exact), meetings: round(a.meetings), deals: round(a.deals),
      wonValue: round(a.won), contactsReached: a.contacts.size, costPerMeeting: cpm === null ? null : round(cpm),
      costPerDeal: a.deals > 0 ? round(a.credits / a.deals) : null,
      vsAvgPct: cpm !== null && orgCpm ? round(((cpm - orgCpm) / orgCpm) * 100) : null,
      evidenceN: round(a.meetings + a.deals), confidence: confidenceFor({ outcomes: a.meetings + a.deals, credits: a.credits, exactShare: a.credits > 0 ? a.exact / a.credits : 0 }),
      simulated: a.simulated, computedAt: p.now,
    };
  };
  const out: Stat[] = [toStat("org", "all", orgAcc)];
  if (p.dimension !== "org") {
    for (const [k, a] of accs) if (k.startsWith(`${p.dimension}|`)) out.push(toStat(p.dimension, k.slice(p.dimension.length + 1), a));
  }
  return out;
}

function round(n: number): number { return Math.round(n * 100) / 100; }

export function formatCostPerMeeting(s: Stat): string {
  return s.costPerMeeting === null ? `${Math.round(s.credits).toLocaleString("en-US")} credits, no meetings yet` : `${Math.round(s.costPerMeeting).toLocaleString("en-US")} credits per meeting`;
}
