import Link from "next/link";
import type { FlowLayout } from "@/lib/dashboard/flow";
import { n } from "@/lib/dashboard/story";

export function FlowDiagram({ layout, periodQuery }: { layout: FlowLayout; periodQuery: string }) {
  const q = (href: string) => (periodQuery ? `${href}${href.includes("?") ? "&" : "?"}${periodQuery}` : href);
  const total = layout.nodes.filter((x) => x.col === 2).reduce((s, x) => s + x.value, 0) || 1;
  return (
    <>
      <svg className="flow" viewBox={`-10 -30 ${layout.width + 20} ${layout.height + 40}`} role="img"
        aria-label={`Where ${n(total)} credits went, from what you paid for to who it was spent on to what it bought`}>
        <g className="flow-heads"><text x={185} y={-12} textAnchor="end">What you paid for</text><text x={538} y={-12}>Who it was spent on</text><text x={838} y={-12}>What it bought</text></g>
        {layout.links.map((l) => (
          <a key={`${l.source}>${l.target}`} href={q(l.href)}>
            <path d={l.d} fill={l.colorVar} className={l.colorVar === "var(--flow)" ? "band" : "band outcome"}><title>{l.title}</title></path>
          </a>))}
        {layout.nodes.map((x) => (
          <a key={x.id} href={q(x.href)}>
            <rect x={x.x} y={x.y} width={layout.nodeWidth} height={x.h} rx={1} fill={x.col === 2 ? `var(--${x.key})` : "var(--ink-2)"}><title>{`${x.label}: ${n(x.value)} credits`}</title></rect>
            <text className="flow-label" x={x.col === 0 ? x.x - 8 : x.x + layout.nodeWidth + 8} y={x.y + x.h / 2 + 4} textAnchor={x.col === 0 ? "end" : "start"}>
              {x.label} <tspan fontWeight={600}>{n(x.value)}</tspan>
            </text>
          </a>))}
      </svg>
      <div className="flow-mobile" aria-hidden="true">
        <div className="stack-bar">{layout.nodes.filter((x) => x.col === 2).map((x) => <span key={x.id} style={{ flex: x.value, background: `var(--${x.key})` }} />)}</div>
        <ul>{layout.nodes.filter((x) => x.col === 2).map((x) => (
          <li key={x.id}><Link href={q(x.href)}><i className="dot" style={{ background: `var(--${x.key})` }} />{x.label}</Link><b>{n(x.value)}</b></li>))}</ul>
      </div>
    </>
  );
}
