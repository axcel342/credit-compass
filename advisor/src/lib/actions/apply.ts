import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { RecordStore } from "../store/records";
import { actionToValues, valuesToAction } from "../store/mappers";
import type { ActionRecord, ContactCacheRow } from "../domain/types";
import { findEnrichmentPipeline, listPipelines, patchPipeline, restorePipeline, type PipelinePatch, type PipelineSettings } from "../guardrail/pipeline";
import { ROI_FIT_FIELD_NAME, RUN_CONDITION, assertConditionFilters, validateCondition, writeFit } from "../guardrail/guardrail";

async function existing(c: G8Caller, extId: string): Promise<ActionRecord | null> {
  const r = (await new RecordStore(c, "roi_action").list()).find((x) => x.values.ext_id === extId);
  return r ? valuesToAction(r.values) : null;
}
async function save(c: G8Caller, a: ActionRecord): Promise<void> { await new RecordStore(c, "roi_action").upsert(actionToValues(a)); }

async function patchList(c: G8Caller, kind: "repeat_skip" | "pause_list" | "guardrail", listId: number, patch: PipelinePatch, now: string, detail: Record<string, unknown> = {}): Promise<boolean> {
  const extId = `${kind}:${listId}`;
  const prev = await existing(c, extId);
  if (prev?.status === "applied") return true; // idempotent: keep the first previous settings
  const p = await findEnrichmentPipeline(c, listId);
  if (!p) return false;
  const before = await patchPipeline(c, listId, p, patch);
  await save(c, { extId, kind, listId, pipelineId: p.id, appliedAt: now, status: "applied", previous: before, detail, simulated: false });
  return true;
}

export async function applyRepeatSkip(c: G8Caller, listIds: number[], now: string) {
  const changed: number[] = [], skipped: number[] = [];
  for (const l of listIds) (await patchList(c, "repeat_skip", l, { step: { skip_recently_enriched: true, skip_existing_values: true } }, now)) ? changed.push(l) : skipped.push(l);
  return { changed, skipped };
}

export async function applyPause(c: G8Caller, listId: number, now: string) {
  return patchList(c, "pause_list", listId, { enabled: false }, now);
}

export async function applyGuardrailRule(c: G8Caller, listId: number, rows: ContactCacheRow[], now: string) {
  await writeFit(c, { columnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fits: new Map(rows.map((r) => [r.contactId, r.fit])) });
  await validateCondition(c, RUN_CONDITION);
  await assertConditionFilters(c, { listId, listSize: rows.length, fieldName: ROI_FIT_FIELD_NAME, value: "low" });
  return patchList(c, "guardrail", listId, { step: { run_condition: RUN_CONDITION } }, now, { contacts: rows.length });
}

export async function applyLookalike(c: G8Caller, p: { listId: number; title: string; filters: { field: string; operator: string; value: string[] }[] }, now: string) {
  const extId = `lookalike:${p.listId}`;
  const prev = await existing(c, extId);
  if (prev?.status === "applied") return prev;
  const r = await c.call<{ list_id?: number; id?: number }>(OPS.saveContactSearch, { body: { filters: p.filters, list_title: p.title, max_results: 50 } });
  const rec: ActionRecord = { extId, kind: "lookalike", listId: p.listId, pipelineId: null, appliedAt: now, status: "applied", previous: null,
    detail: { title: p.title, listId: r.list_id ?? r.id ?? null, filters: p.filters }, simulated: false };
  await save(c, rec);
  return rec;
}

export async function undoAction(c: G8Caller, a: ActionRecord): Promise<void> {
  if (a.kind === "lookalike") throw new Error("Lookalike lists are never deleted from here. Remove the list in graph8 if you don't want it.");
  if (a.kind === "refund_request") throw new Error("A sent refund request can't be undone.");
  if (a.status !== "applied" || a.listId === null) return;
  const p = (await listPipelines(c, a.listId)).find((x) => x.id === a.pipelineId);
  if (!p) throw new Error("That pipeline no longer exists in graph8, so there is nothing to undo.");
  await restorePipeline(c, a.listId, p, a.previous as PipelineSettings);
  await save(c, { ...a, status: "undone" });
}
