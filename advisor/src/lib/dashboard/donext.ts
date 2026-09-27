import type { Finding } from "../domain/types";
import type { Payoff, PlannedAction } from "../domain/actions";
import { n } from "./story";

export interface DoNextItem { id: string; figure: string; unit: string; text: string; label: string; href: string }
export interface DoNextImpact { repeat: Payoff | null; move: (Payoff & { title: string }) | null; refundRequested: boolean }
const NO_IMPACT: DoNextImpact = { repeat: null, move: null, refundRequested: false };
const WEIGHT = { high: 1, medium: 0.6, low: 0.2 } as const;

type Group = "move" | "repeat" | "unused" | "refund" | "side_effect" | "fix";
const GROUP: Partial<Record<Finding["kind"], Group>> = {
  cut: "move", scale: "move", repeat_enrichment: "repeat", unused: "unused", waste: "refund", side_effect: "side_effect", fix: "fix",
};
const BUTTON: Record<Group, [string, string]> = {
  move: ["Move spend", "/optimize#move-spend"], repeat: ["Stop paying twice", "/optimize#repeat"], unused: ["See it", "/recovery"],
  refund: ["Claim refund", "/recovery#claim"], side_effect: ["See it", "/recovery"], fix: ["Plan it", "/optimize#plan"],
};

export function doNextImpact(actions: PlannedAction[], refundRequested = false): DoNextImpact {
  const open = (id: PlannedAction["id"]) => actions.find((a) => a.id === id && !a.applied);
  const move = open("move-spend"), repeat = open("repeat");
  return { repeat: repeat ? repeat.payoff : null, move: move ? { ...move.payoff, title: move.title } : null, refundRequested };
}

function content(g: Group, fs: Finding[], impact: DoNextImpact): Pick<DoNextItem, "figure" | "unit" | "text"> {
  const stake = n(fs.reduce((s, f) => s + f.creditsAtStake, 0));
  switch (g) {
    case "move": {
      if (impact.move) return { figure: impact.move.figure, unit: impact.move.unit, text: impact.move.title };
      const lead = fs.find((f) => f.kind === "cut") ?? fs[0];
      return { figure: n(lead.creditsAtStake), unit: lead.kind === "cut" ? "credits on a costly list" : "credits on your best list", text: lead.body };
    }
    case "repeat": return { ...(impact.repeat ?? { figure: stake, unit: "credits paid twice" }), text: "Stop paying twice for the same contacts" };
    case "unused": return { figure: stake, unit: "credits unused", text: "Onboarding research nobody has opened" };
    case "refund": return { figure: stake, unit: "credits back", text: "graph8 owes you for work that produced nothing" };
    case "side_effect": return { figure: stake, unit: "credits of agent charges", text: "Automated posts woke graph8's agent" };
    case "fix": return { figure: stake, unit: "credits over quotes", text: fs[0].body };
  }
}

function withPeriod(href: string, periodQuery: string): string {
  if (!periodQuery) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}${periodQuery}${hash ? `#${hash}` : ""}`;
}

export function doNextItems(findings: Finding[], max = 4, periodQuery = "", impact: DoNextImpact = NO_IMPACT): DoNextItem[] {
  const groups = new Map<Group, Finding[]>();
  for (const f of findings) {
    const g = GROUP[f.kind];
    if (!g || (g === "refund" && impact.refundRequested)) continue;
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  const score = (fs: Finding[]) => Math.max(...fs.map((f) => f.creditsAtStake * WEIGHT[f.confidence]));
  return [...groups].sort((a, b) => score(b[1]) - score(a[1])).slice(0, max)
    .map(([g, fs]) => ({ id: fs.map((f) => f.extId).join("+"), ...content(g, fs, impact), label: BUTTON[g][0], href: withPeriod(BUTTON[g][1], periodQuery) }));
}
