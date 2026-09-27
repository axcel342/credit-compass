import { describe, it, expect } from "vitest";
import { weeklySpend, recoveryItems, refundDraftFor, claimState } from "@/lib/dashboard/recovery";
import { recoveryHeadline, recoveryLede } from "@/lib/dashboard/story";
import type { ActionRecord, AttributedCharge, Run } from "@/lib/domain/types";

const c = (id: string, at: string, p: Partial<AttributedCharge> = {}): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits: 10, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: null, contactId: null,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const charges = [
  c("w1", "2026-08-05T10:00:00Z", { credits: 500 }),
  c("f1", "2026-09-26T14:34:00Z", { service: "ai_enrichment", credits: 50, isWaste: true, wasteReason: "failed_job", runExtId: "fd26115a-1", result: "failed" }),
  c("f2", "2026-09-26T14:36:00Z", { service: "ai_enrichment", credits: 27, isWaste: true, wasteReason: "failed_job", runExtId: "4a3c811e-2", result: "failed" }),
  c("u1", "2026-09-26T14:09:00Z", { credits: 14, isWaste: true, wasteReason: "no_change", runExtId: "lm-1", result: "unreadable" }),
  c("s1", "2026-09-26T15:40:00Z", { service: "studio_copilot", credits: 24, isWaste: true, wasteReason: "agent_side_effect", method: "time_window", result: "side_effect" }),
  c("o1", "2026-09-26T09:11:00Z", { service: "studio_global", credits: 860, method: "time_window", result: "unknown" }),
];
const runs: Run[] = [
  { extId: "fd26115a-1", kind: "ai_enrichment_job", actionName: "AI enrichment", startedAt: null, completedAt: null, status: "failed", source: "poll", recordsOk: 0, recordsFailed: 10 },
  { extId: "4a3c811e-2", kind: "ai_enrichment_job", actionName: "AI enrichment", startedAt: null, completedAt: null, status: "failed", source: "poll", recordsOk: 0, recordsFailed: 1 },
];
const ctx = { onboardingUnused: true, unusedDocs: 23, advisorPosts: ["2026-09-26T20:57:37Z"] };

describe("weeklySpend", () => {
  it("returns 8 weeks oldest first with waste split out", () => {
    const w = weeklySpend(charges, "2026-09-27T12:00:00Z");
    expect(w).toHaveLength(8);
    expect(w[7]).toMatchObject({ credits: 975, waste: 115 });
    expect(w[0].credits + w[1].credits).toBe(500);
    expect(w.slice(0, 7).every((x) => x.waste === 0)).toBe(true);
  });
});

describe("recoveryItems", () => {
  const items = recoveryItems(charges, runs, ctx);
  it("gives every wasted or unused credit an owner", () => {
    expect(items.map((x) => [x.owner, x.credits])).toEqual([["usable", 860], ["refund", 14], ["refund", 77], ["stopped", 24]]);
    expect(items.find((x) => x.credits === 77)!.title).toBe("AI enrichment failed on 11 of 11 records and was still charged");
  });
  it("calls a side effect stopped only when a later automated post cost nothing", () => {
    expect(recoveryItems(charges, runs, { ...ctx, advisorPosts: [] }).find((x) => x.credits === 24)!.owner).toBe("stoppable");
  });
  it("writes a refund request from the refundable items", () => {
    const text = refundDraftFor(items.filter((x) => x.owner === "refund"), "org_x");
    expect(text).toContain("We were charged 91 credits for work that produced nothing usable:");
    expect(text).toContain("- AI enrichment failed on 11 of 11 records and was still charged: 77 credits (jobs fd26115a, 4a3c811e; Sep 26).");
    expect(text).toContain("Please refund the 91 credits. Org: org_x.");
  });
});

describe("claimState", () => {
  const a = (status: ActionRecord["status"], credits: number): ActionRecord => ({ extId: `refund:${status}`, kind: "refund_request", listId: null, pipelineId: null,
    appliedAt: "2026-09-27T00:00:00Z", status, previous: null, detail: { credits }, simulated: false });
  it("moves from found to requested to refunded", () => {
    expect(claimState([], 91)).toMatchObject({ found: 91, requested: 0, refunded: 0 });
    expect(claimState([a("requested", 91)], 91)).toMatchObject({ requested: 91, refunded: 0 });
    expect(claimState([a("refunded", 91)], 91)).toMatchObject({ requested: 91, refunded: 91 });
  });
});

describe("Recovery sentences", () => {
  it("states waste and what graph8 owes", () => expect(recoveryHeadline({ waste: 115, refundable: 91, periodLabel: "the last 8 weeks" })).toBe("115 credits bought nothing. graph8 owes you 91 of them."));
  it("handles no waste", () => expect(recoveryHeadline({ waste: 0, refundable: 0, periodLabel: "the last 30 days" })).toBe("Nothing was wasted in the last 30 days."));
  it("says when it happened", () => {
    expect(recoveryLede(["2026-09-26T14:34:00Z", "2026-09-26T15:40:00Z"])).toBe("All of it on Sep 26. Click a week to see what happened in it.");
    expect(recoveryLede(["2026-09-20T00:00:00Z", "2026-09-26T00:00:00Z"])).toBe("Spread over 2 days, Sep 20 to Sep 26. Click a week to see what happened in it.");
    expect(recoveryLede([])).toBeNull();
  });
});
