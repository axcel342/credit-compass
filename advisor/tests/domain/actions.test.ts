import { describe, it, expect } from "vitest";
import { buildActions, lookalikeFilters } from "@/lib/domain/actions";
import type { ActionRecord, AttributedCharge, ContactCacheRow, Stat } from "@/lib/domain/types";

const ch = (id: string, contactId: number, listId: number, at: string, credits = 90): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: `sim-run-${listId}`, listId, contactId,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: true });
const stat = (value: string, credits: number, meetings: number, cpm: number | null, confidence: Stat["confidence"]): Stat => ({ period: "8w", dimension: value === "all" ? "org" : "list",
  value, credits, creditsExact: credits, meetings, deals: 0, wonValue: 0, contactsReached: 20, costPerMeeting: cpm, costPerDeal: null, vsAvgPct: null, evidenceN: meetings,
  confidence, simulated: true, computedAt: "2026-09-27T00:00:00Z" });
const row = (id: number, listId: number, fit: ContactCacheRow["fit"], seg = "Vice President|Sales|Software|51-200"): ContactCacheRow =>
  ({ contactId: id, listIds: [listId], hasEmail: true, consistency: fit === "low" ? "flagged" : "ok", segmentKey: seg, fit, fitLevel: "role", syncedAt: "2026-09-27T00:00:00Z" });

const charges = [ch("a", 1, 2, "2026-09-01T00:00:00Z"), ch("b", 1, 2, "2026-09-10T00:00:00Z"), ch("c", 2, 15, "2026-09-02T00:00:00Z")];
const stats = [stat("all", 10000, 27, 370, "high"), stat("15", 2108, 17, 124, "high"), stat("16", 2598, 6, 433, "medium"), stat("2", 4931, 4, 1233, "low")];
const contacts = [...Array.from({ length: 12 }, (_, i) => row(100 + i, 2, "low", "Owner|Founders|X|1-10")), ...Array.from({ length: 20 }, (_, i) => row(200 + i, 15, "high"))];
const names = new Map([["2", "Starter list"], ["15", "Sales VPs"], ["16", "Founders"]]);
const input = { charges, stats, listNames: names, contacts, actions: [] as ActionRecord[] };

describe("buildActions", () => {
  const acts = buildActions(input);
  it("finds repeat enrichment with a monthly saving and the lists to change", () => {
    const r = acts.find((a) => a.id === "repeat")!;
    expect(r.monthlyCredits).toBe(Math.round((90 * 30) / 56));
    expect(r.title).toBe("Stop paying twice for the same contacts");
    expect(r.button).toMatchObject({ action: "repeat", label: "Turn on for 1 pipeline", listIds: [2], confirm: "Yes, change 1 pipeline in graph8" });
    expect(r.inGraph8).toBe("Turns on Skip recently enriched and Skip existing values for the Starter list pipeline.");
  });
  it("moves spend from the costliest list to the cheapest, in two steps", () => {
    const m = acts.find((a) => a.id === "move-spend")!;
    expect(m.title).toBe("Move spend from the Starter list to people like your Sales VPs");
    expect(m.impact).toBe("~2 more meetings a week");
    expect(m.steps.map((s) => [s.label, s.done])).toEqual([["Build a lookalike list, free", false], ["Pause the Starter list", false]]);
    expect(m.button).toMatchObject({ action: "lookalike", label: "Build lookalike list", listIds: [15], confirm: "Yes, create a new list in graph8" });
  });
  it("skips unlikely contacts on the list with the most of them", () => {
    const s = acts.find((a) => a.id === "skip-unlikely")!;
    expect(s.title).toBe("Skip contacts unlikely to book");
    expect(s.impact).toBe("saves 12 per run");
    expect(s.button).toMatchObject({ action: "guardrail", listIds: [2], confirm: "Yes, add the rule to the Starter list in graph8" });
  });
  it("orders by impact: monthly savings first, then meetings, then per-run", () => expect(acts.map((a) => a.id)).toEqual(["repeat", "move-spend", "skip-unlikely"]));
  it("marks steps and actions done from roi_action records", () => {
    const applied = (kind: ActionRecord["kind"], listId: number): ActionRecord => ({ extId: `${kind}:${listId}`, kind, listId, pipelineId: "p", appliedAt: "2026-09-27T00:00:00Z",
      status: "applied", previous: null, detail: {}, simulated: false });
    const a2 = buildActions({ ...input, actions: [applied("lookalike", 15), applied("repeat_skip", 2)] });
    expect(a2.find((a) => a.id === "repeat")!.applied).toBe(true);
    const m = a2.find((a) => a.id === "move-spend")!;
    expect(m.steps[0].done).toBe(true);
    expect(m.button).toMatchObject({ action: "pause", label: "Pause the Starter list", listIds: [2], confirm: "Yes, pause the Starter list in graph8" });
  });
  it("offers nothing when the data doesn't support it", () => expect(buildActions({ charges: [], stats: [], listNames: names, contacts: [], actions: [] })).toEqual([]));
  it("gives each action a payoff figure and unit", () =>
    expect(acts.map((a) => [a.id, a.payoff])).toEqual([
      ["repeat", { figure: "48", unit: "credits a month" }], ["move-spend", { figure: "+2", unit: "meetings a week" }], ["skip-unlikely", { figure: "12", unit: "credits a run" }]]));
  it("keeps evidence to one line, and only where the chart can't say it", () => {
    expect(acts.map((a) => a.evidence)).toEqual([null, null, "Emails that don't match the company bounced 45% of the time, against 20% for the rest."]);
  });
  it("charts the fit of the list the rule would change", () => {
    const more = [...contacts, row(300, 2, "high"), row(301, 2, "medium"), row(302, 2, "unknown")];
    expect(buildActions({ ...input, contacts: more }).find((a) => a.id === "skip-unlikely")!.chart).toEqual([
      { label: "Likely", value: 1, tone: "var(--booked)" }, { label: "Maybe", value: 1, tone: "var(--maybe)" },
      { label: "Unlikely", value: 12, tone: "var(--waste)" }, { label: "Unknown", value: 1, tone: "var(--unknown)" }]);
    expect(acts.find((a) => a.id === "skip-unlikely")!.chart).toEqual([{ label: "Unlikely", value: 12, tone: "var(--waste)" }]);
  });
  it("shows a small gain with one decimal, and credits when the gain rounds to nothing", () => {
    const withWorst = (cpm: number) => buildActions({ ...input, stats: [stats[0], stats[1], stat("2", 1000, 4, cpm, "low")] }).find((a) => a.id === "move-spend")!.payoff;
    expect(withWorst(400)).toEqual({ figure: "+0.2", unit: "meetings a week" });
    expect(withWorst(248)).toEqual({ figure: "125", unit: "credits a week to move" });
  });
});

describe("lookalikeFilters", () => {
  it("uses the most common known seniority and department", () =>
    expect(lookalikeFilters([row(1, 15, "high"), row(2, 15, "high"), row(3, 15, "high", "Director|Marketing|X|1-10"), row(4, 15, "high", "Unknown|Unknown|X|1-10")]))
      .toEqual([{ field: "seniority_level", operator: "any_of", value: ["Vice President"] }, { field: "job_department", operator: "any_of", value: ["Sales"] }]));
});
