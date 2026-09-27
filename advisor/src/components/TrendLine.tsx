import type { TrendLineData } from "@/lib/domain/trend";

export function TrendLine({ t }: { t: TrendLineData | null }) {
  if (!t) return null;
  const W = 120, H = 32, P = 4;
  const min = Math.min(...t.values), span = Math.max(...t.values) - min || 1;
  const pts = t.values.map((v, i) => [P + (i * (W - 2 * P)) / (t.values.length - 1), P + ((Math.max(...t.values) - v) / span) * (H - 2 * P)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts.at(-1)!;
  const good = t.direction === "down";
  return (
    <p className="trendline">
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={`${line} L${lx.toFixed(1)},${H} L${P},${H} Z`} fill={good ? "var(--good-bg)" : "var(--crit-bg)"} />
        <path d={line} fill="none" stroke={good ? "var(--booked)" : "var(--waste)"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r={3} fill={good ? "var(--booked)" : "var(--waste)"} />
      </svg>
      <span>Cost per meeting is <b className={good ? "good-ink" : "bad-ink"}>{t.direction} {t.pct}%</b> since {t.since}</span>
    </p>
  );
}
