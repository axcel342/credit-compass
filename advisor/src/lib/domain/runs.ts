import type { Run, TimeWindow } from "./types";
import { toMs } from "./time";

export interface ExecutionRecord {
  execution_id: string; action_id: string; status: string; input_data?: Record<string, unknown>;
  output_data?: { node_results?: Record<string, { output?: { tokens_input?: number; tokens_output?: number } }> } | null;
  tokens_input?: number | null; tokens_output?: number | null; started_at?: string | null; completed_at?: string | null;
}

export function runFromExecution(exec: ExecutionRecord, actionNames: Record<string, string>): Run | null {
  if (!exec || !exec.execution_id) return null;
  let tokensIn = exec.tokens_input ?? null, tokensOut = exec.tokens_output ?? null;
  const nodes = exec.output_data?.node_results ?? {};
  const isWorkflow = Object.keys(nodes).length > 0;
  for (const n of Object.values(nodes)) {
    if (n?.output?.tokens_input) { tokensIn = n.output.tokens_input; tokensOut = n.output.tokens_output ?? null; }
  }
  const input = exec.input_data ?? {};
  const first = typeof input.first_name === "string" ? input.first_name : "";
  const last = typeof input.last_name === "string" ? input.last_name : "";
  const company = typeof input.company_name === "string" ? input.company_name : null;
  return {
    extId: exec.execution_id, kind: isWorkflow ? "workflow_run" : "skill_run", service: "voice_llm",
    actionName: actionNames[exec.action_id] ?? (isWorkflow ? "Workflow run" : "Skill run"),
    startedAt: exec.started_at ?? null, completedAt: exec.completed_at ?? null, status: exec.status, source: "poll",
    tokensIn, tokensOut, contactLabel: `${first} ${last}`.trim() || null, companyName: company,
  };
}

export function onboardingWindow(a: { firstStudioDocCreatedAt: string; lastResearchReportUpdatedAt: string; landingPageCreatedAt: string | null }): TimeWindow {
  const starts = [toMs(a.firstStudioDocCreatedAt)];
  const ends = [toMs(a.lastResearchReportUpdatedAt)];
  if (a.landingPageCreatedAt) { starts.push(toMs(a.landingPageCreatedAt)); ends.push(toMs(a.landingPageCreatedAt)); }
  return {
    services: ["studio_global", "landing_page_template", "image_generation", "brand_snapshot_classify"],
    start: Math.min(...starts) - 15 * 60_000, end: Math.max(...ends) + 60 * 60_000, label: "Onboarding research and setup",
  };
}
