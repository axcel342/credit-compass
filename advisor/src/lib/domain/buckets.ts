import type { AttributedCharge, Outcome, OutcomeBucket } from "./types";
import { toMs } from "./time";

export const BUCKETS: OutcomeBucket[] = ["booked", "nomeet", "unused", "unknown", "waste"];
export const BUCKET_LABEL: Record<OutcomeBucket, string> = {
  booked: "Booked a meeting", nomeet: "No meeting yet", unused: "Never used", unknown: "Can't tell yet", waste: "Wasted",
};

export interface BucketContext { meetingsByContact: Map<number, number[]>; onboardingUnused: boolean }

export function meetingsByContact(outcomes: Outcome[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const o of outcomes) {
    if (o.type !== "meeting_booked" || o.contactId === null) continue;
    m.set(o.contactId, [...(m.get(o.contactId) ?? []), toMs(o.occurredAt)].sort((a, b) => a - b));
  }
  return m;
}

export function isOnboardingResearch(c: AttributedCharge): boolean {
  return c.service === "studio_global" && c.method === "time_window";
}

export function outcomeBucket(c: AttributedCharge, ctx: BucketContext): OutcomeBucket {
  if (c.isWaste) return "waste";
  if (ctx.onboardingUnused && isOnboardingResearch(c)) return "unused";
  if (c.contactId !== null) {
    const t = toMs(c.chargedAt);
    if ((ctx.meetingsByContact.get(c.contactId) ?? []).some((m) => m >= t)) return "booked";
  }
  if (c.contactId !== null || c.listId !== null) return "nomeet";
  return "unknown";
}

export function bucketTotals(charges: AttributedCharge[], ctx: BucketContext): Record<OutcomeBucket, number> {
  const t: Record<OutcomeBucket, number> = { booked: 0, nomeet: 0, unused: 0, unknown: 0, waste: 0 };
  for (const c of charges) t[outcomeBucket(c, ctx)] += c.credits;
  return t;
}
