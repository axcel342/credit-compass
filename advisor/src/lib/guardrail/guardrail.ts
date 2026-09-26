import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";

export const ROI_FIT_FIELD_NAME = "udo_roi_fit_11e946f0";

export const RUN_CONDITION = `NOT(EQ({{${ROI_FIT_FIELD_NAME}}}, "low"))`;

export async function validateCondition(c: G8Caller, formula: string): Promise<void> {
  const r = await c.call<{ valid: boolean; errors: string[] }>(OPS.validateFormula, { body: { formula } });
  if (!r.valid) throw new Error(`graph8 rejected the condition: ${r.errors.join("; ")}`);
}

export async function assertConditionFilters(c: G8Caller, p: { listId: number; listSize: number; fieldName: string; value: string }): Promise<number> {
  const r = await c.call<{ matching_count: number }>(OPS.previewRoutingRule, { body: { source_list_id: p.listId, conditions: [{ field: p.fieldName, operator: "equals", value: p.value }] } });
  if (r.matching_count >= p.listSize) throw new Error(`The filter matches every contact on the list (${r.matching_count}). It isn't filtering; nothing was saved.`);
  if (r.matching_count === 0) throw new Error(`The filter matches no contact on the list. Write roi_fit values first.`);
  return r.matching_count;
}

export async function writeFit(c: G8Caller, p: { columnId: number; fits: Map<number, string> }): Promise<number> {
  let n = 0;
  for (const [contactId, fit] of p.fits) {
    await c.call(OPS.setFieldValue, { path: { column_id: p.columnId }, body: { entity: "contacts", record_id: contactId, value: fit } });
    n++;
  }
  return n;
}

interface Pipeline { id: string; name: string; steps?: { id: string; name?: string; type: string; config_ref?: string }[] }

export interface GuardablePipeline { id: string; name: string; configRef: string; stepId: string; stepName: string }

export async function ensurePipeline(c: G8Caller, listId: number): Promise<GuardablePipeline> {
  const existing = (await c.call<{ items: Pipeline[] }>(OPS.listListPipelines, { path: { list_id: listId } })).items ?? [];
  const p = existing.find((x) => x.name === "Verified emails")
    ?? await c.call<Pipeline>(OPS.createPipelineFromTemplate, { path: { list_id: listId }, body: { template_key: "verified_emails" } });
  const step = (p.steps ?? []).find((s) => s.type === "waterfall");
  if (!step?.config_ref) throw new Error("The pipeline has no email-finder step to guard.");
  return { id: p.id, name: p.name, configRef: step.config_ref, stepId: step.id, stepName: step.name ?? "Email finder" };
}

export async function setRunCondition(c: G8Caller, p: { listId: number; pipeline: GuardablePipeline; condition: string | null }): Promise<void> {
  await c.call(OPS.updateListPipeline, { path: { list_id: p.listId, pipeline_id: p.pipeline.id }, body: { name: p.pipeline.name, enabled: false,
    steps: [{ id: p.pipeline.stepId, name: p.pipeline.stepName, type: "waterfall", config_ref: p.pipeline.configRef, run_condition: p.condition,
      skip_existing_values: true, skip_recently_enriched: true, enabled: true }] } });
}

export async function runGuardedPipeline(c: G8Caller, p: { listId: number; pipelineId: string; estimatedCredits: number; cap: number }): Promise<{ runId: string }> {
  if (p.estimatedCredits > p.cap) throw new Error(`Estimated ${p.estimatedCredits} credits is above the per-action cap of ${p.cap}. Raise ACTION_CREDIT_CAP or narrow the list.`);
  const r = await c.call<{ run_id: string }>(OPS.runListPipeline, { path: { list_id: p.listId, pipeline_id: p.pipelineId } });
  return { runId: r.run_id };
}

export async function readPipelineRun(c: G8Caller, runId: string) {
  const r = await c.call<{ status: string; step_progress?: { processed_records?: number; successful?: number; failed?: number; skipped_by_reason?: Record<string, number> }[] }>(OPS.getPipelineRun, { path: { run_id: runId } });
  const sp = r.step_progress ?? [];
  const sum = (f: (x: (typeof sp)[number]) => number) => sp.reduce((s, x) => s + f(x), 0);
  return { status: r.status, processed: sum((x) => x.processed_records ?? 0), successful: sum((x) => x.successful ?? 0), failed: sum((x) => x.failed ?? 0),
    skipped: sum((x) => Object.values(x.skipped_by_reason ?? {}).reduce((a, b) => a + b, 0)) };
}
