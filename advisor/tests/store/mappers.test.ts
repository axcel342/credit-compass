import { describe, it, expect } from "vitest";
import { attributeCharges } from "@/lib/domain/attribution";
import { chargeToValues, valuesToCharge, findingToValues, valuesToFinding, runToValues, valuesToRun, ledgerFromCharge, contactToValues, valuesToContact } from "@/lib/store/mappers";
import type { ContactCacheRow } from "@/lib/domain/types";
import { loadDesignInput } from "../helpers/design-fixture";

const input = loadDesignInput();
const charges = attributeCharges(input);

describe("mappers", () => {
  it("round-trips a charge", () => expect(valuesToCharge(chargeToValues(charges[0]))).toEqual(charges[0]));
  it("round-trips a run with contact IDs", () => {
    const r = input.runs.find((x) => x.contactIds?.length)!;
    expect(valuesToRun(runToValues(r))).toMatchObject({ extId: r.extId, contactIds: r.contactIds, kind: r.kind });
  });
  it("rebuilds the ledger row a charge came from", () => {
    const row = ledgerFromCharge(charges[0]);
    expect(row).toMatchObject({ id: charges[0].ledgerId, type: "usage", amount: -charges[0].credits });
  });
  it("round-trips a finding including JSON evidence", () => {
    const f = { extId: "waste|failed_job|30d", kind: "waste" as const, title: "t", body: "b", evidence: { runs: ["x"] }, creditsAtStake: 77, confidence: "high" as const,
      status: "open" as const, snoozedUntil: null, dismissCount: 0, action: "Refund request", actionPayload: { reason: "failed_job" }, firstSeen: "2026-10-04T00:00:00.000Z",
      lastSeen: "2026-10-04T00:00:00.000Z", lastNotifiedStake: null, inRecap: false, simulated: false };
    expect(valuesToFinding(findingToValues(f))).toEqual(f);
  });
});

describe("contact cache mappers", () => {
  it("round-trips a cached contact", () => {
    const r: ContactCacheRow = { contactId: 66, listIds: [2, 13], hasEmail: true, consistency: "flagged", segmentKey: "a|b|c|d", fit: "low", fitLevel: null, syncedAt: "2026-09-27T00:00:00Z" };
    expect(valuesToContact(contactToValues(r))).toEqual(r);
    expect(contactToValues(r).ext_id).toBe("66");
  });
});
