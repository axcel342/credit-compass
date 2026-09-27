import type { TypeDef } from "../domain/planner";
import type { TrendChange } from "../domain/trend";
export const n = (x: number) => Math.round(x).toLocaleString("en-US");
export const usd = (x: number) => x.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${Math.round(k) === 1 ? one : many}`;
export interface StatItem { value: string; label: string; tone?: "bad"; note?: string; noteTone?: "good" | "bad" }

export function overviewHeadline(p: { total: number; meetings: number; won: number; wonValue: number; periodLabel: string }): string {
  if (p.total <= 0) return `No credits spent in ${p.periodLabel}.`;
  if (p.meetings <= 0) return `${n(p.total)} credits spent in ${p.periodLabel}, and no meetings booked yet.`;
  const worth = p.wonValue > 0 ? ` worth ${usd(p.wonValue)}` : "";
  const won = p.won > 0 ? ` and ${plural(p.won, "won deal")}${worth}` : "";
  return `${n(p.total)} credits bought ${plural(p.meetings, "meeting")}${won}.`;
}

export function overviewLede(p: { unused: number; waste: number }): string | null {
  const parts: string[] = [];
  if (p.unused > 0) parts.push(`${n(p.unused)} on onboarding research nobody has opened`);
  if (p.waste > 0) parts.push(`${n(p.waste)} on jobs that failed`);
  if (!parts.length) return null;
  return `${n(p.unused + p.waste)} of them bought nothing you've used: ${parts.join(", and ")}.`;
}

export function statStrip(p: { total: number; meetings: number; booked: number; waste: number; traced: number; wonValue: number; trend: TrendChange | null }): StatItem[] {
  const cpm: StatItem = { value: p.meetings > 0 ? n(p.total / p.meetings) : "—", label: "credits per meeting" };
  if (p.trend && p.trend.pct !== 0) {
    cpm.note = `${p.trend.pct < 0 ? "down" : "up"} ${Math.abs(p.trend.pct)}% in ${p.trend.weeks} weeks`;
    cpm.noteTone = p.trend.pct < 0 ? "good" : "bad";
  }
  return [
    cpm,
    ...(p.wonValue > 0 && p.total > 0 ? [{ value: usd((p.wonValue / p.total) * 1000), label: "won per 1,000 credits" }] : []),
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

export function optimizeHeadline(p: { count: number; monthly: number; hasMove: boolean }): string {
  if (p.count <= 0) return "Your spend looks efficient right now.";
  const parts = [p.monthly > 0 ? `save about ${n(p.monthly)} credits a month` : null, p.hasMove ? "move spend to the lists that book" : null].filter(Boolean);
  return `${plural(p.count, "change")} would ${parts.length ? parts.join(" and ") : "make your spend go further"}.`;
}

export function cpmBarColor(cpm: number, best: number, avg: number | null): string {
  if (cpm === best) return "var(--booked)";
  if (avg !== null && cpm >= 2 * avg) return "var(--waste)";
  return "var(--series-weak)";
}

export interface ChainNode { figure: string; label: string; tone: "in" | "mid" | "out" }
export type ValueChain = { nodes: ChainNode[]; links: string[]; aria: string } | { empty: string };

export const perCredit = (x: number) => (x >= 10 ? usd(x) : `$${x.toFixed(2)}`);

export function valueChain(p: { total: number; meetings: number; won: number; wonValue: number; periodLabel: string }): ValueChain {
  if (p.total <= 0) return { empty: `No credits spent in ${p.periodLabel}.` };
  const spent: ChainNode = { figure: n(p.total), label: "credits spent", tone: "in" };
  if (p.meetings <= 0) return { nodes: [spent], links: [], aria: `${n(p.total)} credits spent in ${p.periodLabel}, and no meetings booked yet.` };
  const cpm = `${n(p.total / p.meetings)} per meeting`;
  const booked: ChainNode = { figure: n(p.meetings), label: Math.round(p.meetings) === 1 ? "meeting booked" : "meetings booked", tone: "mid" };
  const bought = `${n(p.total)} credits bought ${plural(p.meetings, "meeting")}, ${cpm}.`;
  if (p.won <= 0 || p.wonValue <= 0) return { nodes: [spent, booked], links: [cpm], aria: bought };
  const each = perCredit(p.wonValue / p.total);
  return { nodes: [spent, booked, { figure: usd(p.wonValue), label: `won, ${each} per credit`, tone: "out" }],
    links: [cpm, plural(p.won, "deal won", "deals won")],
    aria: `${bought} ${plural(p.won, "won deal")} worth ${usd(p.wonValue)}, ${each} per credit.` };
}

export interface ListRow { label: string; value: number; color: string; note: string | null; tone: "good" | "bad" | null }

export function listRows(rows: { label: string; value: number }[], avg: number | null): ListRow[] {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const min = sorted[0]?.value;
  const compare = sorted.length >= 2 && sorted.some((r) => r.value !== min);
  return sorted.map((r) => {
    if (compare && r.value === min) return { ...r, color: "var(--booked)", note: "cheapest", tone: "good" };
    if (compare && avg !== null && avg > 0 && r.value >= 2 * avg) return { ...r, color: "var(--waste)", note: `${Math.floor(r.value / avg)}× average`, tone: "bad" };
    return { ...r, color: "var(--series-weak)", note: null, tone: null };
  });
}
