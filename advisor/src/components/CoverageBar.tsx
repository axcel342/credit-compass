export function CoverageBar({ exact, window, none }: { exact: number; window: number; none: number }) {
  const total = Math.max(exact + window + none, 1), pct = (x: number) => Math.round((x / total) * 100);
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  return (
    <div className="coverage">
      <h3>How the {n(total)} credits were matched</h3>
      <div className="covbar" aria-hidden="true">
        <div style={{ flex: exact, background: "var(--series-strong)" }} title={`Exact ${n(exact)}`} />
        <div style={{ flex: window, background: "var(--series)" }} title={`Time window ${n(window)}`} />
        <div style={{ flex: none, background: "var(--series-weak)" }} title={`Service only ${n(none)}`} />
      </div>
      <div className="covkey">
        <span><i className="sw" style={{ background: "var(--series-strong)" }} />Exact: {n(exact)} ({pct(exact)}%) · run, job or pipeline ID</span>
        <span><i className="sw" style={{ background: "var(--series)" }} />Time window: {n(window)} ({pct(window)}%) · matched by timestamp</span>
        <span><i className="sw" style={{ background: "var(--series-weak)" }} />Service only: {n(none)} ({pct(none)}%) · can't be traced</span>
      </div>
    </div>
  );
}
