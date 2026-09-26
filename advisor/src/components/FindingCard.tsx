import type { Finding } from "@/lib/domain/types";
import { Tag } from "./Tag";
const KIND_CLASS: Record<Finding["kind"], string> = { scale: "scale", cut: "cut", waste: "waste", fix: "fix", unused: "info", data_risk: "watch", what_worked: "scale", traceability: "info", side_effect: "fix" };
const KIND_LABEL: Record<Finding["kind"], string> = { scale: "Scale", cut: "Cut", waste: "Waste", fix: "Fix", unused: "Unused", data_risk: "Data risk", what_worked: "Worked", traceability: "Trace", side_effect: "Side effect" };
export function FindingCard({ f, children }: { f: Finding; children?: React.ReactNode }) {
  return (
    <div className="finding">
      <div className="f-top"><span className={`kind ${KIND_CLASS[f.kind]}`}>{KIND_LABEL[f.kind]}</span><Tag simulated={f.simulated} /><span className="conf">{f.confidence[0].toUpperCase() + f.confidence.slice(1)} confidence</span></div>
      <p>{f.body}</p>
      <div className="f-ev">{f.creditsAtStake.toLocaleString("en-US")} credits at stake</div>
      {children}
    </div>
  );
}
