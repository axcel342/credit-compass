import { randomBytes, randomUUID, createHash } from "node:crypto";
import { G8Error } from "@graph8/sdk";
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { encrypt, keyHash } from "./crypto";
import type { Workspace, WorkspaceStore } from "./store";

export const REQUIRED_READS: [string, string][] = [
  [OPS.listUsageTransactions, "can't see the credit ledger. Create a key with read access to usage"],
  [OPS.listLists, "can't read your lists. Create a key with read access to lists"],
  [OPS.listObjects, "can't read custom objects. Create a key with access to objects"],
  [OPS.listDeals, "can't read deals. Create a key with read access to deals"],
  [OPS.listWebhooks, "can't read webhooks. Create a key with access to webhooks"],
];

export function parseMe(body: unknown): { orgId: string | null; orgName: string | null } {
  const d = ((body as { data?: unknown })?.data ?? body ?? {}) as Record<string, any>;
  const orgId = d.org_id ?? d.organization_id ?? d.org?.id ?? d.organization?.id ?? d.user?.org_id ?? null;
  const orgName = d.org_name ?? d.organization_name ?? d.org?.name ?? d.organization?.name ?? null;
  return { orgId: orgId ? String(orgId) : null, orgName: orgName ? String(orgName) : null };
}

export interface ConnectDeps {
  store: WorkspaceStore; secret: string; now: string; makeCaller: (key: string) => G8Caller;
  fetchMe: (key: string) => Promise<{ status: number; body: unknown }>;
  bootstrap: (c: G8Caller, workspaceId: string) => Promise<{ webhookId: string; webhookSecret: string; fitColumnId: number; fitFieldName: string }>;
}

export async function connectWorkspace(raw: string, deps: ConnectDeps): Promise<{ ok: true; workspace: Workspace; mcpToken: string } | { ok: false; error: string }> {
  const key = raw.trim();
  if (!key) return { ok: false, error: "Paste an API key from graph8 → Settings → API." };
  let me: { status: number; body: unknown };
  try { me = await deps.fetchMe(key); }
  catch { return { ok: false, error: "graph8 isn't answering right now. Try again in a minute." }; }
  if (me.status === 401 || me.status === 403) return { ok: false, error: "graph8 didn't accept that key. Copy it again from graph8 → Settings → API." };
  if (me.status >= 400) return { ok: false, error: `graph8 answered ${me.status}. Try again in a minute.` };
  const { orgId, orgName } = parseMe(me.body);
  if (!orgId) return { ok: false, error: "graph8 didn't say which organization this key belongs to. Use an organization API key." };
  const c = deps.makeCaller(key);
  for (const [op, why] of REQUIRED_READS) {
    try { await c.call(op, op === OPS.listUsageTransactions || op === OPS.listDeals ? { query: { page: 1, limit: 1 } } : {}); }
    catch (e) { if (e instanceof G8Error && (e.status === 401 || e.status === 403)) return { ok: false, error: `This key ${why}, then try again.` }; throw e; }
  }
  const existing = (await deps.store.list()).find((w) => w.orgId === orgId);
  const id = existing?.id ?? randomUUID();
  let setup: { webhookId: string; webhookSecret: string; fitColumnId: number; fitFieldName: string };
  try { setup = await deps.bootstrap(c, id); }
  catch (e) {
    if (e instanceof G8Error) {
      if (e.status === 401 || e.status === 403) return { ok: false, error: "This key can't set up Credit Compass objects and webhooks. Create a key with access to objects and webhooks, then try again." };
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "graph8 isn't answering right now. Try again in a minute." };
  }
  const mcpToken = randomBytes(32).toString("base64url");
  if (existing) await deps.store.remove(existing.id);
  const workspace: Workspace = { id, orgId, orgName: orgName ?? orgId, demo: false, keyCipher: encrypt(key, deps.secret), keyHash: keyHash(key),
    webhookId: setup.webhookId,
    // graph8 returns a webhook's secret only when it is created; on a reconnect keep the stored one.
    webhookSecretCipher: setup.webhookSecret ? encrypt(setup.webhookSecret, deps.secret) : existing?.webhookSecretCipher ?? null, mcpTokenHash: createHash("sha256").update(mcpToken).digest("hex"),
    fitColumnId: setup.fitColumnId, fitFieldName: setup.fitFieldName, createdAt: existing?.createdAt ?? deps.now };
  await deps.store.put(workspace);
  return { ok: true, workspace, mcpToken };
}
