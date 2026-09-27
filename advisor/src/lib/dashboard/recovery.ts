import type { ActionRecord, AttributedCharge, Run } from "../domain/types";
import { isOnboardingResearch } from "../domain/buckets";
import { serviceName } from "../domain/names";
import { toMs } from "../domain/time";
import { n, plural } from "./story";

export const shortDate = (t: number | string) => new Date(typeof t === "string" ? toMs(t) : t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export interface RecoveryItem { id: string; owner: "refund" | "stopped" | "stoppable" | "usable"; title: string; detail: string; credits: number; at: string; ledgerIds: string[]; runIds: string[] }

export function recoveryItems(charges: AttributedCharge[], runs: Run[], ctx: { onboardingUnused: boolean; unusedDocs: number; advisorPosts: string[] }): RecoveryItem[] {
  const runMap = new Map(runs.map((r) => [r.extId, r]));
  const sum = (xs: AttributedCharge[]) => xs.reduce((s, c) => s + c.credits, 0);
  const first = (xs: AttributedCharge[]) => [...xs].sort((a, b) => toMs(a.chargedAt) - toMs(b.chargedAt))[0].chargedAt;
  const ids = (xs: AttributedCharge[]) => [...new Set(xs.map((c) => c.runExtId).filter((x): x is string => !!x))];
  const items: RecoveryItem[] = [];
  const bySvc = (reason: string) => { const m = new Map<string, AttributedCharge[]>(); for (const c of charges.filter((x) => x.wasteReason === reason)) m.set(c.service, [...(m.get(c.service) ?? []), c]); return m; };
  for (const [svc, xs] of bySvc("failed_job")) {
    const rs = ids(xs).map((id) => runMap.get(id)).filter((r): r is Run => !!r);
    const failed = rs.reduce((s, r) => s + (r.recordsFailed ?? 0), 0), total = rs.reduce((s, r) => s + (r.recordsFailed ?? 0) + (r.recordsOk ?? 0), 0);
    items.push({ id: `failed:${svc}`, owner: "refund", credits: sum(xs), at: first(xs), ledgerIds: xs.map((c) => c.ledgerId), runIds: ids(xs),
      title: total ? `${serviceName(svc)} failed on ${failed} of ${total} records and was still charged` : `${serviceName(svc)} jobs failed and were still charged`,
      detail: `${plural(ids(xs).length, "job")}, ${plural(xs.length, "ledger line")}` });
  }
  for (const [svc, xs] of bySvc("no_change")) items.push({ id: `unreadable:${svc}`, owner: "refund", credits: sum(xs), at: first(xs), ledgerIds: xs.map((c) => c.ledgerId),
    runIds: ids(xs), title: `${serviceName(svc)} returned a result graph8 can't read back`, detail: `${plural(xs.length, "ledger line")}` });
  const side = charges.filter((c) => c.wasteReason === "agent_side_effect");
  if (side.length) {
    const last = Math.max(...side.map((c) => toMs(c.chargedAt)));
    const stopped = ctx.advisorPosts.some((p) => toMs(p) > last + 60_000);
    items.push({ id: "side_effect", owner: stopped ? "stopped" : "stoppable", credits: sum(side), at: first(side), ledgerIds: side.map((c) => c.ledgerId), runIds: [],
      title: "Automated posts woke graph8's agent", detail: stopped ? "Recaps now post to #roi-advisor, which has no agent. No charges since." : "Post recaps only to #roi-advisor to stop this." });
  }
  const onboarding = charges.filter(isOnboardingResearch);
  if (ctx.onboardingUnused && onboarding.length) items.push({ id: "unused", owner: "usable", credits: sum(onboarding), at: first(onboarding), ledgerIds: onboarding.map((c) => c.ledgerId),
    runIds: [], title: `${plural(ctx.unusedDocs, "onboarding document")} nobody has used`, detail: "Not refundable. Paid for and still available in graph8." });
  return items.sort((a, b) => toMs(a.at) - toMs(b.at));
}

export function refundDraftFor(items: RecoveryItem[], orgId: string): string {
  const total = items.reduce((s, x) => s + x.credits, 0);
  const lines = items.map((x) => `- ${x.title}: ${n(x.credits)} credits (${x.runIds.length ? `${x.runIds.length === 1 ? "job" : "jobs"} ${x.runIds.map((id) => id.slice(0, 8)).join(", ")}; ` : ""}${shortDate(x.at)}).`);
  return ["Hello graph8 support,", "", `We were charged ${n(total)} credits for work that produced nothing usable:`, ...lines, "", `Please refund the ${n(total)} credits. Org: ${orgId}.`].join("\n");
}

export function claimState(actions: ActionRecord[], found: number) {
  const open = actions.filter((a) => a.kind === "refund_request" && a.status !== "undone").sort((a, b) => toMs(b.appliedAt) - toMs(a.appliedAt))[0] ?? null;
  const credits = open ? Number(open.detail.credits ?? 0) : 0;
  return { found, requested: open ? credits : 0, refunded: open?.status === "refunded" ? credits : 0, open };
}

export interface AlsoRow { id: string; credits: number; lead: string; text: string }

export function alsoRows(items: RecoveryItem[]): AlsoRow[] {
  return items.filter((x) => x.owner !== "refund").map((x) => ({
    id: x.id, credits: x.credits,
    lead: x.owner === "stopped" ? "Already stopped." : x.owner === "stoppable" ? "You can stop this." : "Still yours to use.",
    text: x.owner === "stopped" ? `${x.title}. No charges since.` : x.owner === "stoppable" ? `${x.title}. Post recaps only to #roi-advisor.` : `${x.title}.`,
  }));
}
