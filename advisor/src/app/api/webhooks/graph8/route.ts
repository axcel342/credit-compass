import { after } from "next/server";
import { verifyDelivery } from "@/lib/webhooks/verify";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.G8_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook secret not configured", { status: 500 });
  const raw = await req.text();
  const v = verifyDelivery(raw, req.headers, secret);
  if (!v.ok) return new Response(v.reason, { status: 401 });
  after(async () => {
    const { g8Caller } = await import("@/lib/g8/client");
    const { RecordStore } = await import("@/lib/store/records");
    const { handleEvent } = await import("@/lib/sync/handle-event");
    const result = await handleEvent(v.event, { c: g8Caller, outcomes: new RecordStore(g8Caller, "roi_outcome"), runs: new RecordStore(g8Caller, "roi_run") });
    console.log("graph8 webhook", v.event.event, result);
  });
  return new Response("ok");
}
