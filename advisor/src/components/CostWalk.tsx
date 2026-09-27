import type { CostWalk as Walk, TypeDef } from "@/lib/domain/planner";
import { n, plural } from "@/lib/dashboard/story";

export function CostWalk({ walk, def }: { walk: Walk; def: TypeDef }) {
  const w = (v: number) => `${walk.every ? (v / walk.every) * 100 : 0}%`;
  const after1 = walk.every - walk.done.credits;
  return (
    <div className="walk" role="table" aria-label="How the estimate is built">
      <div role="row"><span role="cell">Every contact</span><div className="track"><span className="b every" style={{ width: "100%" }} /></div><b role="cell">{n(walk.every)}</b></div>
      <div role="row" title={plural(walk.done.count, "contact")}><span role="cell">{def.shortNotTarget}</span><div className="track"><span style={{ width: w(after1) }} /><span className="b cut" style={{ width: w(walk.done.credits) }} /></div><b role="cell" className="muted">{walk.done.credits ? `−${n(walk.done.credits)}` : "0"}</b></div>
      <div role="row" title={plural(walk.skipped.count, "contact")}><span role="cell">Unlikely to book, skipped</span><div className="track"><span style={{ width: w(after1 - walk.skipped.credits) }} /><span className="b skip" style={{ width: w(walk.skipped.credits) }} /></div><b role="cell" className="muted">{walk.skipped.credits ? `−${n(walk.skipped.credits)}` : "0"}</b></div>
      <div role="row" title={plural(walk.records, "contact")}><span role="cell"><b>Estimate</b></span><div className="track"><span className="b est" style={{ width: w(walk.records * walk.perRecord) }} /></div><b role="cell">~{n(walk.estimate)}</b></div>
    </div>
  );
}
