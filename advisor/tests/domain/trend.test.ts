import { describe, it, expect } from "vitest";
import { rollingCostPerMeeting, trendSentence, firstTouchCohorts } from "@/lib/domain/trend";
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
  it("describes the direction in plain words", () => expect(trendSentence(points)).toBe("Credits per meeting fell from 1,000 to 200 over the last 5 weeks."));
  it("has no sentence without two points", () => expect(trendSentence([{ label: "x", value: null }])).toBeNull());
});

describe("firstTouchCohorts", () => {
  const charges = [ch("a", 0, 100, 1), ch("b", 1, 100, 1), ch("c", 0, 100, 2), ch("d", 1, 200, 3), ch("e", 6, 300, 4)];
  const outcomes = [mt(2, 1), mt(3, 3), mt(7, 4)];
  const cohorts = firstTouchCohorts(charges, outcomes, NOW);
  it("puts each contact in the week of its first charge and counts each meeting once", () => {
    expect(cohorts[0]).toMatchObject({ contacts: 2, credits: 300, meetings: 1, costPerMeeting: 300, maturing: false });
    expect(cohorts[1]).toMatchObject({ contacts: 1, credits: 200, meetings: 1, costPerMeeting: 200 });
    expect(cohorts[6]).toMatchObject({ contacts: 1, credits: 300, meetings: 1, maturing: true });
    expect(cohorts[2]).toMatchObject({ contacts: 0, costPerMeeting: null });
    expect(cohorts.reduce((s, c) => s + c.meetings, 0)).toBe(3);
  });
});
