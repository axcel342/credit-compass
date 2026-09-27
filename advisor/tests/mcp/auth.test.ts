import { describe, it, expect } from "vitest";
import { authorizeMcp, resolveMcpCaller } from "@/lib/mcp/auth";
import { MemoryWorkspaceStore } from "@/lib/workspace/store";
import { encrypt } from "@/lib/workspace/crypto";
import { createHash } from "node:crypto";
import { g8Caller } from "@/lib/g8/client";

describe("authorizeMcp", () => {
  const t = "tok";
  it("accepts a bearer token", () => expect(authorizeMcp(new Request("https://x/api/mcp", { headers: { authorization: "Bearer tok" } }), t)).toBe(true));
  it("accepts ?key= for graph8's SSE connection", () => expect(authorizeMcp(new Request("https://x/api/sse?key=tok"), t)).toBe(true));
  it("lets the SSE message leg through", () => expect(authorizeMcp(new Request("https://x/api/message?sessionId=abc", { method: "POST" }), t)).toBe(true));
  it("rejects missing or wrong tokens", () => {
    expect(authorizeMcp(new Request("https://x/api/mcp"), t)).toBe(false);
    expect(authorizeMcp(new Request("https://x/api/sse?key=nope"), t)).toBe(false);
  });
});

it("resolves the demo token to the demo org and a workspace token to that workspace", async () => {
  process.env.MCP_TOKEN = "demo-token"; process.env.WORKSPACE_KEY_SECRET = "k".repeat(64);
  const s = new MemoryWorkspaceStore();
  await s.put({ id: "w1", orgId: "org_1", orgName: "A", demo: false, keyCipher: encrypt("key1", "k".repeat(64)), keyHash: "h", webhookId: null, webhookSecretCipher: null,
    mcpTokenHash: createHash("sha256").update("ws-token").digest("hex"), fitColumnId: 1, fitFieldName: "f", createdAt: "2026-09-27T00:00:00Z" });
  const req = (t: string) => new Request("https://x/api/mcp", { headers: { authorization: `Bearer ${t}` } });
  expect(await resolveMcpCaller(req("demo-token"), s)).toBe(g8Caller);
  expect(await resolveMcpCaller(req("ws-token"), s)).not.toBeNull();
  expect(await resolveMcpCaller(req("nope"), s)).toBeNull();
});
