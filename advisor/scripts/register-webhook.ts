import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";

const url = `${process.env.ADVISOR_URL}/api/webhooks/graph8`;
if (!process.env.ADVISOR_URL) throw new Error("Set ADVISOR_URL in .env.local");
const events = [
  "deal.created", "deal.updated", "deal.stage_changed", "deal.won", "deal.deleted",
  "workflow.execution_completed", "workflow.execution_failed",
  "enrichment.job_completed", "enrichment.job_failed",
  "engagement.email_sent", "engagement.email_replied", "engagement.email_bounced",
  "meeting.booked", "meeting.cancelled", "meeting.no_show",
];
const res = await g8Caller.call<{ id: string; secret: string }>(OPS.createWebhook, { body: { name: "ROI Advisor receiver", url, events } });

const envPath = path.join(import.meta.dirname, "..", ".env.local");
const line = `G8_WEBHOOK_SECRET=${res.secret}`;
let env = readFileSync(envPath, "utf8");
env = /^#?\s*G8_WEBHOOK_SECRET=.*$/m.test(env)
  ? env.replace(/^#?\s*G8_WEBHOOK_SECRET=.*$/m, line)
  : env.trimEnd() + "\n" + line + "\n";
writeFileSync(envPath, env);

console.log(`webhook id: ${res.id}`);
console.log("secret written to .env.local");
