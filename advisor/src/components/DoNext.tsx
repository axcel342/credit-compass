import Link from "next/link";
import type { DoNextItem } from "@/lib/dashboard/donext";
export function DoNext({ items }: { items: DoNextItem[] }) {
  return (
    <section className="panel" aria-labelledby="donext-h">
      <div className="ph"><h2 id="donext-h">Do next</h2><span className="small">Most credits at stake first</span></div>
      {items.length === 0 && <p className="small">Nothing needs doing right now.</p>}
      {items.map((x) => (
        <div className="todo" key={x.id}><div><p>{x.text}</p><span className="small">{x.sub}</span></div><Link className="btn primary" href={x.href}>{x.label}</Link></div>))}
    </section>
  );
}
