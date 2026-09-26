import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyDelivery } from "@/lib/webhooks/verify";

const secret = "test-secret";
const body = JSON.stringify({ id: "evt_1", event: "deal.created", timestamp: "2026-09-26T15:05:47Z", org_id: "org_x", data: { deal_id: "d1" } });
function headersFor(ts: number, b = body, s = secret) {
  const sig = "sha256=" + createHmac("sha256", s).update(`${ts}.${b}`).digest("hex");
  return new Headers({ "x-studio-signature": sig, "x-studio-timestamp": String(ts) });
}

describe("verifyDelivery", () => {
  const now = 1790437000;
  it("accepts a valid signature", () => {
    const r = verifyDelivery(body, headersFor(now), secret, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.event.event).toBe("deal.created");
  });
  it("rejects a tampered body", () => {
    const r = verifyDelivery(body.replace("d1", "d2"), headersFor(now), secret, now);
    expect(r.ok).toBe(false);
  });
  it("rejects a delivery older than 300 seconds", () => {
    expect(verifyDelivery(body, headersFor(now - 900), secret, now).ok).toBe(false);
  });
  it("rejects a wrong secret and missing headers", () => {
    expect(verifyDelivery(body, headersFor(now, body, "other"), secret, now).ok).toBe(false);
    expect(verifyDelivery(body, new Headers(), secret, now).ok).toBe(false);
  });
});
