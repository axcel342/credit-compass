import { MATCH_LABEL, type Activity } from "@/lib/domain/activities";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { n } from "@/lib/dashboard/story";

const when = (a: Activity) => {
  const d = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const t = new Date(a.from).toISOString().slice(11, 16);
  return a.from.slice(0, 10) === a.to.slice(0, 10) ? `${d(a.from)}, ${t}` : `${d(a.from)} to ${d(a.to)}`;
};
const SHORT: Record<string, string> = { booked: "booked", emailed: "emailed, no meeting yet", nomeet: "no meeting yet", unused: "never used", unknown: "can't tell yet", waste: "wasted" };

export function ActivityTable({ rows }: { rows: Activity[] }) {
  if (!rows.length) return <p className="small">No charges match this filter.</p>;
  return (
    <div className="table-wrap"><table className="acts-table">
      <thead><tr><th>When</th><th>What it paid for</th><th className="num">Credits</th><th>What it bought</th><th>Match</th></tr></thead>
      {rows.map((a) => {
        const parts = BUCKETS.filter((b) => a.buckets[b] > 0);
        return (
          <tbody key={a.key}>
            <tr>
              <td>{when(a)}</td>
              <td className="what"><b>{a.title}</b>{a.detail ? `, ${a.detail}` : ""}<small>{a.charges} {a.charges === 1 ? "charge" : "charges"}</small>
                {parts.length > 1 && <span className="mini" aria-hidden="true">{parts.map((b) => <span key={b} style={{ flex: a.buckets[b], background: `var(--${b})` }} />)}</span>}
                {a.children.length > 0 && (
                  <details><summary>{a.children.length} jobs</summary>
                    <ul>{a.children.map((k) => <li key={k.key}><span>{k.label}</span><b>{n(k.credits)}</b><span className="small">{k.result}</span></li>)}</ul>
                  </details>)}
              </td>
              <td className="num">{n(a.credits)}</td>
              <td>{a.result ? <span><i className="dot" style={{ background: `var(--${parts[0]})` }} /> {a.result}</span>
                : <ul className="split">{parts.map((b) => <li key={b}><i className="dot" style={{ background: `var(--${b})` }} />{n(a.buckets[b])} {SHORT[b]}</li>)}</ul>}
                <span className="sr-only">{parts.map((b) => `${BUCKET_LABEL[b]} ${n(a.buckets[b])}`).join("; ")}</span></td>
              <td><span className={`match ${a.match}`} title={a.matchNote}>{MATCH_LABEL[a.match]}</span></td>
            </tr>
          </tbody>);
      })}
    </table></div>
  );
}
