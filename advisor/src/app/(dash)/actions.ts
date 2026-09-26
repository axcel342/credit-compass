"use server";
import { revalidatePath } from "next/cache";
import { g8Caller } from "@/lib/g8/client";
import { runSync } from "@/lib/sync/run-sync";
import { isAuthed } from "@/lib/auth";
export async function syncNow(): Promise<void> {
  if (!(await isAuthed())) throw new Error("Sign in first");
  await runSync({ c: g8Caller });
  revalidatePath("/");
}
