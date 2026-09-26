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
    console.log("graph8 webhook", JSON.stringify({ id: v.event.id, event: v.event.event, data: v.event.data }));
  });
  return new Response("ok");
}
