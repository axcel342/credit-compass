import Link from "next/link";
import type { OutcomeBucket } from "@/lib/domain/types";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { filterHref, type ChargeFilter } from "@/lib/dashboard/filters";
import { n } from "@/lib/dashboard/story";

export function OutcomeChips({ f, totals, all, periodQuery }: { f: ChargeFilter; totals: Record<OutcomeBucket, number>; all: number; periodQuery: string }) {
  return (
    <nav className="chips" aria-label="Filter by what it bought">
      <Link className="chip" aria-current={!f.outcome ? "true" : undefined} href={filterHref(f, { outcome: null }, periodQuery)}>All <b>{n(all)}</b></Link>
      {BUCKETS.filter((b) => totals[b] > 0).map((b) => (
        <Link key={b} className="chip" aria-current={f.outcome === b ? "true" : undefined} href={filterHref(f, { outcome: b }, periodQuery)}>
          <i className="dot" style={{ background: `var(--${b})` }} />{BUCKET_LABEL[b]} <b>{n(totals[b])}</b></Link>))}
    </nav>
  );
}
