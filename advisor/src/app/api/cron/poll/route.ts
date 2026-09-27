import { runSync } from "@/lib/sync/run-sync";
import { forEachWorkspace } from "@/lib/workspace/fanout";
import { workspaceStore } from "@/lib/workspace/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  return Response.json(await forEachWorkspace((ws) => runSync({ c: ws.caller }), workspaceStore()));
}
