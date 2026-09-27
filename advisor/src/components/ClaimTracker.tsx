import { n } from "@/lib/dashboard/story";
export function ClaimTracker({ found, requested, refunded }: { found: number; requested: number; refunded: number }) {
  const step = refunded > 0 ? 2 : requested > 0 ? 1 : 0;
  return (
    <ol className="tracker" aria-label="Refund claim progress">
      {[["Found", found], ["Requested", requested], ["Refunded", refunded]].map(([label, v], i) => (
        <li key={label as string} className={i < step ? "done" : undefined} aria-current={i === step ? "step" : undefined}><span className="small">{label}</span><b>{n(v as number)}</b></li>))}
    </ol>
  );
}
