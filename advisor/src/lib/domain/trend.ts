import type { AttributedCharge, Outcome } from "./types";
import { toMs } from "./time";

const W = 7 * 86_400_000;
const label = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const n = (x: number) => Math.round(x).toLocaleString("en-US");

export interface TrendPoint { label: string; value: number | null }
export interface Cohort { label: string; contacts: number; credits: number; meetings: number; costPerMeeting: number | null; maturing: boolean }

export function rollingCostPerMeeting(charges: AttributedCharge[], outcomes: Outcome[], now: string, weeks = 8, window = 4): TrendPoint[] {
  const start = toMs(now) - weeks * W, idx = (t: number) => Math.floor((t - start) / W);
  const cr = Array<number>(weeks).fill(0), mt = Array<number>(weeks).fill(0);
  for (const c of charges) { const i = idx(toMs(c.chargedAt)); if (i >= 0 && i < weeks) cr[i] += c.credits; }
  for (const o of outcomes) if (o.type === "meeting_booked") { const i = idx(toMs(o.occurredAt)); if (i >= 0 && i < weeks) mt[i]++; }
  const out: TrendPoint[] = [];
  for (let k = window - 1; k < weeks; k++) {
    const c = cr.slice(k - window + 1, k + 1).reduce((a, b) => a + b, 0), m = mt.slice(k - window + 1, k + 1).reduce((a, b) => a + b, 0);
    out.push({ label: label(start + (k + 1) * W), value: m > 0 ? c / m : null });
  }
  return out;
}

export interface TrendChange { from: number; to: number; weeks: number; pct: number }

export function trendChange(points: TrendPoint[]): TrendChange | null {
  const v = points.filter((p): p is { label: string; value: number } => p.value !== null);
  if (v.length < 2) return null;
  const from = Math.round(v[0].value), to = Math.round(v.at(-1)!.value);
  return { from, to, weeks: v.length, pct: from > 0 ? Math.round(((to - from) / from) * 100) : 0 };
}

export function trendSentence(points: TrendPoint[]): string | null {
  const c = trendChange(points);
  if (!c) return null;
  if (c.from === c.to) return `Credits per meeting held at ${n(c.to)} over the last ${c.weeks} weeks.`;
  return `Credits per meeting ${c.to < c.from ? "fell" : "rose"} from ${n(c.from)} to ${n(c.to)} over the last ${c.weeks} weeks.`;
}

export function trendTitle(points: TrendPoint[]): string {
  const c = trendChange(points);
  if (!c) return "Cost per meeting over time";
  if (c.pct === 0) return `Cost per meeting held steady for ${c.weeks} weeks`;
  return `Cost per meeting ${c.pct < 0 ? "fell" : "rose"} ${Math.abs(c.pct)}% in ${c.weeks} weeks`;
}

export function firstTouchCohorts(charges: AttributedCharge[], outcomes: Outcome[], now: string, weeks = 8, maturingWeeks = 3): Cohort[] {
  const start = toMs(now) - weeks * W, idx = (t: number) => Math.floor((t - start) / W);
  const all = new Map<number, number>();
  for (const c of charges) if (c.contactId !== null) all.set(c.contactId, Math.min(all.get(c.contactId) ?? Infinity, toMs(c.chargedAt)));
  const first = new Map([...all].filter(([, t]) => idx(t) >= 0 && idx(t) < weeks));
  const cohorts: Cohort[] = Array.from({ length: weeks }, (_, i) => ({ label: label(start + i * W), contacts: 0, credits: 0, meetings: 0, costPerMeeting: null, maturing: i >= weeks - maturingWeeks }));
  for (const [, t] of first) cohorts[idx(t)].contacts++;
  for (const c of charges) if (c.contactId !== null && first.has(c.contactId)) cohorts[idx(first.get(c.contactId)!)].credits += c.credits;
  for (const o of outcomes) if (o.type === "meeting_booked" && o.contactId !== null && first.has(o.contactId)) cohorts[idx(first.get(o.contactId)!)].meetings++;
  for (const c of cohorts) c.costPerMeeting = c.meetings > 0 ? c.credits / c.meetings : null;
  return cohorts;
}

export interface TrendLineData { pct: number; direction: "down" | "up"; since: string; values: number[] }

export function trendLine(points: TrendPoint[]): TrendLineData | null {
  const c = trendChange(points);
  if (!c || c.pct === 0) return null;
  const v = points.filter((p): p is { label: string; value: number } => p.value !== null);
  return { pct: Math.abs(c.pct), direction: c.pct < 0 ? "down" : "up", since: v[0].label, values: v.map((p) => p.value) };
}
