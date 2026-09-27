export function ForecastBar({ expected, lo, hi, lowConfidence, basis }: { expected: number; lo: number; hi: number; lowConfidence: boolean; basis: string }) {
  const max = Math.max(10, hi + 2), pct = (v: number) => `${(v / max) * 100}%`;
  const text = expected < 1 ? `Less than 1 meeting, likely ${lo} to ${hi}` : `About ${Math.round(expected)} meetings, likely ${lo} to ${hi}`;
  return (
    <div className="forecast">
      <div className="ph"><h3>What it should book</h3><span className="small">{basis}{lowConfidence ? " Low confidence: fewer than 5 meetings of history." : ""}</span></div>
      <div className="fc" aria-hidden="true"><span className="rg" style={{ left: pct(lo), width: pct(hi - lo) }} /><span className="pt" style={{ left: pct(expected) }} /></div>
      <p className="fcx"><span>0</span><b>{text}</b><span>{max}</span></p>
    </div>
  );
}
