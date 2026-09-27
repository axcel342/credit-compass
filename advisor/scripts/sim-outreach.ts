// Writes .sim-outreach.json. Send with: npm run script scripts/sim-events.ts .sim-outreach.json
import fs from "node:fs";
import { g8Caller as c } from "../src/lib/g8/client";
import { loadDashboardData } from "../src/lib/dashboard/data";
import { meetingsByContact, emailsByContact } from "../src/lib/domain/buckets";
import { toMs } from "../src/lib/domain/time";
import type { WebhookEnvelope } from "../src/lib/webhooks/verify";

const SHARE = 60, DAY = 86_400_000;
const d = await loadDashboardData(c);
const met = meetingsByContact(d.outcomes), emailed = emailsByContact(d.outcomes);
const first = new Map<number, { t: number; listId: number | null; credits: number }>();
for (const x of d.charges) {
  if (!x.simulated || x.contactId === null || x.service !== "waterfall_enrichment") continue;
  const t = toMs(x.chargedAt), f = first.get(x.contactId);
  first.set(x.contactId, { t: Math.min(t, f?.t ?? t), listId: f?.listId ?? x.listId, credits: (f?.credits ?? 0) + x.credits });
}
const open = [...first].filter(([id]) => !met.has(id) && !emailed.has(id));
const chosen = open.filter(([id]) => ((id * 2654435761) >>> 0) % 100 < SHARE);
const now = Date.now();
const events: WebhookEnvelope[] = chosen.map(([id, f]) => ({ id: `sim-outreach-${id}`, event: "engagement.email_sent", org_id: "sim",
  timestamp: new Date(Math.min(f.t + (2 + (id % 5)) * DAY, now - DAY)).toISOString(),
  data: { contact_id: id, list_id: f.listId, simulated: true, step: 1, channel: "email" } }));
fs.writeFileSync(".sim-outreach.json", JSON.stringify({ events }, null, 1));
console.log(JSON.stringify({ contactsWithoutOutreach: open.length, emailed: events.length, creditsMovingToEmailed: Math.round(chosen.reduce((s, [, f]) => s + f.credits, 0)) }));
