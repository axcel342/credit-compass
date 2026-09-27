import { describe, it, expect, beforeEach } from "vitest";
import { G8Error } from "@graph8/sdk";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { parseMe, connectWorkspace, REQUIRED_READS } from "@/lib/workspace/connector";
import { MemoryWorkspaceStore } from "@/lib/workspace/store";
import { decrypt } from "@/lib/workspace/crypto";

const SECRET = "k".repeat(64);
function fakeFor(opts: { status?: number; deny?: string[] } = {}) {
  const g = new FakeG8();
  for (const [op] of REQUIRED_READS) g.handlers.set(op, () => {
    if (opts.deny?.includes(op)) throw new G8Error({ message: "forbidden", status: 403, type: "forbidden", code: "missing_scope" });
    return [];
  });
  return g;
}
const deps = (g: FakeG8, me: { status: number; body: unknown }) => ({ store: new MemoryWorkspaceStore(), secret: SECRET, now: "2026-09-27T00:00:00Z",
  makeCaller: () => g, fetchMe: async () => me, bootstrap: async () => ({ webhookId: "wh1", webhookSecret: "whs", fitColumnId: 900, fitFieldName: "udo_roi_fit_x" }) });

describe("parseMe", () => {
  it("finds the org in common shapes", () => {
    expect(parseMe({ data: { org_id: "org_1", org_name: "Acme" } })).toEqual({ orgId: "org_1", orgName: "Acme" });
    expect(parseMe({ data: { organization: { id: "org_2", name: "Beta" } } })).toEqual({ orgId: "org_2", orgName: "Beta" });
    expect(parseMe({})).toEqual({ orgId: null, orgName: null });
  });
});

describe("connectWorkspace", () => {
  it("trims the key, stores it encrypted and returns an MCP token", async () => {
    const d = deps(fakeFor(), { status: 200, body: { data: { org_id: "org_1", org_name: "Acme" } } });
    const r = await connectWorkspace("  g8_key_123 \n", d);
    expect(r.ok).toBe(true);
    const [w] = await d.store.list();
    expect(w).toMatchObject({ orgId: "org_1", orgName: "Acme", webhookId: "wh1", fitColumnId: 900, fitFieldName: "udo_roi_fit_x" });
    expect(w.keyCipher).not.toContain("g8_key_123");
    expect(decrypt(w.keyCipher, SECRET)).toBe("g8_key_123");
    if (r.ok) expect(r.mcpToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });
  it("explains a rejected key and stores nothing", async () => {
    const d = deps(fakeFor(), { status: 401, body: {} });
    expect(await connectWorkspace("bad", d)).toEqual({ ok: false, error: "graph8 didn't accept that key. Copy it again from graph8 → Settings → API." });
    expect(await d.store.list()).toEqual([]);
  });
  it("lists missing permissions in plain words and stores nothing", async () => {
    const d = deps(fakeFor({ deny: [OPS.listUsageTransactions] }), { status: 200, body: { data: { org_id: "org_1" } } });
    const r = await connectWorkspace("k", d);
    expect(r).toEqual({ ok: false, error: "This key can't see the credit ledger. Create a key with read access to usage, then try again." });
    expect(await d.store.list()).toEqual([]);
  });
  it("refuses an empty key", async () => expect((await connectWorkspace("   ", deps(fakeFor(), { status: 200, body: {} }))).ok).toBe(false));
  it("reuses the workspace when the same org connects again", async () => {
    const d = deps(fakeFor(), { status: 200, body: { data: { org_id: "org_1" } } });
    await connectWorkspace("k1", d); await connectWorkspace("k2", d);
    expect(await d.store.list()).toHaveLength(1);
  });
  it("explains a key that can't set up objects and webhooks and stores nothing", async () => {
    const d = deps(fakeFor(), { status: 200, body: { data: { org_id: "org_1" } } });
    d.bootstrap = async () => { throw new G8Error({ message: "forbidden", status: 403, type: "forbidden", code: "missing_scope" }); };
    expect(await connectWorkspace("k", d)).toEqual({ ok: false, error: "This key can't set up Credit Compass objects and webhooks. Create a key with access to objects and webhooks, then try again." });
    expect(await d.store.list()).toEqual([]);
  });
  it("passes through other graph8 setup errors", async () => {
    const d = deps(fakeFor(), { status: 200, body: { data: { org_id: "org_1" } } });
    d.bootstrap = async () => { throw new G8Error({ message: "graph8 answered 500. Try again in a minute.", status: 500, type: "server_error", code: "internal" }); };
    expect(await connectWorkspace("k", d)).toEqual({ ok: false, error: "graph8 answered 500. Try again in a minute." });
  });
  it("explains a network failure while checking the key", async () => {
    const d = deps(fakeFor(), { status: 200, body: {} });
    d.fetchMe = async () => { throw new Error("fetch failed"); };
    expect(await connectWorkspace("k", d)).toEqual({ ok: false, error: "graph8 isn't answering right now. Try again in a minute." });
    expect(await d.store.list()).toEqual([]);
  });
  it("explains a non-graph8 setup failure", async () => {
    const d = deps(fakeFor(), { status: 200, body: { data: { org_id: "org_1" } } });
    d.bootstrap = async () => { throw new Error("socket hang up"); };
    expect(await connectWorkspace("k", d)).toEqual({ ok: false, error: "graph8 isn't answering right now. Try again in a minute." });
  });
});
