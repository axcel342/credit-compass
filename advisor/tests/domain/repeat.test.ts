import { describe, it, expect } from "vitest";
import { repeatEnrichment } from "@/lib/domain/repeat";
import type { AttributedCharge } from "@/lib/domain/types";

const c = (id: string, contactId: number | null, at: string, p: Partial<AttributedCharge> = {}): AttributedCharge => ({
  ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment", credits: 10, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null,
  description: null, method: "advisor", runExtId: null, listId: 15, contactId, segmentKey: null, explanation: "x", result: "success",
  isWaste: false, wasteReason: null, simulated: false, ...p });

describe("repeatEnrichment", () => {
  it("counts a second charge for the same contact and service within 30 days", () => {
    const r = repeatEnrichment([c("a", 1, "2026-09-01T00:00:00Z"), c("b", 1, "2026-09-20T00:00:00Z"), c("c", 2, "2026-09-02T00:00:00Z")]);
    expect(r).toMatchObject({ credits: 10, charges: 1, contacts: 1, ledgerIds: ["b"] });
    expect(r.byList.get(15)).toBe(10);
  });
  it("ignores repeats after the window, after a failed first attempt, and wasted repeats", () => {
    expect(repeatEnrichment([c("a", 1, "2026-07-01T00:00:00Z"), c("b", 1, "2026-09-01T00:00:00Z")]).charges).toBe(0);
    expect(repeatEnrichment([c("a", 1, "2026-09-01T00:00:00Z", { result: "failed" }), c("b", 1, "2026-09-02T00:00:00Z")]).charges).toBe(0);
    expect(repeatEnrichment([c("a", 1, "2026-09-01T00:00:00Z"), c("b", 1, "2026-09-02T00:00:00Z", { isWaste: true })]).charges).toBe(0);
  });
  it("ignores charges without a contact", () => expect(repeatEnrichment([c("a", null, "2026-09-01T00:00:00Z"), c("b", null, "2026-09-02T00:00:00Z")]).charges).toBe(0));
});
