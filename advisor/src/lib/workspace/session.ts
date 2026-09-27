import { createHmac, timingSafeEqual } from "node:crypto";
export const WORKSPACE_COOKIE = "cc_ws";
const sig = (id: string) => createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`ws:${id}`).digest("base64url");
export function signSession(id: string): string { return `${id}.${sig(id)}`; }
export function verifySession(value: string | undefined | null): string | null {
  if (!value || !process.env.SESSION_SECRET) return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const id = value.slice(0, i), a = Buffer.from(value.slice(i + 1)), b = Buffer.from(sig(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
