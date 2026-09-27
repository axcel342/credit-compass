import { describe, it, expect } from "vitest";
import { parseChargeFilter, applyChargeFilter, filterHref, listChips } from "@/lib/dashboard/filters";
import type { AttributedCharge, OutcomeBucket } from "@/lib/domain/types";

const c = (id: string, service: string, credits: number, listId: number | null, b: OutcomeBucket) => ({ ledgerId: id, ledgerType: "usage", service, credits,
  chargedAt: "2026-09-01T00:00:00Z", llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId, contactId: null,
  segmentKey: null, explanation: "x", result: "success", isWaste: b === "waste", wasteReason: null, simulated: false, b }) as AttributedCharge & { b: OutcomeBucket };
const xs = [c("1", "waterfall_enrichment", 9000, 2, "booked"), c("2", "waterfall_enrichment", 3, 13, "nomeet"), c("3", "studio_global", 860, null, "unused"), c("4", "ai_enrichment", 77, 2, "waste")];
const bucketOf = (x: AttributedCharge) => (x as (typeof xs)[number]).b;

describe("charge filters", () => {
  it("parses only known values", () => {
    expect(parseChargeFilter({ outcome: "waste", list: "2", service: "ai_enrichment" })).toEqual({ outcome: "waste", list: "2", service: "ai_enrichment" });
    expect(parseChargeFilter({ outcome: "bogus", list: "2; drop", service: "x y" })).toEqual({ outcome: null, list: null, service: null });
  });
  it("filters by outcome, list (including none and other) and service", () => {
    expect(applyChargeFilter(xs, { outcome: "waste", list: null, service: null }, bucketOf).map((x) => x.ledgerId)).toEqual(["4"]);
    expect(applyChargeFilter(xs, { outcome: null, list: "none", service: null }, bucketOf).map((x) => x.ledgerId)).toEqual(["3"]);
    expect(applyChargeFilter(xs, { outcome: null, list: "other", service: null }, bucketOf).map((x) => x.ledgerId)).toEqual(["2"]);
    expect(applyChargeFilter(xs, { outcome: null, list: "2", service: "waterfall_enrichment" }, bucketOf).map((x) => x.ledgerId)).toEqual(["1"]);
  });
  it("builds links that keep the period and the other filters", () =>
    expect(filterHref({ outcome: null, list: "2", service: null }, { outcome: "waste" }, "period=30d")).toBe("/charges?outcome=waste&list=2&period=30d"));
  it("shows lists with at least 1% of spend, biggest first, and folds the rest into Other lists", () => {
    expect(listChips(xs)).toEqual({ ids: [2], hasOther: true });
    expect(listChips([c("a", "waterfall_enrichment", 100, 2, "booked"), c("b", "waterfall_enrichment", 300, 15, "booked")])).toEqual({ ids: [15, 2], hasOther: false });
  });
});
