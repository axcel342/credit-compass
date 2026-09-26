"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionValue } from "@/lib/auth";

export async function login(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw || form.get("password") !== pw) return { error: "That password isn't right. Check DASHBOARD_PASSWORD in the Vercel project settings." };
  (await cookies()).set(SESSION_COOKIE, sessionValue(pw), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
  redirect("/");
}
