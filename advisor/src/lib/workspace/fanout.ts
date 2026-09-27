import { g8Caller, callerFor, type G8Caller } from "../g8/client";
import { decrypt } from "./crypto";
import type { WorkspaceStore } from "./store";

export async function forEachWorkspace<T>(fn: (ws: { id: string; caller: G8Caller; demo: boolean; orgName: string }) => Promise<T>, store: WorkspaceStore) {
  const out: { id: string; ok: boolean; result?: T; error?: string }[] = [];
  const run = async (id: string, get: () => { caller: G8Caller; demo: boolean; orgName: string }) => {
    try { out.push({ id, ok: true, result: await fn({ id, ...get() }) }); } catch (e) { out.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) }); }
  };
  await run("demo", () => ({ caller: g8Caller, demo: true, orgName: "Demo workspace" }));
  for (const w of await store.list()) await run(w.id, () => ({ caller: callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? "")), demo: false, orgName: w.orgName }));
  return out;
}
