import { describe, it, expect } from "vitest";
import { overviewHeadline, overviewLede, statStrip, plural } from "@/lib/dashboard/story";

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
