import { linearScale, niceTicks } from "@/lib/dashboard/scale";
export function LineChart({ points, ariaLabel, unit }: { points: { label: string; value: number }[]; ariaLabel: string; unit: string }) {
  if (points.length < 2) return null;
  const W = 620, H = 200, L = 44, R = 40, T = 14, B = 28;
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 4);
  const sy = linearScale([ticks[0], ticks.at(-1)!], [H - B, T]);
  const sx = (i: number) => L + (i * (W - L - R)) / (points.length - 1);
  const xy = points.map((p, i) => [sx(i), sy(p.value)] as const);
  const line = "M" + xy.map(([x, y]) => `${x},${y}`).join("L");
  const area = `M${xy[0][0]},${sy(ticks[0])}` + xy.map(([x, y]) => `L${x},${y}`).join("") + `L${xy.at(-1)![0]},${sy(ticks[0])}Z`;
  const last = xy.at(-1)!;
  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="grid" /><text x={L - 8} y={sy(t) + 4} textAnchor="end">{t}</text></g>))}
        {points.map((p, i) => (i % 2 === 0 || i === points.length - 1 ? <text key={p.label} x={sx(i)} y={H - 8} textAnchor="middle">{p.label}</text> : null))}
        <path d={area} fill="var(--series-soft)" />
        <path d={line} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r={5} fill="var(--series)" stroke="var(--panel)" strokeWidth={2} />
        <text x={last[0] + 8} y={last[1] + 4} className="val">{Math.round(points.at(-1)!.value)}</text>
        {xy.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r={10} fill="transparent"><title>{`${points[i].label}: ${Math.round(points[i].value)} ${unit}`}</title></circle>))}
      </svg>
    </div>
  );
}
