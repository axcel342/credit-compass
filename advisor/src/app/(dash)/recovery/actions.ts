"use server";
import { revalidatePath } from "next/cache";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";
import { currentCaller } from "@/lib/workspace/current";
import { RecordStore } from "@/lib/store/records";
import { actionToValues } from "@/lib/store/mappers";

export async function sendRefund(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm you've read the message." };
  const message = String(form.get("message") ?? ""), credits = Number(form.get("credits") ?? 0);
  if (message.length < 40) return { ok: false, message: "The message is empty. Tick at least one item." };
  const c = await currentCaller();
  await c.call(OPS.contactSupport, { body: { message, urgency: "normal" } });
  const at = new Date().toISOString();
  await new RecordStore(c, "roi_action").upsert(actionToValues({ extId: `refund:${at}`, kind: "refund_request", listId: null, pipelineId: null, appliedAt: at,
    status: "requested", previous: null, detail: { credits, message }, simulated: false }));
  revalidatePath("/recovery");
  return { ok: true, message: "Sent to graph8 support." };
}

export async function markRefunded(form: FormData): Promise<void> {
  if (!(await isAuthed())) throw new Error("Sign in first.");
  const c = await currentCaller(), ext = String(form.get("extId") ?? "");
  const store = new RecordStore(c, "roi_action");
  const rec = (await store.list()).find((r) => r.values.ext_id === ext);
  if (!rec) throw new Error("That refund request no longer exists.");
  await store.upsert({ ...rec.values, status: "refunded" });
  revalidatePath("/recovery");
}
