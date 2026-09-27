import { linearScale } from "@/lib/dashboard/scale";
export interface Bar { label: string; value: number; note?: string; simulated?: boolean; color?: string }
export function HBarChart({ rows, max, avg, unit, labelW = 190, ariaLabel }: { rows: Bar[]; max: number; avg?: number; unit: string; labelW?: number; ariaLabel: string }) {
  const W = 620, valW = 64, rowH = 30, barH = 14, top = 6;
  const H = top + rows.length * rowH + (avg ? 22 : 6);
  const sx = linearScale([0, max], [labelW, W - valW]);
  const path = (x: number, y: number, w: number, h: number, r = 4) => { r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <line x1={labelW} x2={labelW} y1={top - 2} y2={top + rows.length * rowH - 4} className="axis" />
        {rows.map((r, i) => { const y = top + i * rowH + (rowH - barH) / 2 - 4; const w = Math.max(2, sx(r.value) - labelW); return (
          <g key={r.label}>
            <title>{`${r.label}: ${Math.round(r.value).toLocaleString("en-US")} ${unit}${r.note ? ` · ${r.note}` : ""}`}</title>
            <text x={labelW - 10} y={y + barH / 2 + 4} textAnchor="end">{r.label}</text>
            <path d={path(labelW, y, w, barH)} fill={r.color ?? "var(--series)"} />
            <text x={labelW + w + 6} y={y + barH / 2 + 4} className="val">{Math.round(r.value).toLocaleString("en-US")}</text>
          </g>); })}
        {avg !== undefined && (<g>
          <line x1={sx(avg)} x2={sx(avg)} y1={top - 2} y2={top + rows.length * rowH - 4} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={sx(avg)} y={top + rows.length * rowH + 11} textAnchor="middle">{`average ${Math.round(avg)}`}</text></g>)}
      </svg>
    </div>
  );
}
