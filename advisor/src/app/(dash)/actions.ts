"use server";
import { revalidatePath } from "next/cache";
import { currentCaller } from "@/lib/workspace/current";
import { runSync } from "@/lib/sync/run-sync";
import { isAuthed } from "@/lib/auth";
export async function syncNow(): Promise<void> {
  if (!(await isAuthed())) throw new Error("Sign in first");
  await runSync({ c: await currentCaller() });
  revalidatePath("/", "layout");
}
