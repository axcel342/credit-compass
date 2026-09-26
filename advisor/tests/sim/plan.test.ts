import { describe, it, expect } from "vitest";
import { buildSimPlan } from "@/lib/sim/plan";

const lists = [{ id: 101, label: "Fintech VPs", contactIds: [1, 2, 3, 4], costPerMeeting: 124, meetings: 17 },
  { id: 102, label: "Starter list", contactIds: [5, 6], costPerMeeting: 1200, meetings: 4 }];

describe("buildSimPlan", () => {
  const p = buildSimPlan(42, "2026-10-04T00:00:00Z", lists);
  it("is deterministic", () => expect(buildSimPlan(42, "2026-10-04T00:00:00Z", lists)).toEqual(p));
  it("labels everything simulated", () => {
    expect(p.charges.every((c) => c.simulated && c.ledgerId.startsWith("sim-"))).toBe(true);
    expect(p.events.every((e) => e.data.simulated === true && e.id!.startsWith("sim-"))).toBe(true);
  });
  it("hits the target cost per meeting per list", () => {
    for (const l of lists) {
      const credits = p.charges.filter((c) => c.listId === l.id).reduce((s, c) => s + c.credits, 0);
      const meetings = p.events.filter((e) => e.event === "meeting.booked" && e.data.list_id === l.id).length;
      expect(meetings).toBe(l.meetings);
      expect(credits / meetings).toBeCloseTo(l.costPerMeeting, 0);
    }
  });
  it("spreads events over the last 8 weeks", () => {
    const ts = p.events.map((e) => Date.parse(e.timestamp));
    expect(Math.min(...ts)).toBeGreaterThanOrEqual(Date.parse("2026-08-09T00:00:00Z"));
    expect(Math.max(...ts)).toBeLessThanOrEqual(Date.parse("2026-10-04T00:00:00Z"));
  });
});
