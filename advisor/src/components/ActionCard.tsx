"use client";
import { useActionState } from "react";
import type { PlannedAction } from "@/lib/domain/actions";
import { applyAction } from "@/app/(dash)/optimize/apply";

export function ActionCard({ a }: { a: PlannedAction }) {
  const [state, act, pending] = useActionState(applyAction, undefined);
  const max = Math.max(1, ...a.chart.map((x) => x.value));
  return (
    <article className="act" id={a.id}>
      <div className="act-main">
        <div className="act-head"><h2>{a.title}</h2><span className="impact">{a.impact}</span></div>
        <p>{a.evidence}</p>
        {a.chart.length > 0 && (a.id === "repeat"
          ? <div className="evbar">{a.chart.map((x) => <span key={x.label} style={{ flex: x.value, background: x.tone }}>{x.label} {Math.round(x.value).toLocaleString("en-US")}</span>)}</div>
          : <div className="cmp">{a.chart.map((x) => <div key={x.label}><span>{x.label}</span><i style={{ width: `${(x.value / max) * 100}%`, background: x.tone }} /><b>{x.value.toFixed(1)}</b></div>)}</div>)}
        {a.steps.length > 0 && <ol className="steps2">{a.steps.map((s) => <li key={s.label} className={s.done ? "done" : undefined}><span>{s.label}</span><small>{s.sub}</small></li>)}</ol>}
        <p className="what">In graph8: {a.inGraph8}</p>
      </div>
      <div className="act-side">
        <span className="small">{a.confidence}</span>
        {a.button ? (
          <form action={act}>
            <input type="hidden" name="action" value={a.button.action} /><input type="hidden" name="listIds" value={a.button.listIds.join(",")} />
            <label className="small"><input type="checkbox" name="confirm" value="yes" /> Change this in graph8</label>
            <button className="btn primary" type="submit" disabled={pending}>{pending ? "Working…" : a.button.label}</button>
            <span className="small">0 credits</span>
          </form>) : <span className="done-tag">Done</span>}
        {state && <span className="toast" role="status">{state.ok ? state.message : `Not changed: ${state.message}`}</span>}
      </div>
    </article>
  );
}
