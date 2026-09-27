import type { ActionRecord, Run } from "@/lib/domain/types";
import { toMs } from "@/lib/domain/time";
import { undo } from "@/app/(dash)/optimize/apply";

const LABEL: Record<string, string> = { repeat_skip: "Skip recently enriched", pause_list: "Paused enrichment", guardrail: "Skip unlikely contacts", lookalike: "Lookalike list" };

export function appliedSummary(a: ActionRecord, runs: Run[], listName: string): string {
  const when = new Date(a.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (a.kind === "lookalike") return `${when}. Saved as "${String(a.detail.title ?? "")}", 0 credits.`;
  const after = runs.filter((r) => r.kind === "pipeline_run" && r.listId === a.listId && r.startedAt && toMs(r.startedAt) > toMs(a.appliedAt));
  const skipped = after.reduce((s, r) => s + (r.recordsSkipped ?? 0), 0);
  const base = `${a.status === "undone" ? "Undone" : "Applied"} ${when} on ${listName}.`;
  if (a.kind === "pause_list") return `${base} ${after.length === 0 ? "No runs since." : `${after.length} manual runs since.`}`;
  return `${base} ${after.length === 0 ? "No runs since." : `${skipped} contacts skipped since, about ${skipped * 3} credits saved.`}`;
}

export function AppliedChanges({ actions, runs, listNames }: { actions: ActionRecord[]; runs: Run[]; listNames: Map<string, string> }) {
  const xs = actions.filter((a) => a.kind !== "refund_request").sort((a, b) => toMs(b.appliedAt) - toMs(a.appliedAt));
  return (
    <section className="panel" aria-labelledby="applied-h">
      <div className="ph"><h2 id="applied-h">Changes you&apos;ve made</h2><span className="small">What each one has done since</span></div>
      {xs.length === 0 && <p className="small">None yet. Changes you apply above show up here with what they did.</p>}
      {xs.map((a) => (
        <div className="applied" key={a.extId}>
          <i className="dot" style={{ background: a.status === "applied" ? "var(--booked)" : "var(--unknown)" }} />
          <div><b>{LABEL[a.kind]}</b><br /><span className="small">{appliedSummary(a, runs, listNamesGet(listNames, a.listId))}</span></div>
          {a.status === "applied" && a.kind !== "lookalike" && <form action={undo}><input type="hidden" name="extId" value={a.extId} /><button className="btn ghost" type="submit">Undo</button></form>}
        </div>))}
    </section>
  );
}
const listNamesGet = (m: Map<string, string>, id: number | null) => (id === null ? "the org" : m.get(String(id)) ?? `list ${id}`);
