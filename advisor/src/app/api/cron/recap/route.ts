import type { G8Caller } from "@/lib/g8/client";
import { loadDashboardData } from "@/lib/dashboard/data";
import { recapSelection } from "@/lib/domain/gate";
import { toMs } from "@/lib/domain/time";
import { RecordStore } from "@/lib/store/records";
import { findingToValues, runToValues, valuesToOutcome } from "@/lib/store/mappers";
import { buildRecapBlocks, postRecap } from "@/lib/recap/recap";
import { forEachWorkspace } from "@/lib/workspace/fanout";
import { workspaceStore } from "@/lib/workspace/store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function recapFor(c: G8Caller) {
  const d = await loadDashboardData(c);
  const now = Date.now(), week = 7 * 86_400_000;
  const inWeek = (iso: string, k: number) => { const t = toMs(iso); return t > now - (k + 1) * week && t <= now - k * week; };
  const spendThisWeek = d.charges.filter((c) => inWeek(c.chargedAt, 0)).reduce((s, c) => s + c.credits, 0);
  const spendLastWeek = d.charges.filter((c) => inWeek(c.chargedAt, 1)).reduce((s, c) => s + c.credits, 0);
  const outcomes = (await new RecordStore(c, "roi_outcome").list()).map((r) => valuesToOutcome(r.values));
  const meetingsThisWeek = outcomes.filter((o) => o.type === "meeting_booked" && inWeek(o.occurredAt, 0)).length;
  const lastRecapAt = d.runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!).sort((a, b) => toMs(b) - toMs(a))[0] ?? null;
  const items = recapSelection(d.findings, { lastRecapAt, spendThisWeek, spendLastWeek });
  if (!items.length) return { skipped: "quiet week" };
  const simulated = items.some((f) => f.simulated) || outcomes.some((o) => o.simulated && inWeek(o.occurredAt, 0));
  const postedAt = await postRecap(c, buildRecapBlocks({ spendThisWeek, meetingsThisWeek, items, simulated }), process.env.ROI_ADVISOR_CHANNEL ?? "roi-advisor");
  await new RecordStore(c, "roi_run").upsert(runToValues({ extId: `post:${postedAt}`, kind: "advisor_post", actionName: "Weekly recap", startedAt: postedAt,
    completedAt: postedAt, status: "completed", source: "advisor" }));
  const findings = new RecordStore(c, "roi_finding");
  for (const f of items) await findings.upsert(findingToValues({ ...f, inRecap: true, lastNotifiedStake: f.creditsAtStake }));
  return { posted: items.length, postedAt };
}

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  return Response.json(await forEachWorkspace((ws) => recapFor(ws.caller), workspaceStore()));
}
