import { loadDashboardData } from "@/lib/dashboard/data";
import { dashboardBuckets } from "@/lib/domain/gate";
import { KpiTile } from "@/components/KpiTile";
import { HBarChart } from "@/components/HBarChart";
import { FindingCard } from "@/components/FindingCard";
import { formatCostPerMeeting } from "@/lib/domain/metrics";
import { syncNow } from "./actions";

export default async function Overview() {
  const d = await loadDashboardData();
  const org = d.stats.find((s) => s.dimension === "org" && s.period === "8w");
  const byService = d.stats.filter((s) => s.dimension === "service" && s.period === "8w").sort((a, b) => b.credits - a.credits);
  const byList = d.stats.filter((s) => s.dimension === "list" && s.period === "8w" && s.costPerMeeting !== null).sort((a, b) => (a.costPerMeeting ?? 0) - (b.costPerMeeting ?? 0));
  const { open, watching } = dashboardBuckets(d.findings, d.now);
  const pct = d.coverage.total ? Math.round((d.coverage.exact / d.coverage.total) * 100) : 0;
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  return (
    <section>
      <div className="sec-head"><h2>Overview</h2><form action={syncNow}><button className="btn" type="submit">Sync now</button></form></div>
      <div className="kpis">
        <KpiTile label="Credits spent" value={n(d.coverage.total)} note={`${d.charges.filter((c) => !c.simulated).length} charges`} simulated={false} />
        <KpiTile label="Wasted" value={n(d.waste)} note="Failed jobs, unreadable results, side effects" simulated={false} alert />
        <KpiTile label="Traced exactly" value={`${pct}%`} note={`${n(d.coverage.exact)} credits tied to a contact, list or run`} simulated={false} />
        <KpiTile label="Meetings" value={org ? n(org.meetings) : "0"} note="Last 8 weeks" simulated={org?.simulated ?? false} />
        <KpiTile label="Credits per meeting" value={org?.costPerMeeting !== null && org ? n(org.costPerMeeting!) : "—"} note={org ? formatCostPerMeeting(org) : "No data yet"} simulated={org?.simulated ?? false} />
      </div>
      <div className="two">
        <div className="stack">
          <HBarChart ariaLabel="Credits by service" unit="credits" max={Math.max(1, ...byService.map((s) => s.credits))} rows={byService.map((s) => ({ label: s.value, value: s.credits, simulated: s.simulated }))} labelW={170} />
          {byList.length > 0 && <HBarChart ariaLabel="Credits per meeting by list" unit="credits per meeting" avg={org?.costPerMeeting ?? undefined}
            max={Math.max(...byList.map((s) => s.costPerMeeting ?? 0)) * 1.05} rows={byList.map((s) => ({ label: `List ${s.value}`, value: s.costPerMeeting ?? 0, note: `${s.meetings} meetings`, simulated: s.simulated }))} />}
        </div>
        <aside className="advisor"><div className="advisor-head"><h3>Advisor</h3><span className="muted">{open.length} open</span></div>
          {open.map((f) => <FindingCard key={f.extId} f={f} />)}
          {watching.length > 0 && <div className="watching">Watching (low confidence): {watching.map((f) => f.title).join(" · ")}</div>}
        </aside>
      </div>
    </section>
  );
}
