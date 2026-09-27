import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureEnrichmentPipeline, findEnrichmentPipeline, patchPipeline, restorePipeline, settingsOf, type ListPipeline } from "@/lib/guardrail/pipeline";

function fake(initial: ListPipeline[]) {
  const g = new FakeG8();
  let pipes = structuredClone(initial);
  g.handlers.set(OPS.listListPipelines, () => ({ items: pipes }));
  g.handlers.set(OPS.createPipelineFromTemplate, () => { const p: ListPipeline = { id: "new", name: "Verified emails", enabled: true,
    steps: [{ id: "s1", name: "Email finder", type: "waterfall", config_ref: "CFG", run_condition: null, skip_existing_values: true, skip_recently_enriched: false, enabled: true }] };
    pipes.push(p); return p; });
  g.handlers.set(OPS.updateListPipeline, (i) => { const b = i.body as ListPipeline; pipes = pipes.map((p) => (p.id === i.path?.pipeline_id ? { ...p, ...b } : p)); return b; });
  return g;
}
const existing: ListPipeline = { id: "p1", name: "Verified emails", enabled: true, steps: [{ id: "s1", name: "Email finder", type: "waterfall", config_ref: "CFG",
  run_condition: null, skip_existing_values: false, skip_recently_enriched: false, enabled: true }] };

describe("pipeline helpers", () => {
  it("finds the list's enrichment pipeline", async () => {
    expect((await findEnrichmentPipeline(fake([existing]), 15))?.id).toBe("p1");
    expect(await findEnrichmentPipeline(fake([]), 15)).toBeNull();
  });
  it("patches a step and returns the settings from before the patch", async () => {
    const g = fake([existing]);
    const prev = await patchPipeline(g, 15, existing, { step: { skip_recently_enriched: true, skip_existing_values: true } });
    expect(prev).toEqual(settingsOf(existing));
    const body = g.calls.find((c) => c.op === OPS.updateListPipeline)!.input.body as ListPipeline;
    expect(body).toMatchObject({ name: "Verified emails", enabled: true });
    expect(body.steps![0]).toMatchObject({ id: "s1", type: "waterfall", config_ref: "CFG", skip_recently_enriched: true, skip_existing_values: true, run_condition: null });
  });
  it("restores exactly the previous settings", async () => {
    const g = fake([existing]);
    const prev = await patchPipeline(g, 15, existing, { enabled: false });
    const now = (await findEnrichmentPipeline(g, 15))!;
    await restorePipeline(g, 15, now, prev);
    expect(settingsOf((await findEnrichmentPipeline(g, 15))!)).toEqual(prev);
  });
  it("creates a missing pipeline from the template, switched off", async () => {
    const g = fake([]);
    const p = await ensureEnrichmentPipeline(g, 15, { enabled: false });
    expect(p.id).toBe("new");
    expect(settingsOf((await findEnrichmentPipeline(g, 15))!).enabled).toBe(false);
  });
});
