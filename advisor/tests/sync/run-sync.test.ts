import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { findingToValues, runToValues } from "@/lib/store/mappers";
import { runSync } from "@/lib/sync/run-sync";
import { loadDesignInput } from "../helpers/design-fixture";
import { loadFixture } from "../fixtures";

async function designDayClient() {
  const c = new FakeG8(); await ensureSchema(c);
  const input = loadDesignInput();
  const runs = new RecordStore(c, "roi_run");
  for (const r of input.runs) await runs.upsert(runToValues(r));
  for (const p of input.advisorPosts) await runs.upsert(runToValues({ extId: `post:${p}`, kind: "advisor_post", actionName: "Recap post", startedAt: p, completedAt: p, status: "completed", source: "advisor" }));
  const newestFirst = [...input.ledger].reverse();
  c.handlers.set(OPS.listUsageTransactions, (i) => newestFirst.slice((Number(i.query?.page) - 1) * 100, Number(i.query?.page) * 100));
  c.handlers.set(OPS.listLists, () => []);
  c.handlers.set(OPS.documentsAnalytics, () => loadFixture<{ data: unknown }>("graph8/studio_documents_analytics.json").data);
  c.handlers.set(OPS.listResearchReports, () => loadFixture<{ data: unknown }>("graph8/research_reports.json").data);
  c.handlers.set(OPS.listLandingPages, () => loadFixture<{ data: unknown }>("graph8/landing_pages.json").data);
  c.handlers.set(OPS.listDealPipelines, () => []);
  c.handlers.set(OPS.listDeals, () => []);
  return c;
}

describe("runSync", () => {
  it("reproduces the design-day coverage and waste end to end", async () => {
    const c = await designDayClient();
    const summary = await runSync({ c, now: "2026-10-04T00:00:00Z", contacts: new Map() });
    expect(summary.coverage).toEqual({ exact: 216, window: 1033, none: 11, total: 1260 });
    expect(summary.charges).toBe(126);
    const findings = await new RecordStore(c, "roi_finding").list();
    expect(findings.map((f) => f.values.kind)).toEqual(expect.arrayContaining(["waste", "side_effect", "fix", "unused"]));
    const again = await runSync({ c, now: "2026-10-04T00:10:00Z", contacts: new Map() });
    expect(again.newLedgerRows).toBe(0);
  });

  it("marks a stale finding as applied once its fresh cause disappears", async () => {
    const c = await designDayClient();
    const findings = new RecordStore(c, "roi_finding");
    await findings.upsert(findingToValues({
      extId: "cut|list:999|30d", kind: "cut", title: "Stale finding", body: "No longer generated", evidence: {}, creditsAtStake: 10,
      confidence: "high", status: "open", snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null,
      firstSeen: "2026-09-01T00:00:00Z", lastSeen: "2026-09-01T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false,
    }));
    await runSync({ c, now: "2026-10-04T00:00:00Z", contacts: new Map() });
    const stored = (await findings.list()).find((r) => r.values.ext_id === "cut|list:999|30d");
    expect(stored?.values.status).toBe("applied");
  });

  it("keeps a dismissed stale finding dismissed instead of applying it", async () => {
    const c = await designDayClient();
    const findings = new RecordStore(c, "roi_finding");
    await findings.upsert(findingToValues({
      extId: "cut|list:998|30d", kind: "cut", title: "Dismissed finding", body: "No longer generated", evidence: {}, creditsAtStake: 10,
      confidence: "high", status: "dismissed", snoozedUntil: "2026-12-01T00:00:00Z", dismissCount: 1, action: null, actionPayload: null,
      firstSeen: "2026-09-01T00:00:00Z", lastSeen: "2026-09-01T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false,
    }));
    await runSync({ c, now: "2026-10-04T00:00:00Z", contacts: new Map() });
    const stored = (await findings.list()).find((r) => r.values.ext_id === "cut|list:998|30d");
    expect(stored?.values.status).toBe("dismissed");
    expect(stored?.values.snoozed_until).toBe("2026-12-01T00:00:00Z");
  });

  it("caches each contact's fit and only rewrites contacts that changed", async () => {
    const g = await designDayClient();
    const mk = (id: number, consistency: "ok" | "flagged" | "unknown") => ({ contactId: id, name: `c${id}`, email: consistency === "unknown" ? null : `c${id}@x.com`,
      companyName: null, companyDomain: null, listIds: [13], sequenceIds: [], segmentKey: "Vice President|Sales|Software|51-200", consistency });
    const contacts = new Map([[66, mk(66, "flagged")], [81, mk(81, "ok")], [249, mk(249, "unknown")]]);
    await runSync({ c: g, now: "2026-09-27T00:00:00Z", contacts });
    const rows = g.objects.get("roi_contact")!.records;
    expect(rows.length).toBe(contacts.size);
    expect(rows.every((r) => ["high", "medium", "low", "unknown"].includes(String(r.values.fit)))).toBe(true);
    const writes = () => g.calls.filter((x) => x.input.path?.object_slug === "roi_contact" && x.op !== "list_object_records_objects__object_slug__records_get").length;
    const before = writes();
    await runSync({ c: g, now: "2026-09-27T00:10:00Z", contacts });
    expect(writes()).toBe(before);
  });
});
