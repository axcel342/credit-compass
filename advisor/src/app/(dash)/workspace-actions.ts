"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPS } from "@/lib/g8/ops";
import { currentWorkspace } from "@/lib/workspace/current";
import { workspaceStore } from "@/lib/workspace/store";
import { WORKSPACE_COOKIE } from "@/lib/workspace/session";

export async function disconnect(): Promise<void> {
  const ws = await currentWorkspace();
  if (ws.demo) redirect("/");
  const w = await workspaceStore().get(ws.id);
  if (w?.webhookId) {
    try { await ws.caller.call(OPS.deleteWebhook, { path: { webhook_id: w.webhookId } }); }
    catch { throw new Error("Could not remove the webhook in graph8, so nothing was disconnected. Try again."); }
  }
  await workspaceStore().remove(ws.id);
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/connect");
}
