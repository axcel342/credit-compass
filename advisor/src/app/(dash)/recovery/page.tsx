import { loadDashboardData } from "@/lib/dashboard/data";
import { dashboardBuckets } from "@/lib/domain/gate";
import { buildRefundDraft } from "@/lib/recovery/refund";
import { Tag } from "@/components/Tag";
import { SendRefund } from "./SendRefund";
const LABEL: Record<string, string> = { waste: "Waste", fix: "Fix", side_effect: "Side effect", unused: "Unused" };
export default async function RecoveryPage() {
  const d = await loadDashboardData();
  const cards = dashboardBuckets(d.findings, d.now).open.filter((f) => ["waste", "fix", "side_effect", "unused"].includes(f.kind));
  const draft = buildRefundDraft({ orgId: process.env.G8_ORG_ID ?? "", charges: d.charges, reason: "failed_job" });
  return (
    <section>
      <div className="sec-head"><h2>Recovery</h2><p>Credits that bought nothing, with the evidence attached. Refund requests go to graph8 support only after you confirm.</p></div>
      <div className="frame"><div className="frame-body">
        <div className="cards">{cards.map((f) => (
          <div className="rcard" key={f.extId}>
            <span className={`kind ${f.kind === "unused" ? "info" : f.kind === "waste" ? "waste" : "fix"}`}>{LABEL[f.kind]}</span> <Tag simulated={f.simulated} />
            <div className="amt">{f.creditsAtStake.toLocaleString("en-US")}</div><p>{f.body}</p>
          </div>))}
          {cards.length === 0 && <p>Nothing to recover right now.</p>}
        </div>
        {draft && <SendRefund draft={draft.message} />}
      </div></div>
    </section>
  );
}
