import Link from "next/link";
import type { WeekBar } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";

export function WeeklyBars({ bars, selected, hrefFor }: { bars: WeekBar[]; selected: string | null; hrefFor: (start: string | null) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.credits));
  return (
    <div>
      <div className="bars" role="list">
        {bars.map((b) => {
          const on = selected === b.start.slice(0, 10);
          return (
            <Link role="listitem" key={b.start} href={hrefFor(on ? null : b.start.slice(0, 10))} aria-current={on ? "true" : undefined}
              className={`bar${selected && !on ? " dim" : ""}`} aria-label={`Week of ${b.label}: ${n(b.credits)} credits, ${n(b.waste)} wasted`}>
              {b.waste > 0 && <span className="wl">{n(b.waste)} wasted</span>}
              <span className="b waste" style={{ height: b.waste > 0 ? `${Math.max(8, (b.waste / max) * 140)}px` : 0 }} />
              <span className="b" style={{ height: `${((b.credits - b.waste) / max) * 140}px` }} />
            </Link>);
        })}
      </div>
      <div className="xl">{bars.map((b) => <span key={b.start}>{b.label}</span>)}</div>
    </div>
  );
}
