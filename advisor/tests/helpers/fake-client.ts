import { G8Error } from "@graph8/sdk";
import type { CallInput, G8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";

export class FakeG8 implements G8Caller {
  objects = new Map<string, { attrs: Set<string>; unique: Set<string>; records: { id: string; values: Record<string, unknown> }[] }>();
  calls: { op: string; input: CallInput }[] = [];
  handlers = new Map<string, (i: CallInput) => unknown>();
  private seq = 0;

  async callRaw<T>(op: string, input: CallInput = {}): Promise<T> { return this.call<T>(op, input); }
  async call<T>(op: string, input: CallInput = {}): Promise<T> {
    this.calls.push({ op, input });
    const h = this.handlers.get(op);
    if (h) return h(input) as T;
    const slug = String(input.path?.object_slug ?? "");
    const body = (input.body ?? {}) as Record<string, unknown>;
    switch (op) {
      case OPS.listObjects: return [...this.objects.keys()].map((s) => ({ slug: s })) as T;
      case OPS.createObject: this.objects.set(String(body.slug), { attrs: new Set(), unique: new Set(), records: [] }); return {} as T;
      case OPS.listAttributes: return [...(this.objects.get(slug)?.attrs ?? [])].map((s) => ({ slug: s })) as T;
      case OPS.createAttribute: { const o = this.objects.get(slug)!; o.attrs.add(String(body.slug)); if (body.is_unique) o.unique.add(String(body.slug)); return {} as T; }
      case OPS.listRecords: {
        const recs = this.objects.get(slug)?.records ?? [];
        const page = Number(input.query?.page ?? 1), limit = Number(input.query?.limit ?? 200);
        return recs.slice((page - 1) * limit, page * limit) as T;
      }
      case OPS.createRecord: {
        const o = this.objects.get(slug)!, values = (body.values ?? {}) as Record<string, unknown>;
        for (const u of o.unique) if (values[u] !== undefined && o.records.some((r) => r.values[u] === values[u]))
          throw new G8Error({ message: "a record already has this value", status: 409, type: "conflict", code: "duplicate_active_value" });
        const rec = { id: `r${++this.seq}`, values: { ...values } }; o.records.push(rec); return rec as T;
      }
      case OPS.updateRecord: {
        const rec = this.objects.get(slug)!.records.find((r) => r.id === input.path?.record_id)!;
        Object.assign(rec.values, (body.values ?? {}) as Record<string, unknown>); return rec as T;
      }
      default: throw new Error(`FakeG8: no handler for ${op}`);
    }
  }
}
