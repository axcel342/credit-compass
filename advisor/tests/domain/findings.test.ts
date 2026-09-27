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
const findings = generateFindings({ now: "2026-10-04T00:00:00Z", period: "8w", statsByList, statsBySegment: [], charges, runs: input.runs, outcomes: [],
  unusedDocs: Array.from({ length: 23 }, (_, i) => ({ name: `doc ${i}`, createdAt: "2026-09-26T09:00:00Z" })), onboardingCredits: 860,
  listNames: new Map([["fintech", "Fintech VPs"], ["starter", "Starter list"]]) });
const byKind = (k: string) => findings.filter((f) => f.kind === k);

describe("generateFindings", () => {
  it("finds the real waste: 77 failed-job credits, 14 unreadable, 24 agent side effect", () => {
    expect(byKind("waste").map((f) => f.creditsAtStake).sort((a, b) => a - b)).toEqual([14, 77]);
    expect(byKind("side_effect")[0].creditsAtStake).toBe(24);
  });
  it("folds the billing mismatch into the failed-job finding instead of listing the same 77 credits twice", () => {
    expect(findings.some((f) => f.extId.startsWith("fix|billing_mismatch"))).toBe(false);
    const w = byKind("waste").find((f) => f.creditsAtStake === 77)!;
    expect(w.title).toBe("graph8 owes you for jobs that failed");
    expect(w.body).toBe("77 credits went to 3 jobs that failed on every record. graph8's job records say 0 credits were used.");
  });
  it("flags the estimate gap: quoted 37, charged 50", () => {
    const f = byKind("fix").find((x) => x.extId.startsWith("fix|estimate_gap"));
    expect(f?.evidence).toMatchObject({ quoted: 37, actual: 50 });
  });
  it("names lists in scale and cut findings", () => {
    expect(byKind("scale").map((f) => f.title)).toEqual(["Scale Fintech VPs"]);
    expect(byKind("scale")[0].body).toBe("Fintech VPs book meetings at 124 credits each, 62% below your average.");
    expect(byKind("cut")[0].body).toBe("Starter list costs 1,200 credits per meeting, over twice your average.");
  });
  it("reports unused documents without waiting 7 days", () => {
    const f = byKind("unused")[0];
    expect(f.evidence).toMatchObject({ documents: 23 });
    expect(f.title).toBe("23 paid documents never used");
  });
  it("uses correct plurals", () => expect(byKind("waste").find((f) => f.creditsAtStake === 14)!.body).toBe("14 credits went to 1 job whose result can't be read back."));
  it("does not raise traceability when service-only spend is under 10%", () => expect(byKind("traceability")).toHaveLength(0));
  it("raises repeat enrichment when the same contacts are charged again within 30 days", () => {
    const base = charges[0];
    const again = [0, 1, 2, 3, 4, 5].map((i) => ({ ...base, ledgerId: `rep${i}`, service: "waterfall_enrichment", contactId: 42, listId: 15, credits: 20,
      isWaste: false, wasteReason: null, result: "success" as const, chargedAt: `2026-09-0${i + 1}T00:00:00Z` }));
    const fs = generateFindings({ now: "2026-10-04T00:00:00Z", period: "8w", statsByList: [], statsBySegment: [], charges: again, runs: [], outcomes: [],
      unusedDocs: [], onboardingCredits: 0, listNames: new Map([["15", "Sales VPs"]]) });
    const r = fs.find((f) => f.kind === "repeat_enrichment")!;
    expect(r).toMatchObject({ creditsAtStake: 100, title: "Paying to enrich the same contacts again", action: "Turn on skip recently enriched" });
    expect(r.evidence).toMatchObject({ charges: 5, contacts: 1, byList: { "15": 100 } });
  });
});

describe("mergeFindings", () => {
  it("keeps user status and first-seen date, refreshes the rest", () => {
    const prev = { ...findings[0], status: "dismissed" as const, dismissCount: 1, firstSeen: "2026-09-27T00:00:00Z", snoozedUntil: "2026-10-27T00:00:00Z" };
    const [m] = mergeFindings([findings[0]], [prev]);
    expect(m).toMatchObject({ status: "dismissed", dismissCount: 1, firstSeen: "2026-09-27T00:00:00Z", lastSeen: findings[0].lastSeen });
  });
  it("reopens a regenerated applied finding but still preserves a dismissed one", () => {
    const applied = { ...findings[0], status: "applied" as const, firstSeen: "2026-09-27T00:00:00Z" };
    const reopened = mergeFindings([findings[0]], [applied])[0];
    expect(reopened).toMatchObject({ status: "open", firstSeen: findings[0].firstSeen });
    const dismissed = { ...findings[0], status: "dismissed" as const, firstSeen: "2026-09-27T00:00:00Z" };
    expect(mergeFindings([findings[0]], [dismissed])[0]).toMatchObject({ status: "dismissed", firstSeen: "2026-09-27T00:00:00Z" });
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
