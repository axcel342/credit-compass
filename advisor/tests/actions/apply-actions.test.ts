import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { valuesToAction } from "@/lib/store/mappers";
import { applyRepeatSkip, applyPause, applyLookalike, applyGuardrailRule, undoAction } from "@/lib/actions/apply";
import type { ListPipeline } from "@/lib/guardrail/pipeline";
import type { ContactCacheRow } from "@/lib/domain/types";

async function setup() {
  const g = new FakeG8(); await ensureSchema(g);
  let pipes: Record<number, ListPipeline[]> = { 15: [{ id: "p15", name: "Verified emails", enabled: true, steps: [{ id: "s1", name: "Email finder", type: "waterfall", config_ref: "CFG",
    run_condition: null, skip_existing_values: false, skip_recently_enriched: false, enabled: true }] }] };
  g.handlers.set(OPS.listListPipelines, (i) => ({ items: structuredClone(pipes[Number(i.path?.list_id)] ?? []) }));
  g.handlers.set(OPS.updateListPipeline, (i) => { const l = Number(i.path?.list_id); pipes[l] = pipes[l].map((p) => (p.id === i.path?.pipeline_id ? { ...p, ...(i.body as ListPipeline) } : p)); return i.body; });
  g.handlers.set(OPS.saveContactSearch, () => ({ list_id: 99, saved: 50 }));
  const actions = () => new RecordStore(g, "roi_action").list().then((rs) => rs.map((r) => valuesToAction(r.values)));
  return { g, pipes: () => pipes, setPipes: (p: typeof pipes) => { pipes = p; }, actions };
}
const NOW = "2026-09-27T10:00:00Z";

describe("apply and undo", () => {
  it("turns on the skip flags and records the settings from before", async () => {
    const t = await setup();
    await applyRepeatSkip(t.g, [15], NOW);
    expect(t.pipes()[15][0].steps![0]).toMatchObject({ skip_recently_enriched: true, skip_existing_values: true });
    const [a] = await t.actions();
    expect(a).toMatchObject({ extId: "repeat_skip:15", kind: "repeat_skip", listId: 15, pipelineId: "p15", status: "applied" });
    expect((a.previous as { steps: { skip_recently_enriched: boolean }[] }).steps[0].skip_recently_enriched).toBe(false);
  });
  it("is idempotent: applying twice keeps one record and the original previous settings", async () => {
    const t = await setup();
    await applyRepeatSkip(t.g, [15], NOW);
    await applyRepeatSkip(t.g, [15], "2026-09-27T11:00:00Z");
    const all = await t.actions();
    expect(all).toHaveLength(1);
    expect(all[0].appliedAt).toBe(NOW);
    expect((all[0].previous as { steps: { skip_recently_enriched: boolean }[] }).steps[0].skip_recently_enriched).toBe(false);
  });
  it("undo restores the settings captured at the first apply, even if someone changed the pipeline since", async () => {
    const t = await setup();
    await applyPause(t.g, 15, NOW);
    const p = t.pipes(); p[15][0].steps![0].run_condition = "EDITED ELSEWHERE"; t.setPipes(p);
    const [a] = await t.actions();
    await undoAction(t.g, a);
    expect(t.pipes()[15][0].enabled).toBe(true);
    expect(t.pipes()[15][0].steps![0].run_condition).toBeNull();
    expect((await t.actions())[0].status).toBe("undone");
  });
  it("saves a lookalike search with the filters and 50 contacts, and refuses to undo it", async () => {
    const t = await setup();
    await applyLookalike(t.g, { listId: 15, title: "Lookalike of Sales VPs", filters: [{ field: "seniority_level", operator: "any_of", value: ["Vice President"] }] }, NOW);
    const call = t.g.calls.find((c) => c.op === OPS.saveContactSearch)!;
    expect(call.input.body).toEqual({ filters: [{ field: "seniority_level", operator: "any_of", value: ["Vice President"] }], list_title: "Lookalike of Sales VPs", max_results: 50 });
    const [a] = await t.actions();
    expect(a).toMatchObject({ kind: "lookalike", detail: { title: "Lookalike of Sales VPs", listId: 99 } });
    await expect(undoAction(t.g, a)).rejects.toThrow("Lookalike lists are never deleted");
  });
  it("skips a list with no enrichment pipeline and says so", async () => {
    const t = await setup();
    await expect(applyRepeatSkip(t.g, [42], NOW)).resolves.toEqual({ changed: [], skipped: [42] });
  });
  it("writes the fit and run condition for the workspace's own field", async () => {
    const t = await setup();
    t.g.handlers.set(OPS.validateFormula, () => ({ valid: true, errors: [] }));
    t.g.handlers.set(OPS.previewRoutingRule, () => ({ matching_count: 1 }));
    t.g.handlers.set(OPS.setFieldValue, () => ({}));
    const row = (contactId: number, fit: ContactCacheRow["fit"]): ContactCacheRow => ({ contactId, listIds: [15], hasEmail: true, consistency: "ok", segmentKey: "s",
      fit, fitLevel: "role", syncedAt: NOW });
    await applyGuardrailRule(t.g, 15, [row(1, "low"), row(2, "high")], NOW, { columnId: 999, name: "udo_fit_custom" });
    expect(t.g.calls.filter((c) => c.op === OPS.setFieldValue).map((c) => c.input.path?.column_id)).toEqual([999, 999]);
    expect(t.g.calls.find((c) => c.op === OPS.validateFormula)!.input.body).toEqual({ formula: 'NOT(EQ({{udo_fit_custom}}, "low"))' });
    expect(t.g.calls.find((c) => c.op === OPS.previewRoutingRule)!.input.body).toMatchObject({ conditions: [{ field: "udo_fit_custom", operator: "equals", value: "low" }] });
    expect(t.pipes()[15][0].steps![0].run_condition).toBe('NOT(EQ({{udo_fit_custom}}, "low"))');
  });
});
