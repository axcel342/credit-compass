import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { assertConditionFilters, validateCondition, runGuardedPipeline, readPipelineRun, runCondition, RUN_CONDITION } from "@/lib/guardrail/guardrail";
import { loadFixture } from "../fixtures";

describe("guardrail", () => {
  it("uses the validated function-style condition", () => expect(RUN_CONDITION).toBe('NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))'));
  it("builds the run condition for any fit field", () => expect(runCondition("udo_roi_fit_abc")).toBe('NOT(EQ({{udo_roi_fit_abc}}, "low"))'));
  it("refuses a condition graph8 says is invalid", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.validateFormula, () => ({ valid: false, errors: ["Invalid G8X syntax: Unexpected character '='"] }));
    await expect(validateCondition(c, "{{x}} == 1")).rejects.toThrow(/Unexpected character/);
  });
  it("refuses a filter that matches everyone (unknown operator) or no one", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.previewRoutingRule, () => ({ matching_count: 250 }));
    await expect(assertConditionFilters(c, { listId: 2, listSize: 250, fieldName: "udo_roi_fit_11e946f0", value: "low" })).rejects.toThrow(/every contact/);
    c.handlers.set(OPS.previewRoutingRule, () => ({ matching_count: 0 }));
    await expect(assertConditionFilters(c, { listId: 2, listSize: 250, fieldName: "udo_roi_fit_11e946f0", value: "low" })).rejects.toThrow(/no contact/);
    c.handlers.set(OPS.previewRoutingRule, () => ({ matching_count: 113 }));
    expect(await assertConditionFilters(c, { listId: 2, listSize: 250, fieldName: "udo_roi_fit_11e946f0", value: "low" })).toBe(113);
  });
  it("won't start a run above the credit cap", async () => {
    await expect(runGuardedPipeline(new FakeG8(), { listId: 2, pipelineId: "p", estimatedCredits: 498, cap: 50 })).rejects.toThrow(/cap/);
  });
  it("reads the real guardrail run: 3 processed, 1 successful, 2 skipped", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.getPipelineRun, () => loadFixture<{ data: unknown }>("graph8/pipeline_run_guardrail.json").data);
    expect(await readPipelineRun(c, "e2b2e81f")).toEqual({ status: "completed", processed: 3, successful: 1, failed: 0, skipped: 2 });
  });
});
