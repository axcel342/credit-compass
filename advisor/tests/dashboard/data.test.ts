import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { chargeToValues, outcomeToValues, statToValues } from "@/lib/store/mappers";
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import type { AttributedCharge, Stat } from "@/lib/domain/types";

const ch = (id: string, at: string, p: Partial<AttributedCharge> = {}): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits: 100, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: "r", listId: 15, contactId: 1,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const st = (period: string, credits: number): Stat => ({ period, dimension: "org", value: "all", credits, creditsExact: credits, meetings: 1, deals: 0, wonValue: 0,
  contactsReached: 1, costPerMeeting: credits, costPerDeal: null, vsAvgPct: null, evidenceN: 1, confidence: "low", simulated: false, computedAt: "2026-09-27T00:00:00Z" });

async function seeded() {
  const g = new FakeG8();
  g.handlers.set(OPS.listLists, () => [{ id: 15, title: "[sim] Sales VPs", total: 20 }]);
  await ensureSchema(g);
  const charges = new RecordStore(g, "roi_charge");
  await charges.upsert(chargeToValues(ch("old", "2026-08-10T00:00:00Z")));
  await charges.upsert(chargeToValues(ch("new", "2026-09-20T00:00:00Z", { simulated: true })));
  await new RecordStore(g, "roi_outcome").upsert(outcomeToValues({ extId: "m1", type: "meeting_booked", occurredAt: "2026-09-21T00:00:00Z", contactId: 1,
    companyId: null, dealId: null, amount: null, listId: 15, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true }));
  const stats = new RecordStore(g, "roi_stat");
  await stats.upsert(statToValues(st("8w", 200)));
  await stats.upsert(statToValues(st("30d", 100)));
  return g;
}

describe("loadDashboardData + periodView", () => {
  it("loads one dataset and flags demo data", async () => {
    const d = await loadDashboardData(await seeded());
    expect(d.charges).toHaveLength(2);
    expect(d.hasDemoData).toBe(true);
    expect(d.listNames.get("15")).toBe("Sales VPs");
  });
  it("narrows charges, stats and buckets to the period", async () => {
    const d = await loadDashboardData(await seeded());
    const v8 = periodView({ ...d, now: "2026-09-27T00:00:00Z" }, "8w"), v30 = periodView({ ...d, now: "2026-09-27T00:00:00Z" }, "30d");
    expect(v8.charges.map((c) => c.ledgerId)).toEqual(["old", "new"]);
    expect(v30.charges.map((c) => c.ledgerId)).toEqual(["new"]);
    expect(v8.org?.credits).toBe(200);
    expect(v30.org?.credits).toBe(100);
    expect(v8.buckets.booked).toBe(200);
    expect(v8.coverage.total).toBe(200);
    expect(v8.meetings).toBe(1);
  });
  it("sums won deal value inside the period", async () => {
    const g = await seeded();
    const oc = new RecordStore(g, "roi_outcome");
    const won = (extId: string, at: string, amount: number | null) => outcomeToValues({ extId, type: "deal_won", occurredAt: at, contactId: 1, companyId: null,
      dealId: extId, amount, listId: null, sequenceId: null, step: null, channel: null, segmentKey: null, source: "poll", simulated: true });
    await oc.upsert(won("d1", "2026-09-22T00:00:00Z", 12000));
    await oc.upsert(won("d2", "2026-08-05T00:00:00Z", 6000));
    await oc.upsert(won("d3", "2026-09-23T00:00:00Z", null));
    const d = { ...(await loadDashboardData(g)), now: "2026-09-27T00:00:00Z" };
    expect(periodView(d, "8w").wonValue).toBe(18000);
    expect(periodView(d, "8w").won).toBe(3);
    expect(periodView(d, "30d").wonValue).toBe(12000);
  });
});
