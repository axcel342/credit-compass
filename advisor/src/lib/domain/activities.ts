import type { AttributedCharge, Method, OutcomeBucket, Run, WasteReason } from "./types";
import { serviceName } from "./names";
import { EXACT_METHODS } from "./attribution";
import { BUCKETS } from "./buckets";
import { toMs } from "./time";

export interface ActivityChild { key: string; label: string; credits: number; charges: number; result: string }
export interface Activity {
  key: string; title: string; detail: string; service: string; listId: number | null; from: string; to: string;
  credits: number; charges: number; buckets: Record<OutcomeBucket, number>; match: MatchLevel | "mixed"; matchNote: string; result: string | null; simulated: boolean;
  ledgerIds: string[]; children: ActivityChild[];
}

export type MatchLevel = "exact" | "likely" | "none";
export const MATCH_LABEL: Record<MatchLevel | "mixed", string> = { exact: "Exact", likely: "Likely", none: "Not matched", mixed: "Mixed" };
const levelOf = (m: Method): MatchLevel => (EXACT_METHODS.has(m) ? "exact" : m === "time_window" ? "likely" : "none");
const METHOD_NOTE: Record<Method, string> = { advisor: "Run ID", pipeline_run: "Run ID", job_window: "Job ID", exact_tokens: "Token count", time_window: "Time of charge", none: "Service only" };
const WASTE: Record<WasteReason, string> = { failed_job: "Wasted: the job failed", no_change: "Wasted: the result can't be read back", billing_mismatch: "Wasted: billing mismatch", agent_side_effect: "Wasted: graph8's agent replied to a post" };
const day = (iso: string) => new Date(toMs(iso)).toISOString().slice(0, 10);
const clean = (s: string) => s.replace(/\[sim\]\s*/g, "");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function groupKey(c: AttributedCharge): string {
  if (c.method === "exact_tokens" || c.method === "none") return `${c.service}|day:${day(c.chargedAt)}`;
  const base = `${c.service}|${c.listId ?? "-"}|${clean(c.explanation)}`;
  return c.runExtId ? base : `${base}|${day(c.chargedAt)}`;
}

function detailOf(xs: AttributedCharge[], listNames: Map<string, string>): string {
  const first = xs[0];
  if (first.listId !== null) return listNames.get(String(first.listId)) ?? `List ${first.listId}`;
  const heads = [...new Set(xs.map((x) => clean(x.explanation).split(" · ")))].filter((p) => p.length > 1).map((p) => p[0]);
  const tails = [...new Set(xs.map((x) => clean(x.explanation).split(" · ")).filter((p) => p.length > 1 && first.method !== "exact_tokens").map((p) => p.slice(1).join(", ")))];
  if (first.method === "exact_tokens" || first.method === "none") return [...new Set(heads)].slice(0, 3).join(", ");
  return tails[0] ?? "";
}

function recordsOf(runIds: string[], runs: Map<string, Run>) {
  let ok = 0, failed = 0, known = false;
  for (const id of runIds) { const r = runs.get(id); if (r && (r.recordsOk != null || r.recordsFailed != null)) { known = true; ok += r.recordsOk ?? 0; failed += r.recordsFailed ?? 0; } }
  return known ? { ok, failed, total: ok + failed } : null;
}

