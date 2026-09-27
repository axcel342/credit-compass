import type { StatItem } from "@/lib/dashboard/story";
export function StatStrip({ items }: { items: StatItem[] }) {
  return (<dl className="strip">{items.map((s) => (<div key={s.label}><dt>{s.label}</dt><dd className={s.tone === "bad" ? "bad" : undefined}>{s.value}</dd></div>))}</dl>);
}
