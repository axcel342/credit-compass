import { loadFixture, listFixtures } from "../fixtures";
import type { LedgerRow, Run } from "@/lib/domain/types";
import { runFromExecution, onboardingWindow, type ExecutionRecord } from "@/lib/domain/runs";

interface AdvisorRunsFile {
  runs: Run[]; advisorPosts: string[]; actionNames: Record<string, string>;
  onboardingAnchors: { firstStudioDocCreatedAt: string; lastResearchReportUpdatedAt: string; landingPageCreatedAt: string };
}

export function loadDesignInput() {
  const ledger = loadFixture<LedgerRow[]>("ledger/ledger-2026-09-26.json");
  const a = loadFixture<AdvisorRunsFile>("advisor-runs-2026-09-26.json");
  const execRuns = listFixtures("executions")
    .map((f) => runFromExecution(loadFixture<ExecutionRecord>(f), a.actionNames))
    .filter((r): r is Run => r !== null);
  return { ledger, runs: [...execRuns, ...a.runs], windows: [onboardingWindow(a.onboardingAnchors)], advisorPosts: a.advisorPosts };
}
