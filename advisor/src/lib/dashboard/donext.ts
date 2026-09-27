import type { Finding } from "../domain/types";
import { plural } from "./story";

export interface DoNextItem { id: string; text: string; sub: string; label: string; href: string }
const WEIGHT = { high: 1, medium: 0.6, low: 0.2 } as const;
const BUTTON: Partial<Record<Finding["kind"], [string, string]>> = {
  cut: ["See how to cut it", "/optimize#move-spend"], scale: ["Build a lookalike list", "/optimize#move-spend"],
  repeat_enrichment: ["Stop paying twice", "/optimize#repeat"], waste: ["Request a refund", "/recovery#claim"],
  unused: ["See it in Recovery", "/recovery"], side_effect: ["See it in Recovery", "/recovery"], fix: ["Plan the next enrichment", "/optimize#plan"],
};

function withPeriod(href: string, periodQuery: string): string {
  if (!periodQuery) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}${periodQuery}${hash ? `#${hash}` : ""}`;
}

export function doNextItems(findings: Finding[], max = 4, periodQuery = ""): DoNextItem[] {
  return findings.filter((f) => BUTTON[f.kind])
    .sort((a, b) => b.creditsAtStake * WEIGHT[b.confidence] - a.creditsAtStake * WEIGHT[a.confidence])
    .slice(0, max)
    .map((f) => ({ id: f.extId, text: f.body, sub: `${plural(f.creditsAtStake, "credit")} at stake`, label: BUTTON[f.kind]![0], href: withPeriod(BUTTON[f.kind]![1], periodQuery) }));
}
