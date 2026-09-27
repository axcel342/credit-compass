import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { dashboardBuckets } from "@/lib/domain/gate";
import { rollingCostPerMeeting, trendLine } from "@/lib/domain/trend";
import { valueChain, listRows } from "@/lib/dashboard/story";
import { doNextItems, doNextImpact } from "@/lib/dashboard/donext";
import { claimState } from "@/lib/dashboard/recovery";
import { buildActions } from "@/lib/domain/actions";
import { ValueChain } from "@/components/ValueChain";
import { TrendLine } from "@/components/TrendLine";
import { DoNext } from "@/components/DoNext";
import { OutcomeBar } from "@/components/OutcomeBar";
import { ListBars } from "@/components/ListBars";

export default async function Overview({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const periodQuery = period === "30d" ? "period=30d" : "";
  const byList = v.stats.filter((s) => s.dimension === "list" && s.costPerMeeting !== null)
    .map((s) => ({ label: d.listNames.get(s.value) ?? `List ${s.value}`, value: s.costPerMeeting! }));
  const avg = v.org?.costPerMeeting ?? null;
  const v8 = period === "8w" ? v : periodView(d, "8w");
  const impact = doNextImpact(buildActions({ charges: v8.charges, stats: v8.stats, listNames: d.listNames, contacts: [], actions: d.actions }),
    claimState(d.actions, 0).open !== null);
  return (
    <>
      <ValueChain chain={valueChain({ total: v.coverage.total, meetings: v.meetings, won: v.won, wonValue: v.wonValue, periodLabel: PERIOD_LABEL[period] })} />
      <TrendLine t={trendLine(rollingCostPerMeeting(d.charges, d.outcomes, d.now))} />
      <DoNext items={doNextItems(dashboardBuckets(d.findings, d.now).open, 4, periodQuery, impact)} />
      <div className="duo">
        <section className="panel" aria-labelledby="bought-h">
          <div className="ph"><h2 id="bought-h">What the credits bought</h2></div>
          {v.coverage.total > 0
            ? <OutcomeBar totals={v.buckets} hrefFor={(b) => `/charges?outcome=${b}${periodQuery ? `&${periodQuery}` : ""}`} />
            : <p className="small">No charges in {PERIOD_LABEL[period]}.</p>}
        </section>
        <section className="panel" aria-labelledby="cpm-h">
          <div className="ph"><h2 id="cpm-h">Credits per meeting</h2></div>
          {byList.length ? <ListBars rows={listRows(byList, avg)} avg={avg} /> : <p className="small">No meetings in {PERIOD_LABEL[period]} yet.</p>}
        </section>
      </div>
    </>
  );
}
