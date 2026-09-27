import { after } from "next/server";
import { verifyDelivery } from "@/lib/webhooks/verify";
import { workspaceStore } from "@/lib/workspace/store";
import { decrypt } from "@/lib/workspace/crypto";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ workspace: string }> }): Promise<Response> {
  const { workspace } = await params;
  const w = /^[0-9a-f-]{36}$/.test(workspace) ? await workspaceStore().get(workspace) : null;
  if (!w || !w.webhookSecretCipher) return new Response("not found", { status: 404 });
  const secret = decrypt(w.webhookSecretCipher, process.env.WORKSPACE_KEY_SECRET ?? "");
  const raw = await req.text();
  const v = verifyDelivery(raw, req.headers, secret);
  if (!v.ok) return new Response(v.reason, { status: 401 });
  after(async () => {
    const { callerFor } = await import("@/lib/g8/client");
    const { RecordStore } = await import("@/lib/store/records");
    const { handleEvent } = await import("@/lib/sync/handle-event");
    const c = callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? ""));
    await handleEvent(v.event, { c, outcomes: new RecordStore(c, "roi_outcome"), runs: new RecordStore(c, "roi_run") });
  });
  return new Response("ok");
}
