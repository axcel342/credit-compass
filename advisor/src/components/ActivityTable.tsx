import Link from "next/link";
import { boughtCell, MATCH_LABEL, type Activity } from "@/lib/domain/activities";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { n } from "@/lib/dashboard/story";

export interface Fold { count: number; credits: number; open: boolean; href: string }
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const when = (a: Activity) => (a.from.slice(0, 10) === a.to.slice(0, 10) ? day(a.from) : `${day(a.from)} to ${day(a.to)}`);
const MATCH_TIP = "Exact: a run, job or token count matched. Likely: only the timing matched.";

function Bought({ a }: { a: Activity }) {
  const b = boughtCell(a);
  if (b.kind === "split") return (
    <span className="bought" title={b.title}>
      <span className="bmini" aria-hidden="true">{BUCKETS.filter((k) => b.buckets[k] > 0).map((k) => <i key={k} style={{ flex: b.buckets[k], background: `var(--${k})` }} />)}</span>
      <span><span className={b.share >= 50 ? "share good-ink" : "share"}>{b.share}%</span> booked</span>
    </span>);
  return (
    <span className={b.bucket === "waste" ? "res bad-ink" : "res"} title={b.title}>
      <i className="dot" style={{ background: `var(--${b.bucket})` }} />{b.kind === "result" ? b.text : BUCKET_LABEL[b.bucket]}
    </span>);
}

export function ActivityTable({ rows, fold }: { rows: Activity[]; fold: Fold | null }) {
  if (!rows.length) return <p className="small">No charges match this filter.</p>;
  return (
    <div className="table-wrap"><table className="acts-table">
      <thead><tr><th>When</th><th>What it paid for</th><th className="num">Credits</th><th>What it bought</th><th title={MATCH_TIP}>Match</th></tr></thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.key}>
            <td className="when">{when(a)}</td>
            <td className="what"><b>{a.title}</b>{a.detail ? `, ${a.detail}` : ""}
              {a.children.length > 0 && (
                <details><summary>{a.children.length} jobs</summary>
                  <ul>{a.children.map((k) => <li key={k.key}><span>{k.label}</span><b>{n(k.credits)}</b><span className="small">{k.result}</span></li>)}</ul>
                </details>)}
            </td>
            <td className="num">{n(a.credits)}</td>
            <td><Bought a={a} /></td>
            <td><span className={`match ${a.match}`} title={a.matchNote}>{MATCH_LABEL[a.match]}</span></td>
          </tr>
        ))}
        {fold && (
          <tr className="fold"><td /><td><Link href={fold.href}>{fold.open ? "Hide" : "Show"} {fold.count} smaller charges</Link></td>
            <td className="num">{n(fold.credits)}</td><td className="small">Each under 1% of spend</td><td /></tr>)}
      </tbody>
    </table></div>
  );
}
