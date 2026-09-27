"use client";
import { useActionState } from "react";
import { runPlan } from "./actions";
export function RunPlan({ listId, estimate, records, verb }: { listId: number; estimate: number; records: number; verb: string }) {
  const [state, action, pending] = useActionState(runPlan, undefined);
  return (
    <form action={action} className="foot">
      <input type="hidden" name="listId" value={listId} />
      <label><input type="checkbox" name="confirm" value="yes" /> Spend about {estimate} credits</label>
      <button className="btn primary" type="submit" disabled={pending || records === 0}>{pending ? "Running…" : `${verb} ${records} ${records === 1 ? "contact" : "contacts"}`}</button>
      {state && <span className="toast" role="status">{state.ok ? state.message : `Not run: ${state.message}`}</span>}
    </form>
  );
}
