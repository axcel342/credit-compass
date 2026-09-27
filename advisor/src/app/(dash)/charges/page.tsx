import Link from "next/link";
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { foldSmall, groupActivities } from "@/lib/domain/activities";
import { bucketTotals } from "@/lib/domain/buckets";
import { serviceName } from "@/lib/domain/names";
import { applyChargeFilter, filterHref, listChips, parseChargeFilter } from "@/lib/dashboard/filters";
import { n } from "@/lib/dashboard/story";
import { OutcomeBar } from "@/components/OutcomeBar";
import { OutcomeChips } from "@/components/OutcomeChips";
import { ActivityTable } from "@/components/ActivityTable";

type SP = Record<string, string | string[] | undefined>;
export default async function ChargesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period), pq = period === "30d" ? "period=30d" : "";
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const f = parseChargeFilter(sp);
  const scoped = applyChargeFilter(v.charges, { ...f, outcome: null }, v.bucketOf);
  const all = scoped.reduce((s, c) => s + c.credits, 0);
  const rows = groupActivities(applyChargeFilter(v.charges, f, v.bucketOf), d.runs, v.bucketOf, d.listNames);
  const fold = foldSmall(rows);
  const chips = listChips(v.charges);
  const matched = v.coverage.total > 0 ? Math.round((v.coverage.exact / v.coverage.total) * 100) : 0;
  const label = [f.list ? (f.list === "none" ? "Not tied to a list" : f.list === "other" ? "Other lists" : d.listNames.get(f.list) ?? `List ${f.list}`) : null,
    f.service ? serviceName(f.service) : null].filter(Boolean).join(", ");
  return (
    <>
      <div className="c-head">
        <h1 className="h-scr">{all > 0 ? `What ${n(all)} credits bought` : `No charges in ${PERIOD_LABEL[period]}.`}</h1>
        {v.coverage.total > 0 && <span className="small">{matched}% matched to a contact, list or run</span>}
      </div>
      {all > 0 && <OutcomeBar totals={bucketTotals(scoped, v.bucketCtx)} big />}
      <div className="filters">
        <OutcomeChips f={f} totals={bucketTotals(scoped, v.bucketCtx)} all={all} periodQuery={pq} />
        <nav className="list-filter" aria-label="Filter by list">
          <Link href={filterHref(f, { list: null }, pq)} aria-current={!f.list ? "true" : undefined}>All lists</Link>
          {chips.ids.map((id) => <Link key={id} href={filterHref(f, { list: String(id) }, pq)} aria-current={f.list === String(id) ? "true" : undefined}>{d.listNames.get(String(id)) ?? `List ${id}`}</Link>)}
          {chips.hasOther && <Link href={filterHref(f, { list: "other" }, pq)} aria-current={f.list === "other" ? "true" : undefined}>Other lists</Link>}
        </nav>
        {label && <p className="small">Showing {label}. <Link href={filterHref({ outcome: f.outcome, list: null, service: null }, {}, pq)}>Clear</Link></p>}
      </div>
      <section className="panel">
        <ActivityTable rows={f.small ? rows : fold.shown}
          fold={fold.small.length ? { count: fold.small.length, credits: fold.smallCredits, open: !!f.small, href: filterHref(f, { small: !f.small }, pq) } : null} />
      </section>
    </>
  );
}
