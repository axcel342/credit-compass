import type { G8Caller } from "../g8/client";
import { g8Caller } from "../g8/client";
import { RecordStore } from "../store/records";
import { valuesToCharge, valuesToFinding, valuesToRun, valuesToStat } from "../store/mappers";
import { coverage } from "../domain/attribution";
import type { AttributedCharge, Finding, Run, Stat } from "../domain/types";

export interface DashboardData { charges: AttributedCharge[]; stats: Stat[]; findings: Finding[]; runs: Run[]; coverage: ReturnType<typeof coverage>; waste: number; now: string }

export async function loadDashboardData(c: G8Caller = g8Caller): Promise<DashboardData> {
  const [ch, st, fi, ru] = await Promise.all(["roi_charge", "roi_stat", "roi_finding", "roi_run"].map((slug) => new RecordStore(c, slug).list()));
  const charges = ch.map((r) => valuesToCharge(r.values));
  const real = charges.filter((x) => !x.simulated);
  return { charges, stats: st.map((r) => valuesToStat(r.values)), findings: fi.map((r) => valuesToFinding(r.values)), runs: ru.map((r) => valuesToRun(r.values)),
    coverage: coverage(real), waste: real.filter((x) => x.isWaste).reduce((s, x) => s + x.credits, 0), now: new Date().toISOString() };
}
