import { describe, it, expect } from "vitest";
import { recoveryItems, refundDraftFor, claimState, alsoRows } from "@/lib/dashboard/recovery";
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
  it("turns everything that isn't refundable into one quiet line each", () => {
    expect(alsoRows(items)).toEqual([
      { id: "unused", credits: 860, lead: "Still yours to use.", text: "23 onboarding documents nobody has used." },
      { id: "side_effect", credits: 24, lead: "Already stopped.", text: "Automated posts woke graph8's agent. No charges since." }]);
    expect(alsoRows(recoveryItems(charges, runs, { ...ctx, advisorPosts: [] })).find((x) => x.id === "side_effect"))
      .toEqual({ id: "side_effect", credits: 24, lead: "You can stop this.", text: "Automated posts woke graph8's agent. Post recaps only to #roi-advisor." });
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


