import type { AttributedCharge, OutcomeBucket } from "../domain/types";
import { BUCKETS, BUCKET_LABEL } from "../domain/buckets";
import { serviceName } from "../domain/names";
import { n } from "./story";

export interface FlowNode { id: string; key: string; label: string; value: number; col: 0 | 1 | 2; href: string }
export interface FlowLink { source: string; target: string; value: number }
export interface FlowData { nodes: FlowNode[]; links: FlowLink[] }
export interface LaidNode extends FlowNode { x: number; y: number; h: number }
export interface LaidLink extends FlowLink { d: string; h: number; colorVar: string; href: string; title: string }
export interface FlowLayout { width: number; height: number; nodeWidth: number; nodes: LaidNode[]; links: LaidLink[] }

const TOP_SERVICES = 5, SMALL_LIST_SHARE = 0.01;

export function flowData(charges: AttributedCharge[], bucketOf: (c: AttributedCharge) => OutcomeBucket, listNames: Map<string, string>): FlowData {
  const total = charges.reduce((s, c) => s + c.credits, 0) || 1;
  const bySvc = new Map<string, number>(), byList = new Map<string, number>();
  for (const c of charges) {
    bySvc.set(c.service, (bySvc.get(c.service) ?? 0) + c.credits);
    const lk = c.listId === null ? "none" : String(c.listId);
    byList.set(lk, (byList.get(lk) ?? 0) + c.credits);
  }
  const topSvc = [...bySvc].sort((a, b) => b[1] - a[1]).slice(0, TOP_SERVICES).map(([s]) => s);
  const svcKey = (s: string) => (topSvc.includes(s) ? s : "other");
  const listKey = (c: AttributedCharge) => {
    if (c.listId === null) return "none";
    return (byList.get(String(c.listId)) ?? 0) / total < SMALL_LIST_SHARE ? "other" : String(c.listId);
  };
  const acc = new Map<string, number>();
  const add = (k: string, v: number) => acc.set(k, (acc.get(k) ?? 0) + v);
  for (const c of charges) {
    const s = `s:${svcKey(c.service)}`, l = `l:${listKey(c)}`, b = `b:${bucketOf(c)}`;
    add(s, c.credits); add(l, c.credits); add(b, c.credits); add(`${s}>${l}`, c.credits); add(`${l}>${b}`, c.credits);
  }
  const nodes: FlowNode[] = [];
  const svcOrder = [...topSvc.filter((s) => acc.has(`s:${s}`)), ...(acc.has("s:other") ? ["other"] : [])];
  for (const s of svcOrder) nodes.push({ id: `s:${s}`, key: s, col: 0, value: acc.get(`s:${s}`)!, label: s === "other" ? "Other services" : serviceName(s),
    href: s === "other" ? "/charges" : `/charges?service=${s}` });
  const listIds = [...acc.keys()].filter((k) => /^l:[^>]+$/.test(k)).map((k) => k.slice(2));
  const named = listIds.filter((k) => k !== "other" && k !== "none").sort((a, b) => acc.get(`l:${b}`)! - acc.get(`l:${a}`)!);
  for (const l of [...named, ...listIds.filter((k) => k === "other"), ...listIds.filter((k) => k === "none")])
    nodes.push({ id: `l:${l}`, key: l, col: 1, value: acc.get(`l:${l}`)!, href: `/charges?list=${l}`,
      label: l === "none" ? "Not tied to a list" : l === "other" ? "Other lists" : listNames.get(l) ?? `List ${l}` });
  for (const b of BUCKETS) if (acc.has(`b:${b}`)) nodes.push({ id: `b:${b}`, key: b, col: 2, value: acc.get(`b:${b}`)!, label: BUCKET_LABEL[b], href: `/charges?outcome=${b}` });
  const links: FlowLink[] = [...acc].filter(([k]) => k.includes(">")).map(([k, value]) => { const [source, target] = k.split(">"); return { source, target, value }; });
  return { nodes, links };
}

export function layoutFlow(data: FlowData, o = { width: 1000, height: 380, nodeWidth: 10, gap: 14, minH: 3, colX: [190, 520, 820] }): FlowLayout {
  const cols = [0, 1, 2].map((ci) => data.nodes.filter((x) => x.col === ci));
  const total = cols[0].reduce((s, x) => s + x.value, 0) || 1;
  const maxGaps = Math.max(...cols.map((c) => Math.max(0, c.length - 1))) * o.gap;
  const extra = Math.max(...cols.map((c) => c.length)) * o.minH;
  const scale = Math.max(0.0001, (o.height - maxGaps - extra) / total);
  const laid = new Map<string, LaidNode & { out: number; in: number }>();
  for (const [ci, col] of cols.entries()) {
    let y = 0;
    for (const node of col) {
      const h = Math.max(o.minH, node.value * scale);
      laid.set(node.id, { ...node, x: o.colX[ci], y, h, out: 0, in: 0 });
      y += h + o.gap;
    }
  }
  const order = (id: string) => data.nodes.findIndex((x) => x.id === id);
  const links: LaidLink[] = [...data.links].sort((a, b) => order(a.source) - order(b.source) || order(a.target) - order(b.target)).map((l) => {
    const A = laid.get(l.source)!, B = laid.get(l.target)!;
    const h = Math.max(1.5, l.value * scale);
    const y0 = A.y + A.out, y1 = B.y + B.in; A.out += h; B.in += h;
    const x0 = A.x + o.nodeWidth, x1 = B.x, mx = (x0 + x1) / 2;
    const f = (v: number) => Math.round(v * 10) / 10;
    const d = `M${f(x0)} ${f(y0)}C${f(mx)} ${f(y0)} ${f(mx)} ${f(y1)} ${f(x1)} ${f(y1)}L${f(x1)} ${f(y1 + h)}C${f(mx)} ${f(y1 + h)} ${f(mx)} ${f(y0 + h)} ${f(x0)} ${f(y0 + h)}Z`;
    const toBucket = B.col === 2;
    const href = toBucket ? `/charges?list=${A.key}&outcome=${B.key}` : `/charges?service=${A.key === "other" ? "" : A.key}&list=${B.key}`.replace("service=&", "");
    return { ...l, d, h, colorVar: toBucket ? `var(--${B.key})` : "var(--flow)", href, title: `${A.label} → ${B.label}: ${n(l.value)} credits` };
  });
  const height = Math.max(o.height, ...[...laid.values()].map((x) => x.y + x.h));
  return { width: o.width, height, nodeWidth: o.nodeWidth, nodes: [...laid.values()].map(({ out: _o, in: _i, ...x }) => x), links };
}
