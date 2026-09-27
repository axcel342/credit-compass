import type { ContactCacheRow } from "./types";
import { smoothedRate } from "./prespend";

export type EnrichmentType = "find" | "verify" | "phones";
export interface Template { key: string; name: string }
export interface TypeDef { key: EnrichmentType; label: string; verb: string; noun: string; notTargetLabel: string; pricePerRecord: number;
  target: (r: ContactCacheRow) => boolean; template: (t: Template) => boolean; missingReason: string }

export const ENRICHMENT_TYPES: TypeDef[] = [
  { key: "find", label: "Find emails", verb: "Find emails for", noun: "email finding", notTargetLabel: "already have an email, graph8 will skip", pricePerRecord: 3,
    target: (r) => !r.hasEmail, template: (t) => t.key === "verified_emails", missingReason: "graph8 has no email-finding list template here." },
  { key: "verify", label: "Verify emails", verb: "Verify", noun: "email verification", notTargetLabel: "have no email to verify", pricePerRecord: 1,
    target: (r) => r.hasEmail, template: (t) => /^(verify|email_verif)/i.test(t.key) && t.key !== "verified_emails",
    missingReason: "graph8 has no list template for email verification, so this is an estimate only." },
  { key: "phones", label: "Find phones", verb: "Find phones for", noun: "phone finding", notTargetLabel: "already have a phone", pricePerRecord: 0,
    target: () => true, template: () => false, missingReason: "Available once graph8's phone template is checked." },
];

export function availableTypes(templates: Template[]): { def: TypeDef; runnable: boolean; reason: string | null }[] {
  return ENRICHMENT_TYPES.map((def) => { const ok = templates.some(def.template); return { def, runnable: ok, reason: ok ? null : def.missingReason }; });
}

export function listChoices(lists: { id: number; title: string; total: number }[], listNames: Map<string, string>) {
  return lists.filter((l) => l.total > 0).map((l) => ({ id: l.id, label: listNames.get(String(l.id)) ?? l.title, total: l.total })).sort((a, b) => b.total - a.total);
}

export interface CostWalk { every: number; perRecord: number; done: { count: number; credits: number }; skipped: { count: number; credits: number }; records: number; estimate: number }

export function costWalk(p: { rows: ContactCacheRow[]; def: TypeDef; price: number; calibration: number; guardrail: boolean }): CostWalk {
  const target = p.rows.filter(p.def.target);
  const skipped = p.guardrail ? target.filter((r) => r.fit === "low") : [];
  const records = target.length - skipped.length;
  const done = p.rows.length - target.length;
  return { every: p.rows.length * p.price, perRecord: p.price, done: { count: done, credits: done * p.price }, skipped: { count: skipped.length, credits: skipped.length * p.price },
    records, estimate: Math.round(records * p.price * p.calibration) };
}

export function poissonQuantile(mean: number, q: number): number {
  if (mean <= 0) return 0;
  let k = 0, pk = Math.exp(-mean), cdf = pk;
  while (cdf < q && k < 10_000) { k++; pk = (pk * mean) / k; cdf += pk; }
  return k;
}

export function forecastMeetings(p: { records: number; meetings: number; reached: number; orgRate: number }) {
  const rate = smoothedRate(p.meetings, p.reached, p.orgRate);
  const expected = p.records * rate;
  return { expected: Math.round(expected * 10) / 10, lo: poissonQuantile(expected, 0.1), hi: poissonQuantile(expected, 0.9), lowConfidence: p.meetings < 5 };
}
