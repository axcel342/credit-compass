import { Fragment } from "react";
import type { ValueChain as Chain } from "@/lib/dashboard/story";

export function ValueChain({ chain }: { chain: Chain }) {
  if ("empty" in chain) return <h1 className="chain-empty">{chain.empty}</h1>;
  return (
    <>
      <h1 className="sr-only">{chain.aria}</h1>
      <div className="chain" aria-hidden="true">
        {chain.nodes.map((x, i) => (
          <Fragment key={x.label}>
            {i > 0 && <div className="cl"><span>{chain.links[i - 1]}</span></div>}
            <div className="cn"><span className={`fig tnum ${x.tone}`}>{x.figure}</span><span className="lab">{x.label}</span></div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
