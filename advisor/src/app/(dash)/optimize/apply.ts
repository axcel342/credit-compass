"use server";
import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { currentCaller, currentWorkspace } from "@/lib/workspace/current";
import { loadDashboardData } from "@/lib/dashboard/data";
import { plural } from "@/lib/dashboard/story";
import { RecordStore } from "@/lib/store/records";
import { valuesToContact } from "@/lib/store/mappers";
import { lookalikeFilters } from "@/lib/domain/actions";
import { applyGuardrailRule, applyLookalike, applyPause, applyRepeatSkip, undoAction } from "@/lib/actions/apply";

type Result = { ok: boolean; message: string };
const DONE: Record<string, string> = { repeat: "Turned on", lookalike: "Built the lookalike list", pause: "Paused", guardrail: "Applied the rule" };

export async function applyAction(_: unknown, form: FormData): Promise<Result> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm the change in graph8." };
  const c = await currentCaller(), ws = await currentWorkspace(), now = new Date().toISOString();
  const action = String(form.get("action")), listIds = String(form.get("listIds") ?? "").split(",").filter(Boolean).map(Number);
  try {
    const d = await loadDashboardData(c);
    const rows = (await new RecordStore(c, "roi_contact").list()).map((r) => valuesToContact(r.values));
    if (action === "repeat") {
      const r = await applyRepeatSkip(c, listIds, now);
      revalidatePath("/optimize");
      return { ok: true, message: `${DONE.repeat} for ${r.changed.length} ${r.changed.length === 1 ? "pipeline" : "pipelines"}${r.skipped.length ? `; ${plural(r.skipped.length, "list")} ${r.skipped.length === 1 ? "has" : "have"} no pipeline` : ""}.` };
    }
    const listId = listIds[0];
    if (action === "lookalike") {
      const name = d.listNames.get(String(listId)) ?? `list ${listId}`;
      await applyLookalike(c, { listId, title: `Lookalike of ${name}`, filters: lookalikeFilters(rows.filter((r) => r.listIds.includes(listId))) }, now);
    } else if (action === "pause") {
      if (!(await applyPause(c, listId, now))) return { ok: false, message: "That list has no enrichment pipeline to pause." };
    } else if (action === "guardrail") {
      if (!(await applyGuardrailRule(c, listId, rows.filter((r) => r.listIds.includes(listId)), now, { columnId: ws.fitColumnId, name: ws.fitFieldName }))) return { ok: false, message: "That list has no enrichment pipeline." };
    } else return { ok: false, message: "Unknown action." };
    revalidatePath("/optimize");
    return { ok: true, message: `${DONE[action]}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function undo(form: FormData): Promise<void> {
  if (!(await isAuthed())) throw new Error("Sign in first.");
  const c = await currentCaller();
  const d = await loadDashboardData(c);
  const a = d.actions.find((x) => x.extId === String(form.get("extId")));
  if (a) await undoAction(c, a);
  revalidatePath("/optimize");
}
