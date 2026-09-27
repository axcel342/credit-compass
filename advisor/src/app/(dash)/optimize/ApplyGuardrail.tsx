"use client";
import { useActionState } from "react";
import { applyGuardrail } from "./actions";
export function ApplyGuardrail({ listId, estimate }: { listId: number; estimate: number }) {
  const [state, action, pending] = useActionState(applyGuardrail, undefined);
  return (
    <form action={action} className="dialog-foot">
      <input type="hidden" name="listId" value={listId} />
      <label><input type="checkbox" name="confirm" value="yes" /> Run it (about {estimate} credits)</label>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Running…" : "Apply guardrail and enrich"}</button>
      {state && <span className="toast" role="status">{state.message}</span>}
    </form>
  );
}
