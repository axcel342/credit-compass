import { describe, it, expect, vi, beforeEach } from "vitest";
import { OPS } from "@/lib/g8/ops";
import { WORKSPACE_COOKIE } from "@/lib/workspace/session";

const h = vi.hoisted(() => ({
  call: vi.fn(), remove: vi.fn(), del: vi.fn(), get: vi.fn(),
  redirect: vi.fn((u: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${u}`), { digest: `NEXT_REDIRECT;replace;${u}` }); }),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ delete: h.del }) }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => h.redirect(u) }));
vi.mock("@/lib/workspace/current", () => ({ currentWorkspace: async () => ({ demo: false, id: "w1", caller: { call: h.call } }) }));
vi.mock("@/lib/workspace/store", () => ({ workspaceStore: () => ({ get: h.get, remove: h.remove }) }));

import { disconnect } from "@/app/(dash)/workspace-actions";

describe("disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.get.mockResolvedValue({ id: "w1", webhookId: "wh1" });
  });

  it("deletes the webhook first, then the workspace and cookie", async () => {
    h.call.mockResolvedValue(undefined);
    await expect(disconnect()).rejects.toThrow("NEXT_REDIRECT:/connect");
    expect(h.call).toHaveBeenCalledWith(OPS.deleteWebhook, { path: { webhook_id: "wh1" } });
    expect(h.remove).toHaveBeenCalledWith("w1");
    expect(h.del).toHaveBeenCalledWith(WORKSPACE_COOKIE);
    expect(h.call.mock.invocationCallOrder[0]).toBeLessThan(h.remove.mock.invocationCallOrder[0]);
  });

  it("fails closed: a failed deletion keeps the workspace and cookie", async () => {
    h.call.mockRejectedValue(new Error("graph8 500"));
    await expect(disconnect()).rejects.toThrow("Could not remove the webhook in graph8, so nothing was disconnected. Try again.");
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.del).not.toHaveBeenCalled();
  });

  it("still disconnects when there is no webhook id", async () => {
    h.get.mockResolvedValue({ id: "w1", webhookId: null });
    await expect(disconnect()).rejects.toThrow("NEXT_REDIRECT:/connect");
    expect(h.call).not.toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalledWith("w1");
    expect(h.del).toHaveBeenCalledWith(WORKSPACE_COOKIE);
  });
});
