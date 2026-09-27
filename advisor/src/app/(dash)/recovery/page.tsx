import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { toMs } from "@/lib/domain/time";
import { weeklySpend, recoveryItems, claimState, refundDraftFor, shortDate } from "@/lib/dashboard/recovery";
import { recoveryHeadline, recoveryLede } from "@/lib/dashboard/story";
import { Headline } from "@/components/Headline";
import { WeeklyBars } from "@/components/WeeklyBars";
import { OwnerColumns } from "@/components/OwnerColumns";
import { Timeline } from "@/components/Timeline";
import { ClaimTracker } from "@/components/ClaimTracker";
import { RefundForm } from "./RefundForm";
import { markRefunded } from "./actions";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ period?: string; week?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period), pq = period === "30d" ? "period=30d" : "";
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const unused = d.findings.find((f) => f.kind === "unused" && f.status !== "applied");
  const items = recoveryItems(v.charges, d.runs, { onboardingUnused: v.bucketCtx.onboardingUnused, unusedDocs: Number(unused?.evidence.documents ?? 0),
    advisorPosts: d.runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!) });
  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : null;
  const inWeek = (iso: string) => !week || (toMs(iso) >= toMs(`${week}T00:00:00Z`) && toMs(iso) < toMs(`${week}T00:00:00Z`) + 7 * 86_400_000);
  const shown = items.filter((x) => inWeek(x.at));
  const refundable = items.filter((x) => x.owner === "refund");
  const claim = claimState(d.actions, refundable.reduce((s, x) => s + x.credits, 0));
  const wasteTimes = v.charges.filter((c) => c.isWaste).map((c) => c.chargedAt);
  const hrefFor = (w: string | null) => `/recovery${[w ? `week=${w}` : "", pq].filter(Boolean).length ? `?${[w ? `week=${w}` : "", pq].filter(Boolean).join("&")}` : ""}`;
  return (
    <>
      <Headline text={recoveryHeadline({ waste: v.waste, refundable: claim.found, periodLabel: PERIOD_LABEL[period] })} lede={recoveryLede(wasteTimes)} />
      <section className="panel">
        <div className="ph"><h2>Credits by week, wasted in red</h2>{week && <a className="chip" href={hrefFor(null)}>Show all weeks</a>}</div>
        <WeeklyBars bars={weeklySpend(v.charges, d.now, period === "30d" ? 5 : 8)} selected={week} hrefFor={hrefFor} />
      </section>
      <OwnerColumns items={items} dimmed={new Set(items.filter((x) => !inWeek(x.at)).map((x) => x.id))} />
      <div className="grid2">
        <Timeline title={week ? `What happened in the week of ${shortDate(`${week}T00:00:00Z`)}` : "What happened"} items={shown} />
        <section className="panel" id="claim">
          <div className="ph"><h2>Your refund claim</h2></div>
          <ClaimTracker found={claim.found} requested={claim.requested} refunded={claim.refunded} />
          {claim.open && claim.open.status === "requested" && (
            <form action={markRefunded}><input type="hidden" name="extId" value={claim.open.extId} /><button className="btn ghost" type="submit">Mark as refunded</button></form>)}
          {refundable.length > 0 && !claim.open && (
            <RefundForm orgId={process.env.G8_ORG_ID ?? ""} draftFor={refundable.map((x) => x.id).join(",")}
              items={refundable.map((x) => ({ id: x.id, title: x.title, credits: Math.round(x.credits), line: refundDraftFor([x], "").split("\n")[3] }))} />)}
        </section>
      </div>
    </>
  );
}
