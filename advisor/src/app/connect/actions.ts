"use server";
import { cookies } from "next/headers";
import { connectWorkspace } from "@/lib/workspace/connector";
import { bootstrapOrg } from "@/lib/workspace/bootstrap";
import { callerFor } from "@/lib/g8/client";
import { workspaceStore } from "@/lib/workspace/store";
import { keyHash } from "@/lib/workspace/crypto";
import { signSession, WORKSPACE_COOKIE } from "@/lib/workspace/session";
import { runSync } from "@/lib/sync/run-sync";

export async function connect(_: unknown, form: FormData): Promise<{ ok: boolean; message: string; mcpToken?: string }> {
  const secret = process.env.WORKSPACE_KEY_SECRET, base = process.env.ADVISOR_URL;
  if (!secret || !process.env.SESSION_SECRET || !base) return { ok: false, message: "Connecting is not set up on this server yet (WORKSPACE_KEY_SECRET, SESSION_SECRET, ADVISOR_URL)." };
  const apiKey = String(form.get("apiKey") ?? "").trim();
  const known = apiKey ? await workspaceStore().findByKeyHash(keyHash(apiKey)) : null;
  if (known) {
    (await cookies()).set(WORKSPACE_COOKIE, signSession(known.id), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
    return { ok: true, message: `Welcome back ${known.orgName}. Your existing MCP token still works.` };
  }
  const r = await connectWorkspace(apiKey, {
    store: workspaceStore(), secret, now: new Date().toISOString(), makeCaller: callerFor,
    fetchMe: async (key) => { const res = await fetch("https://be.graph8.com/api/v1/me", { headers: { Authorization: `Bearer ${key}`, "User-Agent": "credit-compass" } });
      return { status: res.status, body: res.ok ? await res.json() : {} }; },
    bootstrap: (c, id) => bootstrapOrg(c, { webhookUrl: `${base}/api/webhooks/graph8/${id}` }),
  });
  if (!r.ok) return { ok: false, message: r.error };
  (await cookies()).set(WORKSPACE_COOKIE, signSession(r.workspace.id), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
  try { await runSync({ c: callerFor(apiKey) }); }
  catch { return { ok: false, message: "graph8 isn't answering right now. Try again in a minute." }; }
  return { ok: true, message: `Connected ${r.workspace.orgName}. Your first sync is done.`, mcpToken: r.mcpToken };
}
