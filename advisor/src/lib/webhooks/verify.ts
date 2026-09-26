import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookEnvelope { id?: string; event: string; timestamp: string; org_id: string; data: Record<string, unknown> }

export function verifyDelivery(rawBody: string, headers: Headers, secret: string, nowSec = Math.floor(Date.now() / 1000)):
  { ok: true; event: WebhookEnvelope } | { ok: false; reason: string } {
  const sigHeader = headers.get("x-studio-signature");
  const tsHeader = headers.get("x-studio-timestamp");
  if (!sigHeader || !tsHeader) return { ok: false, reason: "missing signature headers" };
  const ts = Number.parseInt(tsHeader, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };
  if (Math.abs(nowSec - ts) > 300) return { ok: false, reason: "stale delivery" };
  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const provided = sigHeader.startsWith("sha256=") ? sigHeader.slice(7) : sigHeader;
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(provided, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };
  try { return { ok: true, event: JSON.parse(rawBody) as WebhookEnvelope }; }
  catch { return { ok: false, reason: "invalid JSON" }; }
}
