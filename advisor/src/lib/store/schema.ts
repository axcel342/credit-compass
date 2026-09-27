import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";

export interface AttrDef { slug: string; type: "text" | "number" | "timestamp" | "checkbox" | "select"; unique?: boolean }
export interface ObjectDef { slug: string; singular: string; plural: string; attributes: AttrDef[] }

const t = (slug: string, type: AttrDef["type"] = "text"): AttrDef => ({ slug, type });
const common = [{ slug: "ext_id", type: "text", unique: true } as AttrDef, t("simulated", "checkbox")];

export const OBJECTS: ObjectDef[] = [
  { slug: "roi_charge", singular: "ROI charge", plural: "ROI charges", attributes: [...common,
    t("ledger_type", "select"), t("service", "select"), t("credits", "number"), t("charged_at", "timestamp"), t("llm_tier"), t("tokens_in", "number"),
    t("tokens_out", "number"), t("description"), t("run_ext_id"), t("method", "select"), t("contact_id", "number"), t("list_id", "number"),
    t("segment_key"), t("explanation"), t("result", "select"), t("is_waste", "checkbox"), t("waste_reason", "select")] },
  { slug: "roi_run", singular: "ROI run", plural: "ROI runs", attributes: [...common,
    t("kind", "select"), t("service", "select"), t("action_name"), t("started_at", "timestamp"), t("completed_at", "timestamp"), t("status"),
    t("source", "select"), t("tokens_in", "number"), t("tokens_out", "number"), t("list_id", "number"), t("contact_ids"), t("contact_label"),
    t("company_name"), t("records_ok", "number"), t("records_failed", "number"), t("records_skipped", "number"), t("quoted_credits", "number"),
    t("reported_credits", "number"), t("result_hint")] },
  { slug: "roi_outcome", singular: "ROI outcome", plural: "ROI outcomes", attributes: [...common,
    t("type", "select"), t("occurred_at", "timestamp"), t("contact_id", "number"), t("company_id", "number"), t("deal_id"), t("amount", "number"),
    t("list_id", "number"), t("sequence_id"), t("step", "number"), t("channel", "select"), t("segment_key"), t("source", "select")] },
  { slug: "roi_stat", singular: "ROI stat", plural: "ROI stats", attributes: [...common,
    t("period"), t("dimension", "select"), t("value"), t("credits", "number"), t("credits_exact", "number"), t("meetings", "number"), t("deals", "number"),
    t("won_value", "number"), t("contacts_reached", "number"), t("cost_per_meeting", "number"), t("cost_per_deal", "number"), t("vs_avg_pct", "number"),
    t("evidence_n", "number"), t("confidence", "select"), t("computed_at", "timestamp")] },
  { slug: "roi_finding", singular: "ROI finding", plural: "ROI findings", attributes: [...common,
    t("kind", "select"), t("title"), t("body"), t("evidence"), t("credits_at_stake", "number"), t("confidence", "select"), t("status", "select"),
    t("snoozed_until", "timestamp"), t("dismiss_count", "number"), t("action"), t("action_payload"), t("first_seen", "timestamp"),
    t("last_seen", "timestamp"), t("last_notified_stake", "number"), t("in_recap", "checkbox")] },
  { slug: "roi_contact", singular: "ROI contact", plural: "ROI contacts", attributes: [...common,
    t("contact_id", "number"), t("list_ids"), t("has_email", "checkbox"), t("consistency", "select"), t("segment_key"), t("fit", "select"), t("fit_level", "select"), t("synced_at", "timestamp")] },
  { slug: "roi_action", singular: "ROI action", plural: "ROI actions", attributes: [...common,
    t("kind", "select"), t("list_id", "number"), t("pipeline_id"), t("applied_at", "timestamp"), t("status", "select"), t("previous"), t("detail")] },
];

export async function ensureSchema(c: G8Caller): Promise<{ createdObjects: string[]; createdAttributes: string[] }> {
  const existing = new Set((await c.call<{ slug: string }[]>(OPS.listObjects)).map((o) => o.slug));
  const createdObjects: string[] = [], createdAttributes: string[] = [];
  for (const o of OBJECTS) {
    if (!existing.has(o.slug)) {
      await c.call(OPS.createObject, { body: { slug: o.slug, singular_noun: o.singular, plural_noun: o.plural, description: "ROI Advisor data", icon: "target" } });
      createdObjects.push(o.slug);
    }
    const have = new Set((await c.call<{ slug: string }[]>(OPS.listAttributes, { path: { object_slug: o.slug } })).map((a) => a.slug));
    for (const a of o.attributes) {
      if (have.has(a.slug)) continue;
      await c.call(OPS.createAttribute, { path: { object_slug: o.slug }, body: { slug: a.slug, title: a.slug, attribute_type: a.type, is_unique: a.unique ?? false } });
      createdAttributes.push(`${o.slug}.${a.slug}`);
    }
  }
  return { createdObjects, createdAttributes };
}
