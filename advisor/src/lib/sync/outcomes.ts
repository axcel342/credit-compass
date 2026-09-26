import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { ContactInfo, Outcome, OutcomeType } from "../domain/types";
import type { WebhookEnvelope } from "../webhooks/verify";

interface Deal { id: string; name: string; amount: number | null; created_at: string; close_date: string | null; primary_contact?: { id: number } | null; company_id?: number | null }
interface HistoryItem { id: string; changed_at: string; change_type: string; from_value: string; to_value: string }

export async function pollDealOutcomes(c: G8Caller, contacts: Map<number, ContactInfo>): Promise<Outcome[]> {
  const pipelines = await c.call<{ stages: { name: string; stage_type: string }[] }[]>(OPS.listDealPipelines);
  const stageType = new Map(pipelines.flatMap((p) => p.stages.map((s) => [s.name, s.stage_type] as const)));
  const deals: Deal[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<Deal[]>(OPS.listDeals, { query: { page, limit: 100 } });
    deals.push(...r);
    if (r.length < 100) break;
  }
  const out: Outcome[] = [];
  for (const d of deals) {
    const contactId = d.primary_contact?.id ?? null;
    const simulated = d.name.startsWith("[sim]");
    const base = { companyId: d.company_id ?? null, dealId: d.id, listId: null, sequenceId: null, step: null, channel: null,
      segmentKey: contactId !== null ? contacts.get(contactId)?.segmentKey ?? null : null, source: "poll" as const, simulated, contactId };
    out.push({ ...base, extId: `deal:${d.id}:created`, type: "deal_created", occurredAt: d.created_at, amount: d.amount });
    const hist = await c.call<{ items: HistoryItem[] }>(OPS.listDealHistory, { path: { deal_id: d.id } });
    for (const h of (hist.items ?? []).filter((x) => x.change_type === "stage")) {
      out.push({ ...base, extId: `deal:${d.id}:${h.id}`, type: "deal_stage_changed", occurredAt: h.changed_at, amount: d.amount });
      const t = stageType.get(h.to_value);
      if (t === "won" || t === "lost") {
        const when = d.close_date
          ? (d.close_date.includes("T") ? d.close_date : `${d.close_date}T12:00:00Z`)
          : h.changed_at;
        out.push({ ...base, extId: `deal:${d.id}:${t}`, type: t === "won" ? "deal_won" : "deal_lost", occurredAt: when, amount: d.amount });
      }
    }
  }
  return out;
}

const EVENT_TYPES: Record<string, OutcomeType> = {
  "engagement.email_sent": "email_sent", "engagement.email_replied": "email_replied", "engagement.email_bounced": "email_bounced",
  "meeting.booked": "meeting_booked", "meeting.no_show": "meeting_no_show",
};

function pick(d: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = k.split(".").reduce<unknown>((o, p) => (o && typeof o === "object" ? (o as Record<string, unknown>)[p] : undefined), d);
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

export function outcomeFromEvent(e: WebhookEnvelope, contacts?: Map<number, ContactInfo>): Outcome | null {
  const type = EVENT_TYPES[e.event];
  if (!type) return null;
  const d = e.data ?? {};
  const contactId = Number(pick(d, "contact_id", "contact.id")) || null;
  const simulated = pick(d, "simulated") === true;
  return {
    extId: e.id ?? `${e.event}:${e.timestamp}:${contactId}`, type,
    occurredAt: String(pick(d, "occurred_at", "occurredAt", "timestamp") ?? e.timestamp ?? new Date().toISOString()), contactId,
    companyId: Number(pick(d, "company_id", "company.id")) || null, dealId: (pick(d, "deal_id") as string | null) ?? null,
    amount: Number(pick(d, "amount")) || null, listId: Number(pick(d, "list_id", "audience_id")) || null,
    sequenceId: (pick(d, "sequence_id", "sequence.id") as string | null) ?? null, step: Number(pick(d, "step", "step_order")) || null,
    channel: (pick(d, "channel") as string | null) ?? (type.startsWith("email") ? "email" : null),
    segmentKey: contactId !== null ? contacts?.get(contactId)?.segmentKey ?? null : null, source: simulated ? "sim" : "webhook", simulated,
  };
}
