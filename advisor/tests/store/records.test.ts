import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { ensureSchema, OBJECTS } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";

describe("store", () => {
  it("creates all five objects and their attributes once", async () => {
    const c = new FakeG8();
    const first = await ensureSchema(c);
    expect(first.createdObjects).toEqual(OBJECTS.map((o) => o.slug));
    expect((await ensureSchema(c)).createdAttributes).toEqual([]);
  });
  it("upserts by ext_id: create, then update, and survives a 409 race", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    const s = new RecordStore(c, "roi_charge");
    expect(await s.upsert({ ext_id: "a", credits: 1 })).toMatchObject({ created: true });
    expect(await s.upsert({ ext_id: "a", credits: 2 })).toMatchObject({ created: false });
    const other = new RecordStore(c, "roi_charge"); // stale index: doesn't know "b"
    await s.upsert({ ext_id: "b", credits: 1 });
    await other.list(); await s.upsert({ ext_id: "c", credits: 1 });
    const stale = new RecordStore(c, "roi_charge");
    (stale as unknown as { index: Map<string, string> | null }).index = new Map();
    expect(await stale.upsert({ ext_id: "b", credits: 9 })).toMatchObject({ created: false });
    const recs = await s.list();
    expect(recs).toHaveLength(3);
    expect(recs.find((r) => r.values.ext_id === "b")?.values.credits).toBe(9);
  });
  it("pages through more than 200 records", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    const s = new RecordStore(c, "roi_outcome");
    for (let i = 0; i < 450; i++) await s.upsert({ ext_id: `o${i}` });
    expect(await new RecordStore(c, "roi_outcome").list()).toHaveLength(450);
  });
});
