"use client";
import { useActionState, useMemo, useState } from "react";
import { sendRefund } from "./actions";

export function RefundForm({ items, orgId, draftFor }: { items: { id: string; title: string; credits: number; line: string }[]; orgId: string; draftFor: string }) {
  const [picked, setPicked] = useState(() => new Set(items.map((x) => x.id)));
  const chosen = items.filter((x) => picked.has(x.id));
  const total = chosen.reduce((s, x) => s + x.credits, 0);
  const draft = useMemo(() => ["Hello graph8 support,", "", `We were charged ${Math.round(total).toLocaleString("en-US")} credits for work that produced nothing usable:`,
    ...chosen.map((x) => x.line), "", `Please refund the ${Math.round(total).toLocaleString("en-US")} credits. Org: ${orgId}.`].join("\n"), [chosen, total, orgId]);
  const [state, action, pending] = useActionState(sendRefund, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="refund">
      <fieldset><legend className="small">Include</legend>
        {items.map((x) => (<label key={x.id}><input type="checkbox" checked={picked.has(x.id)} onChange={() => setPicked((s) => { const t = new Set(s); if (t.has(x.id)) t.delete(x.id); else t.add(x.id); return t; })} /> {x.title} ({x.credits})</label>))}
      </fieldset>
      <label htmlFor="refund-text" className="small">Message to graph8 support</label>
      <textarea id="refund-text" name="message" key={draft} defaultValue={draft} data-draft-for={draftFor} />
      <input type="hidden" name="credits" value={total} />
      <div className="foot">
        <button type="button" className="btn ghost" onClick={async () => { await navigator.clipboard.writeText((document.getElementById("refund-text") as HTMLTextAreaElement).value); setCopied(true); }}>{copied ? "Copied" : "Copy text"}</button>
        <label><input type="checkbox" name="confirm" value="yes" /> I've read this and want to send it</label>
        <button className="btn primary" type="submit" disabled={pending || total === 0}>{pending ? "Sending…" : "Send to graph8 support"}</button>
        {state && <span className="toast" role="status">{state.message}</span>}
      </div>
    </form>
  );
}
