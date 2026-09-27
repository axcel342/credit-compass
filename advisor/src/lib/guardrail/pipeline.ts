import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";

export interface PipelineStep { id: string; name?: string; type: string; config_ref?: string; run_condition?: string | null;
  skip_existing_values?: boolean; skip_recently_enriched?: boolean; enabled?: boolean }
export interface ListPipeline { id: string; name: string; enabled?: boolean; steps?: PipelineStep[] }
export interface StepSettings { id: string; run_condition: string | null; skip_existing_values: boolean; skip_recently_enriched: boolean; enabled: boolean }
export interface PipelineSettings { enabled: boolean; steps: StepSettings[] }
export type PipelinePatch = { enabled?: boolean; step?: Partial<Omit<StepSettings, "id">> };

export async function listPipelines(c: G8Caller, listId: number): Promise<ListPipeline[]> {
  return (await c.call<{ items: ListPipeline[] }>(OPS.listListPipelines, { path: { list_id: listId } })).items ?? [];
}

export async function findEnrichmentPipeline(c: G8Caller, listId: number): Promise<ListPipeline | null> {
  const ps = await listPipelines(c, listId);
  return ps.find((p) => p.name === "Verified emails") ?? ps.find((p) => (p.steps ?? []).some((s) => s.type === "waterfall" && s.config_ref)) ?? null;
}

export function settingsOf(p: ListPipeline): PipelineSettings {
  return { enabled: p.enabled !== false, steps: (p.steps ?? []).map((s) => ({ id: s.id, run_condition: s.run_condition ?? null,
    skip_existing_values: s.skip_existing_values === true, skip_recently_enriched: s.skip_recently_enriched === true, enabled: s.enabled !== false })) };
}

async function put(c: G8Caller, listId: number, p: ListPipeline, s: PipelineSettings): Promise<void> {
  const byId = new Map(s.steps.map((x) => [x.id, x]));
  await c.call(OPS.updateListPipeline, { path: { list_id: listId, pipeline_id: p.id }, body: { name: p.name, enabled: s.enabled,
    steps: (p.steps ?? []).map((st) => ({ id: st.id, name: st.name, type: st.type, config_ref: st.config_ref, ...byId.get(st.id) })) } });
}

/** Applies the patch to every enrichment (waterfall) step and returns the settings from before the patch. */
export async function patchPipeline(c: G8Caller, listId: number, p: ListPipeline, patch: PipelinePatch): Promise<PipelineSettings> {
  const prev = settingsOf(p);
  const wf = new Set((p.steps ?? []).filter((s) => s.type === "waterfall").map((s) => s.id));
  await put(c, listId, p, { enabled: patch.enabled ?? prev.enabled,
    steps: prev.steps.map((s) => (wf.has(s.id) && patch.step ? { ...s, ...patch.step } : s)) });
  return prev;
}

export async function restorePipeline(c: G8Caller, listId: number, p: ListPipeline, prev: PipelineSettings): Promise<void> {
  await put(c, listId, p, prev);
}

export async function ensureEnrichmentPipeline(c: G8Caller, listId: number, o: { enabled: boolean }): Promise<ListPipeline> {
  const p = (await findEnrichmentPipeline(c, listId))
    ?? await c.call<ListPipeline>(OPS.createPipelineFromTemplate, { path: { list_id: listId }, body: { template_key: "verified_emails" } });
  if (settingsOf(p).enabled !== o.enabled) await patchPipeline(c, listId, p, { enabled: o.enabled });
  return p;
}
