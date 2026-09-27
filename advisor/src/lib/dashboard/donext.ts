import type { Finding } from "../domain/types";
import type { PlannedAction } from "../domain/actions";
import { n, plural } from "./story";

export interface DoNextItem { id: string; text: string; sub: string; label: string; href: string }
export interface DoNextImpact { repeatMonthly: number | null; moveSpend: string | null }
const NO_IMPACT: DoNextImpact = { repeatMonthly: null, moveSpend: null };
const WEIGHT = { high: 1, medium: 0.6, low: 0.2 } as const;
const BUTTON: Partial<Record<Finding["kind"], [string, string]>> = {
  cut: ["See how to cut it", "/optimize#move-spend"], scale: ["Build a lookalike list", "/optimize#move-spend"],
  repeat_enrichment: ["Stop paying twice", "/optimize#repeat"], waste: ["Request a refund", "/recovery#claim"],
  unused: ["See it in Recovery", "/recovery"], side_effect: ["See it in Recovery", "/recovery"], fix: ["Plan the next enrichment", "/optimize#plan"],
};

export function doNextImpact(actions: PlannedAction[]): DoNextImpact {
  const open = (id: PlannedAction["id"]) => actions.find((a) => a.id === id && !a.applied);
  return { repeatMonthly: open("repeat")?.monthlyCredits ?? null, moveSpend: open("move-spend")?.impact ?? null };
}

function payoff(f: Finding, impact: DoNextImpact): string {
  const k = plural(f.creditsAtStake, "credit");
  switch (f.kind) {
    case "cut": return impact.moveSpend ? `${impact.moveSpend} if you move this spend` : `${k} spent on this list`;
    case "scale": return "Up to 50 more contacts like them, free";
    case "repeat_enrichment": return impact.repeatMonthly ? `Saves ~${n(impact.repeatMonthly)} credits a month` : `${k} paid twice`;
    case "waste": return `${k} to claim back`;
    case "unused": return `${k} of research ready to use`;
    case "side_effect": return `Stops ${k} of agent charges`;
    case "fix": return `${k} over graph8's quotes`;
    default: return `${k} at stake`;
  }
}

function withPeriod(href: string, periodQuery: string): string {
  if (!periodQuery) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}${periodQuery}${hash ? `#${hash}` : ""}`;
}

export function doNextItems(findings: Finding[], max = 4, periodQuery = "", impact: DoNextImpact = NO_IMPACT): DoNextItem[] {
  return findings.filter((f) => BUTTON[f.kind])
    .sort((a, b) => b.creditsAtStake * WEIGHT[b.confidence] - a.creditsAtStake * WEIGHT[a.confidence])
    .slice(0, max)
    .map((f) => ({ id: f.extId, text: f.body, sub: payoff(f, impact), label: BUTTON[f.kind]![0], href: withPeriod(BUTTON[f.kind]![1], periodQuery) }));
}
