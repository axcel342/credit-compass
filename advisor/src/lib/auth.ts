import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { verifySession, WORKSPACE_COOKIE } from "./workspace/session";

export const SESSION_COOKIE = "roi_session";
export function sessionValue(pw: string): string { return createHash("sha256").update(`roi-advisor:${pw}`).digest("hex"); }
export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  if (verifySession(jar.get(WORKSPACE_COOKIE)?.value)) return true;
  const pw = process.env.DASHBOARD_PASSWORD;
  return !!pw && jar.get(SESSION_COOKIE)?.value === sessionValue(pw);
}
