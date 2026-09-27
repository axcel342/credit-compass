import { cache } from "react";
import type { G8Caller } from "../g8/client";
import { g8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { RecordStore } from "../store/records";
import { valuesToAction, valuesToCharge, valuesToFinding, valuesToOutcome, valuesToRun, valuesToStat } from "../store/mappers";
import { coverage } from "../domain/attribution";
import { bucketTotals, emailsByContact, meetingsByContact, outcomeBucket, type BucketContext } from "../domain/buckets";
import { listNamesFrom } from "../domain/names";
import { inWindow, periodWindow } from "../domain/period";
import type { ActionRecord, AttributedCharge, Finding, Outcome, OutcomeBucket, Period, Run, Stat } from "../domain/types";

export interface ListInfo { id: number; title: string; total: number }
export interface DashboardData {
  charges: AttributedCharge[]; outcomes: Outcome[]; stats: Stat[]; findings: Finding[]; runs: Run[]; actions: ActionRecord[]; lists: ListInfo[];
  listNames: Map<string, string>; hasDemoData: boolean; now: string;
  /** All-time coverage and waste, kept for the MCP tools and the recap. */
  coverage: ReturnType<typeof coverage>; waste: number;
}

export const loadDashboardData = cache(async (c: G8Caller = g8Caller): Promise<DashboardData> => {
  const [ch, oc, st, fi, ru, ac] = await Promise.all(["roi_charge", "roi_outcome", "roi_stat", "roi_finding", "roi_run", "roi_action"].map((slug) => new RecordStore(c, slug).list()));
  const lists = await c.call<ListInfo[]>(OPS.listLists);
  const charges = ch.map((r) => valuesToCharge(r.values)), outcomes = oc.map((r) => valuesToOutcome(r.values));
  return { charges, outcomes, stats: st.map((r) => valuesToStat(r.values)), findings: fi.map((r) => valuesToFinding(r.values)), runs: ru.map((r) => valuesToRun(r.values)),
    actions: ac.map((r) => valuesToAction(r.values)),
    lists, listNames: listNamesFrom(lists), hasDemoData: charges.some((x) => x.simulated) || outcomes.some((o) => o.simulated), now: new Date().toISOString(),
    coverage: coverage(charges), waste: charges.filter((x) => x.isWaste).reduce((s, x) => s + x.credits, 0) };
});

export interface PeriodView {
  period: Period; window: { from: number; to: number }; charges: AttributedCharge[]; outcomes: Outcome[]; stats: Stat[]; org: Stat | undefined;
  coverage: ReturnType<typeof coverage>; waste: number; buckets: Record<OutcomeBucket, number>; bucketOf: (c: AttributedCharge) => OutcomeBucket;
  bucketCtx: BucketContext; meetings: number; won: number; wonValue: number;
}

export function periodView(d: DashboardData, period: Period): PeriodView {
  const window = periodWindow(period, d.now);
  const charges = d.charges.filter((c) => inWindow(c.chargedAt, window));
  const outcomes = d.outcomes.filter((o) => inWindow(o.occurredAt, window));
  const bucketCtx: BucketContext = { meetingsByContact: meetingsByContact(d.outcomes), emailedByContact: emailsByContact(d.outcomes),
    onboardingUnused: d.findings.some((f) => f.kind === "unused" && f.extId.startsWith("unused|studio_docs") && f.status !== "applied") };
  const stats = d.stats.filter((s) => s.period === period);
  return { period, window, charges, outcomes, stats, org: stats.find((s) => s.dimension === "org"), coverage: coverage(charges),
    waste: charges.filter((c) => c.isWaste).reduce((s, c) => s + c.credits, 0), buckets: bucketTotals(charges, bucketCtx),
    bucketOf: (c) => outcomeBucket(c, bucketCtx), bucketCtx,
    meetings: outcomes.filter((o) => o.type === "meeting_booked").length, won: outcomes.filter((o) => o.type === "deal_won").length,
    wonValue: outcomes.filter((o) => o.type === "deal_won").reduce((s, o) => s + (o.amount ?? 0), 0) };
}
