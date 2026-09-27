import Link from "next/link";
import type { DoNextItem } from "@/lib/dashboard/donext";

export function DoNext({ items }: { items: DoNextItem[] }) {
  return (
    <section className="panel dn-list" aria-labelledby="donext-h">
      <div className="ph"><h2 id="donext-h">Do next</h2></div>
      {items.length === 0 && <p className="small">Nothing needs doing right now.</p>}
      {items.map((x) => (
        <div className="dn" key={x.id}>
          <div className="dn-fig"><span className="fig tnum">{x.figure}</span><span className="u">{x.unit}</span></div>
          <p>{x.text}</p>
          <Link className="btn ghost" href={x.href}>{x.label}</Link>
        </div>
      ))}
    </section>
  );
}
