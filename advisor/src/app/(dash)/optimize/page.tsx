import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller, currentWorkspace } from "@/lib/workspace/current";
import { runCondition } from "@/lib/guardrail/guardrail";
import { listChoices, type EnrichmentType } from "@/lib/domain/planner";
import { loadPlan } from "@/lib/dashboard/planner-data";
import { optimizeTitle } from "@/lib/dashboard/story";
import { RecordStore } from "@/lib/store/records";
import { valuesToContact } from "@/lib/store/mappers";
import { buildActions } from "@/lib/domain/actions";
import { ActionCard } from "@/components/ActionCard";
import { AppliedChanges } from "@/components/AppliedChanges";
import { Planner } from "@/components/Planner";

type SP = { list?: string; type?: string; period?: string };
export default async function OptimizePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const c = await currentCaller(), ws = await currentWorkspace();
  const d = await loadDashboardData(c);
  const choices = listChoices(d.lists, d.listNames);
  const listId = choices.some((l) => String(l.id) === sp.list) ? Number(sp.list) : (choices.find((l) => d.listNames.get(String(l.id)) === "Starter list") ?? choices[0])?.id;
  const type: EnrichmentType = sp.type === "find" || sp.type === "phones" ? sp.type : "verify";
  if (listId === undefined) return (<><h1 className="h-scr no-lists">No lists with contacts yet.</h1><p className="small">Create a list in graph8, then run Sync now.</p></>);
  const plan = await loadPlan(c, d, listId, type);
  const hrefFor = (p: { list?: number; type?: string }) => `/optimize?${new URLSearchParams({ list: String(p.list ?? listId), type: p.type ?? type, ...(sp.period === "30d" ? { period: "30d" } : {}) })}#plan`;
  const v = periodView(d, "8w");
  const contacts = (await new RecordStore(c, "roi_contact").list()).map((r) => valuesToContact(r.values));
  const actions = buildActions({ charges: v.charges, stats: v.stats, listNames: d.listNames, contacts, actions: d.actions });
  const open = actions.filter((a) => !a.applied);
  const t = optimizeTitle(open.length);
  return (
    <>
      <div className="o-top"><h1 className="h-scr">{t.title}</h1>{t.sub && <span className="small">{t.sub}</span>}</div>
      <div className="ocs">{actions.map((a) => <ActionCard key={a.id} a={a} />)}</div>
      <Planner plan={plan} choices={choices} rule={runCondition(ws.fitFieldName)} hrefFor={hrefFor} />
      <AppliedChanges actions={d.actions} runs={d.runs} listNames={d.listNames} />
    </>
  );
}
