import { n, type ListRow } from "@/lib/dashboard/story";

export function ListBars({ rows, avg }: { rows: ListRow[]; avg: number | null }) {
  const max = Math.max(...rows.map((r) => r.value), avg ?? 0) || 1;
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="lbars" role="list">
      {rows.map((r) => (
        <div className="lb" role="listitem" key={r.label}>
          <span className="nm">{r.label}</span>
          <span className="tr" aria-hidden="true">
            <i style={{ width: pct(r.value), background: r.color }} />
            {avg !== null && <span className="avg" style={{ left: pct(avg) }} />}
          </span>
          <b>{n(r.value)}</b>
          <span className={r.tone ? `note ${r.tone}-ink` : "note"}>{r.note}</span>
        </div>
      ))}
      {avg !== null && (
        <div className="lb foot" aria-hidden="true"><span /><span className="tr"><span className="avg-l" style={{ left: pct(avg) }}>average {n(avg)}</span></span></div>
      )}
    </div>
  );
}
