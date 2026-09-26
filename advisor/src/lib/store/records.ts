import type { G8Caller } from "../g8/client";
import { isConflict } from "../g8/client";
import { OPS } from "../g8/ops";

export interface StoredRecord { id: string; values: Record<string, unknown> }
const PAGE = 200;

export class RecordStore {
  private index: Map<string, string> | null = null;
  constructor(private c: G8Caller, private slug: string) {}

  async list(): Promise<StoredRecord[]> {
    const all: StoredRecord[] = [];
    for (let page = 1; ; page++) {
      const rows = await this.c.call<StoredRecord[]>(OPS.listRecords, { path: { object_slug: this.slug }, query: { page, limit: PAGE } });
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    this.index = new Map(all.filter((r) => typeof r.values.ext_id === "string").map((r) => [r.values.ext_id as string, r.id]));
    return all;
  }

  async upsert(values: Record<string, unknown>): Promise<{ id: string; created: boolean }> {
    const ext = values.ext_id;
    if (typeof ext !== "string" || !ext) throw new Error(`upsert into ${this.slug} needs a string ext_id`);
    if (!this.index) await this.list();
    const known = this.index!.get(ext);
    if (known) { await this.patch(known, values); return { id: known, created: false }; }
    try {
      const rec = await this.c.call<StoredRecord>(OPS.createRecord, { path: { object_slug: this.slug }, body: { values } });
      this.index!.set(ext, rec.id);
      return { id: rec.id, created: true };
    } catch (e) {
      if (!isConflict(e)) throw e;
      await this.list();
      const id = this.index!.get(ext);
      if (!id) throw e;
      await this.patch(id, values);
      return { id, created: false };
    }
  }

  private async patch(id: string, values: Record<string, unknown>): Promise<void> {
    const { ext_id: _ignored, ...rest } = values;
    await this.c.call(OPS.updateRecord, { path: { object_slug: this.slug, record_id: id }, body: { values: rest } });
  }
}
