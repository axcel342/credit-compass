import { describe, it, expect } from "vitest";
import { loadFixture } from "../fixtures";
import { smoothedRate, classifyFit, calibrationFactor, estimateCredits, bestFitSubset, priceFor, type ProviderRow } from "@/lib/domain/prespend";

describe("pre-spend", () => {
  it("smooths a thin segment toward the org rate", () => {
    expect(smoothedRate(0, 0, 0.05)).toBeCloseTo(0.05);
    expect(smoothedRate(10, 100, 0.05)).toBeCloseTo((10 + 5 * 0.05) / 105);
  });
  it("classifies fit, with flagged records always low and thin evidence unknown", () => {
    expect(classifyFit({ rate: 0.1, orgRate: 0.05, n: 10, consistency: "ok" })).toBe("high");
    expect(classifyFit({ rate: 0.1, orgRate: 0.05, n: 10, consistency: "flagged" })).toBe("low");
    expect(classifyFit({ rate: 0.02, orgRate: 0.05, n: 10, consistency: "ok" })).toBe("low");
    expect(classifyFit({ rate: 0.05, orgRate: 0.05, n: 10, consistency: "ok" })).toBe("medium");
    expect(classifyFit({ rate: 0.5, orgRate: 0.05, n: 2, consistency: "ok" })).toBe("unknown");
  });
  it("treats a zero org rate as insufficient evidence instead of calling everything high", () => {
    expect(classifyFit({ rate: 0.1, orgRate: 0, n: 10, consistency: "ok" })).toBe("unknown");
    expect(classifyFit({ rate: 0.1, orgRate: 0, n: 10, consistency: "flagged" })).toBe("low");
  });
  it("calibrates from the real AI enrichment gap (quoted 37, charged 50)", () => {
    expect(calibrationFactor([{ quoted: 37, actual: 50 }])).toBeCloseTo(1.351, 3);
    expect(calibrationFactor([])).toBe(1);
  });
  it("estimates the Starter list email step at 39 credits (13 contacts × 3)", () => {
    const providers = loadFixture<{ data: { providers: ProviderRow[] } }>("graph8/providers.json").data.providers;
    expect(priceFor(providers, "leadmagic", "email_finder")).toBe(3);
    expect(estimateCredits({ records: 13, pricePerRecord: 3 })).toBe(39);
  });
  it("keeps best-fit contacts until the next one costs more per meeting than average", () => {
    const ids = bestFitSubset([
      { contactId: 1, expectedRate: 0.05, consistency: "ok" }, { contactId: 2, expectedRate: 0.02, consistency: "ok" },
      { contactId: 3, expectedRate: 0.004, consistency: "ok" }, { contactId: 4, expectedRate: 0.09, consistency: "flagged" }],
      { pricePerRecord: 3, orgCostPerMeeting: 326 });
    expect(ids).toEqual([1, 2]);
  });
});