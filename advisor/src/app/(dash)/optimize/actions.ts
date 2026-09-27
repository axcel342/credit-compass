"use server";
import { g8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";
import { loadContactInfo, type ContactRow } from "@/lib/sync/contacts";
import { RecordStore } from "@/lib/store/records";
import { runToValues, valuesToCharge, valuesToRun, valuesToStat } from "@/lib/store/mappers";
import { calibrationFactor, classifyFit, estimateCredits, priceFor, smoothedRate, type ProviderRow } from "@/lib/domain/prespend";
import { shouldWarnPreSpend } from "@/lib/domain/gate";
import { ROI_FIT_FIELD_NAME, RUN_CONDITION, assertConditionFilters, ensurePipeline, readPipelineRun, runGuardedPipeline, setRunCondition, validateCondition, writeFit } from "@/lib/guardrail/guardrail";

export interface Advice {
  listId: number; listSize: number; missing: number; quote: number; estimate: number; flagged: number; warn: boolean;
  fits: Record<"high" | "medium" | "low" | "unknown", number>; fitByContact: [number, string][]; consistencyByContact: [number, string][];
}

export async function adviseList(listId: number): Promise<Advice> {
  if (!(await isAuthed())) throw new Error("Sign in first.");
  const c = g8Caller;
  const rows: (ContactRow & { work_email: string | null })[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<(ContactRow & { work_email: string | null })[]>(OPS.getListContacts, { path: { list_id: listId }, query: { page, limit: 200 } });
    rows.push(...r);
    if (r.length < 200) break;
  }
  const stats = (await new RecordStore(c, "roi_stat").list()).map((r) => valuesToStat(r.values));
  const org = stats.find((s) => s.dimension === "org");
  const orgRate = org && org.contactsReached > 0 ? org.meetings / org.contactsReached : 0;
  const seg = new Map(stats.filter((s) => s.dimension === "segment").map((s) => [s.value, s]));
  const fits: Advice["fits"] = { high: 0, medium: 0, low: 0, unknown: 0 };
  const fitByContact: [number, string][] = [], consistencyByContact: [number, string][] = [];
  let flagged = 0, missing = 0;
  for (const row of rows) {
    const info = await loadContactInfo(c, row);
    const s = seg.get(info.segmentKey);
    const n = s?.contactsReached ?? 0;
    const fit = classifyFit({ rate: smoothedRate(s?.meetings ?? 0, n, orgRate), orgRate, n, consistency: info.consistency });
    fits[fit]++; fitByContact.push([row.id, fit]); consistencyByContact.push([row.id, info.consistency]);
    if (info.consistency === "flagged") flagged++;
    if (!info.email && fit !== "low") missing++;
  }
  const providers = (await c.call<{ providers: ProviderRow[] }>(OPS.listProviders)).providers;
  const price = priceFor(providers, "leadmagic", "email_finder") ?? 3;
  const runs = (await new RecordStore(c, "roi_run").list()).map((r) => valuesToRun(r.values)).filter((r) => r.service === "waterfall_enrichment" && r.quotedCredits);
  const charges = (await new RecordStore(c, "roi_charge").list()).map((r) => valuesToCharge(r.values));
  const calibration = calibrationFactor(runs.map((r) => ({ quoted: r.quotedCredits!, actual: charges.filter((x) => x.runExtId === r.extId).reduce((s, x) => s + x.credits, 0) })));
  const estimate = estimateCredits({ records: missing, pricePerRecord: price, calibration });
  const pipes = (await c.call<{ items: { id: string }[] }>(OPS.listListPipelines, { path: { list_id: listId } })).items ?? [];
  const quote = pipes.length
    ? (await c.call<{ required_credits: number }>(OPS.estimateListPipeline, { path: { list_id: listId, pipeline_id: pipes[0].id } })).required_credits
    : rows.length * 2;
  const confidence = org?.confidence ?? "low";
  const warn = shouldWarnPreSpend({ plannedCredits: quote, projectedSaving: quote - estimate, confidence }) || (rows.length > 0 && flagged / rows.length >= 0.2);
  return { listId, listSize: rows.length, missing, quote, estimate, flagged, warn, fits, fitByContact, consistencyByContact };
}

export async function applyGuardrail(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm the run and its cost." };
  const c = g8Caller, listId = Number(form.get("listId"));
  try {
    const advice = await adviseList(listId);
    const fieldName = ROI_FIT_FIELD_NAME;
    await writeFit(c, { columnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fits: new Map(advice.fitByContact) });
    if (process.env.RECORD_CONSISTENCY_COLUMN_ID) // created by scripts/bootstrap.ts (Task 11)
      await writeFit(c, { columnId: Number(process.env.RECORD_CONSISTENCY_COLUMN_ID), fits: new Map(advice.consistencyByContact) });
    await validateCondition(c, RUN_CONDITION);
    await assertConditionFilters(c, { listId, listSize: advice.listSize, fieldName, value: "low" });
    const pipeline = await ensurePipeline(c, listId);
    await setRunCondition(c, { listId, pipeline, condition: RUN_CONDITION });
    const before = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    const runs = new RecordStore(c, "roi_run");
    const startedAt = new Date().toISOString();
    const cap = Number(process.env.ACTION_CREDIT_CAP ?? 50);
    const { runId } = await runGuardedPipeline(c, { listId, pipelineId: pipeline.id, estimatedCredits: advice.estimate, cap: Number.isFinite(cap) ? cap : 50 });
    await runs.upsert(runToValues({ extId: runId, kind: "pipeline_run", service: "waterfall_enrichment", actionName: `List pipeline · ${pipeline.name}`, startedAt,
      completedAt: null, status: "running", source: "advisor", listId, quotedCredits: advice.estimate }));
    let result = await readPipelineRun(c, runId);
    for (let i = 0; i < 36 && result.status !== "completed" && result.status !== "failed"; i++) { await new Promise((r) => setTimeout(r, 5000)); result = await readPipelineRun(c, runId); }
    const after = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    await runs.upsert(runToValues({ extId: runId, kind: "pipeline_run", service: "waterfall_enrichment", actionName: `List pipeline · ${pipeline.name}`, startedAt,
      completedAt: new Date().toISOString(), status: result.status, source: "advisor", listId, quotedCredits: advice.estimate,
      recordsOk: result.successful, recordsFailed: result.failed, recordsSkipped: result.skipped }));
    return { ok: true, message: `Enriched ${result.successful}, skipped ${result.skipped} low-fit contacts, ${Math.round(before - after)} credits.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
