import type { AttributedCharge, Finding, LedgerRow, Outcome, Run, Stat } from "../domain/types";

type V = Record<string, unknown>;
const s = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const bool = (v: unknown): boolean => v === true || v === "true";
const json = <T>(v: unknown, d: T): T => { if (typeof v !== "string" || !v) return d; try { return JSON.parse(v) as T; } catch { return d; } };

export function chargeToValues(c: AttributedCharge): V {
  return { ext_id: c.ledgerId, simulated: c.simulated, ledger_type: c.ledgerType, service: c.service, credits: c.credits, charged_at: c.chargedAt, llm_tier: c.llmTier,
    tokens_in: c.tokensIn, tokens_out: c.tokensOut, description: c.description, run_ext_id: c.runExtId, method: c.method, contact_id: c.contactId,
    list_id: c.listId, segment_key: c.segmentKey, explanation: c.explanation, result: c.result, is_waste: c.isWaste, waste_reason: c.wasteReason };
}
export function valuesToCharge(v: V): AttributedCharge {
  return { ledgerId: String(v.ext_id), ledgerType: String(v.ledger_type), service: String(v.service), credits: Number(v.credits), chargedAt: String(v.charged_at),
    llmTier: s(v.llm_tier), tokensIn: num(v.tokens_in), tokensOut: num(v.tokens_out), description: s(v.description), method: v.method as AttributedCharge["method"],
    runExtId: s(v.run_ext_id), listId: num(v.list_id), contactId: num(v.contact_id), segmentKey: s(v.segment_key), explanation: String(v.explanation ?? ""),
    result: v.result as AttributedCharge["result"], isWaste: bool(v.is_waste), wasteReason: (s(v.waste_reason) as AttributedCharge["wasteReason"]), simulated: bool(v.simulated) };
}
export function ledgerFromCharge(c: AttributedCharge): LedgerRow {
  return { id: c.ledgerId, type: c.ledgerType, amount: -c.credits, service: c.service, quantity: null, llm_tier: c.llmTier, description: c.description, created_at: c.chargedAt };
}

export function runToValues(r: Run): V {
  return { ext_id: r.extId, simulated: r.simulated ?? false, kind: r.kind, service: r.service ?? null, action_name: r.actionName, started_at: r.startedAt, completed_at: r.completedAt,
    status: r.status, source: r.source, tokens_in: r.tokensIn ?? null, tokens_out: r.tokensOut ?? null, list_id: r.listId ?? null,
    contact_ids: JSON.stringify(r.contactIds ?? []), contact_label: r.contactLabel ?? null, company_name: r.companyName ?? null, records_ok: r.recordsOk ?? null,
    records_failed: r.recordsFailed ?? null, records_skipped: r.recordsSkipped ?? null, quoted_credits: r.quotedCredits ?? null,
    reported_credits: r.reportedCredits ?? null, result_hint: r.resultHint ?? null };
}
export function valuesToRun(v: V): Run {
  return { extId: String(v.ext_id), kind: v.kind as Run["kind"], service: s(v.service), actionName: String(v.action_name ?? ""), startedAt: s(v.started_at),
    completedAt: s(v.completed_at), status: String(v.status ?? ""), source: v.source as Run["source"], tokensIn: num(v.tokens_in), tokensOut: num(v.tokens_out),
    listId: num(v.list_id), contactIds: json<number[]>(v.contact_ids, []), contactLabel: s(v.contact_label), companyName: s(v.company_name),
    recordsOk: num(v.records_ok), recordsFailed: num(v.records_failed), recordsSkipped: num(v.records_skipped), quotedCredits: num(v.quoted_credits),
    reportedCredits: num(v.reported_credits), resultHint: (s(v.result_hint) as Run["resultHint"]), simulated: bool(v.simulated) };
}

export function outcomeToValues(o: Outcome): V {
  return { ext_id: o.extId, simulated: o.simulated, type: o.type, occurred_at: o.occurredAt, contact_id: o.contactId, company_id: o.companyId, deal_id: o.dealId,
    amount: o.amount, list_id: o.listId, sequence_id: o.sequenceId, step: o.step, channel: o.channel, segment_key: o.segmentKey, source: o.source };
}
export function valuesToOutcome(v: V): Outcome {
  return { extId: String(v.ext_id), type: v.type as Outcome["type"], occurredAt: String(v.occurred_at), contactId: num(v.contact_id), companyId: num(v.company_id),
    dealId: s(v.deal_id), amount: num(v.amount), listId: num(v.list_id), sequenceId: s(v.sequence_id), step: num(v.step), channel: s(v.channel),
    segmentKey: s(v.segment_key), source: v.source as Outcome["source"], simulated: bool(v.simulated) };
}

export function statToValues(x: Stat): V {
  return { ext_id: `${x.period}|${x.dimension}|${x.value}`, simulated: x.simulated, period: x.period, dimension: x.dimension, value: x.value, credits: x.credits,
    credits_exact: x.creditsExact, meetings: x.meetings, deals: x.deals, won_value: x.wonValue, contacts_reached: x.contactsReached,
    cost_per_meeting: x.costPerMeeting, cost_per_deal: x.costPerDeal, vs_avg_pct: x.vsAvgPct, evidence_n: x.evidenceN, confidence: x.confidence, computed_at: x.computedAt };
}
export function valuesToStat(v: V): Stat {
  return { period: String(v.period), dimension: v.dimension as Stat["dimension"], value: String(v.value), credits: Number(v.credits), creditsExact: Number(v.credits_exact),
    meetings: Number(v.meetings), deals: Number(v.deals), wonValue: Number(v.won_value), contactsReached: Number(v.contacts_reached),
    costPerMeeting: num(v.cost_per_meeting), costPerDeal: num(v.cost_per_deal), vsAvgPct: num(v.vs_avg_pct), evidenceN: Number(v.evidence_n),
    confidence: v.confidence as Stat["confidence"], simulated: bool(v.simulated), computedAt: String(v.computed_at) };
}

export function findingToValues(f: Finding): V {
  return { ext_id: f.extId, simulated: f.simulated, kind: f.kind, title: f.title, body: f.body, evidence: JSON.stringify(f.evidence), credits_at_stake: f.creditsAtStake,
    confidence: f.confidence, status: f.status, snoozed_until: f.snoozedUntil, dismiss_count: f.dismissCount, action: f.action,
    action_payload: f.actionPayload ? JSON.stringify(f.actionPayload) : null, first_seen: f.firstSeen, last_seen: f.lastSeen,
    last_notified_stake: f.lastNotifiedStake, in_recap: f.inRecap };
}
export function valuesToFinding(v: V): Finding {
  return { extId: String(v.ext_id), kind: v.kind as Finding["kind"], title: String(v.title), body: String(v.body), evidence: json(v.evidence, {}),
    creditsAtStake: Number(v.credits_at_stake), confidence: v.confidence as Finding["confidence"], status: v.status as Finding["status"],
    snoozedUntil: s(v.snoozed_until), dismissCount: Number(v.dismiss_count ?? 0), action: s(v.action), actionPayload: json(v.action_payload, null),
    firstSeen: String(v.first_seen), lastSeen: String(v.last_seen), lastNotifiedStake: num(v.last_notified_stake), inRecap: bool(v.in_recap), simulated: bool(v.simulated) };
}
