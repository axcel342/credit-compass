import { describe, it, expect } from "vitest";
import { buildSimPlan } from "@/lib/sim/plan";
import { repeatEnrichment } from "@/lib/domain/repeat";

const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const lists = [
  { id: 15, label: "[sim] Sales VPs", contactIds: ids(100, 20), costPerMeeting: 124, meetings: 17 },
  { id: 16, label: "[sim] Founders", contactIds: ids(200, 20), costPerMeeting: 433, meetings: 6 },
  { id: 2, label: "Starter list", contactIds: ids(300, 30), costPerMeeting: 1200, meetings: 4 },
];
const NOW = "2026-09-27T12:00:00Z", DAY = 86_400_000;
const p = buildSimPlan(20260927, NOW, lists);
const booked = p.events.filter((e) => e.event === "meeting.booked");

describe("buildSimPlan v2", () => {
  it("is deterministic and labels everything simulated", () => {
    expect(buildSimPlan(20260927, NOW, lists)).toEqual(p);
    expect(p.charges.every((c) => c.simulated && c.ledgerId.startsWith("sim-") && c.explanation.startsWith("[sim]"))).toBe(true);
    expect(p.events.every((e) => e.data.simulated === true && e.id!.startsWith("sim-"))).toBe(true);
  });
  it("hits each list's cost per meeting exactly", () => {
    for (const l of lists) {
      const credits = p.charges.filter((c) => c.listId === l.id).reduce((s, c) => s + c.credits, 0);
      const meetings = booked.filter((e) => e.data.list_id === l.id).length;
      expect(meetings).toBe(l.meetings);
      expect(credits / meetings).toBeCloseTo(l.costPerMeeting, 1);
    }
  });
  it("enriches every contact once, and re-enriches about 15% within 30 days", () => {
    for (const l of lists) {
      const counts = l.contactIds.map((id) => p.charges.filter((c) => c.contactId === id).length);
      expect(counts.every((n) => n === 1 || n === 2)).toBe(true);
      expect(counts.filter((n) => n === 2).length).toBe(Math.round(l.contactIds.length * 0.15));
    }
    const rep = repeatEnrichment(p.charges);
    const total = p.charges.reduce((s, c) => s + c.credits, 0);
    expect(rep.credits / total).toBeGreaterThan(0.08);
    expect(rep.credits / total).toBeLessThan(0.2);
  });
  it("books each meeting 7 to 21 days after the contact's first enrichment, and never in the future", () => {
    for (const e of booked) {
      const first = Math.min(...p.charges.filter((c) => c.contactId === e.data.contact_id).map((c) => Date.parse(c.chargedAt)));
      const lag = Date.parse(e.timestamp) - first;
      expect(lag).toBeGreaterThanOrEqual(7 * DAY);
      expect(lag).toBeLessThanOrEqual(21 * DAY);
      expect(Date.parse(e.timestamp)).toBeLessThan(Date.parse(NOW));
    }
  });
  it("spreads first enrichments over at least 7 of the 8 weeks, so cohorts exist", () => {
    const start = Date.parse(NOW) - 56 * DAY;
    const firstWeek = new Set(lists.flatMap((l) => l.contactIds).map((id) =>
      Math.floor((Math.min(...p.charges.filter((c) => c.contactId === id).map((c) => Date.parse(c.chargedAt))) - start) / (7 * DAY))));
    expect(firstWeek.size).toBeGreaterThanOrEqual(7);
  });
  it("refuses more meetings than contacts", () =>
    expect(() => buildSimPlan(1, NOW, [{ ...lists[0], meetings: 21 }])).toThrow("more meetings than contacts"));
});
