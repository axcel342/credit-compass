import { g8Caller } from "@/lib/g8/client";
import { runSync } from "@/lib/sync/run-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const summary = await runSync({ c: g8Caller });
  return Response.json(summary);
}
