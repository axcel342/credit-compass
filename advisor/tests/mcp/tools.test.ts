import { describe, it, expect } from "vitest";
import { attributeCharges, coverage } from "@/lib/domain/attribution";
import { roiSummary, explainCharge, costPerOutcome, listFindings, prespendEstimate } from "@/lib/mcp/tools";
import type { DashboardData } from "@/lib/dashboard/data";
import type { Finding, Stat } from "@/lib/domain/types";
import { loadDesignInput } from "../helpers/design-fixture";

const charges = attributeCharges(loadDesignInput());
const segment8w: Stat = { period: "8w", dimension: "segment", value: "Vice President|Sales|Fintech|51-200", credits: 2100, creditsExact: 2100, meetings: 17, deals: 0, wonValue: 0,
  contactsReached: 212, costPerMeeting: 124, costPerDeal: null, vsAvgPct: -62, evidenceN: 17, confidence: "high", simulated: true, computedAt: "2026-10-04T00:00:00Z" };
const orgStat = (period: string, cpm: number): Stat => ({ period, dimension: "org", value: "all", credits: 3000, creditsExact: 3000, meetings: 10, deals: 0, wonValue: 0,
  contactsReached: 120, costPerMeeting: cpm, costPerDeal: null, vsAvgPct: 0, evidenceN: 10, confidence: "high", simulated: true, computedAt: "2026-10-04T00:00:00Z" });
const d: DashboardData = { charges, outcomes: [], lists: [], listNames: new Map([["15", "Sales VPs"]]), hasDemoData: true, runs: [], actions: [], coverage: coverage(charges), waste: 115, now: "2026-10-04T00:00:00Z",
  stats: [orgStat("30d", 900), orgStat("8w", 300), { ...segment8w, period: "30d", costPerMeeting: 999, vsAvgPct: 10 }, segment8w],
  findings: [] };
const finding: Finding = { extId: "w1", kind: "waste", title: "Wasted enrichment", body: "Failed jobs on the Sales VPs list.", evidence: {}, creditsAtStake: 77, confidence: "high",
  status: "open", snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null, firstSeen: "2026-09-26T00:00:00Z", lastSeen: "2026-09-26T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: true };
const dFinding: DashboardData = { ...d, findings: [finding] };
const dReal: DashboardData = { ...d, hasDemoData: false };

describe("MCP tools", () => {
  it("summarises spend, coverage and waste", () => expect(roiSummary(d)).toContain("1,260 credits"));
  it("explains a real charge", () => {
    const c = charges.find((x) => x.tokensIn === 214)!;
    expect(explainCharge(d, c.ledgerId)).toContain("Meeting Prep Brief · Jamie Elden, Listrak");
    expect(explainCharge(d, "nope")).toMatch(/No charge/);
  });
  it("answers cost per outcome with the demo-data label", () =>
    expect(costPerOutcome(d, { dimension: "segment", value: "Vice President|Sales|Fintech|51-200" })).toBe(
      "Vice President|Sales|Fintech|51-200: 124 credits per meeting across 17 meetings (62% below average, high confidence). Includes demo data."));
  it("pins cost per outcome to the 8-week stats when both periods are stored", () =>
    expect(costPerOutcome(d, { dimension: "segment", value: "Vice President|Sales|Fintech|51-200" })).toContain("124 credits per meeting"));
  it("accepts a list name and answers with it", () => {
    const d2 = { ...d, stats: [...d.stats, { ...segment8w, dimension: "list" as const, value: "15" }] };
    expect(costPerOutcome(d2, { dimension: "list", value: "sales vps" })).toMatch(/^Sales VPs: 124 credits per meeting/);
  });
  it("summarises the last 8 weeks and flags demo data", () => expect(roiSummary(d)).toMatch(/^1,260 credits spent in the last 8 weeks; .* Includes demo data\.$/));
  it("labels findings and charges as demo data", () => {
    expect(listFindings(dFinding, {})).toBe("[waste] Wasted enrichment: Failed jobs on the Sales VPs list. (77 credits, high) Includes demo data.");
    expect(listFindings(d, {})).toBe("No findings match. Includes demo data.");
    expect(explainCharge(d, charges[0].ledgerId)).toMatch(/Includes demo data\.$/);
  });
  it("omits the demo-data note when nothing is simulated", () => {
    expect(listFindings(dReal, {})).toBe("No findings match.");
    expect(explainCharge(dReal, "nope")).toBe("No charge with ledger ID nope.");
    expect(explainCharge(dReal, charges[0].ledgerId)).not.toContain("Includes demo data.");
  });
  it("says so when there are no findings", () => expect(listFindings(dReal, {})).toBe("No findings match."));
  it("hides applied findings unless their status is requested", () => {
    const twin: Finding = { ...finding, extId: "w2", title: "Applied twin", status: "applied" };
    const dBoth: DashboardData = { ...dFinding, findings: [finding, twin] };
    expect(listFindings(dBoth, {})).toBe("[waste] Wasted enrichment: Failed jobs on the Sales VPs list. (77 credits, high) Includes demo data.");
    expect(listFindings(dBoth, { status: "applied" })).toBe("[waste] Applied twin: Failed jobs on the Sales VPs list. (77 credits, high) Includes demo data.");
  });
  it("estimates pre-spend credits", () => expect(prespendEstimate({ listSize: 250, missing: 13, pricePerRecord: 3, calibration: 1 })).toContain("39 credits"));
});
