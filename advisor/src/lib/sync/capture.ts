import type { G8Caller } from "../g8/client";
import { isNotFound } from "../g8/client";
import { OPS } from "../g8/ops";
import type { Run } from "../domain/types";
import { runFromExecution, type ExecutionRecord } from "../domain/runs";
import { toIso, toMs } from "../domain/time";

export async function fetchExecutionRun(c: G8Caller, executionId: string, actionNames: Record<string, string>): Promise<Run | null> {
  try { return runFromExecution(await c.callRaw<ExecutionRecord>(OPS.getExecution, { path: { execution_id: executionId } }), actionNames); }
  catch (e) { if (isNotFound(e)) return null; throw e; }
}

interface PipelineItem { id: string; name: string; last_run?: { run_id: string } | null }
interface PipelineRun { run_id: string; list_id: number; status: string; started_at?: string | null; pipeline_name?: string;
  step_progress?: { total_records?: number; processed_records?: number; successful?: number; failed?: number; skipped_by_reason?: Record<string, number> }[] }

export async function pollPipelineRuns(c: G8Caller, listIds: number[]): Promise<Run[]> {
  const runs: Run[] = [];
  for (const listId of listIds) {
    const res = await c.call<{ items: PipelineItem[] }>(OPS.listListPipelines, { path: { list_id: listId } });
    for (const p of res.items ?? []) {
      if (!p.last_run?.run_id) continue;
      const r = await c.call<PipelineRun>(OPS.getPipelineRun, { path: { run_id: p.last_run.run_id } });
      const prog = r.step_progress ?? [];
      const skipped = prog.reduce((s, x) => s + Object.values(x.skipped_by_reason ?? {}).reduce((a, b) => a + b, 0), 0);
      const started = r.started_at ?? null;
      runs.push({ extId: r.run_id, kind: "pipeline_run", service: "waterfall_enrichment", actionName: `List pipeline · ${p.name}`, startedAt: started,
        completedAt: r.status === "completed" && started ? toIso(toMs(started) + 180_000) : null, status: r.status, source: "poll", listId: r.list_id,
        recordsOk: prog.reduce((s, x) => s + (x.successful ?? 0), 0), recordsFailed: prog.reduce((s, x) => s + (x.failed ?? 0), 0), recordsSkipped: skipped });
    }
  }
  return runs;
}

export async function fetchOnboardingAnchors(c: G8Caller) {
  const docs = (await c.call<{ items: { created_at: string }[] }>(OPS.documentsAnalytics)).items ?? [];
  const reports = await c.call<{ updated_at: string }[]>(OPS.listResearchReports);
  const pages = (await c.call<{ items: { created_at: string }[] }>(OPS.listLandingPages)).items ?? [];
  if (!docs.length || !reports.length) return null;
  const asc = (xs: string[]) => [...xs].sort((a, b) => toMs(a) - toMs(b));
  return {
    firstStudioDocCreatedAt: asc(docs.map((d) => d.created_at))[0],
    lastResearchReportUpdatedAt: asc(reports.map((r) => r.updated_at)).at(-1)!,
    landingPageCreatedAt: pages.length ? asc(pages.map((p) => p.created_at))[0] : null,
  };
}

export async function fetchUnusedDocs(c: G8Caller): Promise<{ name: string; createdAt: string }[]> {
  const docs = (await c.call<{ items: { display_name: string; created_at: string; usage_count: number }[] }>(OPS.documentsAnalytics)).items ?? [];
  return docs.filter((d) => (d.usage_count ?? 0) === 0).map((d) => ({ name: d.display_name, createdAt: d.created_at }));
}
