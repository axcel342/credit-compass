import { loadDashboardData } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { listChoices, type EnrichmentType } from "@/lib/domain/planner";
import { loadPlan } from "@/lib/dashboard/planner-data";
import { plannerHeadline } from "@/lib/dashboard/story";
import { Headline } from "@/components/Headline";
import { Planner } from "@/components/Planner";

type SP = { list?: string; type?: string; period?: string };
export default async function OptimizePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const c = await currentCaller();
  const d = await loadDashboardData(c);
  const choices = listChoices(d.lists, d.listNames);
  const listId = choices.some((l) => String(l.id) === sp.list) ? Number(sp.list) : (choices.find((l) => d.listNames.get(String(l.id)) === "Starter list") ?? choices[0])?.id;
  const type: EnrichmentType = sp.type === "find" || sp.type === "phones" ? sp.type : "verify";
  if (listId === undefined) return <Headline text="No lists with contacts yet." lede="Create a list in graph8, then run Sync now." />;
  const plan = await loadPlan(c, d, listId, type);
  const hrefFor = (p: { list?: number; type?: string }) => `/optimize?${new URLSearchParams({ list: String(p.list ?? listId), type: p.type ?? type, ...(sp.period === "30d" ? { period: "30d" } : {}) })}#plan`;
  return (
    <>
      <Headline text={plannerHeadline({ graph8Quote: plan.graph8Quote, estimate: plan.walk.estimate, listLabel: plan.listLabel, def: plan.def })}
        lede="Pick a list and an enrichment, see what it should really cost and book, then let graph8 skip the contacts least likely to book." />
      <Planner plan={plan} choices={choices} hrefFor={hrefFor} />
    </>
  );
}
