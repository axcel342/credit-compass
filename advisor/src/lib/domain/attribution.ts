import type { AttributedCharge, ChargeResult, LedgerRow, Method, Run, TimeWindow, WasteReason } from "./types";
import { credits, isSpend, parseTokens } from "./spend";
import { toMs } from "./time";

export const EXACT_METHODS = new Set<Method>(["exact_tokens", "job_window", "pipeline_run", "advisor"]);
const TOKEN_MATCH_MS = 10_000, WINDOW_TAIL_MS = 60_000, OPEN_RUN_MS = 180_000, SIDE_EFFECT_MS = 60_000;
const WINDOW_KINDS = new Set(["ai_enrichment_job", "waterfall_job", "pipeline_run", "verification"]);

function label(r: Run): string {
  const who = [r.contactLabel, r.companyName].filter(Boolean).join(", ");
  return who ? `${r.actionName} · ${who}` : r.actionName;
}

function outcomeOf(r: Run): { result: ChargeResult; waste: WasteReason | null } {
  if (r.resultHint === "unreadable") return { result: "unreadable", waste: "no_change" };
  if (r.status === "failed" || (r.recordsOk === 0 && (r.recordsFailed ?? 0) > 0)) return { result: "failed", waste: "failed_job" };
  return { result: "success", waste: null };
}

function methodFor(r: Run): Method {
  if (r.source === "advisor") return "advisor";
  if (r.kind === "pipeline_run") return "pipeline_run";
  return "job_window";
}

export function attributeCharges(input: { ledger: LedgerRow[]; runs: Run[]; windows: TimeWindow[]; advisorPosts: string[] }): AttributedCharge[] {
  const posts = input.advisorPosts.map(toMs);
  const tokenRuns = input.runs.filter((r) => r.tokensIn && r.completedAt);
  const windowRuns = input.runs.filter((r) => WINDOW_KINDS.has(r.kind) && r.startedAt);
  return input.ledger.filter(isSpend).map((row): AttributedCharge => {
    const t = toMs(row.created_at);
    const tok = parseTokens(row.description);
    const base: AttributedCharge = {
      ledgerId: row.id, ledgerType: row.type, service: row.service ?? "unknown", credits: credits(row), chargedAt: row.created_at,
      llmTier: row.llm_tier, tokensIn: tok?.tokensIn ?? null, tokensOut: tok?.tokensOut ?? null, description: row.description,
      method: "none", runExtId: null, listId: null, contactId: null, segmentKey: null,
      explanation: row.service ? `${row.service} charge, details unavailable` : "Charge, details unavailable",
      result: "unknown", isWaste: false, wasteReason: null, simulated: false,
    };
    if (tok) {
      const r = tokenRuns.find((x) => x.tokensIn === tok.tokensIn && x.tokensOut === tok.tokensOut && Math.abs(t - toMs(x.completedAt!)) <= TOKEN_MATCH_MS);
      if (r) {
        const o = outcomeOf(r);
        return { ...base, method: "exact_tokens", runExtId: r.extId, listId: r.listId ?? null, contactId: r.contactIds?.[0] ?? null,
          explanation: label(r), result: o.result, isWaste: o.waste !== null, wasteReason: o.waste };
      }
    }
    const w = windowRuns.find((x) => x.service === row.service && t >= toMs(x.startedAt!) &&
      t <= (x.completedAt ? toMs(x.completedAt) + WINDOW_TAIL_MS : toMs(x.startedAt!) + OPEN_RUN_MS));
    if (w) {
      const o = outcomeOf(w);
      return { ...base, method: methodFor(w), runExtId: w.extId, listId: w.listId ?? null, contactId: w.contactIds?.[0] ?? null,
        explanation: label(w), result: o.result, isWaste: o.waste !== null, wasteReason: o.waste };
    }
    if (row.service === "studio_copilot" && posts.some((p) => t - p >= 0 && t - p <= SIDE_EFFECT_MS)) {
      return { ...base, method: "time_window", explanation: "graph8's agent replied to an automated post", result: "side_effect",
        isWaste: true, wasteReason: "agent_side_effect" };
    }
    const win = input.windows.find((x) => row.service !== null && x.services.includes(row.service) && t >= x.start && t <= x.end);
    if (win) return { ...base, method: "time_window", explanation: win.label };
    return base;
  });
}

export function coverage(charges: AttributedCharge[]): { exact: number; window: number; none: number; total: number } {
  const sum = (f: (c: AttributedCharge) => boolean) => charges.filter(f).reduce((s, c) => s + c.credits, 0);
  return { exact: sum((c) => EXACT_METHODS.has(c.method)), window: sum((c) => c.method === "time_window"),
    none: sum((c) => c.method === "none"), total: sum(() => true) };
}
