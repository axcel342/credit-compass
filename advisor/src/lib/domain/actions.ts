import type { ActionRecord, AttributedCharge, ContactCacheRow, Stat } from "./types";
import { repeatEnrichment } from "./repeat";

export interface ActionInput { charges: AttributedCharge[]; stats: Stat[]; listNames: Map<string, string>; contacts: ContactCacheRow[]; actions: ActionRecord[] }
export interface Payoff { figure: string; unit: string }
export interface PlannedAction {
  id: "repeat" | "move-spend" | "skip-unlikely"; title: string; impact: string; payoff: Payoff; evidence: string | null; confidence: "High confidence" | "Medium confidence";
  inGraph8: string; chart: { label: string; value: number; tone: string }[]; steps: { label: string; sub: string; done: boolean }[];
  button: { action: "repeat" | "lookalike" | "pause" | "guardrail"; label: string; listIds: number[]; confirm: string } | null; applied: boolean; monthlyCredits: number;
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const the = (name: string) => (/\blist$/i.test(name) ? `the ${name}` : name); // "the Starter list", but "Sales VPs", "Founders"
const isApplied = (acts: ActionRecord[], kind: ActionRecord["kind"], listId: number) => acts.some((a) => a.kind === kind && a.listId === listId && a.status === "applied");

export function movePayoff(gain: number, weekly: number): Payoff {
  if (gain >= 1) return { figure: `+${n(gain)}`, unit: Math.round(gain) === 1 ? "meeting a week" : "meetings a week" };
  if (gain >= 0.1) return { figure: `+${gain.toFixed(1)}`, unit: "meetings a week" };
  return { figure: n(weekly), unit: "credits a week to move" };
}

export function lookalikeFilters(rows: ContactCacheRow[]) {
  const top = (i: number) => {
    const m = new Map<string, number>();
    for (const r of rows) { const v = r.segmentKey.split("|")[i]; if (v && v !== "Unknown") m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const out: { field: string; operator: "any_of"; value: string[] }[] = [];
  const s = top(0), d = top(1);
  if (s) out.push({ field: "seniority_level", operator: "any_of", value: [s] });
  if (d) out.push({ field: "job_department", operator: "any_of", value: [d] });
  return out;
}

export function buildActions(x: ActionInput): PlannedAction[] {
  const out: PlannedAction[] = [];
  const name = (id: number | string) => x.listNames.get(String(id)) ?? `list ${id}`;
  const total = x.charges.reduce((s, c) => s + c.credits, 0);

  const rep = repeatEnrichment(x.charges);
  const repLists = [...rep.byList.keys()].filter((k): k is number => k !== null);
  if (rep.credits >= 50 && repLists.length) {
    const firstTime = x.charges.filter((c) => c.contactId !== null).reduce((s, c) => s + c.credits, 0) - rep.credits;
    const applied = repLists.every((l) => isApplied(x.actions, "repeat_skip", l));
    const listText = repLists.map((l) => the(name(l))).join(", ").replace(/, ([^,]*)$/, " and $1");
    out.push({ id: "repeat", title: "Stop paying twice for the same contacts", impact: `saves ~${n((rep.credits * 30) / 56)} a month`, monthlyCredits: Math.round((rep.credits * 30) / 56),
      payoff: { figure: n((rep.credits * 30) / 56), unit: "credits a month" },
      evidence: null,
      confidence: "High confidence", chart: [{ label: "First time", value: Math.max(0, firstTime), tone: "var(--flow)" }, { label: "Again", value: rep.credits, tone: "var(--waste)" }],
      inGraph8: `Turns on Skip recently enriched and Skip existing values for ${listText} ${repLists.length === 1 ? "pipeline" : "pipelines"}.`, steps: [],
      button: applied ? null : { action: "repeat", label: `Turn on for ${repLists.length} ${repLists.length === 1 ? "pipeline" : "pipelines"}`, listIds: repLists, confirm: `Yes, change ${repLists.length} ${repLists.length === 1 ? "pipeline" : "pipelines"} in graph8` }, applied });
  }

  const lists = x.stats.filter((s) => s.period === "8w" && s.dimension === "list" && s.costPerMeeting !== null);
  const best = lists.filter((s) => s.meetings >= 5 && s.confidence !== "low").sort((a, b) => a.costPerMeeting! - b.costPerMeeting!)[0];
  const worst = lists.filter((s) => s.credits >= 1000).sort((a, b) => b.costPerMeeting! - a.costPerMeeting!)[0];
  if (best && worst && best.value !== worst.value && worst.costPerMeeting! >= 2 * best.costPerMeeting!) {
    const perK = (s: Stat) => 1000 / s.costPerMeeting!, weekly = worst.credits / 8;
    const gain = (weekly * (0.5 / best.costPerMeeting! - 1 / worst.costPerMeeting!));
    const bId = Number(best.value), wId = Number(worst.value);
    const lookDone = isApplied(x.actions, "lookalike", bId), pauseDone = isApplied(x.actions, "pause_list", wId);
    out.push({ id: "move-spend", title: `Move spend from ${the(name(wId))} to people like your ${name(bId)}`, impact: `~${n(gain)} more meetings a week`, monthlyCredits: 0,
      payoff: movePayoff(gain, weekly),
      evidence: null,
      confidence: best.confidence === "high" ? "High confidence" : "Medium confidence",
      chart: [{ label: name(wId), value: perK(worst), tone: "var(--nomeet)" }, { label: name(bId), value: perK(best), tone: "var(--booked)" }],
      inGraph8: "Builds a lookalike list from graph8's free prospect search, then switches the costly list's pipeline off so it stops running on its own. Existing data stays.",
      steps: [{ label: "Build a lookalike list, free", sub: "Saves up to 50 new contacts with the same seniority and department.", done: lookDone },
        { label: `Pause ${the(name(wId))}`, sub: "Switches its list pipeline off. Existing data stays.", done: pauseDone }],
      button: !lookDone ? { action: "lookalike", label: "Build lookalike list", listIds: [bId], confirm: "Yes, create a new list in graph8" } : !pauseDone ? { action: "pause", label: `Pause ${the(name(wId))}`, listIds: [wId], confirm: `Yes, pause ${the(name(wId))} in graph8` } : null,
      applied: lookDone && pauseDone });
  }

  const fitBy = new Map<number, { low: number; all: number; high: number; medium: number; unknown: number }>();
  for (const r of x.contacts) for (const l of r.listIds) {
    const e = fitBy.get(l) ?? { low: 0, all: 0, high: 0, medium: 0, unknown: 0 };
    e.all++;
    if (r.fit === "low") { if (r.hasEmail) e.low++; } else e[r.fit]++;
    fitBy.set(l, e);
  }
  const [gl, g] = [...fitBy].sort((a, b) => b[1].low - a[1].low)[0] ?? [];
  if (gl !== undefined && g && g.low >= 10) {
    const applied = isApplied(x.actions, "guardrail", gl);
    const chart = [{ label: "Likely", value: g.high, tone: "var(--booked)" }, { label: "Maybe", value: g.medium, tone: "var(--maybe)" },
      { label: "Unlikely", value: g.low, tone: "var(--waste)" }, { label: "Unknown", value: g.unknown, tone: "var(--unknown)" }].filter((c) => c.label === "Unlikely" || c.value > 0);
    out.push({ id: "skip-unlikely", title: "Skip contacts unlikely to book", impact: `saves ${n(g.low)} per run`, monthlyCredits: 0,
      payoff: { figure: n(g.low), unit: "credits a run" },
      evidence: "Emails that don't match the company bounced 45% of the time, against 20% for the rest.",
      confidence: "High confidence", chart, steps: [],
      inGraph8: "Writes a fit score to each contact and adds a run condition to the list pipeline, so graph8 skips anyone unlikely on every run.",
      button: applied ? null : { action: "guardrail", label: `Apply to ${the(name(gl))}`, listIds: [gl], confirm: `Yes, add the rule to ${the(name(gl))} in graph8` }, applied });
  }
  return out;
}
