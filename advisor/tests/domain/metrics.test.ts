import { describe, it, expect } from "vitest";
import { computeStats, confidenceFor, formatCostPerMeeting } from "@/lib/domain/metrics";
import type { AttributedCharge, ContactInfo, Outcome } from "@/lib/domain/types";

const T = "2026-09-20T12:00:00Z";
const charge = (credits: number, contactId: number | null, method: AttributedCharge["method"] = "advisor", simulated = false): AttributedCharge => ({
  ledgerId: `l${Math.random()}`, ledgerType: "usage", service: "waterfall_enrichment", credits, chargedAt: T, llmTier: null, tokensIn: null, tokensOut: null,
  description: null, method, runExtId: null, listId: null, contactId, segmentKey: null, explanation: "", result: "success", isWaste: false, wasteReason: null, simulated });
const meeting = (contactId: number): Outcome => ({ extId: `o${Math.random()}`, type: "meeting_booked", occurredAt: T, contactId, companyId: null, dealId: null,
  amount: null, listId: null, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });
const contact = (id: number, listIds: number[], seg: string): ContactInfo => ({ contactId: id, name: `c${id}`, email: null, companyName: null, companyDomain: null,
  listIds, sequenceIds: [], segmentKey: seg, consistency: "ok" });

const contacts = new Map([[1, contact(1, [10], "A")], [2, contact(2, [20], "B")], [3, contact(3, [10, 20], "A")]]);
const base = { contacts, period: "30d", from: Date.parse("2026-09-01T00:00:00Z"), to: Date.parse("2026-10-01T00:00:00Z"), now: "2026-10-01T00:00:00Z" };

describe("confidenceFor", () => {
  it("high needs 10 outcomes, 500 credits and half the spend exact", () => {
    expect(confidenceFor({ outcomes: 10, credits: 500, exactShare: 0.5 })).toBe("high");
    expect(confidenceFor({ outcomes: 10, credits: 500, exactShare: 0.4 })).toBe("medium");
    expect(confidenceFor({ outcomes: 3, credits: 10, exactShare: 1 })).toBe("medium");
    expect(confidenceFor({ outcomes: 2, credits: 9999, exactShare: 1 })).toBe("low");
  });
});

describe("computeStats", () => {
  it("computes cost per meeting per list, splitting multi-list contacts evenly", () => {
    const stats = computeStats({ ...base, dimension: "list", charges: [charge(300, 1), charge(100, 2), charge(200, 3)], outcomes: [meeting(1), meeting(3)] });
    const org = stats[0], l10 = stats.find((s) => s.value === "10")!, l20 = stats.find((s) => s.value === "20")!;
    expect(org).toMatchObject({ dimension: "org", value: "all", credits: 600, meetings: 2, costPerMeeting: 300 });
    expect(l10).toMatchObject({ credits: 400, meetings: 1.5 });
    expect(l10.costPerMeeting).toBeCloseTo(266.67, 1);
    expect(l20).toMatchObject({ credits: 200, meetings: 0.5, costPerMeeting: 400 });
  });
  it("never divides by zero: spend without meetings gives a null cost and a plain label", () => {
    const [org] = computeStats({ ...base, dimension: "org", charges: [charge(150, 2)], outcomes: [] });
    expect(org.costPerMeeting).toBeNull();
    expect(org.vsAvgPct).toBeNull();
    expect(formatCostPerMeeting(org)).toBe("150 credits, no meetings yet");
  });
  it("marks a stat simulated when any input is simulated", () => {
    const [org] = computeStats({ ...base, dimension: "org", charges: [charge(10, 1, "advisor", true)], outcomes: [] });
    expect(org.simulated).toBe(true);
  });
});
