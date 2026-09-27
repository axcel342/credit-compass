export const n = (x: number) => Math.round(x).toLocaleString("en-US");
export const usd = (x: number) => x.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${Math.round(k) === 1 ? one : many}`;
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

export function optimizeTitle(open: number): { title: string; sub: string | null } {
  if (open <= 0) return { title: "Your spend looks efficient right now.", sub: null };
  return { title: `${plural(open, "change")} you can make`, sub: "Each costs 0 credits and can be undone" };
}

export function plannerUnit(p: { estimate: number; every: number; graph8Quote: number | null }): string {
  if (p.estimate <= 0) return "credits. Every contact is done or skipped";
  if (p.graph8Quote !== null && p.graph8Quote > p.estimate) return `credits, graph8 quotes ${n(p.graph8Quote)}`;
  if (p.every > p.estimate) return `credits, instead of ${n(p.every)} for every contact`;
  return "credits";
}

export function forecastFigure(f: { expected: number; lo: number; hi: number; lowConfidence: boolean }): { figure: string; unit: string; note: string | null } {
  return { figure: f.expected < 1 ? "<1" : `~${n(f.expected)}`, unit: `meetings, likely ${f.lo} to ${f.hi}`,
    note: f.lowConfidence ? "Low confidence, fewer than 5 meetings so far" : null };
}
