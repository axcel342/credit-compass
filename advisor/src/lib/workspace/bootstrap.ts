import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { ensureSchema } from "../store/schema";

const EVENTS = ["deal.created", "deal.stage_changed", "deal.updated", "workflow.execution_completed", "workflow.execution_failed"];

export async function bootstrapOrg(c: G8Caller, o: { webhookUrl: string }): Promise<{ webhookId: string; webhookSecret: string; fitColumnId: number; fitFieldName: string }> {
  await ensureSchema(c);
  const fields = await c.call<{ id: number; title: string; name: string }[]>(OPS.listFields);
  const field = async (title: string) => fields.find((f) => f.title === title) ?? await c.call<{ id: number; title: string; name: string }>(OPS.createField, { body: { title, entity: "contacts", data_type: "text" } });
  const fit = await field("roi_fit");
  await field("record_consistency");
  const hooks = await c.call<{ id: string; url: string; secret?: string }[]>(OPS.listWebhooks);
  const hook = hooks.find((h) => h.url === o.webhookUrl) ?? await c.call<{ id: string; secret: string }>(OPS.createWebhook, { body: { url: o.webhookUrl, events: EVENTS, name: "Credit Compass" } });
  return { webhookId: hook.id, webhookSecret: hook.secret ?? "", fitColumnId: fit.id, fitFieldName: fit.name };
}
