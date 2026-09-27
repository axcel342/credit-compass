import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { RecordStore } from "../store/records";
import { valuesToContact } from "../store/mappers";
import { loadContactInfo, type ContactRow } from "../sync/contacts";
import { mapLimit } from "../util/concurrency";
import { findEnrichmentPipeline } from "../guardrail/pipeline";
import { calibrationFactor, priceFor, type ProviderRow } from "../domain/prespend";
import { availableTypes, costWalk, forecastMeetings, type CostWalk, type EnrichmentType, type Template, type TypeDef } from "../domain/planner";
import type { ContactCacheRow } from "../domain/types";
import type { DashboardData } from "./data";

export interface Plan {
  listId: number; listLabel: string; rows: ContactCacheRow[]; types: ReturnType<typeof availableTypes>; def: TypeDef; runnable: boolean; reason: string | null;
  walk: CostWalk; graph8Quote: number | null; forecast: ReturnType<typeof forecastMeetings>; fits: Record<ContactCacheRow["fit"], number>; pipelineId: string | null; syncedAt: string | null;
}

async function readTemplates(c: G8Caller): Promise<Template[]> {
  const r = await c.call<unknown>(OPS.listPipelineTemplates);
  const arr = (Array.isArray(r) ? r : ((r as { items?: unknown[]; templates?: unknown[] }).items ?? (r as { templates?: unknown[] }).templates ?? [])) as Record<string, unknown>[];
  return arr.map((t) => ({ key: String(t.template_key ?? t.key ?? t.id ?? ""), name: String(t.name ?? t.title ?? "") }));
}

export async function loadPlan(c: G8Caller, d: DashboardData, listId: number, type: EnrichmentType): Promise<Plan> {
  const ids: number[] = [];
  const listRows: ContactRow[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<ContactRow[]>(OPS.getListContacts, { path: { list_id: listId }, query: { page, limit: 200 } });
    listRows.push(...r); ids.push(...r.map((x) => x.id));
    if (r.length < 200) break;
  }
  const cache = new Map((await new RecordStore(c, "roi_contact").list()).map((r) => { const v = valuesToContact(r.values); return [v.contactId, v] as const; }));
  const missing = listRows.filter((r) => !cache.has(r.id));
  const fresh = await mapLimit(missing, 10, async (r) => { const i = await loadContactInfo(c, r); return { contactId: i.contactId, listIds: i.listIds, hasEmail: !!i.email,
    consistency: i.consistency, segmentKey: i.segmentKey, fit: i.consistency === "flagged" ? "low" : "unknown", fitLevel: null, syncedAt: d.now } as ContactCacheRow; });
  const rows = [...ids.map((id) => cache.get(id)).filter((x): x is ContactCacheRow => !!x), ...fresh];
  const types = availableTypes(await readTemplates(c));
  const t = types.find((x) => x.def.key === type) ?? types[0];
  const providers = (await c.call<{ providers: ProviderRow[] }>(OPS.listProviders)).providers;
  const price = t.def.key === "find" ? priceFor(providers, "leadmagic", "email_finder") ?? t.def.pricePerRecord : t.def.pricePerRecord;
  const wfRuns = d.runs.filter((r) => r.service === "waterfall_enrichment" && r.quotedCredits);
  const calibration = t.def.key === "find" ? calibrationFactor(wfRuns.map((r) => ({ quoted: r.quotedCredits!, actual: d.charges.filter((x) => x.runExtId === r.extId).reduce((s, x) => s + x.credits, 0) }))) : 1;
  const walk = costWalk({ rows, def: t.def, price, calibration, guardrail: true });
  const pipe = t.def.key === "find" ? await findEnrichmentPipeline(c, listId) : null;
  const graph8Quote = pipe ? (await c.call<{ required_credits: number }>(OPS.estimateListPipeline, { path: { list_id: listId, pipeline_id: pipe.id } })).required_credits : null;
  const stat = d.stats.find((s) => s.period === "8w" && s.dimension === "list" && s.value === String(listId));
  const org = d.stats.find((s) => s.period === "8w" && s.dimension === "org");
  const orgRate = org && org.contactsReached > 0 ? org.meetings / org.contactsReached : 0;
  const fits = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const r of rows) fits[r.fit]++;
  // Only email finding runs from here (through the proven guardrail path); other types are estimates.
  const runnable = t.def.key === "find" && t.runnable && !!pipe;
  const reason = runnable ? null : t.def.key === "find" ? (pipe ? t.reason : "This list has no email-finding pipeline in graph8 yet.")
    : (t.reason ?? "Estimate only. Run verification from graph8.");
  return { listId, listLabel: d.listNames.get(String(listId)) ?? `List ${listId}`, rows, types, def: t.def, runnable,
    reason, walk, graph8Quote, forecast: forecastMeetings({ records: walk.records, meetings: stat?.meetings ?? 0, reached: stat?.contactsReached ?? 0, orgRate }),
    fits, pipelineId: pipe?.id ?? null, syncedAt: rows.map((r) => r.syncedAt).sort().at(-1) ?? null };
}
