import { describe, it, expect } from "vitest";
import { attributeCharges } from "@/lib/domain/attribution";
import { generateFindings, mergeFindings } from "@/lib/domain/findings";
import type { Stat } from "@/lib/domain/types";
import { loadDesignInput } from "../helpers/design-fixture";

const input = loadDesignInput();
const charges = attributeCharges(input);
const stat = (value: string, credits: number, meetings: number, cpm: number | null, conf: Stat["confidence"] = "high", reached = 200): Stat => ({
  period: "30d", dimension: value === "all" ? "org" : "list", value, credits, creditsExact: credits, meetings, deals: 0, wonValue: 0, contactsReached: reached,
  costPerMeeting: cpm, costPerDeal: null, vsAvgPct: null, evidenceN: meetings, confidence: conf, simulated: true, computedAt: "2026-10-04T00:00:00Z" });
const statsByList = [stat("all", 12400, 38, 326), stat("fintech", 2100, 17, 124), stat("starter", 4800, 4, 1200, "medium"), stat("health", 2600, 6, 433, "medium")];
const findings = generateFindings({ now: "2026-10-04T00:00:00Z", period: "30d", statsByList, statsBySegment: [], charges, runs: input.runs, outcomes: [],
  unusedDocs: Array.from({ length: 23 }, (_, i) => ({ name: `doc ${i}`, createdAt: "2026-09-26T09:00:00Z" })), onboardingCredits: 860 });
const byKind = (k: string) => findings.filter((f) => f.kind === k);

describe("generateFindings", () => {
  it("finds the real waste: 77 failed-job credits, 14 unreadable, 24 agent side effect", () => {
    expect(byKind("waste").map((f) => f.creditsAtStake).sort((a, b) => a - b)).toEqual([14, 77]);
    expect(byKind("side_effect")[0].creditsAtStake).toBe(24);
  });
  it("flags the billing mismatch on jobs that report 0 credits but were charged", () => {
    expect(byKind("fix").some((f) => f.extId.startsWith("fix|billing_mismatch") && f.creditsAtStake === 77)).toBe(true);
  });
  it("flags the estimate gap: quoted 37, charged 50", () => {
    const f = byKind("fix").find((x) => x.extId.startsWith("fix|estimate_gap"));
    expect(f?.evidence).toMatchObject({ quoted: 37, actual: 50 });
  });
  it("suggests scaling fintech (≤0.6× average) and cutting starter (≥2× average)", () => {
    expect(byKind("scale").map((f) => f.evidence.value)).toEqual(["fintech"]);
    expect(byKind("cut").map((f) => f.evidence.value)).toEqual(["starter"]);
  });
  it("reports 23 unused documents after 7 days", () => expect(byKind("unused")[0].evidence).toMatchObject({ documents: 23 }));
  it("does not raise traceability when service-only spend is under 10%", () => expect(byKind("traceability")).toHaveLength(0));
});

describe("mergeFindings", () => {
  it("keeps user status and first-seen date, refreshes the rest", () => {
    const prev = { ...findings[0], status: "dismissed" as const, dismissCount: 1, firstSeen: "2026-09-27T00:00:00Z", snoozedUntil: "2026-10-27T00:00:00Z" };
    const [m] = mergeFindings([findings[0]], [prev]);
    expect(m).toMatchObject({ status: "dismissed", dismissCount: 1, firstSeen: "2026-09-27T00:00:00Z", lastSeen: findings[0].lastSeen });
  });
  it("refreshes lastSeen when the finding changed", () => {
    const prev = { ...findings[0], creditsAtStake: 10, lastSeen: "2026-09-27T00:00:00Z", firstSeen: "2026-09-27T00:00:00Z" };
    const fresh = { ...findings[0], creditsAtStake: 20 };
    expect(mergeFindings([fresh], [prev])[0]).toMatchObject({ creditsAtStake: 20, lastSeen: fresh.lastSeen });
  });
  it("keeps lastSeen while the finding is unchanged", () => {
    const prev = { ...findings[0], lastSeen: "2026-09-27T00:00:00Z", firstSeen: "2026-09-27T00:00:00Z" };
    expect(mergeFindings([findings[0]], [prev])[0].lastSeen).toBe("2026-09-27T00:00:00Z");
  });
});
