import { Tag } from "./Tag";
export function KpiTile({ label, value, note, simulated, alert }: { label: string; value: string; note: string; simulated: boolean; alert?: boolean }) {
  return (
    <div className={`kpi${alert ? " alert" : ""}`}>
      <div className="k-top"><span className="k-label">{label}</span><Tag simulated={simulated} /></div>
      <div className="k-value">{value}</div>
      <div className="k-note">{note}</div>
    </div>
  );
}
