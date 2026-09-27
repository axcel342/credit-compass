import type { RecoveryItem } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";
export function Timeline({ title, items }: { title: string; items: RecoveryItem[] }) {
  return (
    <section className="panel"><div className="ph"><h2>{title}</h2></div>
      {items.length === 0 ? <p className="small">No waste, nothing to recover.</p> :
        items.map((x) => (<div className="tl" key={x.id}><span className="small">{new Date(x.at).toISOString().slice(11, 16)}</span><span>{x.title}</span>
          <b className={x.owner === "usable" ? undefined : "bad"}>{n(x.credits)}</b></div>))}
    </section>
  );
}
