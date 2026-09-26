import type { AttributedCharge } from "../domain/types";
import { toMs } from "../domain/time";

export function buildRefundDraft(p: { orgId: string; charges: AttributedCharge[]; reason: "failed_job" | "no_change" }) {
  const xs = p.charges.filter((c) => c.wasteReason === p.reason && !c.simulated);
  if (!xs.length) return null;
  const credits = xs.reduce((s, c) => s + c.credits, 0);
  const byRun = new Map<string, AttributedCharge[]>();
  for (const c of xs) byRun.set(c.runExtId ?? "unknown", [...(byRun.get(c.runExtId ?? "unknown") ?? []), c]);
  const times = xs.map((c) => toMs(c.chargedAt)).sort((a, b) => a - b);
  const day = new Date(times[0]).toISOString().slice(0, 10);
  const span = `${new Date(times[0]).toISOString().slice(11, 16)}–${new Date(times.at(-1)!).toISOString().slice(11, 16)} UTC`;
  const why = p.reason === "failed_job" ? "for jobs that failed on every record" : "for results that can't be read back";
  const lines = [...byRun].map(([run, cs]) => `• Run ${run}: ${cs.reduce((s, c) => s + c.credits, 0)} credits, service "${cs[0].service}"`);
  const message = [`Hello graph8 support,`, ``, `We were charged ${credits} credits on ${day} (${span}) ${why}:`, ...lines,
    `• ${xs.length} ledger lines`, ``, `Please refund the ${credits} credits. Org: ${p.orgId}.`].join("\n");
  return { message, credits, ledgerIds: xs.map((c) => c.ledgerId) };
}
