import { describe, it, expect } from "vitest";
import { doNextItems } from "@/lib/dashboard/donext";
import type { Finding } from "@/lib/domain/types";

const f = (kind: Finding["kind"], stake: number, body: string, confidence: Finding["confidence"] = "high"): Finding => ({ extId: `${kind}|x|8w`, kind, title: kind, body,
  evidence: {}, creditsAtStake: stake, confidence, status: "open", snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null,
  firstSeen: "2026-09-27T00:00:00Z", lastSeen: "2026-09-27T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false });

describe("doNextItems", () => {
  it("orders by credits at stake weighted by confidence and gives each a button that says what it does", () => {
    const items = doNextItems([f("waste", 77, "A"), f("cut", 4931, "B", "medium"), f("scale", 2108, "C"), f("unused", 860, "D", "medium"), f("fix", 13, "E")]);
    expect(items.map((x) => [x.text, x.label, x.href])).toEqual([
      ["B", "See how to cut it", "/optimize#move-spend"], ["C", "Build a lookalike list", "/optimize#move-spend"],
      ["D", "See it in Recovery", "/recovery"], ["A", "Request a refund", "/recovery#claim"]]);
    expect(items[0].sub).toBe("4,931 credits at stake");
  });
  it("skips kinds that have nothing to do", () => expect(doNextItems([f("what_worked", 0, "x"), f("traceability", 50, "y")])).toEqual([]));
});
