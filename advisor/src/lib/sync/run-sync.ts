import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { ContactInfo, Run } from "../domain/types";
import { attributeCharges, coverage } from "../domain/attribution";
import { onboardingWindow } from "../domain/runs";
import { computeStats } from "../domain/metrics";
import { generateFindings, mergeFindings } from "../domain/findings";
import { toIso, toMs } from "../domain/time";
import { RecordStore } from "../store/records";
import { chargeToValues, findingToValues, ledgerFromCharge, outcomeToValues, runToValues, statToValues, valuesToCharge, valuesToFinding, valuesToOutcome, valuesToRun } from "../store/mappers";
import { fetchLedgerSince } from "./ledger";
import { fetchOnboardingAnchors, fetchUnusedDocs, pollPipelineRuns } from "./capture";
import { loadContactIndex } from "./contacts";
import { pollDealOutcomes } from "./outcomes";

export interface SyncSummary { skipped?: "locked"; newLedgerRows: number; charges: number; coverage: { exact: number; window: number; none: number; total: number }; findings: number }
const LOCK_MS = 4 * 60_000;

export async function runSync(deps: { c: G8Caller; now?: string; contacts?: Map<number, ContactInfo> }): Promise<SyncSummary> {
  const now = deps.now ?? toIso(Date.now());
  const s = { charges: new RecordStore(deps.c, "roi_charge"), runs: new RecordStore(deps.c, "roi_run"), outcomes: new RecordStore(deps.c, "roi_outcome"),
    stats: new RecordStore(deps.c, "roi_stat"), findings: new RecordStore(deps.c, "roi_finding") };

  const runRecs = (await s.runs.list()).map((r) => valuesToRun(r.values));
  const lock = runRecs.find((r) => r.extId === "sync-lock");
  if (lock?.startedAt && lock.status === "running" && toMs(now) - toMs(lock.startedAt) < LOCK_MS)
    return { skipped: "locked", newLedgerRows: 0, charges: 0, coverage: { exact: 0, window: 0, none: 0, total: 0 }, findings: 0 };
  await s.runs.upsert(runToValues({ extId: "sync-lock", kind: "sync_lock", actionName: "sync", startedAt: now, completedAt: null, status: "running", source: "advisor" }));
  try {
    const existingCharges = (await s.charges.list()).map((r) => valuesToCharge(r.values));
    const fresh = await fetchLedgerSince(deps.c, new Set(existingCharges.map((x) => x.ledgerId)));
    const ledger = [...existingCharges.filter((x) => !x.simulated).map(ledgerFromCharge), ...fresh];

    const lists = await deps.c.call<{ id: number }[]>(OPS.listLists);
    const pipelineRuns = await pollPipelineRuns(deps.c, lists.map((l) => l.id));
    for (const r of pipelineRuns) await s.runs.upsert(runToValues(r));
    const runs: Run[] = [...runRecs.filter((r) => r.kind !== "sync_lock" && !pipelineRuns.some((p) => p.extId === r.extId)), ...pipelineRuns];

    const anchors = await fetchOnboardingAnchors(deps.c);
    const windows = anchors ? [onboardingWindow(anchors)] : [];
    const advisorPosts = runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!);
    const contacts = deps.contacts ?? (await loadContactIndex(deps.c));
    const real = attributeCharges({ ledger, runs, windows, advisorPosts }).map((ch) => ({ ...ch, segmentKey: ch.contactId !== null ? contacts.get(ch.contactId)?.segmentKey ?? null : null }));
    const simCharges = existingCharges.filter((x) => x.simulated);
    for (const ch of real) await s.charges.upsert(chargeToValues(ch));
    const charges = [...real, ...simCharges];

    for (const o of await pollDealOutcomes(deps.c, contacts)) await s.outcomes.upsert(outcomeToValues(o));
    const outcomes = (await s.outcomes.list()).map((r) => valuesToOutcome(r.values));

    const to = toMs(now), from = to - 30 * 86_400_000;
    const base = { charges, outcomes, contacts, period: "30d", from, to, now };
    const byList = computeStats({ ...base, dimension: "list" });
    const bySegment = computeStats({ ...base, dimension: "segment" });
    const byService = computeStats({ ...base, dimension: "service" });
    for (const st of [...byList, ...bySegment.slice(1), ...byService.slice(1)]) await s.stats.upsert(statToValues(st));

    const onboardingCredits = real.filter((ch) => ch.method === "time_window" && ch.service === "studio_global").reduce((a, ch) => a + ch.credits, 0);
    const fresh2 = generateFindings({ now, period: "30d", statsByList: byList, statsBySegment: bySegment, charges, runs, outcomes,
      unusedDocs: await fetchUnusedDocs(deps.c), onboardingCredits });
    const existingFindings = (await s.findings.list()).map((r) => valuesToFinding(r.values));
    const merged = mergeFindings(fresh2, existingFindings);
    const mergedIds = new Set(merged.map((f) => f.extId));
    for (const f of merged) await s.findings.upsert(findingToValues(f));
    for (const f of existingFindings) if (!mergedIds.has(f.extId) && f.status === "open") await s.findings.upsert(findingToValues({ ...f, status: "applied" }));

    return { newLedgerRows: fresh.length, charges: real.length, coverage: coverage(real), findings: merged.length };
  } finally {
    await s.runs.upsert(runToValues({ extId: "sync-lock", kind: "sync_lock", actionName: "sync", startedAt: now, completedAt: toIso(Date.now()), status: "done", source: "advisor" }));
  }
}
