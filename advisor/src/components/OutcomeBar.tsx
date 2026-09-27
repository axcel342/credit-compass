import Link from "next/link";
import type { OutcomeBucket } from "@/lib/domain/types";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { n } from "@/lib/dashboard/story";

export function OutcomeBar({ totals, hrefFor, big = false }: { totals: Record<OutcomeBucket, number>; hrefFor?: (b: OutcomeBucket) => string; big?: boolean }) {
  const shown = BUCKETS.filter((b) => totals[b] > 0);
  return (
    <>
      <div className={big ? "obar big" : "obar"} aria-hidden="true">
        {shown.map((b) => <span key={b} style={{ flex: totals[b], background: `var(--${b})` }} />)}
      </div>
      {hrefFor && (
        <ul className="okey">
          {shown.map((b) => (
            <li key={b} className={b === "booked" ? "lead" : b === "waste" ? "bad" : undefined}>
              <Link href={hrefFor(b)}><i style={{ background: `var(--${b})` }} />{BUCKET_LABEL[b]}<b>{n(totals[b])}</b></Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
