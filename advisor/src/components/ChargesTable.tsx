import type { AttributedCharge } from "@/lib/domain/types";
import { EXACT_METHODS } from "@/lib/domain/attribution";
import { toMs } from "@/lib/domain/time";

const RESULT: Record<AttributedCharge["result"], [string, string]> = {
  success: ["var(--good)", "Completed"], failed: ["var(--crit)", "Failed · waste"], unreadable: ["var(--crit)", "Result not readable · waste"],
  side_effect: ["var(--warn)", "Side effect"], empty: ["var(--warn)", "Empty"], unknown: ["var(--muted)", "Unknown"],
};
export function ChargesTable({ charges }: { charges: AttributedCharge[] }) {
  const rows = [...charges].sort((a, b) => toMs(b.chargedAt) - toMs(a.chargedAt));
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Time (UTC)</th><th>What it paid for</th><th className="num">Credits</th><th>Matched by</th><th>Result</th></tr></thead>
      <tbody>{rows.map((c) => {
        const m = EXACT_METHODS.has(c.method) ? ["exact", "exact"] : c.method === "time_window" ? ["window", "time window"] : ["none", "service only"];
        const [color, words] = RESULT[c.result];
        return (<tr key={c.ledgerId}>
          <td className="mono">{new Date(toMs(c.chargedAt)).toISOString().slice(5, 16).replace("T", " ")}</td>
          <td className="what">{c.explanation}<small>{c.service}</small></td>
          <td className="num">{c.credits.toLocaleString("en-US")}</td>
          <td><span className={`method ${m[0]}`}>{m[1]}</span></td>
          <td><span className="result"><i className="dot" style={{ background: color }} />{words}</span></td>
        </tr>);
      })}</tbody>
    </table></div>
  );
}
