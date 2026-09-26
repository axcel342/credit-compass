import { loadDashboardData } from "@/lib/dashboard/data";
import { CoverageBar } from "@/components/CoverageBar";
import { ChargesTable } from "@/components/ChargesTable";
export default async function ChargesPage() {
  const d = await loadDashboardData();
  return (
    <section>
      <div className="sec-head"><h2>Charges, explained</h2><p>Every ledger line in plain words, with how it was matched. Spend that can't be traced stays in its own bucket.</p></div>
      <div className="frame"><div className="frame-body">
        <CoverageBar exact={d.coverage.exact} window={d.coverage.window} none={d.coverage.none} />
        <ChargesTable charges={d.charges} />
      </div></div>
    </section>
  );
}
