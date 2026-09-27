import { describe, it, expect } from "vitest";
import { ENRICHMENT_TYPES, availableTypes, listChoices, costWalk, poissonQuantile, forecastMeetings } from "@/lib/domain/planner";
import type { ContactCacheRow } from "@/lib/domain/types";

const row = (id: number, hasEmail: boolean, fit: ContactCacheRow["fit"]): ContactCacheRow => ({ contactId: id, listIds: [2], hasEmail, consistency: fit === "low" ? "flagged" : "ok",
  segmentKey: "x", fit, fitLevel: null, syncedAt: "2026-09-27T00:00:00Z" });
// Starter-list shape: 250 contacts, 238 with an email of which 112 are flagged low, 12 without an email.
const rows = [...Array.from({ length: 112 }, (_, i) => row(i, true, "low")), ...Array.from({ length: 126 }, (_, i) => row(200 + i, true, "medium")),
  ...Array.from({ length: 12 }, (_, i) => row(500 + i, false, "unknown"))];
const def = (k: string) => ENRICHMENT_TYPES.find((t) => t.key === k)!;

describe("listChoices", () => {
  it("drops empty lists and names duplicates by id", () => {
    const lists = [{ id: 2, title: "Starter list (proactive setup)", total: 250 }, { id: 3, title: "Revenue-Suspects", total: 0 }, { id: 4, title: "Revenue-Suspects", total: 254 },
      { id: 16, title: "[sim] Founders", total: 20 }];
    const names = new Map([["2", "Starter list"], ["3", "Revenue-Suspects (3)"], ["4", "Revenue-Suspects (4)"], ["16", "Founders"]]);
    expect(listChoices(lists, names)).toEqual([{ id: 4, label: "Revenue-Suspects (4)", total: 254 }, { id: 2, label: "Starter list", total: 250 }, { id: 16, label: "Founders", total: 20 }]);
  });
});

describe("availableTypes", () => {
  it("runs Find emails when the template exists, keeps Verify as an estimate without its template and Phones off", () => {
    const a = availableTypes([{ key: "verified_emails", name: "Verified emails" }]);
    expect(a.map((x) => [x.def.key, x.runnable])).toEqual([["find", true], ["verify", false], ["phones", false]]);
    expect(a[1].reason).toBe("graph8 has no list template for email verification, so this is an estimate only.");
    expect(a[2].reason).toBe("Available once graph8's phone template is checked.");
  });
});

describe("costWalk", () => {
  it("verify: every contact, minus those without an email, minus the unlikely", () =>
    expect(costWalk({ rows, def: def("verify"), price: 1, calibration: 1, guardrail: true })).toEqual({ every: 250, perRecord: 1, done: { count: 12, credits: 12 },
      skipped: { count: 112, credits: 112 }, records: 126, estimate: 126 }));
  it("find: most already have an email and nobody is left to skip", () =>
    expect(costWalk({ rows, def: def("find"), price: 3, calibration: 1, guardrail: true })).toMatchObject({ every: 750, done: { count: 238, credits: 714 },
      skipped: { count: 0, credits: 0 }, records: 12, estimate: 36 }));
  it("without the guardrail nobody is skipped", () => expect(costWalk({ rows, def: def("verify"), price: 1, calibration: 1, guardrail: false }).records).toBe(238));
  it("applies calibration to the estimate only", () => expect(costWalk({ rows, def: def("find"), price: 3, calibration: 1.35, guardrail: true }).estimate).toBe(49));
});

describe("forecast", () => {
  it("computes Poisson quantiles", () => { expect(poissonQuantile(2, 0.1)).toBe(0); expect(poissonQuantile(2, 0.9)).toBe(4); expect(poissonQuantile(0, 0.9)).toBe(0); });
  it("forecasts meetings from the list's rate, with an 80% range and a confidence flag", () => {
    // rate = (4 + 5 × 0.1) / (250 + 5) ≈ 0.0176; expected ≈ 2.22; Poisson(2.22): P(X≤0) ≈ 0.108, P(X≤3) ≈ 0.814, P(X≤4) ≈ 0.924
    expect(forecastMeetings({ records: 126, meetings: 4, reached: 250, orgRate: 0.1 })).toMatchObject({ expected: 2.2, lo: 0, hi: 4, lowConfidence: true });
    expect(forecastMeetings({ records: 0, meetings: 4, reached: 250, orgRate: 0.1 })).toEqual({ expected: 0, lo: 0, hi: 0, lowConfidence: true });
  });
});
