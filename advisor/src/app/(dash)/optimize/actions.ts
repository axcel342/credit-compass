"use server";
import { revalidatePath } from "next/cache";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";
import { currentCaller } from "@/lib/workspace/current";
import { loadDashboardData } from "@/lib/dashboard/data";
import { loadPlan } from "@/lib/dashboard/planner-data";
import { RecordStore } from "@/lib/store/records";
import { runToValues } from "@/lib/store/mappers";
import { ROI_FIT_FIELD_NAME, RUN_CONDITION, assertConditionFilters, ensurePipeline, readPipelineRun, runGuardedPipeline, setRunCondition, validateCondition, writeFit } from "@/lib/guardrail/guardrail";

export async function runPlan(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm the run and its cost." };
  const c = await currentCaller(), listId = Number(form.get("listId"));
  try {
    const plan = await loadPlan(c, await loadDashboardData(c), listId, "find");
    if (!plan.runnable) return { ok: false, message: plan.reason ?? "This enrichment can't run on this list yet." };
    await writeFit(c, { columnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fits: new Map(plan.rows.map((r) => [r.contactId, r.fit])) });
    await validateCondition(c, RUN_CONDITION);
    await assertConditionFilters(c, { listId, listSize: plan.rows.length, fieldName: ROI_FIT_FIELD_NAME, value: "low" });
    const pipeline = await ensurePipeline(c, listId);
    await setRunCondition(c, { listId, pipeline, condition: RUN_CONDITION });
    const before = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    const startedAt = new Date().toISOString(), cap = Number(process.env.ACTION_CREDIT_CAP ?? 50);
    const { runId } = await runGuardedPipeline(c, { listId, pipelineId: pipeline.id, estimatedCredits: plan.walk.estimate, cap: Number.isFinite(cap) ? cap : 50 });
    const runs = new RecordStore(c, "roi_run");
    const base = { extId: runId, kind: "pipeline_run" as const, service: "waterfall_enrichment", actionName: `List pipeline · ${pipeline.name}`, startedAt, source: "advisor" as const, listId, quotedCredits: plan.walk.estimate };
    await runs.upsert(runToValues({ ...base, completedAt: null, status: "running" }));
    let r = await readPipelineRun(c, runId);
    for (let i = 0; i < 36 && r.status !== "completed" && r.status !== "failed"; i++) { await new Promise((x) => setTimeout(x, 5000)); r = await readPipelineRun(c, runId); }
    const after = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    await runs.upsert(runToValues({ ...base, completedAt: new Date().toISOString(), status: r.status, recordsOk: r.successful, recordsFailed: r.failed, recordsSkipped: r.skipped }));
    revalidatePath("/optimize");
    return { ok: true, message: `Enriched ${r.successful}, skipped ${r.skipped}, spent ${Math.round(before - after)} credits.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
