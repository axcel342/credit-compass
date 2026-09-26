import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { pollDealOutcomes, outcomeFromEvent } from "@/lib/sync/outcomes";
import { loadFixture } from "../fixtures";

const won = loadFixture<{ data: Record<string, unknown> }>("graph8/deal_won.json").data;
const wonHist = loadFixture<{ data: { items: unknown[] } }>("graph8/deal_history_won.json").data;
const lostHist = loadFixture<{ data: { items: unknown[] } }>("graph8/deal_history_lost.json").data;
const stages = [{ id: "p", stages: [{ name: "Closed Won", stage_type: "won" }, { name: "Closed Lost", stage_type: "lost" }, { name: "New Meeting", stage_type: "open" }] }];

describe("pollDealOutcomes", () => {
  it("turns deal history into created / stage-changed / won / lost outcomes", async () => {
    const c = new FakeG8();
    const lost = { ...won, id: "9ff5c6ee-10ea-455e-966f-3a831765500a", name: "[sim] seed probe - PayLease", amount: 8000, primary_contact: { id: 77 } };
    c.handlers.set(OPS.listDealPipelines, () => stages);
    c.handlers.set(OPS.listDeals, (i) => (Number(i.query?.page) === 1 ? [won, lost] : []));
    c.handlers.set(OPS.listDealHistory, (i) => (i.path?.deal_id === won.id ? wonHist : lostHist));
    const out = await pollDealOutcomes(c, new Map());
    const types = out.map((o) => o.type).sort();
    // won deal: created + 1 stage move + won; lost deal (real history has 3 moves): created + 3 stage moves + lost
    expect(types).toEqual(["deal_created", "deal_created", "deal_lost", "deal_stage_changed", "deal_stage_changed", "deal_stage_changed", "deal_stage_changed", "deal_won"].sort());
    expect(out.find((o) => o.type === "deal_won")).toMatchObject({ amount: 12000, contactId: 81, simulated: true, source: "poll" });
  });
});

describe("outcomeFromEvent", () => {
  it("maps a meeting.booked envelope and keeps the envelope id", () => {
    const o = outcomeFromEvent({ id: "evt_9", event: "meeting.booked", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: { contact_id: 81, simulated: true } });
    expect(o).toMatchObject({ extId: "evt_9", type: "meeting_booked", contactId: 81, simulated: true, source: "sim" });
  });
  it("ignores events that aren't outcomes", () =>
    expect(outcomeFromEvent({ id: "e", event: "task.created", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: {} })).toBeNull());
});

describe("pollDealOutcomes close_date handling", () => {
  function fakeFor(deal: Record<string, unknown>) {
    const c = new FakeG8();
    c.handlers.set(OPS.listDealPipelines, () => stages);
    c.handlers.set(OPS.listDeals, (i) => (Number(i.query?.page) === 1 ? [deal] : []));
    c.handlers.set(OPS.listDealHistory, () => wonHist);
    return c;
  }
  it("uses noon UTC when close_date is date-only", async () => {
    const out = await pollDealOutcomes(fakeFor({ ...won, close_date: "2026-09-25" }), new Map());
    expect(out.find((o) => o.type === "deal_won")!.occurredAt).toBe("2026-09-25T12:00:00Z");
  });
  it("keeps a full ISO close_date unchanged", async () => {
    const out = await pollDealOutcomes(fakeFor({ ...won, close_date: "2026-09-26T00:00:00Z" }), new Map());
    expect(out.find((o) => o.type === "deal_won")!.occurredAt).toBe("2026-09-26T00:00:00Z");
  });
});
