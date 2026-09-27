import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { bootstrapOrg } from "../src/lib/workspace/bootstrap";

const objects = await g8Caller.call<{ slug: string }[]>(OPS.listObjects);
if (objects.some((o) => o.slug === "roi_probe") && process.argv.includes("--archive-probe")) {
  await g8Caller.call(OPS.archiveObject, { path: { object_slug: "roi_probe" } });
  console.log("archived roi_probe");
}
const base = process.env.ADVISOR_URL;
if (!base) throw new Error("Set ADVISOR_URL in .env.local");
console.log(JSON.stringify(await bootstrapOrg(g8Caller, { webhookUrl: `${base}/api/webhooks/graph8` })));
