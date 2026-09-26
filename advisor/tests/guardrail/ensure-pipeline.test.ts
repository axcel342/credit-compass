import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensurePipeline, setRunCondition } from "@/lib/guardrail/guardrail";

describe("ensurePipeline (live-shape adaptation)", () => {
  it("reuses the list's existing waterfall pipeline when it isn't named 'Verified emails'", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.listListPipelines, () => ({ items: [{ id: "p9", name: "[sim] guardrail probe pipeline",
      steps: [{ id: "step_1", type: "waterfall", config_ref: "CONTACT_WORK_EMAIL_32aa4784488a" }] }] }));
    c.handlers.set(OPS.createPipelineFromTemplate, () => ({ id: "new", name: "Verified emails", steps: [] }));
    expect(await ensurePipeline(c, 13)).toEqual({ id: "p9", name: "[sim] guardrail probe pipeline",
      configRef: "CONTACT_WORK_EMAIL_32aa4784488a", stepId: "step_1", stepName: "Email finder" });
  });

  it("carries a reused waterfall step's own id and name into the run-condition update", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.listListPipelines, () => ({ items: [{ id: "p9", name: "Reused pipeline",
      steps: [{ id: "waterfall_7", name: "Find work email", type: "waterfall", config_ref: "CFG_X" }] }] }));
    c.handlers.set(OPS.updateListPipeline, () => ({}));
    const pipeline = await ensurePipeline(c, 13);
    expect(pipeline).toEqual({ id: "p9", name: "Reused pipeline", configRef: "CFG_X", stepId: "waterfall_7", stepName: "Find work email" });
    await setRunCondition(c, { listId: 13, pipeline, condition: "COND" });
    const call = c.calls.find((x) => x.op === OPS.updateListPipeline)!;
    const body = call.input.body as { steps: { id: string; name: string; config_ref: string; run_condition: string | null }[] };
    expect(body.steps[0]).toMatchObject({ id: "waterfall_7", name: "Find work email", config_ref: "CFG_X", run_condition: "COND" });
  });

  it("reports the intended error for a pipeline whose steps have no waterfall entry", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.listListPipelines, () => ({ items: [{ id: "p0", name: "Verified emails",
      steps: [{ id: "s1", name: "AI pass", type: "ai", config_ref: "AI_CFG" }] }] }));
    await expect(ensurePipeline(c, 13)).rejects.toThrow(/no email-finder step/);
  });

  it("reports the intended error when the matched pipeline has no steps array", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.listListPipelines, () => ({ items: [{ id: "p0", name: "Verified emails" }] }));
    await expect(ensurePipeline(c, 13)).rejects.toThrow(/no email-finder step/);
  });
});
