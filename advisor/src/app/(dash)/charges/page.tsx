import Link from "next/link";
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { groupActivities } from "@/lib/domain/activities";
import { bucketTotals } from "@/lib/domain/buckets";
import { serviceName } from "@/lib/domain/names";
import { applyChargeFilter, filterHref, parseChargeFilter } from "@/lib/dashboard/filters";
import { chargesHeadline } from "@/lib/dashboard/story";
import { Headline } from "@/components/Headline";
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
  const shown = applyChargeFilter(v.charges, f, v.bucketOf);
  const lists = [...new Set(v.charges.map((c) => c.listId).filter((x): x is number => x !== null))];
  const label = [f.list ? (f.list === "none" ? "Not tied to a list" : f.list === "other" ? "Other lists" : d.listNames.get(f.list) ?? `List ${f.list}`) : null,
    f.service ? serviceName(f.service) : null].filter(Boolean).join(", ");
  return (
    <>
      <Headline text={chargesHeadline({ traced: v.coverage.exact, total: v.coverage.total, periodLabel: PERIOD_LABEL[period] })}
        lede="graph8's ledger records only a service, an amount and a time. Each line here is matched to the work it paid for and to what that work led to." />
      <div className="filters">
        <OutcomeChips f={f} totals={bucketTotals(scoped, v.bucketCtx)} all={scoped.reduce((s, c) => s + c.credits, 0)} periodQuery={pq} />
        <nav className="list-filter" aria-label="Filter by list">
          <Link href={filterHref(f, { list: null }, pq)} aria-current={!f.list ? "true" : undefined}>All lists</Link>
          {lists.map((id) => <Link key={id} href={filterHref(f, { list: String(id) }, pq)} aria-current={f.list === String(id) ? "true" : undefined}>{d.listNames.get(String(id)) ?? `List ${id}`}</Link>)}
        </nav>
        {label && <p className="small">Showing {label}. <Link href={filterHref({ outcome: f.outcome, list: null, service: null }, {}, pq)}>Clear</Link></p>}
      </div>
      <section className="panel"><ActivityTable rows={groupActivities(shown, d.runs, v.bucketOf, d.listNames)} /></section>
    </>
  );
}
