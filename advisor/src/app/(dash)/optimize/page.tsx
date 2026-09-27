import { g8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";
import { RUN_CONDITION } from "@/lib/guardrail/guardrail";
import { adviseList } from "./actions";
import { ApplyGuardrail } from "./ApplyGuardrail";

export default async function PrespendPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const { list } = await searchParams;
  const lists = await g8Caller.call<{ id: number; title: string; total: number }[]>(OPS.listLists);
  const advice = list ? await adviseList(Number(list)) : null;
  const chosen = lists.find((l) => String(l.id) === list);
  return (
    <section>
      <div className="sec-head"><h2>Before you spend</h2><p>The Advisor speaks up only when it changes the decision, then graph8 enforces it through the list pipeline&apos;s run condition.</p></div>
      <form method="get" style={{ display: "flex", gap: 8 }}>
        <label htmlFor="list">List</label>
        <select id="list" name="list" defaultValue={list ?? ""}>{lists.map((l) => <option key={l.id} value={l.id}>{l.title} · {l.total}</option>)}</select>
        <button className="btn" type="submit">Check</button>
      </form>
      {advice && chosen && (
        <div className="dialog">
          <div className="dialog-head"><span className="eyebrow">Enrich list</span><h3>{chosen.title} · {advice.listSize} contacts</h3></div>
          <div className="dialog-body">
            <div className="est">
              <div><span className="muted">graph8 quote</span><span className="big struck">{advice.quote}</span><span>credits</span></div>
              <div><span className="muted">Advisor estimate</span><span className="big">~{advice.estimate}</span><span>{advice.missing} contacts need an email</span></div>
            </div>
            {advice.warn && <div className="callout"><strong>You could skip the contacts least likely to book</strong>
              <ul><li>{advice.flagged} records have an email that doesn&apos;t match their company</li><li>Fit: high {advice.fits.high} · medium {advice.fits.medium} · low {advice.fits.low} · unknown {advice.fits.unknown}</li></ul></div>}
            <div className="fitbar" aria-hidden="true">
              <div style={{ flex: advice.fits.high, background: "var(--series-strong)" }} /><div style={{ flex: advice.fits.medium, background: "var(--series)" }} />
              <div style={{ flex: advice.fits.low + advice.fits.unknown, background: "var(--series-weak)" }} />
            </div>
            <pre className="code">{RUN_CONDITION}</pre>
          </div>
          <ApplyGuardrail listId={advice.listId} estimate={advice.estimate} />
        </div>
      )}
    </section>
  );
}
