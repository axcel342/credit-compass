import Link from "next/link";
import type { RecoveryItem } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";

const COLS = [
  { key: "refund", title: "graph8 should refund", tone: "var(--waste)" },
  { key: "stopped", title: "Already stopped", tone: "var(--booked)", also: "stoppable" },
  { key: "usable", title: "Paid for, still usable", tone: "var(--unused)" },
] as const;

export function OwnerColumns({ items, dimmed }: { items: RecoveryItem[]; dimmed: Set<string> }) {
  return (
    <div className="owners">
      {COLS.map((col) => {
        const xs = items.filter((x) => x.owner === col.key || ("also" in col && x.owner === col.also));
        const total = xs.reduce((s, x) => s + x.credits, 0);
        const title = col.key === "stopped" && xs.some((x) => x.owner === "stoppable") ? "You can stop" : col.title;
        return (
          <section className="owner" key={col.key} style={{ borderTopColor: col.tone }}>
            <span className="small">{title}</span><div className="big">{n(total)}</div>
            {xs.length === 0 && <p className="small">Nothing here.</p>}
            {xs.map((x) => (<div key={x.id} className={`item${dimmed.has(x.id) ? " dim" : ""}`}><span>{x.title}<small>{x.detail}</small></span><b>{n(x.credits)}</b></div>))}
            {col.key === "refund" && total > 0 && <Link className="btn primary" href="#claim">Request a refund of {n(total)}</Link>}
          </section>);
      })}
    </div>
  );
}
