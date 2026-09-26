import { describe, it, expect } from "vitest";
import { attributeCharges } from "@/lib/domain/attribution";
import { buildRefundDraft } from "@/lib/recovery/refund";
import { loadDesignInput } from "../helpers/design-fixture";

const charges = attributeCharges(loadDesignInput());
describe("buildRefundDraft", () => {
  it("drafts the real 77-credit refund with evidence", () => {
    const d = buildRefundDraft({ orgId: "org_5e2170609156", charges, reason: "failed_job" })!;
    expect(d.credits).toBe(77);
    expect(d.ledgerIds).toHaveLength(15);
    expect(d.message).toContain("77 credits");
    expect(d.message).toContain("fd26115a-92e4-4ab7-9195-36cbc224550f");
    expect(d.message).toContain("org_5e2170609156");
  });
  it("returns null when there is nothing to recover", () => expect(buildRefundDraft({ orgId: "o", charges: [], reason: "failed_job" })).toBeNull());
});
