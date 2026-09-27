import { describe, it, expect } from "vitest";
import { MemoryWorkspaceStore, type Workspace } from "@/lib/workspace/store";
const w: Workspace = { id: "w1", orgId: "org_a", orgName: "Acme", demo: false, keyCipher: "c", keyHash: "h1", webhookId: null, webhookSecretCipher: null,
  mcpTokenHash: null, fitColumnId: null, fitFieldName: null, createdAt: "2026-09-27T00:00:00Z" };
describe("MemoryWorkspaceStore", () => {
  it("stores, finds by key hash, lists and removes", async () => {
    const s = new MemoryWorkspaceStore();
    await s.put(w);
    expect(await s.get("w1")).toEqual(w);
    expect((await s.findByKeyHash("h1"))?.id).toBe("w1");
    expect(await s.list()).toHaveLength(1);
    await s.remove("w1");
    expect(await s.get("w1")).toBeNull();
    expect(await s.findByKeyHash("h1")).toBeNull();
  });
});
