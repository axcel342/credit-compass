import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { Finding } from "../domain/types";

export type WorkBlock = { type: "paragraph"; content: { type: "text"; text: string; marks?: { type: "bold" }[] }[] };
const para = (text: string, bold = false): WorkBlock => ({ type: "paragraph", content: [{ type: "text", text, ...(bold ? { marks: [{ type: "bold" as const }] } : {}) }] });

export function buildRecapBlocks(p: { spendThisWeek: number; meetingsThisWeek: number; items: Finding[]; simulated: boolean }): WorkBlock[] {
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  const each = p.meetingsThisWeek > 0 ? ` (${n(p.spendThisWeek / p.meetingsThisWeek)} each)` : "";
  return [para(`Last week: ${n(p.spendThisWeek)} credits → ${n(p.meetingsThisWeek)} meetings${each}${p.simulated ? " [sim]" : ""}`, true),
    ...p.items.slice(0, 3).map((f, i) => para(`${i + 1}. ${f.body}`))];
}

export async function postRecap(c: G8Caller, blocks: WorkBlock[], channel: string): Promise<string> {
  if (channel !== "roi-advisor") throw new Error("Recaps may only be posted to roi-advisor (other channels wake graph8's agent and cost credits).");
  await c.call(OPS.createWorkMessage, { body: { channel, document: { version: 1, blocks } } });
  return new Date().toISOString();
}
