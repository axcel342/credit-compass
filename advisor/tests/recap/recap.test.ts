import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { buildRecapBlocks, postRecap } from "@/lib/recap/recap";
import type { Finding } from "@/lib/domain/types";

const f = (title: string, body: string): Finding => ({ extId: title, kind: "waste", title, body, evidence: {}, creditsAtStake: 77, confidence: "high", status: "open",
  snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null, firstSeen: "2026-09-26T00:00:00Z", lastSeen: "2026-09-26T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false });

describe("recap", () => {
  it("builds a bold headline and one numbered line per item (max 3)", () => {
    const blocks = buildRecapBlocks({ spendThisWeek: 2900, meetingsThisWeek: 11, items: [f("a", "A"), f("b", "B"), f("c", "C")], simulated: true });
    expect(blocks[0].content[0]).toMatchObject({ text: "Last week: 2,900 credits → 11 meetings (264 each) [sim]", marks: [{ type: "bold" }] });
    expect(blocks.slice(1).map((b) => b.content[0].text)).toEqual(["1. A", "2. B", "3. C"]);
  });
  it("posts document blocks to the roi-advisor channel only", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.createWorkMessage, () => ({ id: "m1" }));
    await postRecap(c, buildRecapBlocks({ spendThisWeek: 1, meetingsThisWeek: 0, items: [f("a", "A")], simulated: false }), "roi-advisor");
    expect(c.calls[0].input.body).toMatchObject({ channel: "roi-advisor", document: { version: 1 } });
    await expect(postRecap(c, [], "work")).rejects.toThrow(/roi-advisor/);
  });
});
