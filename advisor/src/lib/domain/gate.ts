import type { Confidence, Finding } from "./types";
import { toIso, toMs } from "./time";

const WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.6, low: 0 };
const DAY = 86_400_000;

function visible(f: Finding, now: number): boolean {
  if (f.status === "applied") return false;
  if ((f.status === "dismissed" || f.status === "snoozed") && f.snoozedUntil && toMs(f.snoozedUntil) > now) return false;
  return true;
}

export function recapSelection(findings: Finding[], o: { lastRecapAt: string | null; spendThisWeek: number; spendLastWeek: number }): Finding[] {
  const now = Date.now();
  const dismissalsByKind = new Map<string, number>();
  for (const f of findings) dismissalsByKind.set(f.kind, (dismissalsByKind.get(f.kind) ?? 0) + f.dismissCount);
  const eligible = findings.filter((f) => visible(f, now) && f.confidence !== "low" && (dismissalsByKind.get(f.kind) ?? 0) < 3);
  const since = o.lastRecapAt ? toMs(o.lastRecapAt) : -Infinity;
  const changed = eligible.some((f) => toMs(f.firstSeen) > since || toMs(f.lastSeen) > since);
  const spendMove = Math.abs(o.spendThisWeek - o.spendLastWeek) / Math.max(o.spendLastWeek, 1);
  if (!changed && spendMove < 0.1) return [];
  return [...eligible].sort((a, b) => b.creditsAtStake * WEIGHT[b.confidence] - a.creditsAtStake * WEIGHT[a.confidence]).slice(0, 3);
}

export function shouldRenotify(f: Finding): boolean {
  return f.lastNotifiedStake === null || f.creditsAtStake >= 1.5 * f.lastNotifiedStake;
}

export function dismiss(f: Finding, now: string): Finding {
  return { ...f, status: "dismissed", dismissCount: f.dismissCount + 1, snoozedUntil: toIso(toMs(now) + 30 * DAY) };
}

export function dashboardBuckets(findings: Finding[], now: string): { open: Finding[]; watching: Finding[] } {
  const t = toMs(now);
  const shown = findings.filter((f) => visible(f, t));
  return { open: shown.filter((f) => f.confidence !== "low"), watching: shown.filter((f) => f.confidence === "low") };
}

export function shouldWarnPreSpend(p: { plannedCredits: number; projectedSaving: number; confidence: Confidence }): boolean {
  return p.confidence !== "low" && p.projectedSaving >= 100 && p.projectedSaving >= 0.15 * p.plannedCredits;
}
