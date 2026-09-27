import { describe, it, expect } from "vitest";
import { forEachWorkspace } from "@/lib/workspace/fanout";
import { MemoryWorkspaceStore } from "@/lib/workspace/store";
import { encrypt } from "@/lib/workspace/crypto";

describe("forEachWorkspace", () => {
  it("runs for the demo org and every workspace, isolating failures", async () => {
    process.env.WORKSPACE_KEY_SECRET = "k".repeat(64);
    const s = new MemoryWorkspaceStore();
    for (const id of ["a", "b"]) await s.put({ id, orgId: `org_${id}`, orgName: id, demo: false, keyCipher: encrypt(`key_${id}`, "k".repeat(64)), keyHash: id,
      webhookId: null, webhookSecretCipher: null, mcpTokenHash: null, fitColumnId: 1, fitFieldName: "f", createdAt: "2026-09-27T00:00:00Z" });
    const out = await forEachWorkspace(async (ws) => { if (ws.id === "a") throw new Error("boom"); return ws.id; }, s);
    expect(out).toEqual([{ id: "demo", ok: true, result: "demo" }, { id: "a", ok: false, error: "boom" }, { id: "b", ok: true, result: "b" }]);
  });
});
