export interface LedgerRow {
  id: string; type: string; amount: number; service: string | null; quantity: number | null;
  llm_tier: string | null; description: string | null; created_at: string;
}

export type RunKind = "skill_run" | "workflow_run" | "ai_enrichment_job" | "waterfall_job" | "pipeline_run"
  | "verification" | "studio_doc" | "research_report" | "landing_page" | "advisor_post" | "sync_lock";
export type RunSource = "webhook" | "poll" | "advisor";

export interface Run {
  extId: string; kind: RunKind; service?: string | null; actionName: string;
  startedAt: string | null; completedAt: string | null; status: string; source: RunSource;
  tokensIn?: number | null; tokensOut?: number | null; listId?: number | null; contactIds?: number[];
  contactLabel?: string | null; companyName?: string | null;
  recordsOk?: number | null; recordsFailed?: number | null; recordsSkipped?: number | null;
  quotedCredits?: number | null; reportedCredits?: number | null; resultHint?: "unreadable" | null;
  simulated?: boolean;
}

export interface TimeWindow { services: string[]; start: number; end: number; label: string }

export type Method = "exact_tokens" | "job_window" | "pipeline_run" | "advisor" | "time_window" | "none";
export type ChargeResult = "success" | "failed" | "empty" | "unreadable" | "side_effect" | "unknown";
export type WasteReason = "failed_job" | "no_change" | "billing_mismatch" | "agent_side_effect";

export interface AttributedCharge {
  ledgerId: string; ledgerType: string; service: string; credits: number; chargedAt: string;
  llmTier: string | null; tokensIn: number | null; tokensOut: number | null; description: string | null;
  method: Method; runExtId: string | null; listId: number | null; contactId: number | null; segmentKey: string | null;
  explanation: string; result: ChargeResult; isWaste: boolean; wasteReason: WasteReason | null; simulated: boolean;
}

export type OutcomeType = "email_sent" | "email_replied" | "email_bounced" | "meeting_booked" | "meeting_held"
  | "meeting_no_show" | "deal_created" | "deal_stage_changed" | "deal_won" | "deal_lost";

export interface Outcome {
  extId: string; type: OutcomeType; occurredAt: string; contactId: number | null; companyId: number | null;
  dealId: string | null; amount: number | null; listId: number | null; sequenceId: string | null;
  step: number | null; channel: string | null; segmentKey: string | null; source: "webhook" | "poll" | "sim"; simulated: boolean;
}

export type Confidence = "high" | "medium" | "low";
export type Dimension = "list" | "segment" | "channel" | "step" | "service" | "org";

export interface Stat {
  period: string; dimension: Dimension; value: string; credits: number; creditsExact: number;
  meetings: number; deals: number; wonValue: number; contactsReached: number;
  costPerMeeting: number | null; costPerDeal: number | null; vsAvgPct: number | null;
  evidenceN: number; confidence: Confidence; simulated: boolean; computedAt: string;
}

export type FindingKind = "scale" | "cut" | "waste" | "fix" | "unused" | "data_risk" | "what_worked" | "traceability" | "side_effect" | "repeat_enrichment";
export type FindingStatus = "open" | "dismissed" | "snoozed" | "applied";

export interface Finding {
  extId: string; kind: FindingKind; title: string; body: string; evidence: Record<string, unknown>;
  creditsAtStake: number; confidence: Confidence; status: FindingStatus; snoozedUntil: string | null;
  dismissCount: number; action: string | null; actionPayload: Record<string, unknown> | null;
  firstSeen: string; lastSeen: string; lastNotifiedStake: number | null; inRecap: boolean; simulated: boolean;
}

export interface ContactInfo {
  contactId: number; name: string; email: string | null; companyName: string | null; companyDomain: string | null;
  listIds: number[]; sequenceIds: string[]; segmentKey: string; consistency: "ok" | "flagged" | "unknown";
}

export type OutcomeBucket = "booked" | "emailed" | "nomeet" | "unused" | "unknown" | "waste";
export type Period = "8w" | "30d";

export interface ContactCacheRow {
  contactId: number; listIds: number[]; hasEmail: boolean; consistency: "ok" | "flagged" | "unknown"; segmentKey: string;
  fit: "high" | "medium" | "low" | "unknown"; fitLevel: "segment" | "role" | "seniority" | "list" | "org" | null; syncedAt: string;
}

export type ActionKind = "repeat_skip" | "lookalike" | "pause_list" | "guardrail" | "refund_request";
export interface ActionRecord {
  extId: string; kind: ActionKind; listId: number | null; pipelineId: string | null; appliedAt: string;
  status: "applied" | "undone" | "requested" | "refunded"; previous: unknown; detail: Record<string, unknown>; simulated: boolean;
}
