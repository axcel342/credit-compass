import { describe, it, expect } from "vitest";
import { recapSelection, shouldRenotify, dismiss, dashboardBuckets, shouldWarnPreSpend } from "@/lib/domain/gate";
import type { Finding } from "@/lib/domain/types";

const f = (id: string, stake: number, conf: Finding["confidence"] = "high", extra: Partial<Finding> = {}): Finding => ({
  extId: id, kind: "waste", title: id, body: "", evidence: {}, creditsAtStake: stake, confidence: conf, status: "open", snoozedUntil: null,
  dismissCount: 0, action: null, actionPayload: null, firstSeen: "2026-09-26T00:00:00Z", lastSeen: "2026-10-04T00:00:00Z",
  lastNotifiedStake: null, inRecap: false, simulated: false, ...extra });

describe("recapSelection", () => {
  it("takes the top 3 by stake × confidence weight, medium or better", () => {
    const sel = recapSelection([f("a", 100), f("b", 1000, "medium"), f("c", 700), f("d", 5000, "low"), f("e", 10)],
      { lastRecapAt: "2026-09-28T00:00:00Z", spendThisWeek: 100, spendLastWeek: 100 });
    expect(sel.map((x) => x.extId)).toEqual(["c", "b", "a"]);
  });
  it("skips a quiet week: nothing new and spend moved under 10%", () => {
    const old = f("a", 100, "high", { lastSeen: "2026-09-20T00:00:00Z", firstSeen: "2026-09-20T00:00:00Z" });
    expect(recapSelection([old], { lastRecapAt: "2026-09-28T00:00:00Z", spendThisWeek: 105, spendLastWeek: 100 })).toEqual([]);
  });
  it("leaves out kinds dismissed three times", () => {
    expect(recapSelection([f("a", 100, "high", { dismissCount: 3 })], { lastRecapAt: null, spendThisWeek: 1, spendLastWeek: 0 })).toEqual([]);
  });
});

describe("other gate rules", () => {
  it("re-notifies only when stake grows 50% since the last notice", () => {
    expect(shouldRenotify(f("a", 100))).toBe(true);
    expect(shouldRenotify(f("a", 140, "high", { lastNotifiedStake: 100 }))).toBe(false);
    expect(shouldRenotify(f("a", 150, "high", { lastNotifiedStake: 100 }))).toBe(true);
  });
  it("dismiss hides a finding for 30 days, then it returns", () => {
    const d = dismiss(f("a", 1), "2026-10-04T00:00:00Z");
    expect(d).toMatchObject({ status: "dismissed", dismissCount: 1, snoozedUntil: "2026-11-03T00:00:00.000Z" });
    expect(dashboardBuckets([d], "2026-10-10T00:00:00Z").open).toHaveLength(0);
    expect(dashboardBuckets([d], "2026-11-04T00:00:00Z").open).toHaveLength(1);
  });
  it("puts low confidence in Watching", () => expect(dashboardBuckets([f("a", 1, "low")], "2026-10-04T00:00:00Z").watching).toHaveLength(1));
  it("warns before spending only for a material, confident saving", () => {
    expect(shouldWarnPreSpend({ plannedCredits: 498, projectedSaving: 459, confidence: "medium" })).toBe(true);
    expect(shouldWarnPreSpend({ plannedCredits: 498, projectedSaving: 60, confidence: "high" })).toBe(false);
    expect(shouldWarnPreSpend({ plannedCredits: 400, projectedSaving: 99, confidence: "high" })).toBe(false);
    expect(shouldWarnPreSpend({ plannedCredits: 1000, projectedSaving: 500, confidence: "low" })).toBe(false);
  });
});
