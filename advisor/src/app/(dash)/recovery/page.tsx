import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller, currentWorkspace } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { alsoRows, claimState, recoveryItems } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";
import { RecoveryClaim } from "@/components/RecoveryClaim";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const unused = d.findings.find((f) => f.kind === "unused" && f.status !== "applied");
  const items = recoveryItems(v.charges, d.runs, { onboardingUnused: v.bucketCtx.onboardingUnused, unusedDocs: Number(unused?.evidence.documents ?? 0),
    advisorPosts: d.runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!) });
  const claim = claimState(d.actions, items.filter((x) => x.owner === "refund").reduce((s, x) => s + x.credits, 0));
  const also = alsoRows(items);
  return (
    <>
      <RecoveryClaim items={items} claim={claim} orgId={(await currentWorkspace()).orgId} periodLabel={PERIOD_LABEL[period]} />
      {also.length > 0 && (
        <div className="also">
          {also.map((x) => <div className="also-row" key={x.id}><span className="fig tnum">{n(x.credits)}</span><span><b>{x.lead}</b> <span className="small">{x.text}</span></span></div>)}
        </div>
      )}
    </>
  );
}
