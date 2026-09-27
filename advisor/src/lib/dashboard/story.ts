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
