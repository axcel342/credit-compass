import type { Period } from "./types";
import { toMs } from "./time";

export const PERIOD_DAYS: Record<Period, number> = { "8w": 56, "30d": 30 };
export const PERIOD_LABEL: Record<Period, string> = { "8w": "the last 8 weeks", "30d": "the last 30 days" };

export function parsePeriod(v: unknown): Period {
  return v === "30d" ? "30d" : "8w";
}

export function periodWindow(p: Period, now: string): { from: number; to: number } {
  const to = toMs(now);
  return { from: to - PERIOD_DAYS[p] * 86_400_000, to };
}

export function inWindow(iso: string, w: { from: number; to: number }): boolean {
  const t = toMs(iso);
  return t >= w.from && t <= w.to;
}
