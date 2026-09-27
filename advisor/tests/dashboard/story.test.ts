import { describe, it, expect } from "vitest";
import { plural } from "@/lib/dashboard/story";

describe("plural", () => {
  it("pluralises", () => { expect(plural(1, "job")).toBe("1 job"); expect(plural(3, "job")).toBe("3 jobs"); expect(plural(2, "company", "companies")).toBe("2 companies"); });
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

import { listRows } from "@/lib/dashboard/story";
describe("listRows", () => {
  const rows = [{ label: "Starter list", value: 1232.75 }, { label: "Sales VPs", value: 118.61 }, { label: "Founders", value: 433 }];
  it("sorts cheapest first and labels the cheapest and anything at twice the average", () =>
    expect(listRows(rows, 395.35)).toEqual([
      { label: "Sales VPs", value: 118.61, color: "var(--booked)", note: "cheapest", tone: "good" },
      { label: "Founders", value: 433, color: "var(--series-weak)", note: null, tone: null },
      { label: "Starter list", value: 1232.75, color: "var(--waste)", note: "3× average", tone: "bad" }]));
  it("adds no notes to a single list", () =>
    expect(listRows([{ label: "Sales VPs", value: 118 }], 118)).toEqual([{ label: "Sales VPs", value: 118, color: "var(--series-weak)", note: null, tone: null }]));
  it("skips the average note when there is no org average", () =>
    expect(listRows(rows, null).map((r) => r.note)).toEqual(["cheapest", null, null]));
  it("calls every tied lowest list cheapest, and none when all are equal", () => {
    expect(listRows([{ label: "A", value: 100 }, { label: "B", value: 100 }, { label: "C", value: 500 }], 150).map((r) => r.note)).toEqual(["cheapest", "cheapest", "3× average"]);
    expect(listRows([{ label: "A", value: 100 }, { label: "B", value: 100 }], 100).map((r) => r.note)).toEqual([null, null]);
  });
});

import { optimizeTitle, plannerUnit, forecastFigure } from "@/lib/dashboard/story";
describe("Optimize wording", () => {
  it("counts the changes left to make", () => {
    expect(optimizeTitle(3)).toEqual({ title: "3 changes you can make", sub: "Each costs 0 credits and can be undone" });
    expect(optimizeTitle(1).title).toBe("1 change you can make");
    expect(optimizeTitle(0)).toEqual({ title: "Your spend looks efficient right now.", sub: null });
  });
  it("says what the planner estimate compares with", () => {
    expect(plannerUnit({ estimate: 36, every: 750, graph8Quote: 498 })).toBe("credits, graph8 quotes 498");
    expect(plannerUnit({ estimate: 117, every: 250, graph8Quote: null })).toBe("credits, instead of 250 for every contact");
    expect(plannerUnit({ estimate: 250, every: 250, graph8Quote: 200 })).toBe("credits");
    expect(plannerUnit({ estimate: 0, every: 250, graph8Quote: null })).toBe("credits. Every contact is done or skipped");
  });
  it("turns the forecast into one figure", () => {
    expect(forecastFigure({ expected: 18.7, lo: 14, hi: 25, lowConfidence: true })).toEqual({ figure: "~19", unit: "meetings, likely 14 to 25", note: "Low confidence, fewer than 5 meetings so far" });
    expect(forecastFigure({ expected: 0.4, lo: 0, hi: 1, lowConfidence: false })).toEqual({ figure: "<1", unit: "meetings, likely 0 to 1", note: null });
  });
});
