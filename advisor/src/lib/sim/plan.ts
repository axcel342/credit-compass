import type { AttributedCharge } from "../domain/types";
import type { WebhookEnvelope } from "../webhooks/verify";

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

export function buildSimPlan(seed: number, now: string, lists: { id: number; label: string; contactIds: number[]; costPerMeeting: number; meetings: number }[]) {
  const r = rng(seed), end = Date.parse(now), span = 56 * 86_400_000;
  const charges: AttributedCharge[] = [], events: WebhookEnvelope[] = [];
  let k = 0;
  for (const l of lists) {
    const total = l.costPerMeeting * l.meetings, parts = Math.max(1, l.contactIds.length * 3), each = total / parts;
    for (let i = 0; i < parts; i++) {
      const t = new Date(end - Math.floor(r() * span)).toISOString();
      charges.push({ ledgerId: `sim-${seed}-${k++}`, ledgerType: "usage", service: "waterfall_enrichment", credits: Math.round(each * 100) / 100, chargedAt: t, llmTier: null,
        tokensIn: null, tokensOut: null, description: `[sim] enrichment for ${l.label}`, method: "advisor", runExtId: `sim-run-${l.id}`, listId: l.id,
        contactId: l.contactIds[i % l.contactIds.length], segmentKey: null, explanation: `[sim] Email finder · ${l.label}`, result: "success", isWaste: false, wasteReason: null, simulated: true });
    }
    for (let m = 0; m < l.meetings; m++) {
      // keep the email sent 3 days earlier inside the 8-week window
      const contact = l.contactIds[m % l.contactIds.length], t = end - Math.floor(r() * (span - 3 * 86_400_000));
      const common = { org_id: "sim", data: { contact_id: contact, list_id: l.id, simulated: true } };
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_sent", timestamp: new Date(t - 3 * 86_400_000).toISOString(), ...common, data: { ...common.data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_replied", timestamp: new Date(t - 86_400_000).toISOString(), ...common, data: { ...common.data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "meeting.booked", timestamp: new Date(t).toISOString(), ...common });
    }
  }
  return { charges, events };
}
