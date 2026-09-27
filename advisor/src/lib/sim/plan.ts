import type { AttributedCharge } from "../domain/types";
import type { WebhookEnvelope } from "../webhooks/verify";

export interface SimListSpec { id: number; label: string; contactIds: number[]; costPerMeeting: number; meetings: number }

const DAY = 86_400_000, WEEK = 7 * DAY;
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function shuffled<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function buildSimPlan(seed: number, now: string, lists: SimListSpec[], opts: { weeks?: number; repeatShare?: number } = {}) {
  const weeks = opts.weeks ?? 8, repeatShare = opts.repeatShare ?? 0.15;
  const r = rng(seed), end = Date.parse(now), start = end - weeks * WEEK;
  const charges: AttributedCharge[] = [], events: WebhookEnvelope[] = [];
  let k = 0;
  const iso = (t: number) => new Date(t).toISOString();
  for (const l of lists) {
    if (l.meetings > l.contactIds.length) throw new Error(`List ${l.label} has more meetings than contacts`);
    const first = l.contactIds.map((id, i) => ({ id, t: start + (i % weeks) * WEEK + Math.floor(r() * (WEEK - DAY)) }));
    const mature = first.filter((f) => f.t <= end - 8 * DAY);
    if (mature.length < l.meetings) throw new Error(`List ${l.label} has too few contacts enriched early enough to book ${l.meetings} meetings`);
    const repeats = shuffled(mature, r).slice(0, Math.round(l.contactIds.length * repeatShare))
      .map((f) => ({ id: f.id, t: Math.min(f.t + (7 + Math.floor(r() * 15)) * DAY, end - DAY) }));
    const all = [...first, ...repeats].sort((a, b) => a.t - b.t);
    const total = Math.round(l.costPerMeeting * l.meetings * 100);
    const each = Math.floor(total / all.length);
    all.forEach((x, i) => {
      const cents = i === all.length - 1 ? total - each * (all.length - 1) : each;
      charges.push({ ledgerId: `sim-${seed}-${k++}`, ledgerType: "usage", service: "waterfall_enrichment", credits: cents / 100, chargedAt: iso(x.t), llmTier: null,
        tokensIn: null, tokensOut: null, description: `[sim] enrichment for ${l.label}`, method: "advisor", runExtId: `sim-run-${l.id}`, listId: l.id,
        contactId: x.id, segmentKey: null, explanation: `[sim] Email finder · ${l.label}`, result: "success", isWaste: false, wasteReason: null, simulated: true });
    });
    for (const [m, f] of shuffled(mature, r).slice(0, l.meetings).entries()) {
      const t = Math.min(f.t + (7 + Math.floor(r() * 15)) * DAY, end - DAY);
      const data = { contact_id: f.id, list_id: l.id, simulated: true };
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_sent", timestamp: iso(t - 3 * DAY), org_id: "sim", data: { ...data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_replied", timestamp: iso(t - DAY), org_id: "sim", data: { ...data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "meeting.booked", timestamp: iso(t), org_id: "sim", data });
    }
  }
  return { charges, events };
}
