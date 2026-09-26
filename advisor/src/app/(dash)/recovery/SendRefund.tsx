"use client";
import { useActionState } from "react";
import { sendRefund } from "./actions";
export function SendRefund({ draft }: { draft: string }) {
  const [state, action, pending] = useActionState(sendRefund, undefined);
  return (
    <form action={action} className="draft">
      <div className="draft-head"><strong>Refund request draft</strong><span className="muted">Goes to graph8 support after you confirm</span></div>
      <label htmlFor="refund-text" className="eyebrow" style={{ padding: "10px 14px 0", display: "block" }}>Message</label>
      <textarea id="refund-text" name="message" defaultValue={draft} />
      <div className="draft-foot">
        <label><input type="checkbox" name="confirm" value="yes" /> I've read this and want to send it</label>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send to graph8 support"}</button>
        {state && <span className="toast" role="status">{state.message}</span>}
      </div>
    </form>
  );
}
