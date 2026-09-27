import { describe, it, expect } from "vitest";
import { overviewHeadline, overviewLede, statStrip, plural, plannerHeadline } from "@/lib/dashboard/story";
import { ENRICHMENT_TYPES } from "@/lib/domain/planner";

describe("Overview sentences", () => {
  it("states credits, meetings and won deals", () =>
    expect(overviewHeadline({ total: 10766.4, meetings: 27, won: 10, periodLabel: "the last 8 weeks" })).toBe("10,766 credits bought 27 meetings and 10 won deals."));
  it("handles one meeting and no won deals", () =>
    expect(overviewHeadline({ total: 500, meetings: 1, won: 0, periodLabel: "the last 30 days" })).toBe("500 credits bought 1 meeting."));
  it("never divides by zero or says 0 meetings", () => {
    expect(overviewHeadline({ total: 1260, meetings: 0, won: 0, periodLabel: "the last 30 days" })).toBe("1,260 credits spent in the last 30 days, and no meetings booked yet.");
    expect(overviewHeadline({ total: 0, meetings: 0, won: 0, periodLabel: "the last 30 days" })).toBe("No credits spent in the last 30 days.");
    expect(statStrip({ total: 0, meetings: 0, booked: 0, waste: 0, traced: 0 }).map((s) => s.value)).toEqual(["—", "0", "0", "0%"]);
  });
  it("explains what bought nothing, leaving out empty parts", () => {
    expect(overviewLede({ unused: 860, waste: 115 })).toBe("975 of them bought nothing you've used: 860 on onboarding research nobody has opened, and 115 on jobs that failed.");
    expect(overviewLede({ unused: 0, waste: 115 })).toBe("115 of them bought nothing you've used: 115 on jobs that failed.");
    expect(overviewLede({ unused: 0, waste: 0 })).toBeNull();
  });
  it("builds the number strip", () => {
    expect(statStrip({ total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722 })).toEqual([
      { value: "399", label: "credits per meeting" }, { value: "5,131", label: "spent on contacts who booked" },
      { value: "115", label: "wasted", tone: "bad" }, { value: "90%", label: "traced to a contact, list or run" }]);
  });
  it("pluralises", () => { expect(plural(1, "job")).toBe("1 job"); expect(plural(3, "job")).toBe("3 jobs"); expect(plural(2, "company", "companies")).toBe("2 companies"); });
});

import { chargesHeadline } from "@/lib/dashboard/story";
describe("Charges sentence", () => {
  it("states how much traces back", () => expect(chargesHeadline({ traced: 9722, total: 10766, periodLabel: "the last 8 weeks" })).toBe("90% of your credits trace back to a contact, list or run."));
  it("handles no charges", () => expect(chargesHeadline({ traced: 0, total: 0, periodLabel: "the last 30 days" })).toBe("No charges in the last 30 days."));
});

describe("Planner sentence", () => {
  const find = ENRICHMENT_TYPES[0], verify = ENRICHMENT_TYPES[1];
  it("contrasts graph8's quote with the estimate", () => expect(plannerHeadline({ graph8Quote: 498, estimate: 36, listLabel: "Starter list", def: find })).toBe("graph8 quotes 498 credits. It should cost about 36."));
  it("states the estimate when graph8 has no quote", () => expect(plannerHeadline({ graph8Quote: null, estimate: 126, listLabel: "Starter list", def: verify })).toBe("Email verification on the Starter list should cost about 126 credits."));
  it("says when there is nothing to do", () => expect(plannerHeadline({ graph8Quote: null, estimate: 0, listLabel: "Founders", def: find })).toBe("Nothing to do: every contact on Founders is already done or skipped."));
});

import { optimizeHeadline } from "@/lib/dashboard/story";
describe("Optimize sentence", () => {
  it("sums monthly savings and mentions moving spend", () => expect(optimizeHeadline({ count: 3, monthly: 4400, hasMove: true })).toBe("3 changes would save about 4,400 credits a month and move spend to the lists that book."));
  it("handles one change without savings", () => expect(optimizeHeadline({ count: 1, monthly: 0, hasMove: true })).toBe("1 change would move spend to the lists that book."));
  it("handles nothing to do", () => expect(optimizeHeadline({ count: 0, monthly: 0, hasMove: false })).toBe("Your spend looks efficient right now."));
});
