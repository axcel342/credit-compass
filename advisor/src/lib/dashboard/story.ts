import type { TypeDef } from "../domain/planner";
export const n = (x: number) => Math.round(x).toLocaleString("en-US");
export const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${Math.round(k) === 1 ? one : many}`;
export interface StatItem { value: string; label: string; tone?: "bad" }

export function overviewHeadline(p: { total: number; meetings: number; won: number; periodLabel: string }): string {
  if (p.total <= 0) return `No credits spent in ${p.periodLabel}.`;
  if (p.meetings <= 0) return `${n(p.total)} credits spent in ${p.periodLabel}, and no meetings booked yet.`;
  const won = p.won > 0 ? ` and ${plural(p.won, "won deal")}` : "";
  return `${n(p.total)} credits bought ${plural(p.meetings, "meeting")}${won}.`;
}

export function overviewLede(p: { unused: number; waste: number }): string | null {
  const parts: string[] = [];
  if (p.unused > 0) parts.push(`${n(p.unused)} on onboarding research nobody has opened`);
  if (p.waste > 0) parts.push(`${n(p.waste)} on jobs that failed`);
  if (!parts.length) return null;
  return `${n(p.unused + p.waste)} of them bought nothing you've used: ${parts.join(", and ")}.`;
}

export function statStrip(p: { total: number; meetings: number; booked: number; waste: number; traced: number }): StatItem[] {
  return [
    { value: p.meetings > 0 ? n(p.total / p.meetings) : "—", label: "credits per meeting" },
    { value: n(p.booked), label: "spent on contacts who booked" },
    { value: n(p.waste), label: "wasted", ...(p.waste > 0 ? { tone: "bad" as const } : {}) },
    { value: `${p.total > 0 ? Math.round((p.traced / p.total) * 100) : 0}%`, label: "traced to a contact, list or run" },
  ];
}

export function chargesHeadline(p: { traced: number; total: number; periodLabel: string }): string {
  if (p.total <= 0) return `No charges in ${p.periodLabel}.`;
  return `${Math.round((p.traced / p.total) * 100)}% of your credits trace back to a contact, list or run.`;
}

export function recoveryHeadline(p: { waste: number; refundable: number; periodLabel: string }): string {
  if (p.waste <= 0) return `Nothing was wasted in ${p.periodLabel}.`;
  return p.refundable > 0 ? `${n(p.waste)} credits bought nothing. graph8 owes you ${n(p.refundable)} of them.` : `${n(p.waste)} credits bought nothing.`;
}

export function recoveryLede(wasteTimes: string[]): string | null {
  if (!wasteTimes.length) return null;
  const day = (iso: string) => iso.slice(0, 10);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const days = [...new Set(wasteTimes.map(day))].sort();
  const when = days.length === 1 ? `All of it on ${fmt(days[0])}.` : `Spread over ${days.length} days, ${fmt(days[0])} to ${fmt(days.at(-1)!)}.`;
  return `${when} Click a week to see what happened in it.`;
}

export function plannerHeadline(p: { graph8Quote: number | null; estimate: number; listLabel: string; def: TypeDef }): string {
  if (p.estimate <= 0) return `Nothing to do: every contact on ${p.listLabel} is already done or skipped.`;
  if (p.graph8Quote !== null && p.graph8Quote > p.estimate) return `graph8 quotes ${n(p.graph8Quote)} credits. It should cost about ${n(p.estimate)}.`;
  const noun = p.def.noun[0].toUpperCase() + p.def.noun.slice(1);
  return `${noun} on the ${p.listLabel} should cost about ${n(p.estimate)} credits.`;
}
