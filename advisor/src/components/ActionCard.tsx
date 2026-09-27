"use client";
import { useActionState, useState } from "react";
import type { PlannedAction } from "@/lib/domain/actions";
import { applyAction } from "@/app/(dash)/optimize/apply";
import { n } from "@/lib/dashboard/story";

type Button = NonNullable<PlannedAction["button"]>;

function ApplyForm({ button, act, pending }: { button: Button; act: (f: FormData) => void; pending: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <form action={act}>
      <input type="hidden" name="action" value={button.action} /><input type="hidden" name="listIds" value={button.listIds.join(",")} />
      <label className="small confirm"><input type="checkbox" name="confirm" value="yes" checked={ok} onChange={(e) => setOk(e.target.checked)} /> {button.confirm}</label>
      <button className="btn primary" type="submit" disabled={pending || !ok}>{pending ? "Working…" : button.label}</button>
    </form>);
}

function Chart({ a }: { a: PlannedAction }) {
  if (a.id === "repeat" && a.chart.length === 2) return (
    <>
      <div className="oc-bar" aria-hidden="true">{a.chart.map((x) => <span key={x.label} style={{ flex: x.value, background: x.tone }} />)}</div>
      <div className="oc-key"><span>First time {n(a.chart[0].value)}</span><span className="bad-ink">Again within 30 days {n(a.chart[1].value)}</span></div>
    </>);
  if (a.id === "move-spend") {
    const max = Math.max(1, ...a.chart.map((x) => x.value));
    return (
      <>
        <div className="oc-cmp">{a.chart.map((x) => <div key={x.label}><span>{x.label}</span><i style={{ width: `${(x.value / max) * 100}%`, background: x.tone }} /><b>{x.value.toFixed(1)}</b></div>)}</div>
        <p className="small">Meetings per 1,000 credits</p>
      </>);
  }
  if (a.id === "skip-unlikely") return (
    <>
      <div className="oc-bar" aria-hidden="true">{a.chart.map((x) => <span key={x.label} style={{ flex: x.value, background: x.tone }} />)}</div>
      <div className="oc-key">{a.chart.map((x) => <span key={x.label} className={x.label === "Unlikely" ? "bad-ink" : undefined}>{x.label} {n(x.value)}{x.label === "Unlikely" ? ", skipped" : ""}</span>)}</div>
    </>);
  return null;
}

export function ActionCard({ a }: { a: PlannedAction }) {
  const [state, act, pending] = useActionState(applyAction, undefined);
  return (
    <article className={a.applied ? "oc applied" : "oc"} id={a.id}>
      <div className="oc-fig"><span className="fig tnum">{a.payoff.figure}</span><span className="u">{a.payoff.unit}</span></div>
      <div className="oc-main">
        <h2>{a.title}</h2>
        <Chart a={a} />
        {a.steps.length > 0 && (
          <ol className="oc-steps">{a.steps.map((s, i) => <li key={s.label} className={s.done ? "done" : undefined} title={s.sub}><span className="n" aria-hidden="true">{s.done ? "✓" : i + 1}</span>{s.label}</li>)}</ol>)}
        {a.evidence && <p className="oc-ev">{a.evidence}</p>}
        {a.confidence !== "High confidence" && <p className="small">{a.confidence}</p>}
        <details className="more"><summary>What changes in graph8</summary><p>{a.inGraph8}</p></details>
      </div>
      <div className="oc-side">
        {a.button ? <ApplyForm key={a.button.action} button={a.button} act={act} pending={pending} /> : <span className="done-tag">Done</span>}
        {state && <span className="toast" role="status">{state.ok ? state.message : `Not changed: ${state.message}`}</span>}
      </div>
    </article>
  );
}
