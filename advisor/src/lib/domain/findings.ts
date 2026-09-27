import type { AttributedCharge, Finding, FindingKind, Outcome, Run, Stat } from "./types";
import { repeatEnrichment } from "./repeat";

export interface FindingContext {
  now: string; period: string; statsByList: Stat[]; statsBySegment: Stat[]; charges: AttributedCharge[]; runs: Run[]; outcomes: Outcome[];
  unusedDocs: { name: string; createdAt: string }[]; onboardingCredits: number; listNames: Map<string, string>;
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;

function mk(ctx: FindingContext, kind: FindingKind, scope: string, p: { title: string; body: string; stake: number; confidence: Finding["confidence"];
  evidence: Record<string, unknown>; action?: string; payload?: Record<string, unknown>; simulated?: boolean }): Finding {
  return { extId: `${kind}|${scope}|${ctx.period}`, kind, title: p.title, body: p.body, evidence: p.evidence, creditsAtStake: Math.round(p.stake),
    confidence: p.confidence, status: "open", snoozedUntil: null, dismissCount: 0, action: p.action ?? null, actionPayload: p.payload ?? null,
    firstSeen: ctx.now, lastSeen: ctx.now, lastNotifiedStake: null, inRecap: false, simulated: p.simulated ?? false };
}

export function generateFindings(ctx: FindingContext): Finding[] {
  const out: Finding[] = [];
  const sum = (xs: AttributedCharge[]) => xs.reduce((s, c) => s + c.credits, 0);
  const mismatchRuns = new Set(ctx.runs.filter((r) => r.reportedCredits === 0).map((r) => r.extId)
    .filter((id) => ctx.charges.some((c) => c.runExtId === id && c.credits > 0)));
  const failed = ctx.charges.filter((c) => c.wasteReason === "failed_job");
  if (failed.length) {
    const runs = [...new Set(failed.map((c) => c.runExtId).filter((x): x is string => !!x))];
    const alsoMismatch = runs.length > 0 && runs.every((id) => mismatchRuns.has(id));
    out.push(mk(ctx, "waste", "failed_job", { title: "graph8 owes you for jobs that failed",
      body: `${n(sum(failed))} credits went to ${plural(runs.length, "job")} that failed on every record.${alsoMismatch ? " graph8's job records say 0 credits were used." : ""}`,
      stake: sum(failed), confidence: "high", evidence: { runs, ledgerIds: failed.map((c) => c.ledgerId), billingMismatch: alsoMismatch }, action: "Refund request", payload: { reason: "failed_job" } }));
  }
  const unreadable = ctx.charges.filter((c) => c.wasteReason === "no_change");
  if (unreadable.length) {
    const runs = [...new Set(unreadable.map((c) => c.runExtId).filter((x): x is string => !!x))];
    out.push(mk(ctx, "waste", "no_change", { title: "graph8 owes you for results you can't use",
      body: `${n(sum(unreadable))} credits went to ${runs.length === 1 ? "1 job whose result" : `${plural(runs.length, "job")} whose results`} can't be read back.`,
      stake: sum(unreadable), confidence: "high", evidence: { runs, ledgerIds: unreadable.map((c) => c.ledgerId) }, action: "Refund request", payload: { reason: "no_change" } }));
  }
  const failedRuns = new Set(failed.map((c) => c.runExtId));
  const otherMismatch = [...mismatchRuns].filter((id) => !failedRuns.has(id));
  if (otherMismatch.length) {
    const xs = ctx.charges.filter((c) => c.runExtId !== null && otherMismatch.includes(c.runExtId));
    out.push(mk(ctx, "fix", "billing_mismatch", { title: "Charged for jobs that report no charge",
      body: `graph8's job records say 0 credits were used, but the ledger charged ${n(sum(xs))}.`, stake: sum(xs), confidence: "high",
      evidence: { runs: otherMismatch }, action: "Refund request" }));
  }
  const side = ctx.charges.filter((c) => c.wasteReason === "agent_side_effect");
  if (side.length) out.push(mk(ctx, "side_effect", "agent_reply", { title: "Automated posts are waking graph8's agent",
    body: `${n(sum(side))} credits were charged when graph8's agent replied to automated posts. Post recaps only to #roi-advisor.`,
    stake: sum(side), confidence: "high", evidence: { ledgerIds: side.map((c) => c.ledgerId) }, action: "Use #roi-advisor" }));
  for (const r of ctx.runs) {
    if (r.quotedCredits && r.service) {
      const svcRuns = ctx.runs.filter((x) => x.service === r.service && x.quotedCredits);
      const quoted = svcRuns.reduce((s, x) => s + (x.quotedCredits ?? 0), 0);
      const charged = sum(ctx.charges.filter((c) => svcRuns.some((x) => x.extId === c.runExtId)));
      if (charged > quoted * 1.2 && !out.some((f) => f.extId === `fix|estimate_gap:${r.service}|${ctx.period}`))
        out.push(mk(ctx, "fix", `estimate_gap:${r.service}`, { title: "graph8's estimates run low", body: `Quoted ${n(quoted)}, charged ${n(charged)} (+${Math.round((charged / quoted - 1) * 100)}%). Future estimates here are adjusted.`,
          stake: charged - quoted, confidence: "high", evidence: { service: r.service, quoted, actual: charged } }));
    }
  }
  const org = ctx.statsByList.find((s) => s.dimension === "org");
  const orgCpm = org?.costPerMeeting ?? null;
  for (const s of ctx.statsByList.filter((x) => x.dimension !== "org")) {
    const name = ctx.listNames.get(s.value) ?? `list ${s.value}`;
    if (orgCpm && s.costPerMeeting !== null && s.costPerMeeting <= 0.6 * orgCpm && s.confidence !== "low" && s.meetings >= 5)
      out.push(mk(ctx, "scale", `list:${s.value}`, { title: `Scale ${name}`, body: `${name} book meetings at ${n(s.costPerMeeting)} credits each, ${Math.round((1 - s.costPerMeeting / orgCpm) * 100)}% below your average.`,
        stake: s.credits, confidence: s.confidence, evidence: { value: s.value, costPerMeeting: s.costPerMeeting, meetings: s.meetings }, action: "Build lookalike list", simulated: s.simulated }));
    const tooCostly = orgCpm !== null && s.costPerMeeting !== null && s.costPerMeeting >= 2 * orgCpm;
    const noMeetings = s.meetings === 0 && s.credits >= 1000 && s.contactsReached >= 100;
    if (tooCostly || noMeetings)
      out.push(mk(ctx, "cut", `list:${s.value}`, { title: `Cut back on ${name}`, body: tooCostly ? `${name} costs ${n(s.costPerMeeting!)} credits per meeting, over twice your average.` : `${name} took ${n(s.credits)} credits and booked no meetings.`,
        stake: s.credits, confidence: s.confidence === "low" ? "medium" : s.confidence, evidence: { value: s.value, costPerMeeting: s.costPerMeeting, meetings: s.meetings }, action: "Apply guardrail", simulated: s.simulated }));
  }
  if (ctx.unusedDocs.length) out.push(mk(ctx, "unused", "studio_docs", { title: `${plural(ctx.unusedDocs.length, "paid document")} never used`,
    body: `${plural(ctx.unusedDocs.length, "onboarding document")} ${ctx.unusedDocs.length === 1 ? "has" : "have"} never been used. They came out of about ${n(ctx.onboardingCredits)} credits of research.`,
    stake: ctx.onboardingCredits, confidence: "medium", evidence: { documents: ctx.unusedDocs.length } }));
  const rep = repeatEnrichment(ctx.charges);
  if (rep.credits >= 50) out.push(mk(ctx, "repeat_enrichment", "contacts", { title: "Paying to enrich the same contacts again",
    body: `${n(rep.credits)} credits went to contacts that were enriched again within 30 days.`, stake: rep.credits, confidence: "high",
    evidence: { charges: rep.charges, contacts: rep.contacts, byList: Object.fromEntries([...rep.byList].map(([k, v]) => [String(k), Math.round(v)])) },
    action: "Turn on skip recently enriched", simulated: rep.simulated }));
  const total = sum(ctx.charges), none = sum(ctx.charges.filter((c) => c.method === "none"));
  if (total > 0 && none / total >= 0.1) out.push(mk(ctx, "traceability", "service_only", { title: "Spend you can't trace",
    body: `${n(none)} credits (${Math.round((none / total) * 100)}%) can't be tied to a contact or list. Run repeated skills inside a workflow so they can be traced.`,
    stake: none, confidence: "high", evidence: { none, total } }));
  const sends = ctx.outcomes.filter((o) => o.type === "email_sent" && o.step !== null);
  const replies = ctx.outcomes.filter((o) => o.type === "email_replied" && o.step !== null);
  const bySeg = new Map<string, { sent: Map<number, number>; replied: Map<number, number> }>();
  for (const o of [...sends, ...replies]) {
    const k = o.segmentKey ?? "Unknown";
    const e = bySeg.get(k) ?? { sent: new Map(), replied: new Map() };
    const m = o.type === "email_sent" ? e.sent : e.replied;
    m.set(o.step!, (m.get(o.step!) ?? 0) + 1);
    bySeg.set(k, e);
  }
  for (const [seg, e] of bySeg) {
    const totalSent = [...e.sent.values()].reduce((a, b) => a + b, 0), totalReplied = [...e.replied.values()].reduce((a, b) => a + b, 0);
    const overall = totalSent ? totalReplied / totalSent : 0;
    for (const [step, sent] of e.sent) {
      const rate = (e.replied.get(step) ?? 0) / sent;
      if (sent >= 20 && overall > 0 && rate >= 2 * overall)
        out.push(mk(ctx, "what_worked", `step:${seg}:${step}`, { title: `Step ${step} works for ${seg.split("|")[0]}`,
          body: `Step ${step} gets ${(rate / overall).toFixed(1)}× the reply rate for this segment.`, stake: 0, confidence: "medium",
          evidence: { segment: seg, step, rate, overall, sent }, action: "Use as step 1", simulated: sends.some((o) => o.simulated) }));
    }
  }
  return out;
}

function signature(f: Finding): string {
  return JSON.stringify([f.title, f.body, JSON.stringify(f.evidence), f.creditsAtStake, f.confidence, f.action, f.actionPayload, f.status]);
}

export function mergeFindings(fresh: Finding[], existing: Finding[]): Finding[] {
  const prev = new Map(existing.map((f) => [f.extId, f]));
  return fresh.map((f) => {
    const p = prev.get(f.extId);
    if (!p) return f;
    if (p.status === "applied") return f;
    const merged = { ...f, status: p.status, snoozedUntil: p.snoozedUntil, dismissCount: p.dismissCount, firstSeen: p.firstSeen, lastNotifiedStake: p.lastNotifiedStake, inRecap: p.inRecap };
    return signature(merged) === signature(p) ? { ...merged, lastSeen: p.lastSeen } : merged;
  });
}
