import { describe, it, expect } from "vitest";
import { rollingCostPerMeeting, trendChange, trendLine } from "@/lib/domain/trend";
import type { AttributedCharge, Outcome } from "@/lib/domain/types";

const NOW = "2026-09-27T00:00:00Z", DAY = 86_400_000, W = 7 * DAY, START = Date.parse(NOW) - 8 * W;
const at = (week: number, day = 1) => new Date(START + week * W + day * DAY).toISOString();
const ch = (id: string, week: number, credits: number, contactId: number | null = null): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits, chargedAt: at(week), llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: 2, contactId,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: true });
const mt = (week: number, contactId: number | null = null, day = 2): Outcome => ({ extId: `m${week}${contactId}${day}`, type: "meeting_booked", occurredAt: at(week, day), contactId,
  companyId: null, dealId: null, amount: null, listId: 2, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });

describe("rollingCostPerMeeting", () => {
  const credits = [800, 400, 400, 400, 400, 400, 400, 400], meetings = [0, 0, 1, 1, 2, 2, 2, 2];
  const charges = credits.map((c, i) => ch(`c${i}`, i, c));
  const outcomes = meetings.flatMap((m, i) => Array.from({ length: m }, (_, j) => mt(i, null, 2 + j)));
  const points = rollingCostPerMeeting(charges, outcomes, NOW);
  it("returns one point per week once four weeks of history exist", () => {
    expect(points.map((p) => p.value === null ? null : Math.round(p.value))).toEqual([1000, 400, 267, 229, 200]);
    expect(points[0].label).toBe("Aug 30");
    expect(points.at(-1)!.label).toBe("Sep 27");
  });
  it("measures the change from the first to the last point", () => expect(trendChange(points)).toEqual({ from: 1000, to: 200, weeks: 5, pct: -80 }));
  it("gives the trend line its direction, size and start", () =>
    expect(trendLine(points)).toMatchObject({ pct: 80, direction: "down", since: "Aug 30", values: [1000, 400, expect.any(Number), expect.any(Number), 200] }));
  it("says up when cost per meeting rose, and nothing when flat or too short", () => {
    expect(trendLine([{ label: "a", value: 300 }, { label: "b", value: 360 }])).toEqual({ pct: 20, direction: "up", since: "a", values: [300, 360] });
    expect(trendLine([{ label: "a", value: 300 }, { label: "b", value: 300 }])).toBeNull();
    expect(trendLine([{ label: "a", value: null }, { label: "b", value: 300 }])).toBeNull();
  });
  it("starts from the first week that has a value", () =>
    expect(trendLine([{ label: "a", value: null }, { label: "b", value: 500 }, { label: "c", value: 250 }])).toMatchObject({ since: "b", pct: 50 }));
});


