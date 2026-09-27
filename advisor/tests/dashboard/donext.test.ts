import { describe, it, expect } from "vitest";
import { doNextItems, doNextImpact } from "@/lib/dashboard/donext";
import type { Finding } from "@/lib/domain/types";
import type { PlannedAction } from "@/lib/domain/actions";

const f = (kind: Finding["kind"], stake: number, body: string, confidence: Finding["confidence"] = "high", id: string = kind): Finding => ({ extId: `${id}|x|8w`, kind, title: kind, body,
  evidence: {}, creditsAtStake: stake, confidence, status: "open", snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null,
  firstSeen: "2026-09-27T00:00:00Z", lastSeen: "2026-09-27T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false });
const act = (id: PlannedAction["id"], p: Partial<PlannedAction> = {}): PlannedAction => ({ id, title: "", impact: "", evidence: null, confidence: "High confidence",
  inGraph8: "", chart: [], steps: [], button: null, applied: false, monthlyCredits: 0, payoff: { figure: "", unit: "" }, ...p });
const moveTitle = "Move spend from the Starter list to people like your Sales VPs";
const impact = { repeat: { figure: "696", unit: "credits a month" }, move: { figure: "+2", unit: "meetings a week", title: moveTitle }, refundRequested: false };
const findings = [f("cut", 4931, "Starter list costs 1,233 credits per meeting, over twice your average.", "medium"), f("scale", 2016, "Sales VPs book cheaply."),
  f("repeat_enrichment", 1300, "R"), f("unused", 860, "D", "medium"), f("waste", 77, "A", "high", "waste-a"), f("waste", 14, "B", "high", "waste-b"), f("side_effect", 24, "S")];

describe("doNextItems", () => {
  it("merges cut and scale into one move row and the waste findings into one refund row, figure first", () =>
    expect(doNextItems(findings, 4, "", impact).map((x) => [x.figure, x.unit, x.text, x.label, x.href])).toEqual([
      ["+2", "meetings a week", moveTitle, "Move spend", "/optimize#move-spend"],
      ["696", "credits a month", "Stop paying twice for the same contacts", "Stop paying twice", "/optimize#repeat"],
      ["860", "credits unused", "Onboarding research nobody has opened", "See it", "/recovery"],
      ["91", "credits back", "graph8 owes you for work that produced nothing", "Claim refund", "/recovery#claim"]]));
  it("falls back to the credits at stake when the Optimize change is applied", () =>
    expect(doNextItems([f("cut", 4931, "Starter list costs 1,233 credits per meeting.", "medium"), f("repeat_enrichment", 1300, "R")]).map((x) => [x.figure, x.unit, x.text])).toEqual([
      ["4,931", "credits on a costly list", "Starter list costs 1,233 credits per meeting."], ["1,300", "credits paid twice", "Stop paying twice for the same contacts"]]));
  it("names the best list when only the scale finding is open", () =>
    expect(doNextItems([f("scale", 2016, "Sales VPs book cheaply.")])[0]).toMatchObject({ figure: "2,016", unit: "credits on your best list", text: "Sales VPs book cheaply." }));
  it("stops asking to claim a refund once one has been requested", () =>
    expect(doNextItems([f("waste", 77, "A")], 4, "", { ...impact, refundRequested: true })).toEqual([]));
  it("skips kinds that have nothing to do", () => expect(doNextItems([f("what_worked", 0, "x"), f("traceability", 50, "y")])).toEqual([]));
  it("carries the period query into every link", () =>
    expect(doNextItems(findings, 4, "period=30d", impact).map((x) => x.href)).toEqual(["/optimize?period=30d#move-spend", "/optimize?period=30d#repeat", "/recovery?period=30d", "/recovery?period=30d#claim"]));
  it("counts merged rows once against the limit", () => {
    expect(doNextItems(findings, 5, "", impact).map((x) => x.label)).toEqual(["Move spend", "Stop paying twice", "See it", "Claim refund", "See it"]);
    expect(doNextItems(findings, 2, "", impact)).toHaveLength(2);
  });
  it("gives each merged row a stable id from its findings", () =>
    expect(doNextItems(findings, 1, "", impact)[0].id).toBe("cut|x|8w+scale|x|8w"));
});

describe("doNextImpact", () => {
  it("takes payoffs only from changes not yet applied", () => {
    const open = [act("repeat", { payoff: { figure: "696", unit: "credits a month" } }), act("move-spend", { title: moveTitle, payoff: { figure: "+2", unit: "meetings a week" } })];
    expect(doNextImpact(open)).toEqual({ repeat: { figure: "696", unit: "credits a month" }, move: { figure: "+2", unit: "meetings a week", title: moveTitle }, refundRequested: false });
    expect(doNextImpact(open.map((a) => ({ ...a, applied: true })), true)).toEqual({ repeat: null, move: null, refundRequested: true });
  });
});
