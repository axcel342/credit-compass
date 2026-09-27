import Link from "next/link";
import type { Plan } from "@/lib/dashboard/planner-data";
import { plannerHeadline } from "@/lib/dashboard/story";
import { CostWalk } from "./CostWalk";
import { ForecastBar } from "./ForecastBar";
import { RunPlan } from "@/app/(dash)/optimize/RunPlan";

export function Planner({ plan, choices, rule, hrefFor }: { plan: Plan; choices: { id: number; label: string; total: number }[]; rule: string; hrefFor: (p: { list?: number; type?: string }) => string }) {
  const f = plan.fits;
  return (
    <section className="panel" id="plan" aria-labelledby="plan-h">
      <div className="ph"><h2 id="plan-h">Plan your next enrichment</h2><span className="small">{plan.syncedAt ? `Fit from the last sync, ${new Date(plan.syncedAt).toUTCString().slice(5, 22)} UTC` : "Run Sync now to score contacts"}</span></div>
      <form method="get" action="/optimize#plan" className="planner-sel">
        <label htmlFor="list" className="sr-only">List</label>
        <select id="list" name="list" defaultValue={plan.listId}>{choices.map((l) => <option key={l.id} value={l.id}>{l.label}, {l.total} contacts</option>)}</select>
        <input type="hidden" name="type" value={plan.def.key} />
        <button className="btn ghost" type="submit">Check this list</button>
        <span className="seg" role="group" aria-label="Enrichment">
          {plan.types.map((t) => t.def.key === "phones" && !t.runnable
            ? <button key={t.def.key} type="button" disabled title={t.reason ?? undefined}>{t.def.label}</button>
            : <Link key={t.def.key} href={hrefFor({ list: plan.listId, type: t.def.key })} className={t.def.key === plan.def.key ? "on" : undefined} aria-current={t.def.key === plan.def.key ? "true" : undefined}>{t.def.label}</Link>)}
        </span>
      </form>
      <p className="lede">{plannerHeadline({ graph8Quote: plan.graph8Quote, estimate: plan.walk.estimate, listLabel: plan.listLabel, def: plan.def })}</p>
      <CostWalk walk={plan.walk} def={plan.def} />
      <ForecastBar {...plan.forecast} basis={`If these contacts do as well as ${plan.listLabel} has so far.`} />
      <h3 className="sub">Who gets skipped</h3>
      <div className="fitbar" aria-hidden="true"><span style={{ flex: f.high, background: "var(--booked)" }} /><span style={{ flex: f.medium, background: "var(--maybe)" }} /><span style={{ flex: f.low, background: "var(--waste)" }} /><span style={{ flex: f.unknown, background: "var(--unknown)" }} /></div>
      <p className="small">Likely to book {f.high}, maybe {f.medium}, unlikely {f.low}, unknown {f.unknown}. Unlikely means the email doesn&apos;t match their company (those bounced about twice as often when we checked) or people like them rarely book.</p>
      <details><summary>The rule graph8 will run</summary><p className="small">Written to the list pipeline&apos;s run condition, so graph8 enforces it on every run: <code>{rule}</code></p></details>
      {plan.runnable ? <RunPlan listId={plan.listId} estimate={plan.walk.estimate} records={plan.walk.records} verb={plan.def.verb} /> : <p className="small">{plan.reason ?? "graph8 has no pipeline for this list yet."}</p>}
    </section>
  );
}
