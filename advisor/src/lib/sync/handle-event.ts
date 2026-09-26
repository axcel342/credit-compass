import type { G8Caller } from "../g8/client";
import type { RecordStore } from "../store/records";
import { outcomeToValues, runToValues } from "../store/mappers";
import type { WebhookEnvelope } from "../webhooks/verify";
import { outcomeFromEvent } from "./outcomes";
import { fetchExecutionRun } from "./capture";

export async function handleEvent(e: WebhookEnvelope, deps: { c: G8Caller; outcomes: RecordStore; runs: RecordStore }): Promise<"outcome" | "run" | "ignored"> {
  const o = outcomeFromEvent(e);
  if (o) { await deps.outcomes.upsert(outcomeToValues(o)); return "outcome"; }
  if (e.event === "workflow.execution_completed" || e.event === "workflow.execution_failed") {
    const id = String((e.data ?? {}).execution_id ?? "");
    if (!id) return "ignored";
    const run = await fetchExecutionRun(deps.c, id, {});
    if (run) { await deps.runs.upsert(runToValues(run)); return "run"; }
  }
  return "ignored";
}
