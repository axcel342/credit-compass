import { describe, it, expect } from "vitest";
import { attributeCharges, coverage } from "@/lib/domain/attribution";
import { loadDesignInput } from "../helpers/design-fixture";

const charges = attributeCharges(loadDesignInput());

describe("attribution on the real design-day data", () => {
  it("attributes every usage row (126 charges, 1,260 credits)", () => {
    expect(charges).toHaveLength(126);
    expect(coverage(charges)).toEqual({ exact: 216, window: 1033, none: 11, total: 1260 });
  });
  it("matches 13 of 15 skill-run charges exactly by token count", () => {
    const vl = charges.filter((c) => c.service === "voice_llm");
    expect(vl).toHaveLength(15);
    expect(vl.filter((c) => c.method === "exact_tokens")).toHaveLength(13);
  });
  it("flags 115 credits of waste: 77 failed AI jobs, 14 unreadable, 24 agent side effect", () => {
    const sum = (r: string) => charges.filter((c) => c.wasteReason === r).reduce((s, c) => s + c.credits, 0);
    expect(sum("failed_job")).toBe(77);
    expect(sum("no_change")).toBe(14);
    expect(sum("agent_side_effect")).toBe(24);
  });
  it("explains a skill charge in plain words", () => {
    const c = charges.find((x) => x.tokensIn === 214 && x.tokensOut === 594);
    expect(c?.explanation).toBe("Meeting Prep Brief · Jamie Elden, Listrak");
    expect(c?.method).toBe("exact_tokens");
  });
  it("credits the guardrail pipeline run to list 13", () => {
    const c = charges.find((x) => x.method === "pipeline_run");
    expect(c).toMatchObject({ credits: 3, listId: 13, isWaste: false, result: "success" });
  });
  it("puts onboarding research in the time-window bucket", () => {
    const s = charges.filter((c) => c.service === "studio_global");
    expect(s.every((c) => c.method === "time_window")).toBe(true);
    expect(s.reduce((a, c) => a + c.credits, 0)).toBe(860);
  });
});
