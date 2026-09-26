import fs from "node:fs";
import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { RecordStore } from "../src/lib/store/records";
import { chargeToValues } from "../src/lib/store/mappers";
import { buildSimPlan } from "../src/lib/sim/plan";

type Row = { id: number; job_title: string | null; seniority_level: string | null; job_department: string | null };
const rows: Row[] = [];
for (let page = 1; ; page++) { const r = await c.call<Row[]>(OPS.getListContacts, { path: { list_id: 2 }, query: { page, limit: 200 } }); rows.push(...r); if (r.length < 200) break; }
const vps = rows.filter((r) => r.seniority_level === "Vice President").map((r) => r.id).slice(0, 20);
const founders = rows.filter((r) => /founder/i.test(r.job_title ?? "") && !vps.includes(r.id)).map((r) => r.id).slice(0, 20);
async function simList(title: string, ids: number[]): Promise<number> {
  const l = await c.call<{ id: number }>(OPS.createList, { body: { title, description: "[sim] demo list for ROI Advisor", type: "contacts" } });
  await c.call(OPS.addContactsToList, { path: { list_id: l.id }, body: { contact_ids: ids, conflict_resolution: "add_all" } });
  return l.id;
}
const vpList = await simList("[sim] Sales VPs", vps), founderList = await simList("[sim] Founders", founders);
const plan = buildSimPlan(20260926, new Date().toISOString(), [
  { id: vpList, label: "[sim] Sales VPs", contactIds: vps, costPerMeeting: 124, meetings: 17 },
  { id: founderList, label: "[sim] Founders", contactIds: founders, costPerMeeting: 433, meetings: 6 },
  { id: 2, label: "Starter list", contactIds: rows.slice(0, 30).map((r) => r.id), costPerMeeting: 1200, meetings: 4 },
]);
const charges = new RecordStore(c, "roi_charge");
for (const ch of plan.charges) await charges.upsert(chargeToValues(ch));
const STAGE = { new: "2df1e28d-344c-4940-8bc2-e456bfd874a8", discovery: "2e65b28e-5fc4-49f5-966e-5e8081a921c2", proposal: "3b1e986e-95e1-4179-ad02-2c93b228d5d3",
  won: "59e2345b-7d09-47fe-8ea8-a7e5cbb57437", lost: "3e17b0cb-e2cc-4cd5-993c-69d93858c866" };
const meetings = plan.events.filter((e) => e.event === "meeting.booked");
let made = 0;
for (const [i, m] of meetings.entries()) {
  const contactId = Number(m.data.contact_id), closeDate = m.timestamp.slice(0, 10);
  const deal = await c.call<{ id: string }>(OPS.createDeal, { body: { name: `[sim] deal ${i + 1}`, contact_ids: [contactId], owner_id: "mominimran000@gmail.com",
    amount: 6000 + (i % 5) * 3000, stage_id: STAGE.new, allow_duplicate: true, description: "[sim] ROI Advisor demo deal" } });
  await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.discovery } });
  if (i % 3 === 0) await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.won, close_date: closeDate } });
  else if (i % 3 === 1) await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.lost, close_date: closeDate, closed_lost_reason: "[sim] no budget" } });
  else await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.proposal } });
  made++;
}
fs.writeFileSync(".sim-plan.json", JSON.stringify({ lists: { vpList, founderList }, events: plan.events }, null, 1));
console.log(JSON.stringify({ vpList, founderList, simCharges: plan.charges.length, deals: made, events: plan.events.length }));
