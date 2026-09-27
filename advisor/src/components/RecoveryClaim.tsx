import { claimState, refundDraftFor, shortDate, type RecoveryItem } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";
import { RefundForm } from "@/app/(dash)/recovery/RefundForm";
import { markRefunded } from "@/app/(dash)/recovery/actions";
import { ClaimHash } from "./ClaimHash";

export function RecoveryClaim({ items, claim, orgId, periodLabel }: { items: RecoveryItem[]; claim: ReturnType<typeof claimState>; orgId: string; periodLabel: string }) {
  const refund = items.filter((x) => x.owner === "refund");
  if (claim.found <= 0) return <h1 className="h-scr claim-none">Nothing to claim back in {periodLabel}.</h1>;
  const step = claim.refunded > 0 ? 2 : claim.requested > 0 ? 1 : 0;
  const steps = [`Found ${n(claim.found)}`, claim.requested ? `Requested ${n(claim.requested)}` : "Requested", claim.refunded ? `Refunded ${n(claim.refunded)}` : "Refunded"];
  return (
    <section className="claim-lead" id="claim" aria-labelledby="claim-h">
      <div>
        <h1 id="claim-h" className="r-fig"><span className="fig tnum">{n(claim.found)}</span><span className="u">credits</span><span className="sr-only"> graph8 owes you</span></h1>
        <p className="r-lab">graph8 owes you for work that produced nothing</p>
        <ul className="r-items">{refund.map((x) => <li key={x.id}><span>{x.title}</span><b>{n(x.credits)}</b></li>)}</ul>
        <ol className="r-steps" aria-label="Refund claim">
          {steps.map((t, i) => <li key={t} className={i <= step ? "done" : undefined} aria-current={i === step ? "step" : undefined}>{t}</li>)}
        </ol>
      </div>
      <div className="claim-act">
        {!claim.open && refund.length > 0 && (
          <>
            <ClaimHash />
            <details className="claim" id="claim-form">
              <summary className="btn primary">Request a refund of {n(claim.found)}</summary>
              <RefundForm orgId={orgId} draftFor={refund.map((x) => x.id).join(",")}
                items={refund.map((x) => ({ id: x.id, title: x.title, credits: Math.round(x.credits), line: refundDraftFor([x], "").split("\n")[3] }))} />
            </details>
          </>
        )}
        {claim.open?.status === "requested" && (
          <>
            <p className="small">Requested {shortDate(claim.open.appliedAt)}</p>
            <form action={markRefunded}><input type="hidden" name="extId" value={claim.open.extId} /><button className="btn ghost" type="submit">Mark as refunded</button></form>
          </>
        )}
      </div>
    </section>
  );
}
