import { createHash, timingSafeEqual } from "node:crypto";
import { g8Caller, callerFor, type G8Caller } from "../g8/client";
import { decrypt } from "../workspace/crypto";
import type { WorkspaceStore } from "../workspace/store";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function authorizeMcp(req: Request, token: string): boolean {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/message")) return true;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && same(auth.slice(7), token)) return true;
  const key = url.searchParams.get("key");
  return !!key && same(key, token);
}

export async function resolveMcpCaller(req: Request, store: WorkspaceStore): Promise<G8Caller | null> {
  const demo = process.env.MCP_TOKEN;
  if (demo && authorizeMcp(req, demo)) return g8Caller;
  const url = new URL(req.url), auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("key");
  if (!token) return null;
  const w = await store.findByMcpTokenHash(createHash("sha256").update(token).digest("hex"));
  return w ? callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? "")) : null;
}
