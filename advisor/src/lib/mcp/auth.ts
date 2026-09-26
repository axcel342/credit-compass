import { timingSafeEqual } from "node:crypto";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function authorizeMcp(req: Request, token: string): boolean {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/message")) return true;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && same(auth.slice(7), token)) return true;
  const key = url.searchParams.get("key");
  return !!key && same(key, token);
}
