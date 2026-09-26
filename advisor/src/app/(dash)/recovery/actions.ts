"use server";
import { g8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";

export async function sendRefund(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm you've read the message." };
  const message = String(form.get("message") ?? "");
  if (message.length < 40) return { ok: false, message: "The message is empty." };
  await g8Caller.call(OPS.contactSupport, { body: { message, urgency: "normal" } });
  return { ok: true, message: "Sent to graph8 support." };
}
