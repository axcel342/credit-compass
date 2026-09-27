import { describe, it, expect } from "vitest";
import { attributeCharges, coverage } from "@/lib/domain/attribution";
import { roiSummary, explainCharge, costPerOutcome, listFindings, prespendEstimate } from "@/lib/mcp/tools";
import type { DashboardData } from "@/lib/dashboard/data";
import type { Stat } from "@/lib/domain/types";
import { loadDesignInput } from "../helpers/design-fixture";

const charges = attributeCharges(loadDesignInput());
const segment8w: Stat = { period: "8w", dimension: "segment", value: "Vice President|Sales|Fintech|51-200", credits: 2100, creditsExact: 2100, meetings: 17, deals: 0, wonValue: 0,
  contactsReached: 212, costPerMeeting: 124, costPerDeal: null, vsAvgPct: -62, evidenceN: 17, confidence: "high", simulated: true, computedAt: "2026-10-04T00:00:00Z" };
const orgStat = (period: string, cpm: number): Stat => ({ period, dimension: "org", value: "all", credits: 3000, creditsExact: 3000, meetings: 10, deals: 0, wonValue: 0,
  contactsReached: 120, costPerMeeting: cpm, costPerDeal: null, vsAvgPct: 0, evidenceN: 10, confidence: "high", simulated: true, computedAt: "2026-10-04T00:00:00Z" });
const d: DashboardData = { charges, outcomes: [], lists: [], listNames: new Map(), hasDemoData: true, runs: [], coverage: coverage(charges), waste: 115, now: "2026-10-04T00:00:00Z",
  stats: [orgStat("30d", 900), orgStat("8w", 300), { ...segment8w, period: "30d", costPerMeeting: 999, vsAvgPct: 10 }, segment8w],
  findings: [] };

describe("MCP tools", () => {
  it("summarises spend, coverage and waste", () => expect(roiSummary(d)).toContain("1,260 credits"));
  it("explains a real charge", () => {
    const c = charges.find((x) => x.tokensIn === 214)!;
    expect(explainCharge(d, c.ledgerId)).toContain("Meeting Prep Brief · Jamie Elden, Listrak");
    expect(explainCharge(d, "nope")).toMatch(/No charge/);
  });
  it("answers cost per outcome with the simulated label", () =>
    expect(costPerOutcome(d, { dimension: "segment", value: "Vice President|Sales|Fintech|51-200" })).toBe(
      "Vice President|Sales|Fintech|51-200: 124 credits per meeting across 17 meetings (62% below average, high confidence). Includes simulated data."));
  it("pins summaries to the 8-week stats when both periods are stored", () => {
    expect(roiSummary(d)).toContain("300 credits per meeting");
    expect(costPerOutcome(d, { dimension: "segment", value: "Vice President|Sales|Fintech|51-200" })).toContain("124 credits per meeting");
  });
  it("says so when there are no findings", () => expect(listFindings(d, {})).toBe("No findings match."));
  it("estimates pre-spend credits", () => expect(prespendEstimate({ listSize: 250, missing: 13, pricePerRecord: 3, calibration: 1 })).toContain("39 credits"));
});
