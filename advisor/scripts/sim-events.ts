import fs from "node:fs";
import { createHmac } from "node:crypto";
import type { WebhookEnvelope } from "../src/lib/webhooks/verify";

const url = `${process.env.ADVISOR_URL}/api/webhooks/graph8`, secret = process.env.G8_WEBHOOK_SECRET;
if (!process.env.ADVISOR_URL || !secret) throw new Error("Set ADVISOR_URL and G8_WEBHOOK_SECRET in .env.local");
const file = process.argv[2] ?? ".sim-plan.json";
const { events } = JSON.parse(fs.readFileSync(file, "utf8")) as { events: WebhookEnvelope[] };
let ok = 0, failed = 0;
for (const e of events) {
  const body = JSON.stringify(e), ts = Math.floor(Date.now() / 1000);
  const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-studio-signature": sig, "x-studio-timestamp": String(ts) }, body });
  if (res.ok) ok++; else { failed++; console.error(e.id, res.status, await res.text()); }
  await new Promise((r) => setTimeout(r, 100));
}
console.log(JSON.stringify({ sent: ok, failed }));
