import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "roi_session";
export function sessionValue(pw: string): string { return createHash("sha256").update(`roi-advisor:${pw}`).digest("hex"); }
export async function isAuthed(): Promise<boolean> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return false;
  return (await cookies()).get(SESSION_COOKIE)?.value === sessionValue(pw);
}
