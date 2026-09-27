import Link from "next/link";
import type { Cohort, TrendPoint } from "@/lib/domain/trend";
import { trendSentence } from "@/lib/domain/trend";
import { LineChart } from "./LineChart";

export function TrendChart({ mode, points, cohorts, hrefFor }: { mode: "rolling" | "cohort"; points: TrendPoint[]; cohorts: Cohort[]; hrefFor: (m: "rolling" | "cohort") => string }) {
  const line = points.filter((p): p is { label: string; value: number } => p.value !== null);
  const max = Math.max(1, ...cohorts.map((c) => c.costPerMeeting ?? 0));
  return (
    <div className="trend">
      <div className="ph"><h2>{mode === "rolling" ? "Getting cheaper?" : "By week first enriched"}</h2>
        <span className="seg" role="group" aria-label="Trend view">
          <Link href={hrefFor("rolling")} className={mode === "rolling" ? "on" : undefined}>Rolling 4 weeks</Link>
          <Link href={hrefFor("cohort")} className={mode === "cohort" ? "on" : undefined}>By week spent</Link>
        </span></div>
      {mode === "rolling" ? (<>
        <p className="small">{trendSentence(points) ?? "Not enough weeks with meetings to show a trend yet."}</p>
        {line.length >= 2 && <LineChart points={line} unit="credits per meeting" ariaLabel={trendSentence(points) ?? "Credits per meeting over time"} />}
      </>) : (<>
        <p className="small">Credits per meeting for the contacts first enriched each week. Hatched weeks are still maturing: their meetings are still coming in.</p>
        <div className="cohorts" role="list">{cohorts.map((c) => (
          <div role="listitem" key={c.label} className={c.maturing ? "maturing" : undefined} title={`${c.label}: ${c.contacts} contacts, ${Math.round(c.credits)} credits, ${c.meetings} meetings`}>
            <span className="v">{c.costPerMeeting === null ? "—" : Math.round(c.costPerMeeting)}</span>
            <i style={{ height: `${((c.costPerMeeting ?? 0) / max) * 110}px` }} /><span className="small">{c.label}</span></div>))}</div>
      </>)}
    </div>
  );
}
