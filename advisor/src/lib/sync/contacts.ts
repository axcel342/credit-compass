import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { ContactInfo } from "../domain/types";
import { recordConsistency, segmentKey } from "../domain/segments";
import { mapLimit } from "../util/concurrency";

export interface ContactRow { id: number; first_name: string | null; last_name: string | null }
interface ContactDetail { work_email: string | null; job_title: string | null; seniority_level: string | null; job_department: string | null;
  company?: { name: string | null; domain: string | null; industry: string | null; employee_count: string | null } | null }

export async function loadContactInfo(c: G8Caller, row: ContactRow): Promise<ContactInfo> {
  const d = await c.call<ContactDetail>(OPS.getContact, { path: { contact_id: row.id } });
  const lists = await c.call<{ items: { audience_id: number }[] }>(OPS.getContactLists, { path: { contact_id: row.id } });
  const seqs = await c.call<{ items: { sequence_id?: string; id?: string }[] }>(OPS.getContactSequences, { path: { contact_id: row.id } });
  return {
    contactId: row.id, name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(), email: d.work_email, companyName: d.company?.name ?? null,
    companyDomain: d.company?.domain ?? null, listIds: (lists.items ?? []).map((l) => l.audience_id),
    sequenceIds: (seqs.items ?? []).map((q) => String(q.sequence_id ?? q.id)).filter((x) => x !== "undefined"),
    segmentKey: segmentKey({ seniority: d.seniority_level, department: d.job_department, industry: d.company?.industry, employeeCount: d.company?.employee_count }),
    consistency: recordConsistency(d.work_email, d.company?.domain ?? null),
  };
}

export async function loadContactIndex(c: G8Caller): Promise<Map<number, ContactInfo>> {
  const rows: ContactRow[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<ContactRow[]>(OPS.listContacts, { query: { page, limit: 200 } });
    rows.push(...r);
    if (r.length < 200) break;
  }
  const infos = await mapLimit(rows, 10, (row) => loadContactInfo(c, row));
  return new Map(infos.map((info) => [info.contactId, info]));
}