export function groupActivities(charges: AttributedCharge[], runs: Run[], bucketOf: (c: AttributedCharge) => OutcomeBucket, listNames: Map<string, string>): Activity[] {
  const runMap = new Map(runs.map((r) => [r.extId, r]));
  const groups = new Map<string, AttributedCharge[]>();
  for (const c of charges) groups.set(groupKey(c), [...(groups.get(groupKey(c)) ?? []), c]);
  const out: Activity[] = [];
  for (const [key, xs] of groups) {
    const sorted = [...xs].sort((a, b) => toMs(a.chargedAt) - toMs(b.chargedAt));
    const buckets: Record<OutcomeBucket, number> = { booked: 0, emailed: 0, nomeet: 0, unused: 0, unknown: 0, waste: 0 };
    for (const c of xs) buckets[bucketOf(c)] += c.credits;
    const credits = xs.reduce((s, c) => s + c.credits, 0);
    const kids = new Map<string, AttributedCharge[]>();
    for (const c of sorted) { const k = c.runExtId ?? c.ledgerId; kids.set(k, [...(kids.get(k) ?? []), c]); }
    const children: ActivityChild[] = kids.size <= 1 ? [] : [...kids].map(([k, cs]) => {
      const rec = cs[0].runExtId ? recordsOf([cs[0].runExtId], runMap) : null;
      const label = cs[0].method === "job_window" || cs[0].method === "pipeline_run" ? `Job ${k.slice(0, 8)}${rec ? `, ${plural(rec.total, "record")}` : ""}` : clean(cs[0].explanation);
      const allWaste = cs.every((c) => c.isWaste);
      return { key: k, label, credits: cs.reduce((s, c) => s + c.credits, 0), charges: cs.length,
        result: allWaste && rec ? `Failed on ${rec.failed} of ${rec.total}` : allWaste ? WASTE[cs[0].wasteReason ?? "failed_job"] : "" };
    });
    const only = (b: OutcomeBucket) => buckets[b] > 0 && buckets[b] === credits;
    const rec = recordsOf([...new Set(xs.map((c) => c.runExtId).filter((x): x is string => !!x))], runMap);
    const result = only("waste") ? (rec && xs[0].wasteReason === "failed_job" ? `Wasted: failed on ${rec.failed} of ${rec.total}` : WASTE[xs[0].wasteReason ?? "failed_job"])
      : only("unused") ? "Never used" : only("unknown") ? "Can't tell yet" : null;
    out.push({ key, title: serviceName(xs[0].service), detail: detailOf(sorted, listNames), service: xs[0].service, listId: xs[0].listId,
      from: new Date(toMs(sorted[0].chargedAt)).toISOString(), to: new Date(toMs(sorted.at(-1)!.chargedAt)).toISOString(),
      credits, charges: xs.length, buckets,
      match: ((ls) => (ls.length === 1 ? ls[0] : "mixed"))([...new Set(xs.map((c) => levelOf(c.method)))]),
      matchNote: [...new Set(xs.map((c) => METHOD_NOTE[c.method]))].join(", "), result,
      simulated: xs.some((c) => c.simulated), ledgerIds: xs.map((c) => c.ledgerId), children });
  }
  return out.sort((a, b) => b.credits - a.credits);
}

const SHORT: Record<OutcomeBucket, string> = { booked: "booked", emailed: "emailed, no meeting yet", nomeet: "no meeting yet", unused: "never used", unknown: "can't tell yet", waste: "wasted" };

export type Bought = ({ kind: "result"; text: string; bucket: OutcomeBucket } | { kind: "split"; share: number; buckets: Record<OutcomeBucket, number> }
  | { kind: "single"; bucket: OutcomeBucket }) & { title: string };

export function boughtCell(a: Activity): Bought {
  const parts = BUCKETS.filter((b) => a.buckets[b] > 0);
  const title = parts.map((b) => `${Math.round(a.buckets[b]).toLocaleString("en-US")} ${SHORT[b]}`).join(", ");
  if (a.result) return { kind: "result", text: a.result, bucket: parts[0] ?? "unknown", title };
  if (parts.length > 1) return { kind: "split", share: Math.round((a.buckets.booked / a.credits) * 100), buckets: a.buckets, title };
  return { kind: "single", bucket: parts[0] ?? "unknown", title };
}

export function foldSmall(rows: Activity[], share = 0.01): { shown: Activity[]; small: Activity[]; smallCredits: number } {
  const total = rows.reduce((s, a) => s + a.credits, 0);
  const isSmall = (a: Activity) => a.credits < share * total && a.buckets.waste === 0;
  const small = rows.filter(isSmall);
  if (small.length < 2) return { shown: rows, small: [], smallCredits: 0 };
  return { shown: rows.filter((a) => !isSmall(a)), small, smallCredits: small.reduce((s, a) => s + a.credits, 0) };
}
