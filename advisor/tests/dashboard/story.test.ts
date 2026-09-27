import { describe, it, expect } from "vitest";
import { overviewHeadline, overviewLede, statStrip, plural, plannerHeadline, cpmBarColor } from "@/lib/dashboard/story";
import { ENRICHMENT_TYPES } from "@/lib/domain/planner";

describe("Overview sentences", () => {
  it("states credits, meetings and won deals", () =>
    expect(overviewHeadline({ total: 10766.4, meetings: 27, won: 10, wonValue: 0, periodLabel: "the last 8 weeks" })).toBe("10,766 credits bought 27 meetings and 10 won deals."));
  it("handles one meeting and no won deals", () =>
    expect(overviewHeadline({ total: 500, meetings: 1, won: 0, wonValue: 0, periodLabel: "the last 30 days" })).toBe("500 credits bought 1 meeting."));
  it("never divides by zero or says 0 meetings", () => {
    expect(overviewHeadline({ total: 1260, meetings: 0, won: 0, wonValue: 0, periodLabel: "the last 30 days" })).toBe("1,260 credits spent in the last 30 days, and no meetings booked yet.");
    expect(overviewHeadline({ total: 0, meetings: 0, won: 0, wonValue: 0, periodLabel: "the last 30 days" })).toBe("No credits spent in the last 30 days.");
    expect(statStrip({ total: 0, meetings: 0, booked: 0, waste: 0, traced: 0, wonValue: 0, trend: null }).map((s) => s.value)).toEqual(["—", "0", "0", "0%"]);
  });
  it("explains what bought nothing, leaving out empty parts", () => {
    expect(overviewLede({ unused: 860, waste: 115 })).toBe("975 of them bought nothing you've used: 860 on onboarding research nobody has opened, and 115 on jobs that failed.");
    expect(overviewLede({ unused: 0, waste: 115 })).toBe("115 of them bought nothing you've used: 115 on jobs that failed.");
    expect(overviewLede({ unused: 0, waste: 0 })).toBeNull();
  });
  it("builds the number strip, with value per credit when deals have amounts", () => {
    expect(statStrip({ total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722, wonValue: 96000, trend: null })).toEqual([
      { value: "399", label: "credits per meeting" }, { value: "$8,917", label: "won per 1,000 credits" },
      { value: "5,131", label: "spent on contacts who booked" }, { value: "115", label: "wasted", tone: "bad" }, { value: "90%", label: "traced to a contact, list or run" }]);
    expect(statStrip({ total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722, wonValue: 0, trend: null }).map((s) => s.label))
      .not.toContain("won per 1,000 credits");
  });
  it("adds the trend under credits per meeting", () => {
    const base = { total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722, wonValue: 0 };
    expect(statStrip({ ...base, trend: { from: 504, to: 337, weeks: 5, pct: -33 } })[0]).toEqual({ value: "399", label: "credits per meeting", note: "down 33% in 5 weeks", noteTone: "good" });
    expect(statStrip({ ...base, trend: { from: 300, to: 360, weeks: 4, pct: 20 } })[0]).toMatchObject({ note: "up 20% in 4 weeks", noteTone: "bad" });
    expect(statStrip({ ...base, trend: { from: 300, to: 300, weeks: 4, pct: 0 } })[0].note).toBeUndefined();
  });
  it("says what the won deals were worth, and only when they have amounts", () => {
    expect(overviewHeadline({ total: 10766, meetings: 27, won: 9, wonValue: 96000, periodLabel: "the last 8 weeks" })).toBe("10,766 credits bought 27 meetings and 9 won deals worth $96,000.");
    expect(overviewHeadline({ total: 10766, meetings: 27, won: 9, wonValue: 0, periodLabel: "the last 8 weeks" })).toBe("10,766 credits bought 27 meetings and 9 won deals.");
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

describe("cost per meeting bar colour", () => {
  it("greens the cheapest list, reds any list at twice the average or more, and leaves the rest neutral", () => {
    expect(cpmBarColor(124, 124, 399)).toBe("var(--booked)");
    expect(cpmBarColor(1233, 124, 399)).toBe("var(--waste)");
    expect(cpmBarColor(433, 124, 399)).toBe("var(--series-weak)");
    expect(cpmBarColor(900, 124, null)).toBe("var(--series-weak)");
  });
});

import { valueChain, perCredit } from "@/lib/dashboard/story";
describe("valueChain", () => {
  const base = { total: 10674.35, meetings: 27, won: 9, wonValue: 108000, periodLabel: "the last 8 weeks" };
  it("links credits to meetings to won value, with the rates on the arrows", () =>
    expect(valueChain(base)).toEqual({
      nodes: [{ figure: "10,674", label: "credits spent", tone: "in" }, { figure: "27", label: "meetings booked", tone: "mid" }, { figure: "$108,000", label: "won, $10 per credit", tone: "out" }],
      links: ["395 per meeting", "9 deals won"],
      aria: "10,674 credits bought 27 meetings, 395 per meeting. 9 won deals worth $108,000, $10 per credit." }));
  it("stops at meetings when no deal was won or deals have no amounts", () => {
    expect(valueChain({ ...base, won: 0, wonValue: 0 })).toMatchObject({ links: ["395 per meeting"], nodes: [{ tone: "in" }, { tone: "mid" }] });
    expect(valueChain({ ...base, won: 3, wonValue: 0 })).toMatchObject({ links: ["395 per meeting"] });
  });
  it("shows only the spend when nothing was booked", () =>
    expect(valueChain({ ...base, meetings: 0, won: 0, wonValue: 0 })).toEqual({ nodes: [{ figure: "10,674", label: "credits spent", tone: "in" }], links: [],
      aria: "10,674 credits spent in the last 8 weeks, and no meetings booked yet." }));
  it("says so when nothing was spent", () => expect(valueChain({ ...base, total: 0 })).toEqual({ empty: "No credits spent in the last 8 weeks." }));
  it("uses the singular for one meeting and one deal", () =>
    expect(valueChain({ total: 500, meetings: 1, won: 1, wonValue: 2000, periodLabel: "the last 30 days" })).toMatchObject({
      nodes: [{ figure: "500" }, { figure: "1", label: "meeting booked" }, { figure: "$2,000", label: "won, $4.00 per credit" }], links: ["500 per meeting", "1 deal won"] }));
  it("shows whole dollars per credit from $10 and cents below", () => { expect(perCredit(10.118)).toBe("$10"); expect(perCredit(4.504)).toBe("$4.50"); });
});
