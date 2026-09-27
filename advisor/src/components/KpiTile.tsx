export function KpiTile({ label, value, note, alert }: { label: string; value: string; note: string; alert?: boolean }) {
  return (
    <div className={`kpi${alert ? " alert" : ""}`}>
      <div className="k-top"><span className="k-label">{label}</span></div>
      <div className="k-value">{value}</div>
      <div className="k-note">{note}</div>
    </div>
  );
}
