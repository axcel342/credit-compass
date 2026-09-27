import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { bootstrapOrg } from "@/lib/workspace/bootstrap";

describe("bootstrapOrg", () => {
  it("creates the objects, the fit fields and a webhook, and is safe to repeat", async () => {
    const g = new FakeG8();
    const fields: { id: number; title: string; name: string }[] = [];
    g.handlers.set(OPS.listFields, () => fields);
    g.handlers.set(OPS.createField, (i) => { const b = i.body as { title: string }; const f = { id: 900 + fields.length, title: b.title, name: `udo_${b.title}_x` }; fields.push(f); return f; });
    const hooks: { id: string; url: string }[] = [];
    g.handlers.set(OPS.listWebhooks, () => hooks);
    g.handlers.set(OPS.createWebhook, (i) => { const h = { id: `wh${hooks.length + 1}`, url: String((i.body as { url: string }).url), secret: "s3cret" }; hooks.push(h); return h; });
    const a = await bootstrapOrg(g, { webhookUrl: "https://x/api/webhooks/graph8/w1" });
    expect(a).toMatchObject({ webhookId: "wh1", webhookSecret: "s3cret", fitColumnId: 900, fitFieldName: "udo_roi_fit_x" });
    expect(g.objects.has("roi_charge") && g.objects.has("roi_action") && g.objects.has("roi_contact")).toBe(true);
    const b = await bootstrapOrg(g, { webhookUrl: "https://x/api/webhooks/graph8/w1" });
    expect(hooks).toHaveLength(1);
    expect(b.fitColumnId).toBe(900);
  });
});
