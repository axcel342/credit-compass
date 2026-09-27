import Link from "next/link";
import type { Plan } from "@/lib/dashboard/planner-data";
import { forecastFigure, n, plannerUnit } from "@/lib/dashboard/story";
import { CostWalk } from "./CostWalk";
import { RunPlan } from "@/app/(dash)/optimize/RunPlan";

export function Planner({ plan, choices, rule, hrefFor }: { plan: Plan; choices: { id: number; label: string; total: number }[]; rule: string; hrefFor: (p: { list?: number; type?: string }) => string }) {
  const fc = forecastFigure(plan.forecast);
  const synced = plan.syncedAt ? `Fit from the last sync, ${new Date(plan.syncedAt).toUTCString().slice(5, 22)} UTC` : "Run Sync now to score contacts";
  return (
    <section className="panel" id="plan" aria-labelledby="plan-h">
      <div className="pl-head">
        <h2 id="plan-h">Plan your next enrichment</h2>
        <form method="get" action="/optimize#plan" className="planner-sel">
          <label htmlFor="list" className="sr-only">List</label>
          <select id="list" name="list" defaultValue={plan.listId} title={synced}>{choices.map((l) => <option key={l.id} value={l.id}>{l.label}, {l.total} contacts</option>)}</select>
          <input type="hidden" name="type" value={plan.def.key} />
          <button className="btn ghost" type="submit">Check this list</button>
          <span className="seg" role="group" aria-label="Enrichment">
            {plan.types.map((t) => t.def.key === "phones" && !t.runnable
              ? <button key={t.def.key} type="button" disabled title={t.reason ?? undefined}>{t.def.label}</button>
              : <Link key={t.def.key} href={hrefFor({ list: plan.listId, type: t.def.key })} className={t.def.key === plan.def.key ? "on" : undefined} aria-current={t.def.key === plan.def.key ? "true" : undefined}>{t.def.label}</Link>)}
          </span>
        </form>
      </div>
      <div className="pl-figs">
        <div><span className="fig tnum">{plan.walk.estimate > 0 ? `~${n(plan.walk.estimate)}` : "0"}</span>
          <span className="u">{plannerUnit({ estimate: plan.walk.estimate, every: plan.walk.every, graph8Quote: plan.graph8Quote })}</span></div>
        {plan.walk.records > 0 && (
          <div><span className="fig tnum">{fc.figure}</span><span className="u">{fc.unit}</span>{fc.note && <span className="u muted">{fc.note}</span>}</div>)}
      </div>
      <CostWalk walk={plan.walk} def={plan.def} />
      <details className="more"><summary>The rule graph8 will run</summary><p className="small">Written to the list pipeline&apos;s run condition, so graph8 enforces it on every run: <code>{rule}</code></p></details>
      {plan.runnable ? <RunPlan listId={plan.listId} estimate={plan.walk.estimate} records={plan.walk.records} verb={plan.def.verb} /> : <p className="small">{plan.reason ?? "graph8 has no pipeline for this list yet."}</p>}
    </section>
  );
}
