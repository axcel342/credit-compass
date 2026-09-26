import { z } from "zod";
import type { DashboardData } from "../dashboard/data";
import { estimateCredits } from "../domain/prespend";

const n = (x: number) => Math.round(x).toLocaleString("en-US");

export function roiSummary(d: DashboardData): string {
  const pct = d.coverage.total ? Math.round((d.coverage.exact / d.coverage.total) * 100) : 0;
  const org = d.stats.find((s) => s.dimension === "org");
  const cpm = org?.costPerMeeting != null ? `${n(org.costPerMeeting)} credits per meeting` : "no meetings recorded yet";
  return `${n(d.coverage.total)} credits spent; ${pct}% traced exactly; ${n(d.waste)} wasted; ${cpm}.`;
}

export function costPerOutcome(d: DashboardData, p: { dimension: "list" | "segment" | "service"; value: string }): string {
  const s = d.stats.find((x) => x.dimension === p.dimension && x.value === p.value);
  if (!s) return `No data for ${p.dimension} "${p.value}".`;
  if (s.costPerMeeting === null) return `${p.value}: ${n(s.credits)} credits, no meetings yet.`;
  const vs = s.vsAvgPct === null ? "" : `${Math.abs(Math.round(s.vsAvgPct))}% ${s.vsAvgPct < 0 ? "below" : "above"} average, `;
  return `${p.value}: ${n(s.costPerMeeting)} credits per meeting across ${n(s.meetings)} meetings (${vs}${s.confidence} confidence).${s.simulated ? " Includes simulated data." : ""}`;
}

export function listFindings(d: DashboardData, p: { status?: string; kind?: string }): string {
  const xs = d.findings.filter((f) => (!p.status || f.status === p.status) && (!p.kind || f.kind === p.kind));
  return xs.length ? xs.map((f) => `[${f.kind}] ${f.title}: ${f.body} (${n(f.creditsAtStake)} credits, ${f.confidence})`).join("\n") : "No findings match.";
}

export function explainCharge(d: DashboardData, ledgerId: string): string {
  const c = d.charges.find((x) => x.ledgerId === ledgerId);
  if (!c) return `No charge with ledger ID ${ledgerId}.`;
  return `${c.chargedAt}: ${c.credits} credits for ${c.explanation} (service ${c.service}, matched by ${c.method}, result ${c.result}${c.isWaste ? `, waste: ${c.wasteReason}` : ""}).`;
}

export function prespendEstimate(p: { listSize: number; missing: number; pricePerRecord: number; calibration: number }): string {
  const est = estimateCredits({ records: p.missing, pricePerRecord: p.pricePerRecord, calibration: p.calibration });
  return `Enriching the ${n(p.missing)} of ${n(p.listSize)} contacts that need it costs about ${n(est)} credits.`;
}

type Server = { registerTool: (name: string, meta: { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny> }, cb: (a: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>) => void };
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function registerTools(server: Server, load: () => Promise<DashboardData>): void {
  server.registerTool("roi_summary", { title: "ROI summary", description: "Credits spent, share traced, waste and cost per meeting.", inputSchema: {} }, async () => text(roiSummary(await load())));
  server.registerTool("cost_per_outcome", { title: "Cost per outcome", description: "Credits per meeting for a list, segment or service.",
    inputSchema: { dimension: z.enum(["list", "segment", "service"]), value: z.string() } },
    async (a) => text(costPerOutcome(await load(), { dimension: a.dimension as "list" | "segment" | "service", value: String(a.value) })));
  server.registerTool("list_findings", { title: "List findings", description: "The Advisor's findings, optionally filtered.",
    inputSchema: { status: z.string().optional(), kind: z.string().optional() } }, async (a) => text(listFindings(await load(), { status: a.status as string | undefined, kind: a.kind as string | undefined })));
  server.registerTool("explain_charge", { title: "Explain a charge", description: "What one credit-ledger line paid for.", inputSchema: { ledger_id: z.string() } },
    async (a) => text(explainCharge(await load(), String(a.ledger_id))));
  server.registerTool("prespend_estimate", { title: "Pre-spend estimate", description: "Estimate enrichment credits for the contacts that need it.",
    inputSchema: { list_size: z.number().int(), missing: z.number().int(), price_per_record: z.number().default(3), calibration: z.number().default(1) } },
    async (a) => text(prespendEstimate({ listSize: Number(a.list_size), missing: Number(a.missing), pricePerRecord: Number(a.price_per_record ?? 3), calibration: Number(a.calibration ?? 1) })));
}
