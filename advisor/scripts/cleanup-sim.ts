import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { RecordStore } from "../src/lib/store/records";

const apply = process.argv.includes("--apply");
const deals: { id: string; name: string }[] = [];
for (let page = 1; ; page++) { const r = await c.call<{ id: string; name: string }[]>(OPS.listDeals, { query: { page, limit: 100 } }); deals.push(...r); if (r.length < 100) break; }
const simDeals = deals.filter((d) => d.name.startsWith("[sim]"));
const simRecords: [string, string][] = [];
for (const slug of ["roi_charge", "roi_outcome", "roi_stat", "roi_finding", "roi_run"])
  for (const r of await new RecordStore(c, slug).list()) if (r.values.simulated === true) simRecords.push([slug, r.id]);
const lists = (await c.call<{ id: number; title: string }[]>(OPS.listLists)).filter((l) => l.title.startsWith("[sim]"));
console.log(JSON.stringify({ simDeals: simDeals.length, simRecords: simRecords.length, simListsToReviewWithUser: lists }));
if (!apply) { console.log("Dry run. Re-run with --apply to delete the deals and records listed above. Lists are never deleted by this script."); process.exit(0); }
for (const d of simDeals) await c.call(OPS.deleteDeal, { path: { deal_id: d.id } });
for (const [slug, id] of simRecords) await c.call(OPS.archiveRecord, { path: { object_slug: slug, record_id: id } });
console.log(`deleted ${simDeals.length} deals, archived ${simRecords.length} records`);
