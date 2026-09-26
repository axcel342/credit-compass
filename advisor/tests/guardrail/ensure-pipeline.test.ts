import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensurePipeline } from "@/lib/guardrail/guardrail";

describe("ensurePipeline (live-shape adaptation)", () => {
  it("reuses the list's existing waterfall pipeline when it isn't named 'Verified emails'", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.listListPipelines, () => ({ items: [{ id: "p9", name: "[sim] guardrail probe pipeline",
      steps: [{ id: "step_1", type: "waterfall", config_ref: "CONTACT_WORK_EMAIL_32aa4784488a" }] }] }));
    c.handlers.set(OPS.createPipelineFromTemplate, () => ({ id: "new", name: "Verified emails", steps: [] }));
    expect(await ensurePipeline(c, 13)).toEqual({ id: "p9", name: "[sim] guardrail probe pipeline", configRef: "CONTACT_WORK_EMAIL_32aa4784488a" });
  });
});
