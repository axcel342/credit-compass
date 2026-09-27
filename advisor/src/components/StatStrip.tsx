import type { StatItem } from "@/lib/dashboard/story";
export function StatStrip({ items }: { items: StatItem[] }) {
  return (<dl className="strip">{items.map((s) => (<div key={s.label}>
    <dt>{s.label}{s.note && <span className={`note ${s.noteTone ?? ""}`}>{s.note}</span>}</dt>
    <dd className={s.tone === "bad" ? "bad" : undefined}>{s.value}</dd></div>))}</dl>);
}
