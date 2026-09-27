import { describe, it, expect } from "vitest";
import { flowData, layoutFlow } from "@/lib/dashboard/flow";
import type { AttributedCharge, OutcomeBucket } from "@/lib/domain/types";

const c = (id: string, service: string, credits: number, listId: number | null, bucket: OutcomeBucket): AttributedCharge & { b: OutcomeBucket } => ({
  ledgerId: id, ledgerType: "usage", service, credits, chargedAt: "2026-09-01T00:00:00Z", llmTier: null, tokensIn: null, tokensOut: null, description: null,
  method: "advisor", runExtId: null, listId, contactId: null, segmentKey: null, explanation: "x", result: "success", isWaste: bucket === "waste",
  wasteReason: null, simulated: false, b: bucket });
const charges = [
  c("1", "waterfall_enrichment", 4800, 2, "booked"), c("2", "waterfall_enrichment", 2000, 2, "nomeet"), c("3", "waterfall_enrichment", 2108, 15, "booked"),
  c("4", "studio_global", 860, null, "unused"), c("5", "ai_enrichment", 77, 2, "waste"), c("6", "voice_llm", 93, null, "unknown"),
  c("7", "landing_page_template", 100, null, "unknown"), c("8", "email_verification", 40, 2, "nomeet"), c("9", "image_generation", 25, null, "unknown"),
  c("10", "studio_copilot", 24, null, "waste"), c("11", "waterfall_enrichment", 3, 13, "nomeet"),
];
const names = new Map([["2", "Starter list"], ["15", "Sales VPs"], ["13", "Guardrail probe"]]);
const data = flowData(charges, (x) => (x as typeof charges[number]).b, names);
const total = charges.reduce((s, x) => s + x.credits, 0);

describe("flowData", () => {
  it("names services, keeps the top five and groups the rest", () => {
    const col0 = data.nodes.filter((x) => x.col === 0).map((x) => x.label);
    expect(col0).toEqual(["Email finding", "Onboarding research", "Landing page", "Skill runs", "AI enrichment", "Other services"]);
  });
  it("groups tiny lists and untied spend", () => {
    const col1 = data.nodes.filter((x) => x.col === 1).map((x) => x.label);
    expect(col1).toEqual(["Starter list", "Sales VPs", "Other lists", "Not tied to a list"]);
  });
  it("orders outcomes as booked, no meeting, never used, can't tell, wasted and links them to Charges", () => {
    const col2 = data.nodes.filter((x) => x.col === 2);
    expect(col2.map((x) => x.label)).toEqual(["Booked a meeting", "No meeting yet", "Never used", "Can't tell yet", "Wasted"]);
    expect(col2[0].href).toBe("/charges?outcome=booked");
  });
  it("conserves credits at every node", () => {
    for (const node of data.nodes) {
      const inn = data.links.filter((l) => l.target === node.id).reduce((s, l) => s + l.value, 0);
      const out = data.links.filter((l) => l.source === node.id).reduce((s, l) => s + l.value, 0);
      if (node.col > 0) expect(inn).toBeCloseTo(node.value, 6);
      if (node.col < 2) expect(out).toBeCloseTo(node.value, 6);
    }
    expect(data.nodes.filter((x) => x.col === 2).reduce((s, x) => s + x.value, 0)).toBeCloseTo(total, 6);
  });
});

describe("layoutFlow", () => {
  const lay = layoutFlow(data);
  it("keeps every node inside the drawing and in its column", () => {
    for (const node of lay.nodes) {
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y + node.h).toBeLessThanOrEqual(lay.height + 0.001);
      expect(node.h).toBeGreaterThanOrEqual(3);
    }
  });
  it("gives every band a path, a colour, a link and a tooltip", () => {
    const band = lay.links.find((l) => l.target === "b:booked" && l.source === "l:15")!;
    expect(band.d.startsWith("M")).toBe(true);
    expect(band.colorVar).toBe("var(--booked)");
    expect(band.href).toBe("/charges?list=15&outcome=booked");
    expect(band.title).toBe("Sales VPs → Booked a meeting: 2,108 credits");
  });
});
