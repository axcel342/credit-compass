import { describe, it, expect } from "vitest";
import { rateTables, classifyWithBackoff } from "@/lib/domain/fit";
import { classifyFit } from "@/lib/domain/prespend";
import type { AttributedCharge, ContactInfo, Outcome } from "@/lib/domain/types";

const info = (id: number, seg: string, consistency: ContactInfo["consistency"] = "ok", lists = [2]): ContactInfo => ({ contactId: id, name: `c${id}`,
  email: `c${id}@x.com`, companyName: null, companyDomain: null, listIds: lists, sequenceIds: [], segmentKey: seg, consistency });
const charge = (contactId: number): AttributedCharge => ({ ledgerId: `l${contactId}`, ledgerType: "usage", service: "waterfall_enrichment", credits: 3,
  chargedAt: "2026-09-01T00:00:00Z", llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: 2, contactId,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: true });
const meeting = (contactId: number): Outcome => ({ extId: `m${contactId}`, type: "meeting_booked", occurredAt: "2026-09-10T00:00:00Z", contactId, companyId: null,
  dealId: null, amount: null, listId: 2, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });

// 12 contacts, every 4-part segment unique (the real org's shape): VPs in Sales book often, Individual Contributors never.
const contacts = new Map<number, ContactInfo>();
for (let i = 1; i <= 6; i++) contacts.set(i, info(i, `Vice President|Sales|Industry${i}|51-200`));
for (let i = 7; i <= 12; i++) contacts.set(i, info(i, `Individual Contributor|Engineering|Industry${i}|1-10`));
contacts.set(13, info(13, "Director|Sales|Other|51-200", "flagged"));
const charges = [...contacts.keys()].map(charge);
const outcomes = [1, 2, 3, 4].map(meeting);
const t = rateTables(charges, outcomes, contacts);

describe("fit", () => {
  it("reproduces the bug: with one contact per segment the old classifier says unknown for everyone not flagged", () => {
    const orgRate = 4 / 13;
    expect([...contacts.values()].filter((c) => c.consistency !== "flagged").map((c) => classifyFit({ rate: 0, orgRate, n: 1, consistency: c.consistency })))
      .toEqual(Array(12).fill("unknown"));
  });
  it("backs off to role when the segment is too small", () => {
    expect(classifyWithBackoff(contacts.get(1)!, t)).toEqual({ fit: "high", level: "role" });
    expect(classifyWithBackoff(contacts.get(7)!, t)).toEqual({ fit: "low", level: "role" });
  });
  it("keeps flagged records low whatever their group does", () => expect(classifyWithBackoff(contacts.get(13)!, t)).toEqual({ fit: "low", level: null }));
  it("falls back to the list, then says medium at org level, and unknown with no meetings anywhere", () => {
    const lone = info(99, "Director|Finance|X|1-10", "ok", [2]);
    expect(classifyWithBackoff(lone, t).level).toBe("list");
    const empty = rateTables(charges, [], contacts);
    expect(classifyWithBackoff(contacts.get(1)!, empty)).toEqual({ fit: "unknown", level: null });
  });
});
