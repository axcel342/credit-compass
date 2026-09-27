import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { dashboardBuckets } from "@/lib/domain/gate";
import { rollingCostPerMeeting, firstTouchCohorts, trendChange } from "@/lib/domain/trend";
import { overviewHeadline, overviewLede, statStrip, plural } from "@/lib/dashboard/story";
import { flowData, layoutFlow } from "@/lib/dashboard/flow";
import { doNextItems } from "@/lib/dashboard/donext";
import { Headline } from "@/components/Headline";
import { StatStrip } from "@/components/StatStrip";
import { FlowDiagram } from "@/components/FlowDiagram";
import { DoNext } from "@/components/DoNext";
import { HBarChart } from "@/components/HBarChart";
import { TrendChart } from "@/components/TrendChart";

export default async function Overview({ searchParams }: { searchParams: Promise<{ period?: string; trend?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const total = v.coverage.total;
  const byList = v.stats.filter((s) => s.dimension === "list" && s.costPerMeeting !== null).sort((a, b) => a.costPerMeeting! - b.costPerMeeting!);
  const best = byList[0]?.value;
  const periodQuery = period === "30d" ? "period=30d" : "";
  const trendPoints = rollingCostPerMeeting(d.charges, d.outcomes, d.now);
  return (
    <>
      <Headline text={overviewHeadline({ total, meetings: v.meetings, won: v.won, wonValue: v.wonValue, periodLabel: PERIOD_LABEL[period] })} lede={overviewLede({ unused: v.buckets.unused, waste: v.buckets.waste })} />
      <StatStrip items={statStrip({ total, meetings: v.meetings, booked: v.buckets.booked, waste: v.buckets.waste, traced: v.coverage.exact, wonValue: v.wonValue, trend: trendChange(trendPoints) })} />
      <section className="panel">
        <div className="ph"><h2>Where every credit went</h2><span className="small">Click a band to see its charges</span></div>
        {total > 0 ? <FlowDiagram layout={layoutFlow(flowData(v.charges, v.bucketOf, d.listNames))} periodQuery={periodQuery} />
          : <p className="small">No charges in {PERIOD_LABEL[period]}. Switch to 8 weeks or run Sync now.</p>}
      </section>
      <div className="grid2">
        <DoNext items={doNextItems(dashboardBuckets(d.findings, d.now).open, 4, periodQuery)} />
        <section className="panel">
          <div className="ph"><h2>Credits per meeting, by list</h2><span className="small">Lower is better</span></div>
          {byList.length ? <HBarChart ariaLabel="Credits per meeting by list" unit="credits per meeting" labelW={130} max={Math.max(...byList.map((s) => s.costPerMeeting!)) * 1.05}
            rows={byList.map((s) => ({ label: d.listNames.get(s.value) ?? `List ${s.value}`, value: s.costPerMeeting!, note: plural(s.meetings, "meeting"), color: s.value === best ? "var(--booked)" : "var(--nomeet)" }))} />
            : <p className="small">No meetings in {PERIOD_LABEL[period]} yet.</p>}
          <TrendChart mode={sp.trend === "cohort" ? "cohort" : "rolling"} points={trendPoints}
            cohorts={firstTouchCohorts(d.charges, d.outcomes, d.now)}
            hrefFor={(m) => `/?${new URLSearchParams({ ...(m === "cohort" ? { trend: "cohort" } : {}), ...(period === "30d" ? { period: "30d" } : {}) })}`} />
        </section>
      </div>
    </>
  );
}
