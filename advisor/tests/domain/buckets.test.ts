import { describe, it, expect } from "vitest";
import { outcomeBucket, bucketTotals, meetingsByContact, BUCKETS } from "@/lib/domain/buckets";
import { attributeCharges } from "@/lib/domain/attribution";
import type { AttributedCharge, Outcome } from "@/lib/domain/types";
import { loadDesignInput } from "../helpers/design-fixture";

const charge = (p: Partial<AttributedCharge>): AttributedCharge => ({
  ledgerId: "l1", ledgerType: "usage", service: "waterfall_enrichment", credits: 10, chargedAt: "2026-09-01T10:00:00Z", llmTier: null,
  tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: null, contactId: null, segmentKey: null,
  explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const meeting = (contactId: number, at: string): Outcome => ({ extId: `m${contactId}${at}`, type: "meeting_booked", occurredAt: at, contactId, companyId: null,
  dealId: null, amount: null, listId: null, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });

const ctx = { meetingsByContact: meetingsByContact([meeting(7, "2026-09-10T00:00:00Z")]), onboardingUnused: true };

describe("outcomeBucket", () => {
  it("puts waste first, even when the contact later booked", () =>
    expect(outcomeBucket(charge({ contactId: 7, isWaste: true }), ctx)).toBe("waste"));
  it("marks onboarding research as never used only while the documents are unused", () => {
    const c = charge({ service: "studio_global", method: "time_window" });
    expect(outcomeBucket(c, ctx)).toBe("unused");
    expect(outcomeBucket(c, { ...ctx, onboardingUnused: false })).toBe("unknown");
  });
  it("counts a charge as booked only when the meeting came after it", () => {
    expect(outcomeBucket(charge({ contactId: 7, chargedAt: "2026-09-01T00:00:00Z" }), ctx)).toBe("booked");
    expect(outcomeBucket(charge({ contactId: 7, chargedAt: "2026-09-11T00:00:00Z" }), ctx)).toBe("nomeet");
  });
  it("puts list-only charges in no meeting yet and untied charges in can't tell", () => {
    expect(outcomeBucket(charge({ listId: 2 }), ctx)).toBe("nomeet");
    expect(outcomeBucket(charge({}), ctx)).toBe("unknown");
  });
});

describe("bucketTotals", () => {
  it("always adds up to total spend (real design-day ledger)", () => {
    const charges = attributeCharges(loadDesignInput());
    const totals = bucketTotals(charges, { meetingsByContact: new Map(), onboardingUnused: true });
    const sum = BUCKETS.reduce((s, b) => s + totals[b], 0);
    expect(sum).toBeCloseTo(charges.reduce((s, c) => s + c.credits, 0), 6);
    expect(totals.waste).toBe(115);
    expect(totals.unused).toBe(860);
  });
});
