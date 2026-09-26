# ROI Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app on Vercel that attributes graph8 credit spend to outcomes, explains every charge, finds waste, enforces "spend here, not there" through graph8's own list-pipeline run conditions, posts a weekly recap inside graph8, and answers ROI questions over MCP.

**Architecture:** graph8 is the system of record. A small external engine (Next.js route handlers plus pure TypeScript domain modules) polls the credit ledger, deals and pipeline runs, and receives signed webhooks. It attributes charges to runs and contacts, computes stats and findings, then writes them back into five graph8 custom objects (`roi_charge`, `roi_run`, `roi_outcome`, `roi_stat`, `roi_finding`). The dashboard, the recap and the MCP tools all read those objects. The guardrail writes a `roi_fit` contact field and a pipeline `run_condition`, so graph8 itself skips low-fit contacts.

**Tech Stack:**
- Node 22, Next.js 16.3.6 (App Router, TypeScript, `src/` directory)
- `@graph8/sdk` 0.245.0
- `mcp-handler` 1.1.0 with `@modelcontextprotocol/sdk` 1.26.0 and `zod` ^3.25
- vitest 5.0.2, tsx
- Vercel (cron, env vars), Upstash Redis (only for MCP SSE)

**Spec:** `docs/superpowers/specs/2026-09-26-roi-advisor-design.md`. Read `docs/HANDOFF.md` first. It carries the decision history, the user's working rules and the graph8 behaviours this plan works around.

## Global Constraints

- App root: `advisor/` inside the repo `/home/opc/graph8`. Commit from the repo root after every task.
- Pin exact versions: `next@16.3.6`, `@graph8/sdk@0.245.0`, `mcp-handler@1.1.0`, `@modelcontextprotocol/sdk@1.26.0`, `zod@^3.25.76`, `vitest@5.0.2`. **Do not use `mcp-handler` 2.x**: it removed the SSE transport, and graph8 only registers SSE MCP servers.
- Secrets come only from environment variables. Locally, `advisor/.env.local` is a copy of the repo-root `.env` plus the extra names in `.env.example`. Never commit, log or print secrets.
- graph8 API base: `https://be.graph8.com/api/v1`. Call it only through the SDK wrapper in `src/lib/g8/client.ts`. Never use Python `urllib` (Cloudflare blocks it).
- Rate limits: stay at or below 40 requests/second and 900 requests/minute per process. graph8 enforces 50/s and 1,000/min, and the SDK already retries 429 and 5xx responses twice.
- Contact IDs: every graph8 call in this app uses the **CRM row ID** (1–250 in this org). The contact detail's `data.id` is a different, global ID; don't use it for lists, deals, fields or enrichment.
- Automated Work posts go only to channel name `roi-advisor` (id `7705335b-6dba-51d8-baf9-207a0d19fe4f`). Posting in a channel with agents triggers a charged agent reply.
- Label simulated data: names start with `[sim]`, and every custom-object record carries `simulated: true/false`. The UI shows `SIM` or `REAL` on every number, following `docs/design/roi-advisor-ui.html`.
- Anything that spends credits or sends outside graph8 (pipeline runs, support messages, webhook creation, MCP registration) needs an in-page confirmation and a per-action credit cap (`ACTION_CREDIT_CAP`, default 50). Plan steps that do these things against the live org say "ask the user first". Do that.
- Copy: plain language, active voice, name things by what the user recognises. Style tokens and layout come from `docs/design/roi-advisor-ui.html`.
- `roi_fit` contact field: column ID `757`, formula name `udo_roi_fit_11e946f0`, values `high` / `medium` / `low` / `unknown`. The run-condition grammar is function-style: `NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))`.

## Review Focus

1. **Ledger and graph8 timestamps in mixed formats** (`2026-09-26 15:40:42.883351+00:00`, `2026-09-26 09:47:26.365077` with no zone, `…Z`) must all parse as UTC to the millisecond. Test: Task 5, `toMs`.
2. **Duplicate or replayed webhook deliveries** (at least once, 3 attempts) must never double-count an outcome. Test: Task 3 (signature and staleness) and Task 12 (dedupe by envelope `id` into `roi_outcome.ext_id`).
3. **A segment or list with spend but 0 meetings** must show "N credits, no meetings yet", never `Infinity`, `NaN` or a divided number. Test: Task 8.
4. **A routing rule or run condition that silently matches everyone** (an unknown operator, or a condition that doesn't filter) must be refused before saving or running. Test: Task 16, `assertConditionFilters`.
5. **Bursts of 500+ graph8 calls** (the contact index) must stay under the rate limit instead of hitting 429 storms. Test: Task 2, the `RateLimiter` test with a fake clock.

---

## File Structure

```
advisor/
  package.json, tsconfig.json, next.config.ts, vitest.config.ts, vercel.json, .env.local (gitignored)
  src/lib/g8/client.ts          SDK init, rate-limited call/callRaw, error helpers
  src/lib/g8/rate-limit.ts      RateLimiter (per-second + per-minute sliding windows)
  src/lib/g8/ops.ts             Operation ID constants (from the SDK contract)
  src/lib/domain/types.ts       Shared domain types
  src/lib/domain/time.ts        toMs / toIso
  src/lib/domain/spend.ts       isSpend, parseTokens, countHolds
  src/lib/domain/runs.ts        runFromExecution, onboardingWindow
  src/lib/domain/attribution.ts attributeCharges, coverage
  src/lib/domain/segments.ts    rootDomain, recordConsistency, segmentKey
  src/lib/domain/metrics.ts     computeStats, confidenceFor
  src/lib/domain/findings.ts    generateFindings, mergeFindings
  src/lib/domain/gate.ts        recapSelection, shouldRenotify, dismiss, dashboardBuckets, shouldWarnPreSpend
  src/lib/domain/prespend.ts    smoothedRate, classifyFit, calibrationFactor, estimateCredits, bestFitSubset
  src/lib/store/schema.ts       Custom object definitions + ensureSchema
  src/lib/store/records.ts      RecordStore (list, upsert with 409 handling)
  src/lib/store/mappers.ts      domain <-> custom-object value mappers
  src/lib/sync/ledger.ts        fetchLedgerSince
  src/lib/sync/capture.ts       fetchExecutionRun, pollPipelineRuns, fetchOnboardingAnchors, fetchUnusedDocs
  src/lib/sync/contacts.ts      loadContactIndex
  src/lib/sync/outcomes.ts      pollDealOutcomes, outcomeFromEvent
  src/lib/sync/run-sync.ts      runSync (orchestration + lock)
  src/lib/webhooks/verify.ts    verifyDelivery
  src/lib/dashboard/data.ts     loadDashboardData
  src/lib/recovery/refund.ts    buildRefundDraft
  src/lib/guardrail/guardrail.ts guardrail operations
  src/lib/recap/recap.ts        buildRecapBlocks, postRecap
  src/lib/mcp/tools.ts          MCP tool implementations
  src/lib/auth.ts               dashboard password gate
  src/app/api/webhooks/graph8/route.ts
  src/app/api/cron/poll/route.ts
  src/app/api/cron/recap/route.ts
  src/app/api/[transport]/route.ts   MCP (streamable HTTP at /api/mcp, SSE at /api/sse)
  src/app/login/page.tsx, src/app/login/actions.ts
  src/app/(dash)/layout.tsx, page.tsx, charges/page.tsx, recovery/page.tsx, prespend/page.tsx, actions.ts
  src/components/*.tsx          Tag, KpiTile, HBarChart, LineChart, CoverageBar, FindingCard, ChargesTable
  src/app/globals.css           tokens copied from docs/design/roi-advisor-ui.html
  scripts/bootstrap.ts, import-design-runs.ts, register-webhook.ts, capture-payloads.ts,
  scripts/register-mcp.ts, seed-sim.ts, sim-events.ts, cleanup-sim.ts
  tests/**                      vitest tests; tests/fixtures.ts loads ../research/fixtures
```

---

### Task 1: Scaffold the app and test harness

**Files:**
- Create: `advisor/` (via create-next-app), `advisor/vitest.config.ts`, `advisor/tests/fixtures.ts`, `advisor/tests/smoke.test.ts`, `advisor/.env.local`
- Modify: `advisor/package.json` (scripts, pinned deps), repo-root `.gitignore` (already ignores `.env*`, `node_modules/`, `.next/`, `.vercel/`)

**Interfaces:**
- Produces: `loadFixture<T>(relPath: string): T` and `FIXTURES_DIR` from `tests/fixtures.ts`; npm scripts `test`, `typecheck`, `script`.

- [ ] **Step 1: Create the Next.js app**

```bash
cd /home/opc/graph8
npx --yes create-next-app@16.3.6 advisor --typescript --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm --yes
cd advisor
npm install @graph8/sdk@0.245.0 mcp-handler@1.1.0 @modelcontextprotocol/sdk@1.26.0 zod@^3.25.76
npm install -D vitest@5.0.2 tsx @types/node
```

- [ ] **Step 2: Pin versions, make the package ESM, add scripts.** Edit `advisor/package.json`:
  - Add `"type": "module"`. Scripts use top-level `await`, which tsx only allows in ESM.
  - Make `dependencies` exact: remove `^` from `next`, `@graph8/sdk`, `mcp-handler` and `@modelcontextprotocol/sdk`.
  - Set `scripts` to:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "script": "node --env-file=.env.local --import tsx"
}
```

- [ ] **Step 3: Create `advisor/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 20000 },
});
```

- [ ] **Step 4: Create `advisor/tests/fixtures.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = path.resolve(here, "../../research/fixtures");

export function loadFixture<T>(relPath: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, relPath), "utf8")) as T;
}

export function listFixtures(relDir: string): string[] {
  return fs.readdirSync(path.join(FIXTURES_DIR, relDir)).filter((f) => f.endsWith(".json")).map((f) => path.join(relDir, f));
}
```

- [ ] **Step 5: Write the smoke test `advisor/tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadFixture } from "./fixtures";

describe("fixtures", () => {
  it("loads the real ledger with 144 rows", () => {
    const rows = loadFixture<unknown[]>("ledger/ledger-2026-09-26.json");
    expect(rows).toHaveLength(144);
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `cd /home/opc/graph8/advisor && npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Create `advisor/.env.local`** (gitignored) from the repo-root `.env`, then append the extra names:

```bash
cd /home/opc/graph8/advisor
cp ../.env .env.local
cat >> .env.local <<'EOF'
DASHBOARD_PASSWORD=change-me-local
MCP_TOKEN=local-mcp-token
CRON_SECRET=local-cron-secret
ACTION_CREDIT_CAP=50
ROI_FIT_COLUMN_ID=757
ROI_FIT_FORMULA_NAME=udo_roi_fit_11e946f0
ROI_ADVISOR_CHANNEL=roi-advisor
EOF
git -C /home/opc/graph8 check-ignore -v advisor/.env.local
```
Expected: the last command prints a `.gitignore` rule. That means the file is ignored.

- [ ] **Step 8: Typecheck and commit**

```bash
cd /home/opc/graph8/advisor && npm run typecheck
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): scaffold Next.js app with vitest and fixture loader"
```

---

### Task 2: graph8 client wrapper, rate limiter and contract test

**Files:**
- Create: `advisor/src/lib/g8/rate-limit.ts`, `advisor/src/lib/g8/client.ts`, `advisor/src/lib/g8/ops.ts`
- Test: `advisor/tests/g8/rate-limit.test.ts`, `advisor/tests/g8/contract.test.ts`, `advisor/tests/g8/client.test.ts`

**Interfaces:**
- Produces:
  - `class RateLimiter { constructor(opts: { perSecond: number; perMinute: number; now?: () => number; sleep?: (ms: number) => Promise<void> }); take(): Promise<void> }`
  - `interface CallInput { path?: Record<string, string | number>; query?: Record<string, unknown>; body?: unknown }`
  - `interface G8Caller { call<T = unknown>(op: string, input?: CallInput): Promise<T>; callRaw<T = unknown>(op: string, input?: CallInput): Promise<T> }`
  - `g8Caller: G8Caller` (live), `unwrap<T>(res: unknown): T`, `isConflict(e: unknown): boolean`, `isNotFound(e: unknown): boolean`
  - `OPS` (object of operation ID constants)

- [ ] **Step 1: Write the failing rate-limiter test `advisor/tests/g8/rate-limit.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/lib/g8/rate-limit";

describe("RateLimiter", () => {
  it("never lets more than perSecond calls through in any 1s window", async () => {
    let clock = 0;
    const starts: number[] = [];
    const rl = new RateLimiter({ perSecond: 40, perMinute: 900, now: () => clock, sleep: async (ms) => { clock += ms; } });
    for (let i = 0; i < 500; i++) { await rl.take(); starts.push(clock); }
    for (let i = 40; i < starts.length; i++) expect(starts[i] - starts[i - 40]).toBeGreaterThanOrEqual(1000);
  });

  it("respects the per-minute budget", async () => {
    let clock = 0;
    const rl = new RateLimiter({ perSecond: 1000, perMinute: 900, now: () => clock, sleep: async (ms) => { clock += ms; } });
    for (let i = 0; i < 901; i++) await rl.take();
    expect(clock).toBeGreaterThanOrEqual(60000);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/g8/rate-limit.test.ts`
Expected: FAIL (`Cannot find module '@/lib/g8/rate-limit'`).

- [ ] **Step 3: Implement `advisor/src/lib/g8/rate-limit.ts`**

```ts
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class RateLimiter {
  private sec: number[] = [];
  private min: number[] = [];
  constructor(private opts: { perSecond: number; perMinute: number; now?: () => number; sleep?: (ms: number) => Promise<void> }) {}

  async take(): Promise<void> {
    const now = this.opts.now ?? Date.now;
    const sleep = this.opts.sleep ?? defaultSleep;
    for (;;) {
      const t = now();
      this.sec = this.sec.filter((x) => t - x < 1000);
      this.min = this.min.filter((x) => t - x < 60000);
      if (this.sec.length < this.opts.perSecond && this.min.length < this.opts.perMinute) {
        this.sec.push(t);
        this.min.push(t);
        return;
      }
      const waitSec = this.sec.length >= this.opts.perSecond ? 1000 - (t - this.sec[0]) : 0;
      const waitMin = this.min.length >= this.opts.perMinute ? 60000 - (t - this.min[0]) : 0;
      await sleep(Math.max(waitSec, waitMin, 1));
    }
  }
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npm test -- tests/g8/rate-limit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `advisor/src/lib/g8/ops.ts`.** Every ID below was checked against the SDK contract (`research/reference/sdk-operations.json`).

```ts
export const OPS = {
  listUsageTransactions: "list_usage_transactions_usage_transactions_get",
  getUsage: "get_usage_usage_get",
  getExecution: "get_execution_workflows_executions__execution_id__get",
  listWorkflowExecutions: "list_workflow_executions_workflows_executions_get",
  listListPipelines: "list_list_pipelines_enrichment_lists__list_id__pipelines_get",
  getPipelineRun: "get_pipeline_run_enrichment_lists_pipeline_runs__run_id__get",
  updateListPipeline: "update_list_pipeline_enrichment_lists__list_id__pipelines__pipeline_id__put",
  runListPipeline: "run_list_pipeline_enrichment_lists__list_id__pipelines__pipeline_id__runs_post",
  createPipelineFromTemplate: "create_list_pipeline_from_template_enrichment_lists__list_id__pipelines_from_template_post",
  getAiJobStatus: "get_ai_batch_job_status_enrichment_ai_batch_jobs__job_id__status_get",
  validateFormula: "validate_formula_enrichment_ai_formula_validate_post",
  previewRoutingRule: "preview_routing_rule_enrichment_list_routing_rules_preview_post",
  listProviders: "list_enrichment_providers_enrichment_providers_get",
  documentsAnalytics: "get_documents_analytics_global_context_documents_analytics_get",
  listResearchReports: "list_research_reports_research_reports_get",
  listLandingPages: "list_landing_pages_landing_pages_get",
  listDeals: "list_deals_deals_get",
  getDeal: "get_deal_deals__deal_id__get",
  listDealHistory: "list_deal_history_deals__deal_id__history_get",
  createDeal: "create_deal_deals_post",
  updateDeal: "update_deal_deals__deal_id__patch",
  deleteDeal: "delete_deal_deals__deal_id__delete",
  listDealPipelines: "list_pipelines_deals_pipelines_get",
  listContacts: "list_contacts_contacts_get",
  getContact: "get_contact_contacts__contact_id__get",
  getContactLists: "get_contact_lists_contacts__contact_id__lists_get",
  getContactSequences: "get_contact_sequences_contacts__contact_id__sequences_get",
  getContactEngagement: "get_contact_engagement_summary_contacts__contact_id__engagement_summary_get",
  listLists: "list_lists_lists_get",
  getListContacts: "get_list_contacts_lists__list_id__contacts_get",
  createObject: "create_object_objects_post",
  listObjects: "list_objects_objects_get",
  archiveObject: "archive_object_objects__object_slug__delete",
  createAttribute: "create_attribute_objects__object_slug__attributes_post",
  listAttributes: "list_object_attributes_objects__object_slug__attributes_get",
  createRecord: "create_object_record_objects__object_slug__records_post",
  listRecords: "list_object_records_objects__object_slug__records_get",
  updateRecord: "update_object_record_objects__object_slug__records__record_id__patch",
  createField: "create_field_fields_post",
  listFields: "list_contact_fields_fields_get",
  setFieldValue: "set_field_value_fields__column_id__values_patch",
  saveContactSearch: "save_contact_search_search_contacts_save_post",
  createWorkMessage: "create_work_message_work_messages_post",
  contactSupport: "contact_support_support_contact_post",
  listWebhooks: "list_webhooks_webhooks_get",
  createWebhook: "create_webhook_webhooks_post",
  updateWebhook: "update_webhook_webhooks__webhook_id__patch",
  listWebhookDeliveries: "list_webhook_deliveries_webhooks__webhook_id__deliveries_get",
  createMcpServer: "create_mcp_server_voice_mcp_servers_post",
  listMcpServers: "list_mcp_servers_workflows_mcp_servers_get",
  createWorkflow: "create_workflow_workflows_post",
  executeWorkflow: "execute_workflow_workflows__action_id__execute_post",
  validateWorkflow: "validate_workflow_workflows_validate_post",
  archiveRecord: "archive_object_record_objects__object_slug__records__record_id__delete",
  createList: "create_list_lists_post",
  addContactsToList: "add_contacts_to_list_lists__list_id__contacts_post",
  estimateListPipeline: "estimate_list_pipeline_enrichment_lists__list_id__pipelines__pipeline_id__estimate_post",
} as const;
export type OpId = (typeof OPS)[keyof typeof OPS];
```

- [ ] **Step 6: Write the contract test `advisor/tests/g8/contract.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { API_OPERATION_IDS } from "@graph8/sdk";
import { OPS } from "@/lib/g8/ops";

describe("SDK contract", () => {
  it("contains every operation the app calls", () => {
    const known = new Set<string>(API_OPERATION_IDS as readonly string[]);
    const missing = Object.values(OPS).filter((id) => !known.has(id));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 7: Write the failing client test `advisor/tests/g8/client.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { G8Error } from "@graph8/sdk";
import { unwrap, isConflict, isNotFound } from "@/lib/g8/client";

describe("client helpers", () => {
  it("unwraps the {data, pagination} envelope and passes raw objects through", () => {
    expect(unwrap({ data: [1, 2], pagination: null })).toEqual([1, 2]);
    expect(unwrap({ executions: [] })).toEqual({ executions: [] });
  });
  it("recognises 409 and 404 errors", () => {
    const e409 = new G8Error({ message: "dup", status: 409, type: "conflict", code: "duplicate_active_value" });
    const e404 = new G8Error({ message: "nf", status: 404, type: "not_found", code: "404" });
    expect(isConflict(e409)).toBe(true);
    expect(isNotFound(e404)).toBe(true);
    expect(isConflict(new Error("x"))).toBe(false);
  });
});
```

- [ ] **Step 8: Run it and confirm it fails.** Run `npm test -- tests/g8`. Expected: FAIL (the client module doesn't exist yet).

- [ ] **Step 9: Implement `advisor/src/lib/g8/client.ts`**

```ts
import { g8, G8Error } from "@graph8/sdk";
import { RateLimiter } from "./rate-limit";

export interface CallInput { path?: Record<string, string | number>; query?: Record<string, unknown>; body?: unknown }
export interface G8Caller {
  call<T = unknown>(op: string, input?: CallInput): Promise<T>;
  callRaw<T = unknown>(op: string, input?: CallInput): Promise<T>;
}

const limiter = new RateLimiter({ perSecond: 40, perMinute: 900 });
let initialised = false;

function init(): void {
  if (initialised) return;
  const apiKey = process.env.G8_API_KEY;
  if (!apiKey) throw new Error("G8_API_KEY is not set. Add it to advisor/.env.local or the Vercel project settings.");
  g8.init({ apiKey });
  initialised = true;
}

export function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in (res as Record<string, unknown>)) return (res as { data: T }).data;
  return res as T;
}

export const g8Caller: G8Caller = {
  async callRaw<T>(op: string, input: CallInput = {}): Promise<T> {
    init();
    await limiter.take();
    // g8.api.call is typed against the generated ApiOperationId union; OPS values are checked by tests/g8/contract.test.ts.
    return (await (g8.api.call as (id: string, i: CallInput) => Promise<unknown>)(op, input)) as T;
  },
  async call<T>(op: string, input: CallInput = {}): Promise<T> {
    return unwrap<T>(await this.callRaw(op, input));
  },
};

export function isConflict(e: unknown): boolean { return e instanceof G8Error && e.status === 409; }
export function isNotFound(e: unknown): boolean { return e instanceof G8Error && e.status === 404; }
```

- [ ] **Step 10: Run all g8 tests.** Run `npm test -- tests/g8`. Expected: PASS (5 tests).

- [ ] **Step 11: Live smoke check** (read-only, free). Create `advisor/scripts/g8-smoke.ts`:

```ts
import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
const u = await g8Caller.call<{ available_credits: number }>(OPS.getUsage);
console.log("available credits:", u.available_credits);
```
Run: `cd /home/opc/graph8/advisor && npm run script -- scripts/g8-smoke.ts`
Expected: prints a number around 8,740.

- [ ] **Step 12: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): rate-limited graph8 client, op constants, contract test"
```

---

### Task 3: Webhook receiver, first deploy, capture real payloads (RISK)

**Files:**
- Create: `advisor/src/lib/webhooks/verify.ts`, `advisor/src/app/api/webhooks/graph8/route.ts`, `advisor/scripts/register-webhook.ts`, `advisor/scripts/capture-payloads.ts`, `research/fixtures/webhooks/` (captured payloads)
- Test: `advisor/tests/webhooks/verify.test.ts`

**Interfaces:**
- Produces:
  - `verifyDelivery(rawBody: string, headers: Headers, secret: string, nowSec?: number): { ok: true; event: WebhookEnvelope } | { ok: false; reason: string }`
  - `interface WebhookEnvelope { id?: string; event: string; timestamp: string; org_id: string; data: Record<string, unknown> }`
- The route calls `handleEvent(event)` from Task 12. Until Task 12 exists, the route stores payloads only (Step 7).

- [ ] **Step 1: Write the failing test `advisor/tests/webhooks/verify.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyDelivery } from "@/lib/webhooks/verify";

const secret = "test-secret";
const body = JSON.stringify({ id: "evt_1", event: "deal.created", timestamp: "2026-09-26T15:05:47Z", org_id: "org_x", data: { deal_id: "d1" } });
function headersFor(ts: number, b = body, s = secret) {
  const sig = "sha256=" + createHmac("sha256", s).update(`${ts}.${b}`).digest("hex");
  return new Headers({ "x-studio-signature": sig, "x-studio-timestamp": String(ts) });
}

describe("verifyDelivery", () => {
  const now = 1790437000;
  it("accepts a valid signature", () => {
    const r = verifyDelivery(body, headersFor(now), secret, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.event.event).toBe("deal.created");
  });
  it("rejects a tampered body", () => {
    const r = verifyDelivery(body.replace("d1", "d2"), headersFor(now), secret, now);
    expect(r.ok).toBe(false);
  });
  it("rejects a delivery older than 300 seconds", () => {
    expect(verifyDelivery(body, headersFor(now - 900), secret, now).ok).toBe(false);
  });
  it("rejects a wrong secret and missing headers", () => {
    expect(verifyDelivery(body, headersFor(now, body, "other"), secret, now).ok).toBe(false);
    expect(verifyDelivery(body, new Headers(), secret, now).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npm test -- tests/webhooks`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `advisor/src/lib/webhooks/verify.ts`.** This mirrors the SDK's `constructEvent` (HMAC-SHA256 of `"{ts}.{rawBody}"`) with an injectable clock so the staleness check can be tested.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookEnvelope { id?: string; event: string; timestamp: string; org_id: string; data: Record<string, unknown> }

export function verifyDelivery(rawBody: string, headers: Headers, secret: string, nowSec = Math.floor(Date.now() / 1000)):
  { ok: true; event: WebhookEnvelope } | { ok: false; reason: string } {
  const sigHeader = headers.get("x-studio-signature");
  const tsHeader = headers.get("x-studio-timestamp");
  if (!sigHeader || !tsHeader) return { ok: false, reason: "missing signature headers" };
  const ts = Number.parseInt(tsHeader, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };
  if (Math.abs(nowSec - ts) > 300) return { ok: false, reason: "stale delivery" };
  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const provided = sigHeader.startsWith("sha256=") ? sigHeader.slice(7) : sigHeader;
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(provided, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };
  try { return { ok: true, event: JSON.parse(rawBody) as WebhookEnvelope }; }
  catch { return { ok: false, reason: "invalid JSON" }; }
}
```

- [ ] **Step 4: Run the tests.** Run `npm test -- tests/webhooks`. Expected: PASS (4 tests).

- [ ] **Step 5: Create the route `advisor/src/app/api/webhooks/graph8/route.ts`.** For now it logs the verified envelope; Task 12 replaces the body of the `after()` callback with `handleEvent`.

```ts
import { after } from "next/server";
import { verifyDelivery } from "@/lib/webhooks/verify";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.G8_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook secret not configured", { status: 500 });
  const raw = await req.text();
  const v = verifyDelivery(raw, req.headers, secret);
  if (!v.ok) return new Response(v.reason, { status: 401 });
  after(async () => {
    console.log("graph8 webhook", JSON.stringify({ id: v.event.id, event: v.event.event, data: v.event.data }));
  });
  return new Response("ok");
}
```

- [ ] **Step 6: Ask the user before deploying.** The user confirmed `axcel342` is their account. Still ask: "May I create the Vercel project `graph8-roi-advisor` under axcel342 and deploy it?" Continue only after they say yes.

- [ ] **Step 7: Deploy a preview and set env vars**

```bash
cd /home/opc/graph8/advisor
npx vercel link --yes --project graph8-roi-advisor
for k in G8_API_KEY G8_ORG_ID DASHBOARD_PASSWORD MCP_TOKEN CRON_SECRET ACTION_CREDIT_CAP ROI_FIT_COLUMN_ID ROI_FIT_FORMULA_NAME ROI_ADVISOR_CHANNEL; do
  grep "^$k=" .env.local | cut -d= -f2- | npx vercel env add "$k" production --force >/dev/null
  grep "^$k=" .env.local | cut -d= -f2- | npx vercel env add "$k" preview --force >/dev/null
done
npx vercel deploy --prod
```
Expected: a production URL like `https://graph8-roi-advisor.vercel.app`. Record it as `ADVISOR_URL` in `.env.local`. Use a production deployment, because preview deployments sit behind Vercel Authentication and graph8's webhook calls would get 401.

- [ ] **Step 8: Create `advisor/scripts/register-webhook.ts`.** It creates the graph8 webhook pointing at our receiver, prints the new secret once, and never logs it anywhere else.

```ts
import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";

const url = `${process.env.ADVISOR_URL}/api/webhooks/graph8`;
if (!process.env.ADVISOR_URL) throw new Error("Set ADVISOR_URL in .env.local");
const events = [
  "deal.created", "deal.updated", "deal.stage_changed", "deal.won", "deal.deleted",
  "workflow.execution_completed", "workflow.execution_failed",
  "enrichment.job_completed", "enrichment.job_failed",
  "engagement.email_sent", "engagement.email_replied", "engagement.email_bounced",
  "meeting.booked", "meeting.cancelled", "meeting.no_show",
];
const res = await g8Caller.call<{ id: string; secret: string }>(OPS.createWebhook, { body: { name: "ROI Advisor receiver", url, events } });
console.log(`webhook id: ${res.id}`);
console.log(`Add this line to advisor/.env.local and to Vercel (production): G8_WEBHOOK_SECRET=${res.secret}`);
```

- [ ] **Step 9: Ask the user**, then register the webhook and set the secret. Ask: "May I create a graph8 webhook that sends deal, workflow, enrichment, email and meeting events to the Advisor's URL?" After yes:

```bash
cd /home/opc/graph8/advisor && npm run script -- scripts/register-webhook.ts
# copy the printed secret line into .env.local, then:
grep '^G8_WEBHOOK_SECRET=' .env.local | cut -d= -f2- | npx vercel env add G8_WEBHOOK_SECRET production --force
npx vercel deploy --prod
```

- [ ] **Step 10: Create `advisor/scripts/capture-payloads.ts`.** It triggers one `[sim]` deal (created, then moved to Discovery Held) and one run of the free web-search workflow `712e4f5b-faee-45fd-9150-ea5853cc08dd`.

```ts
import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";

const deal = await g8Caller.call<{ id: string }>(OPS.createDeal, { body: {
  name: "[sim] payload capture", contact_ids: [81], owner_id: "mominimran000@gmail.com", amount: 1000,
  stage_id: "2df1e28d-344c-4940-8bc2-e456bfd874a8", description: "[sim] created to capture webhook payload shapes" } });
await g8Caller.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: "2e65b28e-5fc4-49f5-966e-5e8081a921c2" } });
const run = await g8Caller.callRaw<{ execution_id: string }>(OPS.executeWorkflow, { path: { action_id: "712e4f5b-faee-45fd-9150-ea5853cc08dd" }, body: { input_data: { q: "payload capture" } } });
console.log(JSON.stringify({ dealId: deal.id, executionId: run.execution_id }));
```

- [ ] **Step 11: Run it and capture the payloads from the Vercel logs**

```bash
cd /home/opc/graph8/advisor && npm run script -- scripts/capture-payloads.ts
npx vercel logs "$(grep '^ADVISOR_URL=' .env.local | cut -d= -f2-)" --since 10m | grep 'graph8 webhook' > /tmp/payloads.txt
mkdir -p ../research/fixtures/webhooks && cp /tmp/payloads.txt ../research/fixtures/webhooks/captured-$(date -u +%Y%m%dT%H%M).txt
```
Expected: lines for `deal.created`, `deal.updated`, `deal.stage_changed` and `workflow.execution_completed`, each with its `data` fields. If nothing arrives within 2 minutes, run `GET /webhooks/{id}/deliveries` via `g8Caller` and check `response_code` (401 means the secret is wrong; 404 means the URL is wrong).

- [ ] **Step 12: Record the payload shapes.** Add a section "Captured webhook payloads" to `docs/HANDOFF.md`, listing each event's `data` keys verbatim from the log. Task 12's `outcomeFromEvent` must read exactly these keys.

- [ ] **Step 13: Commit**

```bash
cd /home/opc/graph8 && git add advisor research/fixtures/webhooks docs/HANDOFF.md && git commit -m "feat(advisor): signed webhook receiver, first deploy, captured payload shapes"
```

---

### Task 4: MCP server with SSE and streamable HTTP, registered in graph8 (RISK)

**Files:**
- Create: `advisor/src/app/api/[transport]/route.ts`, `advisor/src/lib/mcp/auth.ts`, `advisor/scripts/register-mcp.ts`
- Test: `advisor/tests/mcp/auth.test.ts`

**Interfaces:**
- Produces:
  - `authorizeMcp(req: Request, token: string): boolean`: true when `Authorization: Bearer <token>` matches, or `?key=<token>` matches (graph8 can't send headers), or the path ends with `/message` (the SSE message leg is bound to an unguessable session ID).
  - The route mounts the tools registered by `registerTools(server)` from Task 18. Until then it registers one `ping` tool.

- [ ] **Step 1: Write the failing test `advisor/tests/mcp/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { authorizeMcp } from "@/lib/mcp/auth";

describe("authorizeMcp", () => {
  const t = "tok";
  it("accepts a bearer token", () => expect(authorizeMcp(new Request("https://x/api/mcp", { headers: { authorization: "Bearer tok" } }), t)).toBe(true));
  it("accepts ?key= for graph8's SSE connection", () => expect(authorizeMcp(new Request("https://x/api/sse?key=tok"), t)).toBe(true));
  it("lets the SSE message leg through", () => expect(authorizeMcp(new Request("https://x/api/message?sessionId=abc", { method: "POST" }), t)).toBe(true));
  it("rejects missing or wrong tokens", () => {
    expect(authorizeMcp(new Request("https://x/api/mcp"), t)).toBe(false);
    expect(authorizeMcp(new Request("https://x/api/sse?key=nope"), t)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npm test -- tests/mcp`. Expected: FAIL.

- [ ] **Step 3: Implement `advisor/src/lib/mcp/auth.ts`**

```ts
import { timingSafeEqual } from "node:crypto";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function authorizeMcp(req: Request, token: string): boolean {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/message")) return true;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && same(auth.slice(7), token)) return true;
  const key = url.searchParams.get("key");
  return !!key && same(key, token);
}
```

- [ ] **Step 4: Run the tests.** Run `npm test -- tests/mcp`. Expected: PASS (4 tests).

- [ ] **Step 5: Create the route `advisor/src/app/api/[transport]/route.ts`.** `mcp-handler` 1.1.0 reads `REDIS_URL` (or `KV_URL`) from the environment for SSE.

```ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { authorizeMcp } from "@/lib/mcp/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    server.registerTool("ping", { title: "Ping", description: "Check the ROI Advisor MCP server is reachable.", inputSchema: { note: z.string().optional() } },
      async ({ note }) => ({ content: [{ type: "text", text: `ROI Advisor is up${note ? `: ${note}` : ""}` }] }));
  },
  { serverInfo: { name: "graph8-roi-advisor", version: "0.1.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: false },
);

async function guarded(req: Request): Promise<Response> {
  const token = process.env.MCP_TOKEN;
  if (!token || !authorizeMcp(req, token)) return new Response("unauthorized", { status: 401 });
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
```

- [ ] **Step 6: Local check of streamable HTTP**

```bash
cd /home/opc/graph8/advisor && npm run dev &
sleep 8
curl -s -X POST http://localhost:3000/api/mcp -H 'Authorization: Bearer local-mcp-token' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 400; echo
kill %1
```
Expected: the response lists the `ping` tool. Without the header: 401.

- [ ] **Step 7: Ask the user about Redis.** Ask: "graph8 only accepts SSE MCP servers. On Vercel, SSE needs a small Redis. May I add Upstash Redis (free tier) through the Vercel Marketplace?"
  - **If yes:** run `npx vercel integration add upstash` (follow the prompts to create a Redis database linked to this project), check that `REDIS_URL` or `KV_URL` now appears under `npx vercel env ls`, then run `npx vercel deploy --prod`.
  - **If no:** skip Steps 8–10, and note in `docs/HANDOFF.md` under "Pending decisions" that graph8 can't call the MCP server; outside agents still can over streamable HTTP.

- [ ] **Step 8: Create `advisor/scripts/register-mcp.ts`**

```ts
import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";

const base = process.env.ADVISOR_URL, token = process.env.MCP_TOKEN;
if (!base || !token) throw new Error("Set ADVISOR_URL and MCP_TOKEN in .env.local");
const res = await g8Caller.call<{ id: number; mcp_server_id: string }>(OPS.createMcpServer, { body: {
  name: "ROI Advisor", description: "Credit ROI answers: cost per outcome, findings, pre-spend estimates",
  transport_type: "sse", connection_url: `${base}/api/sse?key=${encodeURIComponent(token)}`, enabled: true } });
console.log(JSON.stringify(res));
const list = await g8Caller.callRaw<{ servers: { mcp_server_id: string; name: string }[] }>(OPS.listMcpServers);
console.log("visible to workflows:", list.servers.some((s) => s.mcp_server_id === res.mcp_server_id));
```

- [ ] **Step 9: Ask the user, then register the server and test a tool call from a graph8 workflow.** Ask: "May I register the ROI Advisor as an MCP server in graph8 and run one free test workflow that calls its `ping` tool?" After yes, run `npm run script -- scripts/register-mcp.ts`. Then create, validate and execute a workflow with a `tool_call` trigger and one `tool` node:

```ts
// advisor/scripts/test-mcp-from-graph8.ts
import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
const serverId = process.argv[2]; // mcp_server_id printed by register-mcp.ts
const t = "trigger-roi00001", n = "tool-roi00001";
const config = { metadata: {}, settings: {}, start_node_id: t, nodes: [
  { node_id: t, node_type: "trigger", name: "Test", position: { x: 0, y: 0 }, connections: [n], config: { trigger_type: "tool_call", input_schema: { fields: [] } } },
  { node_id: n, node_type: "tool", name: "Ping ROI Advisor", position: { x: 0, y: 150 }, connections: [],
    config: { tool: "mcp", mcp_server_id: serverId, mcp_tool_name: "ping", tool_config: { arguments: { note: "from graph8" } } } } ],
  edges: [{ id: `edge-${t}-${n}`, source: t, target: n }] };
console.log("validate:", JSON.stringify(await g8Caller.callRaw(OPS.validateWorkflow, { body: { config } })));
const wf = await g8Caller.callRaw<{ action_id: string }>(OPS.createWorkflow, { body: { name: "[sim] ROI Advisor MCP test", config, enabled: true } });
const ex = await g8Caller.callRaw<{ execution_id: string }>(OPS.executeWorkflow, { path: { action_id: wf.action_id }, body: { input_data: {} } });
await new Promise((r) => setTimeout(r, 15000));
console.log(JSON.stringify(await g8Caller.callRaw(OPS.getExecution, { path: { execution_id: ex.execution_id } })).slice(0, 1500));
```
Run: `npm run script -- scripts/test-mcp-from-graph8.ts <mcp_server_id>`
Expected on success: the execution's `output_data.node_results` shows the tool output "ROI Advisor is up: from graph8". The field names for the tool node config come from `research/reference/workflow-node-types.json` (node type `tool`); if validation reports a config error, read that schema and adjust.

- [ ] **Step 10: Record the result** in `docs/HANDOFF.md` under a new heading "MCP from graph8: result":
  - **Pass:** keep the design as is.
  - **Fail:** paste the error. The fallback (spec §6.4) is that the MCP server serves outside agents only, and inside graph8 answers live in the Work channel and the custom objects.

- [ ] **Step 11: Commit**

```bash
cd /home/opc/graph8 && git add advisor docs/HANDOFF.md && git commit -m "feat(advisor): MCP server (SSE + HTTP) with token auth; graph8 registration test"
```

---

### Task 5: Domain types, time parsing and spend rules

**Files:**
- Create: `advisor/src/lib/domain/types.ts`, `advisor/src/lib/domain/time.ts`, `advisor/src/lib/domain/spend.ts`
- Test: `advisor/tests/domain/time.test.ts`, `advisor/tests/domain/spend.test.ts`

**Interfaces:**
- Produces: all types below, plus:
  - `toMs(ts: string): number`
  - `toIso(ms: number): string`
  - `isSpend(r: LedgerRow): boolean`
  - `credits(r: LedgerRow): number`
  - `parseTokens(desc: string | null): { tokensIn: number; tokensOut: number } | null`
  - `countHolds(rows: LedgerRow[]): { holds: number; followedByCharge: number; freeFailedAttempts: number }`

- [ ] **Step 1: Create `advisor/src/lib/domain/types.ts`**

```ts
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

export type FindingKind = "scale" | "cut" | "waste" | "fix" | "unused" | "data_risk" | "what_worked" | "traceability" | "side_effect";
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
```

- [ ] **Step 2: Write the failing test `advisor/tests/domain/time.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { toMs, toIso } from "@/lib/domain/time";

describe("toMs", () => {
  it("parses ledger timestamps with a space and 6-digit fractions", () =>
    expect(toMs("2026-09-26 15:40:42.883351+00:00")).toBe(Date.UTC(2026, 8, 26, 15, 40, 42, 883)));
  it("treats a missing zone as UTC", () =>
    expect(toMs("2026-09-26 09:47:26.365077")).toBe(Date.UTC(2026, 8, 26, 9, 47, 26, 365)));
  it("parses Z and offset forms", () => {
    expect(toMs("2026-09-26T13:38:00Z")).toBe(Date.UTC(2026, 8, 26, 13, 38, 0));
    expect(toMs("2026-09-26T15:40:38+0200")).toBe(Date.UTC(2026, 8, 26, 13, 40, 38));
  });
  it("throws on garbage", () => expect(() => toMs("yesterday")).toThrow(/Unparseable/));
  it("round-trips through toIso", () => expect(toIso(toMs("2026-09-26T13:38:00Z"))).toBe("2026-09-26T13:38:00.000Z"));
});
```

- [ ] **Step 3: Run it and confirm it fails.** Run `npm test -- tests/domain/time.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement `advisor/src/lib/domain/time.ts`**

```ts
const RE = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(\.\d+)?(Z|[+-]\d\d:?\d\d)?$/;

export function toMs(ts: string): number {
  const m = RE.exec(ts.trim());
  if (!m) throw new Error(`Unparseable timestamp: ${ts}`);
  const frac = m[3] ? m[3].slice(0, 4) : "";
  let tz = m[4] ?? "Z";
  if (tz !== "Z" && !tz.includes(":")) tz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  const v = Date.parse(`${m[1]}T${m[2]}${frac}${tz}`);
  if (Number.isNaN(v)) throw new Error(`Unparseable timestamp: ${ts}`);
  return v;
}

export function toIso(ms: number): string { return new Date(ms).toISOString(); }
```

- [ ] **Step 5: Run the test.** Run `npm test -- tests/domain/time.test.ts`. Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing test `advisor/tests/domain/spend.test.ts`** (expected values come from the real ledger)

```ts
import { describe, it, expect } from "vitest";
import { loadFixture } from "../fixtures";
import type { LedgerRow } from "@/lib/domain/types";
import { isSpend, credits, parseTokens, countHolds } from "@/lib/domain/spend";

const ledger = loadFixture<LedgerRow[]>("ledger/ledger-2026-09-26.json");

describe("spend rules on the real ledger", () => {
  it("counts only usage rows as spend: 126 rows, 1,260 credits, 9 services", () => {
    const spend = ledger.filter(isSpend);
    expect(spend).toHaveLength(126);
    expect(spend.reduce((s, r) => s + credits(r), 0)).toBe(1260);
    expect(new Set(spend.map((r) => r.service)).size).toBe(9);
  });
  it("parses LLM token counts", () => {
    expect(parseTokens("LLM charge: g8_t1 (in:214, out:594)")).toEqual({ tokensIn: 214, tokensOut: 594 });
    expect(parseTokens("Credit charge: ai_enrichment")).toBeNull();
    expect(parseTokens(null)).toBeNull();
  });
  it("finds 8 holds, 3 followed by a charge, so 5 free failed attempts", () => {
    expect(countHolds(ledger)).toEqual({ holds: 8, followedByCharge: 3, freeFailedAttempts: 5 });
  });
});
```

- [ ] **Step 7: Run it and confirm it fails.** Run `npm test -- tests/domain/spend.test.ts`. Expected: FAIL.

- [ ] **Step 8: Implement `advisor/src/lib/domain/spend.ts`.** Holds were observed only in front of provider-step charges (`waterfall_enrichment`), so only those can "consume" a hold.

```ts
import type { LedgerRow } from "./types";
import { toMs } from "./time";

const HOLD_CONSUMERS = new Set(["waterfall_enrichment"]);
const HOLD_MATCH_MS = 90_000;

export function isSpend(r: LedgerRow): boolean { return r.type === "usage" && r.amount < 0; }
export function credits(r: LedgerRow): number { return Math.abs(r.amount); }

export function parseTokens(desc: string | null): { tokensIn: number; tokensOut: number } | null {
  const m = desc ? /in:(\d+), out:(\d+)/.exec(desc) : null;
  return m ? { tokensIn: Number(m[1]), tokensOut: Number(m[2]) } : null;
}

export function countHolds(rows: LedgerRow[]): { holds: number; followedByCharge: number; freeFailedAttempts: number } {
  const sorted = [...rows].sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
  const charges = sorted.filter((r) => isSpend(r) && r.service !== null && HOLD_CONSUMERS.has(r.service));
  const used = new Set<string>();
  let followed = 0;
  const holds = sorted.filter((r) => r.type === "hold");
  for (const h of holds) {
    const t = toMs(h.created_at);
    const c = charges.find((x) => !used.has(x.id) && toMs(x.created_at) - t >= 0 && toMs(x.created_at) - t <= HOLD_MATCH_MS);
    if (c) { used.add(c.id); followed++; }
  }
  return { holds: holds.length, followedByCharge: followed, freeFailedAttempts: holds.length - followed };
}
```

- [ ] **Step 9: Run the domain tests.** Run `npm test -- tests/domain`. Expected: PASS (8 tests).

- [ ] **Step 10: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): domain types, timestamp parsing, spend and hold rules"
```

---

### Task 6: Attribution engine

**Files:**
- Create: `advisor/src/lib/domain/runs.ts`, `advisor/src/lib/domain/attribution.ts`
- Test: `advisor/tests/domain/attribution.test.ts`, `advisor/tests/helpers/design-fixture.ts`

**Interfaces:**
- Consumes: types and helpers from Task 5.
- Produces:
  - `runFromExecution(exec: ExecutionRecord, actionNames: Record<string, string>): Run | null`
  - `onboardingWindow(a: { firstStudioDocCreatedAt: string; lastResearchReportUpdatedAt: string; landingPageCreatedAt: string | null }): TimeWindow`
  - `attributeCharges(input: { ledger: LedgerRow[]; runs: Run[]; windows: TimeWindow[]; advisorPosts: string[] }): AttributedCharge[]`
  - `coverage(charges: AttributedCharge[]): { exact: number; window: number; none: number; total: number }`
  - `EXACT_METHODS: Set<Method>`
  - Test helper `loadDesignInput(): { ledger; runs; windows; advisorPosts }`
  - `interface ExecutionRecord { execution_id: string; action_id: string; status: string; input_data?: Record<string, unknown>; output_data?: { node_results?: Record<string, { output?: { tokens_input?: number; tokens_output?: number } }> } | null; tokens_input?: number | null; tokens_output?: number | null; started_at?: string | null; completed_at?: string | null }`

- [ ] **Step 1: Create the test helper `advisor/tests/helpers/design-fixture.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `advisor/tests/domain/attribution.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { attributeCharges, coverage } from "@/lib/domain/attribution";
import { loadDesignInput } from "../helpers/design-fixture";

const charges = attributeCharges(loadDesignInput());

describe("attribution on the real design-day data", () => {
  it("attributes every usage row (126 charges, 1,260 credits)", () => {
    expect(charges).toHaveLength(126);
    expect(coverage(charges)).toEqual({ exact: 216, window: 1033, none: 11, total: 1260 });
  });
  it("matches 13 of 15 skill-run charges exactly by token count", () => {
    const vl = charges.filter((c) => c.service === "voice_llm");
    expect(vl).toHaveLength(15);
    expect(vl.filter((c) => c.method === "exact_tokens")).toHaveLength(13);
  });
  it("flags 115 credits of waste: 77 failed AI jobs, 14 unreadable, 24 agent side effect", () => {
    const sum = (r: string) => charges.filter((c) => c.wasteReason === r).reduce((s, c) => s + c.credits, 0);
    expect(sum("failed_job")).toBe(77);
    expect(sum("no_change")).toBe(14);
    expect(sum("agent_side_effect")).toBe(24);
  });
  it("explains a skill charge in plain words", () => {
    const c = charges.find((x) => x.tokensIn === 214 && x.tokensOut === 594);
    expect(c?.explanation).toBe("Meeting Prep Brief · Jamie Elden, Listrak");
    expect(c?.method).toBe("exact_tokens");
  });
  it("credits the guardrail pipeline run to list 13", () => {
    const c = charges.find((x) => x.method === "pipeline_run");
    expect(c).toMatchObject({ credits: 3, listId: 13, isWaste: false, result: "success" });
  });
  it("puts onboarding research in the time-window bucket", () => {
    const s = charges.filter((c) => c.service === "studio_global");
    expect(s.every((c) => c.method === "time_window")).toBe(true);
    expect(s.reduce((a, c) => a + c.credits, 0)).toBe(860);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails.** Run `npm test -- tests/domain/attribution.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement `advisor/src/lib/domain/runs.ts`**

```ts
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
```

- [ ] **Step 5: Implement `advisor/src/lib/domain/attribution.ts`**

```ts
import type { AttributedCharge, ChargeResult, LedgerRow, Method, Run, TimeWindow, WasteReason } from "./types";
import { credits, isSpend, parseTokens } from "./spend";
import { toMs } from "./time";

export const EXACT_METHODS = new Set<Method>(["exact_tokens", "job_window", "pipeline_run", "advisor"]);
const TOKEN_MATCH_MS = 10_000, WINDOW_TAIL_MS = 60_000, OPEN_RUN_MS = 180_000, SIDE_EFFECT_MS = 60_000;
const WINDOW_KINDS = new Set(["ai_enrichment_job", "waterfall_job", "pipeline_run", "verification"]);

function label(r: Run): string {
  const who = [r.contactLabel, r.companyName].filter(Boolean).join(", ");
  return who ? `${r.actionName} · ${who}` : r.actionName;
}

function outcomeOf(r: Run): { result: ChargeResult; waste: WasteReason | null } {
  if (r.resultHint === "unreadable") return { result: "unreadable", waste: "no_change" };
  if (r.status === "failed" || (r.recordsOk === 0 && (r.recordsFailed ?? 0) > 0)) return { result: "failed", waste: "failed_job" };
  return { result: "success", waste: null };
}

function methodFor(r: Run): Method {
  if (r.source === "advisor") return "advisor";
  if (r.kind === "pipeline_run") return "pipeline_run";
  return "job_window";
}

export function attributeCharges(input: { ledger: LedgerRow[]; runs: Run[]; windows: TimeWindow[]; advisorPosts: string[] }): AttributedCharge[] {
  const posts = input.advisorPosts.map(toMs);
  const tokenRuns = input.runs.filter((r) => r.tokensIn && r.completedAt);
  const windowRuns = input.runs.filter((r) => WINDOW_KINDS.has(r.kind) && r.startedAt);
  return input.ledger.filter(isSpend).map((row): AttributedCharge => {
    const t = toMs(row.created_at);
    const tok = parseTokens(row.description);
    const base: AttributedCharge = {
      ledgerId: row.id, ledgerType: row.type, service: row.service ?? "unknown", credits: credits(row), chargedAt: row.created_at,
      llmTier: row.llm_tier, tokensIn: tok?.tokensIn ?? null, tokensOut: tok?.tokensOut ?? null, description: row.description,
      method: "none", runExtId: null, listId: null, contactId: null, segmentKey: null,
      explanation: row.service ? `${row.service} charge, details unavailable` : "Charge, details unavailable",
      result: "unknown", isWaste: false, wasteReason: null, simulated: false,
    };
    if (tok) {
      const r = tokenRuns.find((x) => x.tokensIn === tok.tokensIn && x.tokensOut === tok.tokensOut && Math.abs(t - toMs(x.completedAt!)) <= TOKEN_MATCH_MS);
      if (r) {
        const o = outcomeOf(r);
        return { ...base, method: "exact_tokens", runExtId: r.extId, listId: r.listId ?? null, contactId: r.contactIds?.[0] ?? null,
          explanation: label(r), result: o.result, isWaste: o.waste !== null, wasteReason: o.waste };
      }
    }
    const w = windowRuns.find((x) => x.service === row.service && t >= toMs(x.startedAt!) &&
      t <= (x.completedAt ? toMs(x.completedAt) + WINDOW_TAIL_MS : toMs(x.startedAt!) + OPEN_RUN_MS));
    if (w) {
      const o = outcomeOf(w);
      return { ...base, method: methodFor(w), runExtId: w.extId, listId: w.listId ?? null, contactId: w.contactIds?.[0] ?? null,
        explanation: label(w), result: o.result, isWaste: o.waste !== null, wasteReason: o.waste };
    }
    if (row.service === "studio_copilot" && posts.some((p) => t - p >= 0 && t - p <= SIDE_EFFECT_MS)) {
      return { ...base, method: "time_window", explanation: "graph8's agent replied to an automated post", result: "side_effect",
        isWaste: true, wasteReason: "agent_side_effect" };
    }
    const win = input.windows.find((x) => row.service !== null && x.services.includes(row.service) && t >= x.start && t <= x.end);
    if (win) return { ...base, method: "time_window", explanation: win.label };
    return base;
  });
}

export function coverage(charges: AttributedCharge[]): { exact: number; window: number; none: number; total: number } {
  const sum = (f: (c: AttributedCharge) => boolean) => charges.filter(f).reduce((s, c) => s + c.credits, 0);
  return { exact: sum((c) => EXACT_METHODS.has(c.method)), window: sum((c) => c.method === "time_window"),
    none: sum((c) => c.method === "none"), total: sum(() => true) };
}
```

- [ ] **Step 6: Run the tests.** Run `npm test -- tests/domain/attribution.test.ts`. Expected: PASS (6 tests). If `exact` isn't 216, print the charges with `method === "none"` and compare against `research/fixtures/advisor-runs-2026-09-26.json`. Don't change the expected numbers; they were recomputed from the fixtures.

- [ ] **Step 7: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): attribution engine reproducing 216/1033/11 split and 115 waste"
```

---

### Task 7: Segments and record consistency

**Files:**
- Create: `advisor/src/lib/domain/segments.ts`
- Test: `advisor/tests/domain/segments.test.ts`

**Interfaces:**
- Produces:
  - `rootDomain(d: string | null): string`
  - `emailDomain(email: string | null): string`
  - `recordConsistency(email: string | null, companyDomain: string | null): "ok" | "flagged" | "unknown"`
  - `segmentKey(p: { seniority?: string | null; department?: string | null; industry?: string | null; employeeCount?: string | null }): string`

- [ ] **Step 1: Write the failing test `advisor/tests/domain/segments.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadFixture } from "../fixtures";
import { recordConsistency, rootDomain, segmentKey } from "@/lib/domain/segments";

interface Sample { flagged: { email: string; crm_domain: string }[]; consistent: { email: string; crm_domain: string }[] }
const s = loadFixture<Sample>("idea-a/validation-sample-40.json");
const count = (xs: { email: string; crm_domain: string }[]) =>
  xs.reduce<Record<string, number>>((a, x) => { const k = recordConsistency(x.email, x.crm_domain); a[k] = (a[k] ?? 0) + 1; return a; }, {});

describe("record consistency on the Idea A validation sample", () => {
  it("flags 19 of the flagged group; 1 has no company domain", () => expect(count(s.flagged)).toEqual({ flagged: 19, unknown: 1 }));
  it("passes all 20 consistent contacts", () => expect(count(s.consistent)).toEqual({ ok: 20 }));
  it("accepts subdomains either way and ignores www", () => {
    expect(recordConsistency("a@mail.acme.com", "acme.com")).toBe("ok");
    expect(recordConsistency("a@acme.com", "www.acme.com/about")).toBe("ok");
    expect(recordConsistency(null, "acme.com")).toBe("unknown");
  });
  it("normalises domains", () => expect(rootDomain("https://www.Acme.com/x")).toBe("acme.com"));
  it("builds segment keys with explicit unknowns", () => {
    expect(segmentKey({ seniority: "Vice President", department: "Sales", industry: "Computer Software", employeeCount: "51-200" }))
      .toBe("Vice President|Sales|Computer Software|51-200");
    expect(segmentKey({})).toBe("Unknown|Unknown|Unknown|Unknown");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npm test -- tests/domain/segments.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `advisor/src/lib/domain/segments.ts`**

```ts
export function rootDomain(d: string | null): string {
  return (d ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

export function emailDomain(email: string | null): string {
  if (!email || !email.includes("@")) return "";
  return rootDomain(email.split("@").pop() ?? "");
}

export function recordConsistency(email: string | null, companyDomain: string | null): "ok" | "flagged" | "unknown" {
  const e = emailDomain(email), c = rootDomain(companyDomain);
  if (!e || !c) return "unknown";
  return e === c || e.endsWith(`.${c}`) || c.endsWith(`.${e}`) ? "ok" : "flagged";
}

export function segmentKey(p: { seniority?: string | null; department?: string | null; industry?: string | null; employeeCount?: string | null }): string {
  const v = (x?: string | null) => (x && x.trim() ? x.trim() : "Unknown");
  return [v(p.seniority), v(p.department), v(p.industry), v(p.employeeCount)].join("|");
}
```

- [ ] **Step 4: Run the test.** Run `npm test -- tests/domain/segments.test.ts`. Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): segment keys and record-consistency signal"
```

---

### Task 8: Metrics and confidence

**Files:**
- Create: `advisor/src/lib/domain/metrics.ts`
- Test: `advisor/tests/domain/metrics.test.ts`

**Interfaces:**
- Consumes: `AttributedCharge`, `Outcome`, `ContactInfo`, `Stat` (Task 5), `EXACT_METHODS` (Task 6).
- Produces:
  - `confidenceFor(p: { outcomes: number; credits: number; exactShare: number }): Confidence`
  - `computeStats(p: { charges: AttributedCharge[]; outcomes: Outcome[]; contacts: Map<number, ContactInfo>; dimension: Dimension; period: string; from: number; to: number; now: string }): Stat[]` (always includes one `org` row with `value: "all"` first)
  - `formatCostPerMeeting(s: Stat): string`

- [ ] **Step 1: Write the failing test `advisor/tests/domain/metrics.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeStats, confidenceFor, formatCostPerMeeting } from "@/lib/domain/metrics";
import type { AttributedCharge, ContactInfo, Outcome } from "@/lib/domain/types";

const T = "2026-09-20T12:00:00Z";
const charge = (credits: number, contactId: number | null, method: AttributedCharge["method"] = "advisor", simulated = false): AttributedCharge => ({
  ledgerId: `l${Math.random()}`, ledgerType: "usage", service: "waterfall_enrichment", credits, chargedAt: T, llmTier: null, tokensIn: null, tokensOut: null,
  description: null, method, runExtId: null, listId: null, contactId, segmentKey: null, explanation: "", result: "success", isWaste: false, wasteReason: null, simulated });
const meeting = (contactId: number): Outcome => ({ extId: `o${Math.random()}`, type: "meeting_booked", occurredAt: T, contactId, companyId: null, dealId: null,
  amount: null, listId: null, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });
const contact = (id: number, listIds: number[], seg: string): ContactInfo => ({ contactId: id, name: `c${id}`, email: null, companyName: null, companyDomain: null,
  listIds, sequenceIds: [], segmentKey: seg, consistency: "ok" });

const contacts = new Map([[1, contact(1, [10], "A")], [2, contact(2, [20], "B")], [3, contact(3, [10, 20], "A")]]);
const base = { contacts, period: "30d", from: Date.parse("2026-09-01T00:00:00Z"), to: Date.parse("2026-10-01T00:00:00Z"), now: "2026-10-01T00:00:00Z" };

describe("confidenceFor", () => {
  it("high needs 10 outcomes, 500 credits and half the spend exact", () => {
    expect(confidenceFor({ outcomes: 10, credits: 500, exactShare: 0.5 })).toBe("high");
    expect(confidenceFor({ outcomes: 10, credits: 500, exactShare: 0.4 })).toBe("medium");
    expect(confidenceFor({ outcomes: 3, credits: 10, exactShare: 1 })).toBe("medium");
    expect(confidenceFor({ outcomes: 2, credits: 9999, exactShare: 1 })).toBe("low");
  });
});

describe("computeStats", () => {
  it("computes cost per meeting per list, splitting multi-list contacts evenly", () => {
    const stats = computeStats({ ...base, dimension: "list", charges: [charge(300, 1), charge(100, 2), charge(200, 3)], outcomes: [meeting(1), meeting(3)] });
    const org = stats[0], l10 = stats.find((s) => s.value === "10")!, l20 = stats.find((s) => s.value === "20")!;
    expect(org).toMatchObject({ dimension: "org", value: "all", credits: 600, meetings: 2, costPerMeeting: 300 });
    expect(l10).toMatchObject({ credits: 400, meetings: 1.5 });
    expect(l10.costPerMeeting).toBeCloseTo(266.67, 1);
    expect(l20).toMatchObject({ credits: 200, meetings: 0.5, costPerMeeting: 400 });
  });
  it("never divides by zero: spend without meetings gives a null cost and a plain label", () => {
    const [org] = computeStats({ ...base, dimension: "org", charges: [charge(150, 2)], outcomes: [] });
    expect(org.costPerMeeting).toBeNull();
    expect(org.vsAvgPct).toBeNull();
    expect(formatCostPerMeeting(org)).toBe("150 credits, no meetings yet");
  });
  it("marks a stat simulated when any input is simulated", () => {
    const [org] = computeStats({ ...base, dimension: "org", charges: [charge(10, 1, "advisor", true)], outcomes: [] });
    expect(org.simulated).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npm test -- tests/domain/metrics.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `advisor/src/lib/domain/metrics.ts`**

```ts
import type { AttributedCharge, Confidence, ContactInfo, Dimension, Outcome, Stat } from "./types";
import { EXACT_METHODS } from "./attribution";
import { toMs } from "./time";

export function confidenceFor(p: { outcomes: number; credits: number; exactShare: number }): Confidence {
  if (p.outcomes >= 10 && p.credits >= 500 && p.exactShare >= 0.5) return "high";
  if (p.outcomes >= 3) return "medium";
  return "low";
}

type Keyed = { key: string; weight: number };

function keysForContact(dimension: Dimension, contactId: number | null, listId: number | null, contacts: Map<number, ContactInfo>): Keyed[] {
  if (dimension === "org") return [{ key: "all", weight: 1 }];
  if (dimension === "list") {
    if (listId !== null) return [{ key: String(listId), weight: 1 }];
    const lists = contactId !== null ? contacts.get(contactId)?.listIds ?? [] : [];
    return lists.map((l) => ({ key: String(l), weight: 1 / lists.length }));
  }
  if (dimension === "segment") {
    const seg = contactId !== null ? contacts.get(contactId)?.segmentKey : undefined;
    return seg ? [{ key: seg, weight: 1 }] : [];
  }
  return [];
}

interface Acc { credits: number; exact: number; meetings: number; deals: number; won: number; contacts: Set<number>; simulated: boolean }

export function computeStats(p: { charges: AttributedCharge[]; outcomes: Outcome[]; contacts: Map<number, ContactInfo>; dimension: Dimension;
  period: string; from: number; to: number; now: string }): Stat[] {
  const inRange = (iso: string) => { const t = toMs(iso); return t >= p.from && t < p.to; };
  const accs = new Map<string, Acc>();
  const acc = (k: string) => { let a = accs.get(k); if (!a) { a = { credits: 0, exact: 0, meetings: 0, deals: 0, won: 0, contacts: new Set(), simulated: false }; accs.set(k, a); } return a; };
  const dims: Dimension[] = p.dimension === "org" ? ["org"] : ["org", p.dimension];
  for (const d of dims) {
    for (const c of p.charges.filter((x) => inRange(x.chargedAt))) {
      const keys = d === "service" ? [{ key: c.service, weight: 1 }] : keysForContact(d, c.contactId, c.listId, p.contacts);
      for (const { key, weight } of keys) {
        const a = acc(`${d}|${key}`);
        a.credits += c.credits * weight;
        if (EXACT_METHODS.has(c.method)) a.exact += c.credits * weight;
        if (c.contactId !== null) a.contacts.add(c.contactId);
        a.simulated ||= c.simulated;
      }
    }
    for (const o of p.outcomes.filter((x) => inRange(x.occurredAt))) {
      for (const { key, weight } of keysForContact(d, o.contactId, o.listId, p.contacts)) {
        const a = acc(`${d}|${key}`);
        if (o.type === "meeting_booked") a.meetings += weight;
        if (o.type === "deal_won") { a.deals += weight; a.won += (o.amount ?? 0) * weight; }
        a.simulated ||= o.simulated;
      }
    }
  }
  const orgAcc = accs.get("org|all") ?? { credits: 0, exact: 0, meetings: 0, deals: 0, won: 0, contacts: new Set<number>(), simulated: false };
  const orgCpm = orgAcc.meetings > 0 ? orgAcc.credits / orgAcc.meetings : null;
  const toStat = (dimension: Dimension, value: string, a: Acc): Stat => {
    const cpm = a.meetings > 0 ? a.credits / a.meetings : null;
    return {
      period: p.period, dimension, value, credits: round(a.credits), creditsExact: round(a.exact), meetings: round(a.meetings), deals: round(a.deals),
      wonValue: round(a.won), contactsReached: a.contacts.size, costPerMeeting: cpm === null ? null : round(cpm),
      costPerDeal: a.deals > 0 ? round(a.credits / a.deals) : null,
      vsAvgPct: cpm !== null && orgCpm ? round(((cpm - orgCpm) / orgCpm) * 100) : null,
      evidenceN: round(a.meetings + a.deals), confidence: confidenceFor({ outcomes: a.meetings + a.deals, credits: a.credits, exactShare: a.credits > 0 ? a.exact / a.credits : 0 }),
      simulated: a.simulated, computedAt: p.now,
    };
  };
  const out: Stat[] = [toStat("org", "all", orgAcc)];
  if (p.dimension !== "org") {
    for (const [k, a] of accs) if (k.startsWith(`${p.dimension}|`)) out.push(toStat(p.dimension, k.slice(p.dimension.length + 1), a));
  }
  return out;
}

function round(n: number): number { return Math.round(n * 100) / 100; }

export function formatCostPerMeeting(s: Stat): string {
  return s.costPerMeeting === null ? `${Math.round(s.credits).toLocaleString("en-US")} credits, no meetings yet` : `${Math.round(s.costPerMeeting).toLocaleString("en-US")} credits per meeting`;
}
```

- [ ] **Step 4: Run the tests.** Run `npm test -- tests/domain/metrics.test.ts`. Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): stats by list/segment/service with confidence and zero-meeting safety"
```

---

### Task 9: Findings and the surfacing gate

**Files:**
- Create: `advisor/src/lib/domain/findings.ts`, `advisor/src/lib/domain/gate.ts`
- Test: `advisor/tests/domain/findings.test.ts`, `advisor/tests/domain/gate.test.ts`

**Interfaces:**
- Consumes: `Stat`, `AttributedCharge`, `Run`, `Outcome`, `Finding` (Task 5); `computeStats` output (Task 8).
- Produces:
  - `generateFindings(ctx: FindingContext): Finding[]`, where `interface FindingContext { now: string; period: string; statsByList: Stat[]; statsBySegment: Stat[]; charges: AttributedCharge[]; runs: Run[]; outcomes: Outcome[]; unusedDocs: { name: string; createdAt: string }[]; onboardingCredits: number }`
  - `mergeFindings(fresh: Finding[], existing: Finding[]): Finding[]`
  - `recapSelection(findings: Finding[], o: { lastRecapAt: string | null; spendThisWeek: number; spendLastWeek: number }): Finding[]`
  - `shouldRenotify(f: Finding): boolean`
  - `dismiss(f: Finding, now: string): Finding`
  - `dashboardBuckets(findings: Finding[], now: string): { open: Finding[]; watching: Finding[] }`
  - `shouldWarnPreSpend(p: { plannedCredits: number; projectedSaving: number; confidence: Confidence }): boolean`

- [ ] **Step 1: Write the failing test `advisor/tests/domain/findings.test.ts`** (uses the real attributed charges plus a small synthetic stats set)

```ts
import { describe, it, expect } from "vitest";
import { attributeCharges } from "@/lib/domain/attribution";
import { generateFindings, mergeFindings } from "@/lib/domain/findings";
import type { Stat } from "@/lib/domain/types";
import { loadDesignInput } from "../helpers/design-fixture";

const input = loadDesignInput();
const charges = attributeCharges(input);
const stat = (value: string, credits: number, meetings: number, cpm: number | null, conf: Stat["confidence"] = "high", reached = 200): Stat => ({
  period: "30d", dimension: value === "all" ? "org" : "list", value, credits, creditsExact: credits, meetings, deals: 0, wonValue: 0, contactsReached: reached,
  costPerMeeting: cpm, costPerDeal: null, vsAvgPct: null, evidenceN: meetings, confidence: conf, simulated: true, computedAt: "2026-10-04T00:00:00Z" });
const statsByList = [stat("all", 12400, 38, 326), stat("fintech", 2100, 17, 124), stat("starter", 4800, 4, 1200, "medium"), stat("health", 2600, 6, 433, "medium")];
const findings = generateFindings({ now: "2026-10-04T00:00:00Z", period: "30d", statsByList, statsBySegment: [], charges, runs: input.runs, outcomes: [],
  unusedDocs: Array.from({ length: 23 }, (_, i) => ({ name: `doc ${i}`, createdAt: "2026-09-26T09:00:00Z" })), onboardingCredits: 860 });
const byKind = (k: string) => findings.filter((f) => f.kind === k);

describe("generateFindings", () => {
  it("finds the real waste: 77 failed-job credits, 14 unreadable, 24 agent side effect", () => {
    expect(byKind("waste").map((f) => f.creditsAtStake).sort((a, b) => a - b)).toEqual([14, 77]);
    expect(byKind("side_effect")[0].creditsAtStake).toBe(24);
  });
  it("flags the billing mismatch on jobs that report 0 credits but were charged", () => {
    expect(byKind("fix").some((f) => f.extId.startsWith("fix|billing_mismatch") && f.creditsAtStake === 77)).toBe(true);
  });
  it("flags the estimate gap: quoted 37, charged 50", () => {
    const f = byKind("fix").find((x) => x.extId.startsWith("fix|estimate_gap"));
    expect(f?.evidence).toMatchObject({ quoted: 37, actual: 50 });
  });
  it("suggests scaling fintech (≤0.6× average) and cutting starter (≥2× average)", () => {
    expect(byKind("scale").map((f) => f.evidence.value)).toEqual(["fintech"]);
    expect(byKind("cut").map((f) => f.evidence.value)).toEqual(["starter"]);
  });
  it("reports 23 unused documents after 7 days", () => expect(byKind("unused")[0].evidence).toMatchObject({ documents: 23 }));
  it("does not raise traceability when service-only spend is under 10%", () => expect(byKind("traceability")).toHaveLength(0));
});

describe("mergeFindings", () => {
  it("keeps user status and first-seen date, refreshes the rest", () => {
    const prev = { ...findings[0], status: "dismissed" as const, dismissCount: 1, firstSeen: "2026-09-27T00:00:00Z", snoozedUntil: "2026-10-27T00:00:00Z" };
    const [m] = mergeFindings([findings[0]], [prev]);
    expect(m).toMatchObject({ status: "dismissed", dismissCount: 1, firstSeen: "2026-09-27T00:00:00Z", lastSeen: findings[0].lastSeen });
  });
});
```

- [ ] **Step 2: Write the failing test `advisor/tests/domain/gate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { recapSelection, shouldRenotify, dismiss, dashboardBuckets, shouldWarnPreSpend } from "@/lib/domain/gate";
import type { Finding } from "@/lib/domain/types";

const f = (id: string, stake: number, conf: Finding["confidence"] = "high", extra: Partial<Finding> = {}): Finding => ({
  extId: id, kind: "waste", title: id, body: "", evidence: {}, creditsAtStake: stake, confidence: conf, status: "open", snoozedUntil: null,
  dismissCount: 0, action: null, actionPayload: null, firstSeen: "2026-09-26T00:00:00Z", lastSeen: "2026-10-04T00:00:00Z",
  lastNotifiedStake: null, inRecap: false, simulated: false, ...extra });

describe("recapSelection", () => {
  it("takes the top 3 by stake × confidence weight, medium or better", () => {
    const sel = recapSelection([f("a", 100), f("b", 1000, "medium"), f("c", 700), f("d", 5000, "low"), f("e", 10)],
      { lastRecapAt: "2026-09-28T00:00:00Z", spendThisWeek: 100, spendLastWeek: 100 });
    expect(sel.map((x) => x.extId)).toEqual(["c", "b", "a"]);
  });
  it("skips a quiet week: nothing new and spend moved under 10%", () => {
    const old = f("a", 100, "high", { lastSeen: "2026-09-20T00:00:00Z", firstSeen: "2026-09-20T00:00:00Z" });
    expect(recapSelection([old], { lastRecapAt: "2026-09-28T00:00:00Z", spendThisWeek: 105, spendLastWeek: 100 })).toEqual([]);
  });
  it("leaves out kinds dismissed three times", () => {
    expect(recapSelection([f("a", 100, "high", { dismissCount: 3 })], { lastRecapAt: null, spendThisWeek: 1, spendLastWeek: 0 })).toEqual([]);
  });
});

describe("other gate rules", () => {
  it("re-notifies only when stake grows 50% since the last notice", () => {
    expect(shouldRenotify(f("a", 100))).toBe(true);
    expect(shouldRenotify(f("a", 140, "high", { lastNotifiedStake: 100 }))).toBe(false);
    expect(shouldRenotify(f("a", 150, "high", { lastNotifiedStake: 100 }))).toBe(true);
  });
  it("dismiss hides a finding for 30 days, then it returns", () => {
    const d = dismiss(f("a", 1), "2026-10-04T00:00:00Z");
    expect(d).toMatchObject({ status: "dismissed", dismissCount: 1, snoozedUntil: "2026-11-03T00:00:00.000Z" });
    expect(dashboardBuckets([d], "2026-10-10T00:00:00Z").open).toHaveLength(0);
    expect(dashboardBuckets([d], "2026-11-04T00:00:00Z").open).toHaveLength(1);
  });
  it("puts low confidence in Watching", () => expect(dashboardBuckets([f("a", 1, "low")], "2026-10-04T00:00:00Z").watching).toHaveLength(1));
  it("warns before spending only for a material, confident saving", () => {
    expect(shouldWarnPreSpend({ plannedCredits: 498, projectedSaving: 459, confidence: "medium" })).toBe(true);
    expect(shouldWarnPreSpend({ plannedCredits: 498, projectedSaving: 60, confidence: "high" })).toBe(false);
    expect(shouldWarnPreSpend({ plannedCredits: 400, projectedSaving: 99, confidence: "high" })).toBe(false);
    expect(shouldWarnPreSpend({ plannedCredits: 1000, projectedSaving: 500, confidence: "low" })).toBe(false);
  });
});
```

- [ ] **Step 3: Run both and confirm they fail.** Run `npm test -- tests/domain/findings.test.ts tests/domain/gate.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement `advisor/src/lib/domain/gate.ts`**

```ts
import type { Confidence, Finding } from "./types";
import { toIso, toMs } from "./time";

const WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.6, low: 0 };
const DAY = 86_400_000;

function visible(f: Finding, now: number): boolean {
  if (f.status === "applied") return false;
  if ((f.status === "dismissed" || f.status === "snoozed") && f.snoozedUntil && toMs(f.snoozedUntil) > now) return false;
  return true;
}

export function recapSelection(findings: Finding[], o: { lastRecapAt: string | null; spendThisWeek: number; spendLastWeek: number }): Finding[] {
  const now = Date.now();
  const eligible = findings.filter((f) => visible(f, now) && f.confidence !== "low" && f.dismissCount < 3);
  const since = o.lastRecapAt ? toMs(o.lastRecapAt) : -Infinity;
  const changed = eligible.some((f) => toMs(f.firstSeen) > since || toMs(f.lastSeen) > since);
  const spendMove = Math.abs(o.spendThisWeek - o.spendLastWeek) / Math.max(o.spendLastWeek, 1);
  if (!changed && spendMove < 0.1) return [];
  return [...eligible].sort((a, b) => b.creditsAtStake * WEIGHT[b.confidence] - a.creditsAtStake * WEIGHT[a.confidence]).slice(0, 3);
}

export function shouldRenotify(f: Finding): boolean {
  return f.lastNotifiedStake === null || f.creditsAtStake >= 1.5 * f.lastNotifiedStake;
}

export function dismiss(f: Finding, now: string): Finding {
  return { ...f, status: "dismissed", dismissCount: f.dismissCount + 1, snoozedUntil: toIso(toMs(now) + 30 * DAY) };
}

export function dashboardBuckets(findings: Finding[], now: string): { open: Finding[]; watching: Finding[] } {
  const t = toMs(now);
  const shown = findings.filter((f) => visible(f, t));
  return { open: shown.filter((f) => f.confidence !== "low"), watching: shown.filter((f) => f.confidence === "low") };
}

export function shouldWarnPreSpend(p: { plannedCredits: number; projectedSaving: number; confidence: Confidence }): boolean {
  return p.confidence !== "low" && p.projectedSaving >= 100 && p.projectedSaving >= 0.15 * p.plannedCredits;
}
```

- [ ] **Step 5: Implement `advisor/src/lib/domain/findings.ts`**

```ts
import type { AttributedCharge, Finding, FindingKind, Outcome, Run, Stat } from "./types";
import { toMs } from "./time";

export interface FindingContext {
  now: string; period: string; statsByList: Stat[]; statsBySegment: Stat[]; charges: AttributedCharge[]; runs: Run[]; outcomes: Outcome[];
  unusedDocs: { name: string; createdAt: string }[]; onboardingCredits: number;
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");

function mk(ctx: FindingContext, kind: FindingKind, scope: string, p: { title: string; body: string; stake: number; confidence: Finding["confidence"];
  evidence: Record<string, unknown>; action?: string; payload?: Record<string, unknown>; simulated?: boolean }): Finding {
  return { extId: `${kind}|${scope}|${ctx.period}`, kind, title: p.title, body: p.body, evidence: p.evidence, creditsAtStake: Math.round(p.stake),
    confidence: p.confidence, status: "open", snoozedUntil: null, dismissCount: 0, action: p.action ?? null, actionPayload: p.payload ?? null,
    firstSeen: ctx.now, lastSeen: ctx.now, lastNotifiedStake: null, inRecap: false, simulated: p.simulated ?? false };
}

export function generateFindings(ctx: FindingContext): Finding[] {
  const out: Finding[] = [];
  const sum = (xs: AttributedCharge[]) => xs.reduce((s, c) => s + c.credits, 0);
  const wasteGroups: [string, string, string][] = [
    ["failed_job", "Charged for jobs that failed", "Refund request"],
    ["no_change", "Charged for results you can't use", "Refund request"],
  ];
  for (const [reason, title, action] of wasteGroups) {
    const xs = ctx.charges.filter((c) => c.wasteReason === reason);
    if (!xs.length) continue;
    const runs = [...new Set(xs.map((c) => c.runExtId).filter(Boolean))];
    out.push(mk(ctx, "waste", reason, { title, body: `${n(sum(xs))} credits went to work that produced nothing usable (${runs.length} runs).`,
      stake: sum(xs), confidence: "high", evidence: { runs, ledgerIds: xs.map((c) => c.ledgerId) }, action, payload: { reason } }));
  }
  const side = ctx.charges.filter((c) => c.wasteReason === "agent_side_effect");
  if (side.length) out.push(mk(ctx, "side_effect", "agent_reply", { title: "Automated posts are waking graph8's agent",
    body: `${n(sum(side))} credits were charged when graph8's agent replied to automated posts. Post recaps only to #roi-advisor.`,
    stake: sum(side), confidence: "high", evidence: { ledgerIds: side.map((c) => c.ledgerId) }, action: "Use #roi-advisor" }));
  for (const r of ctx.runs) {
    const linked = ctx.charges.filter((c) => c.runExtId === r.extId);
    const actual = sum(linked);
    if (r.reportedCredits === 0 && actual > 0) {
      const all = ctx.runs.filter((x) => x.reportedCredits === 0).flatMap((x) => ctx.charges.filter((c) => c.runExtId === x.extId));
      if (!out.some((f) => f.extId.startsWith("fix|billing_mismatch"))) out.push(mk(ctx, "fix", "billing_mismatch", { title: "Charged for jobs that report no charge",
        body: `graph8's job records say 0 credits were used, but the ledger charged ${n(sum(all))}.`, stake: sum(all), confidence: "high",
        evidence: { runs: [...new Set(all.map((c) => c.runExtId))] }, action: "Refund request" }));
    }
    if (r.quotedCredits && r.service) {
      const svcRuns = ctx.runs.filter((x) => x.service === r.service && x.quotedCredits);
      const quoted = svcRuns.reduce((s, x) => s + (x.quotedCredits ?? 0), 0);
      const charged = sum(ctx.charges.filter((c) => svcRuns.some((x) => x.extId === c.runExtId)));
      if (charged > quoted * 1.2 && !out.some((f) => f.extId === `fix|estimate_gap:${r.service}|${ctx.period}`))
        out.push(mk(ctx, "fix", `estimate_gap:${r.service}`, { title: "graph8's estimates run low", body: `Quoted ${n(quoted)}, charged ${n(charged)} (+${Math.round((charged / quoted - 1) * 100)}%). Future estimates here are adjusted.`,
          stake: charged - quoted, confidence: "high", evidence: { service: r.service, quoted, actual: charged } }));
    }
  }
  const org = ctx.statsByList.find((s) => s.dimension === "org");
  const orgCpm = org?.costPerMeeting ?? null;
  for (const s of ctx.statsByList.filter((x) => x.dimension !== "org")) {
    if (orgCpm && s.costPerMeeting !== null && s.costPerMeeting <= 0.6 * orgCpm && s.confidence !== "low" && s.meetings >= 5)
      out.push(mk(ctx, "scale", `list:${s.value}`, { title: `Scale ${s.value}`, body: `${n(s.costPerMeeting)} credits per meeting, ${Math.round((1 - s.costPerMeeting / orgCpm) * 100)}% below your average.`,
        stake: s.credits, confidence: s.confidence, evidence: { value: s.value, costPerMeeting: s.costPerMeeting, meetings: s.meetings }, action: "Build lookalike list", simulated: s.simulated }));
    const tooCostly = orgCpm !== null && s.costPerMeeting !== null && s.costPerMeeting >= 2 * orgCpm;
    const noMeetings = s.meetings === 0 && s.credits >= 1000 && s.contactsReached >= 100;
    if (tooCostly || noMeetings)
      out.push(mk(ctx, "cut", `list:${s.value}`, { title: `Cut back on ${s.value}`, body: tooCostly ? `${n(s.costPerMeeting!)} credits per meeting, over twice your average.` : `${n(s.credits)} credits and no meetings.`,
        stake: s.credits, confidence: s.confidence === "low" ? "medium" : s.confidence, evidence: { value: s.value, costPerMeeting: s.costPerMeeting, meetings: s.meetings }, action: "Apply guardrail", simulated: s.simulated }));
  }
  const stale = ctx.unusedDocs.filter((d) => toMs(ctx.now) - toMs(d.createdAt) >= 7 * 86_400_000);
  if (stale.length) out.push(mk(ctx, "unused", "studio_docs", { title: `${stale.length} paid documents never used`,
    body: `${stale.length} onboarding documents have zero uses. They came out of about ${n(ctx.onboardingCredits)} credits of research.`,
    stake: ctx.onboardingCredits, confidence: "medium", evidence: { documents: stale.length } }));
  const total = sum(ctx.charges), none = sum(ctx.charges.filter((c) => c.method === "none"));
  if (total > 0 && none / total >= 0.1) out.push(mk(ctx, "traceability", "service_only", { title: "Spend you can't trace",
    body: `${n(none)} credits (${Math.round((none / total) * 100)}%) can't be tied to a contact or list. Run repeated skills inside a workflow so they can be traced.`,
    stake: none, confidence: "high", evidence: { none, total } }));
  const sends = ctx.outcomes.filter((o) => o.type === "email_sent" && o.step !== null);
  const replies = ctx.outcomes.filter((o) => o.type === "email_replied" && o.step !== null);
  const bySeg = new Map<string, { sent: Map<number, number>; replied: Map<number, number> }>();
  for (const o of [...sends, ...replies]) {
    const k = o.segmentKey ?? "Unknown";
    const e = bySeg.get(k) ?? { sent: new Map(), replied: new Map() };
    const m = o.type === "email_sent" ? e.sent : e.replied;
    m.set(o.step!, (m.get(o.step!) ?? 0) + 1);
    bySeg.set(k, e);
  }
  for (const [seg, e] of bySeg) {
    const totalSent = [...e.sent.values()].reduce((a, b) => a + b, 0), totalReplied = [...e.replied.values()].reduce((a, b) => a + b, 0);
    const overall = totalSent ? totalReplied / totalSent : 0;
    for (const [step, sent] of e.sent) {
      const rate = (e.replied.get(step) ?? 0) / sent;
      if (sent >= 20 && overall > 0 && rate >= 2 * overall)
        out.push(mk(ctx, "what_worked", `step:${seg}:${step}`, { title: `Step ${step} works for ${seg.split("|")[0]}`,
          body: `Step ${step} gets ${(rate / overall).toFixed(1)}× the reply rate for this segment.`, stake: 0, confidence: "medium",
          evidence: { segment: seg, step, rate, overall, sent }, action: "Use as step 1", simulated: sends.some((o) => o.simulated) }));
    }
  }
  return out;
}

export function mergeFindings(fresh: Finding[], existing: Finding[]): Finding[] {
  const prev = new Map(existing.map((f) => [f.extId, f]));
  return fresh.map((f) => {
    const p = prev.get(f.extId);
    return p ? { ...f, status: p.status, snoozedUntil: p.snoozedUntil, dismissCount: p.dismissCount, firstSeen: p.firstSeen, lastNotifiedStake: p.lastNotifiedStake, inRecap: p.inRecap } : f;
  });
}
```

- [ ] **Step 6: Run the tests.** Run `npm test -- tests/domain`. Expected: PASS. If the scale or cut test fails, check the `org` stat is the one with `dimension: "org"` (the test builds it with `value: "all"`).

- [ ] **Step 7: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): findings catalogue and anti-spam surfacing gate"
```

---

### Task 10: Pre-spend estimate and roi_fit

**Files:**
- Create: `advisor/src/lib/domain/prespend.ts`
- Test: `advisor/tests/domain/prespend.test.ts`

**Interfaces:**
- Produces:
  - `smoothedRate(meetings: number, reached: number, orgRate: number, k?: number): number`
  - `classifyFit(p: { rate: number; orgRate: number; n: number; consistency: "ok" | "flagged" | "unknown" }): "high" | "medium" | "low" | "unknown"`
  - `calibrationFactor(history: { quoted: number; actual: number }[]): number`
  - `estimateCredits(p: { records: number; pricePerRecord: number; calibration?: number }): number`
  - `bestFitSubset(contacts: { contactId: number; expectedRate: number; consistency: string }[], p: { pricePerRecord: number; orgCostPerMeeting: number }): number[]`
  - `priceFor(providers: ProviderRow[], provider: string, action: string): number | null`, where `interface ProviderRow { provider: string; credits_per_row: Record<string, number> }`

- [ ] **Step 1: Write the failing test `advisor/tests/domain/prespend.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadFixture } from "../fixtures";
import { smoothedRate, classifyFit, calibrationFactor, estimateCredits, bestFitSubset, priceFor, type ProviderRow } from "@/lib/domain/prespend";

describe("pre-spend", () => {
  it("smooths a thin segment toward the org rate", () => {
    expect(smoothedRate(0, 0, 0.05)).toBeCloseTo(0.05);
    expect(smoothedRate(10, 100, 0.05)).toBeCloseTo((10 + 5 * 0.05) / 105);
  });
  it("classifies fit, with flagged records always low and thin evidence unknown", () => {
    expect(classifyFit({ rate: 0.1, orgRate: 0.05, n: 10, consistency: "ok" })).toBe("high");
    expect(classifyFit({ rate: 0.1, orgRate: 0.05, n: 10, consistency: "flagged" })).toBe("low");
    expect(classifyFit({ rate: 0.02, orgRate: 0.05, n: 10, consistency: "ok" })).toBe("low");
    expect(classifyFit({ rate: 0.05, orgRate: 0.05, n: 10, consistency: "ok" })).toBe("medium");
    expect(classifyFit({ rate: 0.5, orgRate: 0.05, n: 2, consistency: "ok" })).toBe("unknown");
  });
  it("calibrates from the real AI enrichment gap (quoted 37, charged 50)", () => {
    expect(calibrationFactor([{ quoted: 37, actual: 50 }])).toBeCloseTo(1.351, 3);
    expect(calibrationFactor([])).toBe(1);
  });
  it("estimates the Starter list email step at 39 credits (13 contacts × 3)", () => {
    const providers = loadFixture<{ data: { providers: ProviderRow[] } }>("graph8/providers.json").data.providers;
    expect(priceFor(providers, "leadmagic", "email_finder")).toBe(3);
    expect(estimateCredits({ records: 13, pricePerRecord: 3 })).toBe(39);
  });
  it("keeps best-fit contacts until the next one costs more per meeting than average", () => {
    const ids = bestFitSubset([
      { contactId: 1, expectedRate: 0.05, consistency: "ok" }, { contactId: 2, expectedRate: 0.02, consistency: "ok" },
      { contactId: 3, expectedRate: 0.004, consistency: "ok" }, { contactId: 4, expectedRate: 0.09, consistency: "flagged" }],
      { pricePerRecord: 3, orgCostPerMeeting: 326 });
    expect(ids).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npm test -- tests/domain/prespend.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `advisor/src/lib/domain/prespend.ts`**

```ts
export interface ProviderRow { provider: string; credits_per_row: Record<string, number> }

export function smoothedRate(meetings: number, reached: number, orgRate: number, k = 5): number {
  return (meetings + k * orgRate) / (reached + k);
}

export function classifyFit(p: { rate: number; orgRate: number; n: number; consistency: "ok" | "flagged" | "unknown" }): "high" | "medium" | "low" | "unknown" {
  if (p.consistency === "flagged") return "low";
  if (p.n < 3) return "unknown";
  if (p.rate >= 1.5 * p.orgRate) return "high";
  if (p.rate <= 0.5 * p.orgRate) return "low";
  return "medium";
}

export function calibrationFactor(history: { quoted: number; actual: number }[]): number {
  const q = history.reduce((s, h) => s + h.quoted, 0), a = history.reduce((s, h) => s + h.actual, 0);
  return q > 0 ? a / q : 1;
}

export function estimateCredits(p: { records: number; pricePerRecord: number; calibration?: number }): number {
  return Math.round(p.records * p.pricePerRecord * (p.calibration ?? 1));
}

export function bestFitSubset(contacts: { contactId: number; expectedRate: number; consistency: string }[], p: { pricePerRecord: number; orgCostPerMeeting: number }): number[] {
  return contacts.filter((c) => c.consistency !== "flagged" && c.expectedRate > 0)
    .sort((a, b) => b.expectedRate - a.expectedRate)
    .filter((c) => p.pricePerRecord / c.expectedRate <= p.orgCostPerMeeting)
    .map((c) => c.contactId);
}

export function priceFor(providers: ProviderRow[], provider: string, action: string): number | null {
  return providers.find((x) => x.provider === provider)?.credits_per_row[action] ?? null;
}
```

- [ ] **Step 4: Run the test.** Run `npm test -- tests/domain/prespend.test.ts`. Expected: PASS (5 tests). Check the arithmetic: contact 2 costs 3 ÷ 0.02 = 150 ≤ 326 and is kept; contact 3 costs 750 and is dropped; contact 4 is flagged.

- [ ] **Step 5: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): pre-spend estimate, calibration, best-fit subset, roi_fit classes"
```

---

### Task 11: Custom-object store and bootstrap

**Files:**
- Create: `advisor/src/lib/store/schema.ts`, `advisor/src/lib/store/records.ts`, `advisor/src/lib/store/mappers.ts`, `advisor/scripts/bootstrap.ts`
- Test: `advisor/tests/store/records.test.ts`, `advisor/tests/store/mappers.test.ts`, `advisor/tests/helpers/fake-client.ts`

**Interfaces:**
- Consumes: `G8Caller`, `OPS`, `isConflict` (Task 2); domain types (Task 5).
- Produces:
  - `OBJECTS: ObjectDef[]`, where `interface ObjectDef { slug: string; singular: string; plural: string; attributes: { slug: string; type: string; unique?: boolean }[] }`
  - `ensureSchema(c: G8Caller): Promise<{ createdObjects: string[]; createdAttributes: string[] }>`
  - `class RecordStore { constructor(c: G8Caller, slug: string); list(): Promise<StoredRecord[]>; upsert(values: Record<string, unknown>): Promise<{ id: string; created: boolean }> }`, where `interface StoredRecord { id: string; values: Record<string, unknown> }`
  - Mappers: `chargeToValues` / `valuesToCharge`, `runToValues` / `valuesToRun`, `outcomeToValues` / `valuesToOutcome`, `statToValues` / `valuesToStat`, `findingToValues` / `valuesToFinding`, `ledgerFromCharge(c: AttributedCharge): LedgerRow`
  - Test helper `FakeG8` implementing `G8Caller` over an in-memory object store.

- [ ] **Step 1: Create `advisor/src/lib/store/schema.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";

export interface AttrDef { slug: string; type: "text" | "number" | "timestamp" | "checkbox" | "select"; unique?: boolean }
export interface ObjectDef { slug: string; singular: string; plural: string; attributes: AttrDef[] }

const t = (slug: string, type: AttrDef["type"] = "text"): AttrDef => ({ slug, type });
const common = [{ slug: "ext_id", type: "text", unique: true } as AttrDef, t("simulated", "checkbox")];

export const OBJECTS: ObjectDef[] = [
  { slug: "roi_charge", singular: "ROI charge", plural: "ROI charges", attributes: [...common,
    t("ledger_type", "select"), t("service", "select"), t("credits", "number"), t("charged_at", "timestamp"), t("llm_tier"), t("tokens_in", "number"),
    t("tokens_out", "number"), t("description"), t("run_ext_id"), t("method", "select"), t("contact_id", "number"), t("list_id", "number"),
    t("segment_key"), t("explanation"), t("result", "select"), t("is_waste", "checkbox"), t("waste_reason", "select")] },
  { slug: "roi_run", singular: "ROI run", plural: "ROI runs", attributes: [...common,
    t("kind", "select"), t("service", "select"), t("action_name"), t("started_at", "timestamp"), t("completed_at", "timestamp"), t("status"),
    t("source", "select"), t("tokens_in", "number"), t("tokens_out", "number"), t("list_id", "number"), t("contact_ids"), t("contact_label"),
    t("company_name"), t("records_ok", "number"), t("records_failed", "number"), t("records_skipped", "number"), t("quoted_credits", "number"),
    t("reported_credits", "number"), t("result_hint")] },
  { slug: "roi_outcome", singular: "ROI outcome", plural: "ROI outcomes", attributes: [...common,
    t("type", "select"), t("occurred_at", "timestamp"), t("contact_id", "number"), t("company_id", "number"), t("deal_id"), t("amount", "number"),
    t("list_id", "number"), t("sequence_id"), t("step", "number"), t("channel", "select"), t("segment_key"), t("source", "select")] },
  { slug: "roi_stat", singular: "ROI stat", plural: "ROI stats", attributes: [...common,
    t("period"), t("dimension", "select"), t("value"), t("credits", "number"), t("credits_exact", "number"), t("meetings", "number"), t("deals", "number"),
    t("won_value", "number"), t("contacts_reached", "number"), t("cost_per_meeting", "number"), t("cost_per_deal", "number"), t("vs_avg_pct", "number"),
    t("evidence_n", "number"), t("confidence", "select"), t("computed_at", "timestamp")] },
  { slug: "roi_finding", singular: "ROI finding", plural: "ROI findings", attributes: [...common,
    t("kind", "select"), t("title"), t("body"), t("evidence"), t("credits_at_stake", "number"), t("confidence", "select"), t("status", "select"),
    t("snoozed_until", "timestamp"), t("dismiss_count", "number"), t("action"), t("action_payload"), t("first_seen", "timestamp"),
    t("last_seen", "timestamp"), t("last_notified_stake", "number"), t("in_recap", "checkbox")] },
];

export async function ensureSchema(c: G8Caller): Promise<{ createdObjects: string[]; createdAttributes: string[] }> {
  const existing = new Set((await c.call<{ slug: string }[]>(OPS.listObjects)).map((o) => o.slug));
  const createdObjects: string[] = [], createdAttributes: string[] = [];
  for (const o of OBJECTS) {
    if (!existing.has(o.slug)) {
      await c.call(OPS.createObject, { body: { slug: o.slug, singular_noun: o.singular, plural_noun: o.plural, description: "ROI Advisor data", icon: "target" } });
      createdObjects.push(o.slug);
    }
    const have = new Set((await c.call<{ slug: string }[]>(OPS.listAttributes, { path: { object_slug: o.slug } })).map((a) => a.slug));
    for (const a of o.attributes) {
      if (have.has(a.slug)) continue;
      await c.call(OPS.createAttribute, { path: { object_slug: o.slug }, body: { slug: a.slug, title: a.slug, attribute_type: a.type, is_unique: a.unique ?? false } });
      createdAttributes.push(`${o.slug}.${a.slug}`);
    }
  }
  return { createdObjects, createdAttributes };
}
```

- [ ] **Step 2: Create the test helper `advisor/tests/helpers/fake-client.ts`**

```ts
import { G8Error } from "@graph8/sdk";
import type { CallInput, G8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";

export class FakeG8 implements G8Caller {
  objects = new Map<string, { attrs: Set<string>; unique: Set<string>; records: { id: string; values: Record<string, unknown> }[] }>();
  calls: { op: string; input: CallInput }[] = [];
  handlers = new Map<string, (i: CallInput) => unknown>();
  private seq = 0;

  async callRaw<T>(op: string, input: CallInput = {}): Promise<T> { return this.call<T>(op, input); }
  async call<T>(op: string, input: CallInput = {}): Promise<T> {
    this.calls.push({ op, input });
    const h = this.handlers.get(op);
    if (h) return h(input) as T;
    const slug = String(input.path?.object_slug ?? "");
    const body = (input.body ?? {}) as Record<string, unknown>;
    switch (op) {
      case OPS.listObjects: return [...this.objects.keys()].map((s) => ({ slug: s })) as T;
      case OPS.createObject: this.objects.set(String(body.slug), { attrs: new Set(), unique: new Set(), records: [] }); return {} as T;
      case OPS.listAttributes: return [...(this.objects.get(slug)?.attrs ?? [])].map((s) => ({ slug: s })) as T;
      case OPS.createAttribute: { const o = this.objects.get(slug)!; o.attrs.add(String(body.slug)); if (body.is_unique) o.unique.add(String(body.slug)); return {} as T; }
      case OPS.listRecords: {
        const recs = this.objects.get(slug)?.records ?? [];
        const page = Number(input.query?.page ?? 1), limit = Number(input.query?.limit ?? 200);
        return recs.slice((page - 1) * limit, page * limit) as T;
      }
      case OPS.createRecord: {
        const o = this.objects.get(slug)!, values = (body.values ?? {}) as Record<string, unknown>;
        for (const u of o.unique) if (values[u] !== undefined && o.records.some((r) => r.values[u] === values[u]))
          throw new G8Error({ message: "a record already has this value", status: 409, type: "conflict", code: "duplicate_active_value" });
        const rec = { id: `r${++this.seq}`, values: { ...values } }; o.records.push(rec); return rec as T;
      }
      case OPS.updateRecord: {
        const rec = this.objects.get(slug)!.records.find((r) => r.id === input.path?.record_id)!;
        Object.assign(rec.values, (body.values ?? {}) as Record<string, unknown>); return rec as T;
      }
      default: throw new Error(`FakeG8: no handler for ${op}`);
    }
  }
}
```

- [ ] **Step 3: Write the failing test `advisor/tests/store/records.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { ensureSchema, OBJECTS } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";

describe("store", () => {
  it("creates all five objects and their attributes once", async () => {
    const c = new FakeG8();
    const first = await ensureSchema(c);
    expect(first.createdObjects).toEqual(OBJECTS.map((o) => o.slug));
    expect((await ensureSchema(c)).createdAttributes).toEqual([]);
  });
  it("upserts by ext_id: create, then update, and survives a 409 race", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    const s = new RecordStore(c, "roi_charge");
    expect(await s.upsert({ ext_id: "a", credits: 1 })).toMatchObject({ created: true });
    expect(await s.upsert({ ext_id: "a", credits: 2 })).toMatchObject({ created: false });
    const other = new RecordStore(c, "roi_charge"); // stale index: doesn't know "b"
    await s.upsert({ ext_id: "b", credits: 1 });
    await other.list(); await s.upsert({ ext_id: "c", credits: 1 });
    const stale = new RecordStore(c, "roi_charge");
    (stale as unknown as { index: Map<string, string> | null }).index = new Map();
    expect(await stale.upsert({ ext_id: "b", credits: 9 })).toMatchObject({ created: false });
    const recs = await s.list();
    expect(recs).toHaveLength(3);
    expect(recs.find((r) => r.values.ext_id === "b")?.values.credits).toBe(9);
  });
  it("pages through more than 200 records", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    const s = new RecordStore(c, "roi_outcome");
    for (let i = 0; i < 450; i++) await s.upsert({ ext_id: `o${i}` });
    expect(await new RecordStore(c, "roi_outcome").list()).toHaveLength(450);
  });
});
```

- [ ] **Step 4: Run it and confirm it fails.** Run `npm test -- tests/store`. Expected: FAIL.

- [ ] **Step 5: Implement `advisor/src/lib/store/records.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { isConflict } from "../g8/client";
import { OPS } from "../g8/ops";

export interface StoredRecord { id: string; values: Record<string, unknown> }
const PAGE = 200;

export class RecordStore {
  private index: Map<string, string> | null = null;
  constructor(private c: G8Caller, private slug: string) {}

  async list(): Promise<StoredRecord[]> {
    const all: StoredRecord[] = [];
    for (let page = 1; ; page++) {
      const rows = await this.c.call<StoredRecord[]>(OPS.listRecords, { path: { object_slug: this.slug }, query: { page, limit: PAGE } });
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    this.index = new Map(all.filter((r) => typeof r.values.ext_id === "string").map((r) => [r.values.ext_id as string, r.id]));
    return all;
  }

  async upsert(values: Record<string, unknown>): Promise<{ id: string; created: boolean }> {
    const ext = values.ext_id;
    if (typeof ext !== "string" || !ext) throw new Error(`upsert into ${this.slug} needs a string ext_id`);
    if (!this.index) await this.list();
    const known = this.index!.get(ext);
    if (known) { await this.patch(known, values); return { id: known, created: false }; }
    try {
      const rec = await this.c.call<StoredRecord>(OPS.createRecord, { path: { object_slug: this.slug }, body: { values } });
      this.index!.set(ext, rec.id);
      return { id: rec.id, created: true };
    } catch (e) {
      if (!isConflict(e)) throw e;
      await this.list();
      const id = this.index!.get(ext);
      if (!id) throw e;
      await this.patch(id, values);
      return { id, created: false };
    }
  }

  private async patch(id: string, values: Record<string, unknown>): Promise<void> {
    const { ext_id: _ignored, ...rest } = values;
    await this.c.call(OPS.updateRecord, { path: { object_slug: this.slug, record_id: id }, body: { values: rest } });
  }
}
```

- [ ] **Step 6: Run the store tests.** Run `npm test -- tests/store/records.test.ts`. Expected: PASS (3 tests).

- [ ] **Step 7: Write the failing mapper test `advisor/tests/store/mappers.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { attributeCharges } from "@/lib/domain/attribution";
import { chargeToValues, valuesToCharge, findingToValues, valuesToFinding, runToValues, valuesToRun, ledgerFromCharge } from "@/lib/store/mappers";
import { loadDesignInput } from "../helpers/design-fixture";

const input = loadDesignInput();
const charges = attributeCharges(input);

describe("mappers", () => {
  it("round-trips a charge", () => expect(valuesToCharge(chargeToValues(charges[0]))).toEqual(charges[0]));
  it("round-trips a run with contact IDs", () => {
    const r = input.runs.find((x) => x.contactIds?.length)!;
    expect(valuesToRun(runToValues(r))).toMatchObject({ extId: r.extId, contactIds: r.contactIds, kind: r.kind });
  });
  it("rebuilds the ledger row a charge came from", () => {
    const row = ledgerFromCharge(charges[0]);
    expect(row).toMatchObject({ id: charges[0].ledgerId, type: "usage", amount: -charges[0].credits });
  });
  it("round-trips a finding including JSON evidence", () => {
    const f = { extId: "waste|failed_job|30d", kind: "waste" as const, title: "t", body: "b", evidence: { runs: ["x"] }, creditsAtStake: 77, confidence: "high" as const,
      status: "open" as const, snoozedUntil: null, dismissCount: 0, action: "Refund request", actionPayload: { reason: "failed_job" }, firstSeen: "2026-10-04T00:00:00.000Z",
      lastSeen: "2026-10-04T00:00:00.000Z", lastNotifiedStake: null, inRecap: false, simulated: false };
    expect(valuesToFinding(findingToValues(f))).toEqual(f);
  });
});
```

- [ ] **Step 8: Implement `advisor/src/lib/store/mappers.ts`.** `null` values are written as `null`, and JSON fields are stored as text.

```ts
import type { AttributedCharge, Finding, LedgerRow, Outcome, Run, Stat } from "../domain/types";

type V = Record<string, unknown>;
const s = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const bool = (v: unknown): boolean => v === true || v === "true";
const json = <T>(v: unknown, d: T): T => { if (typeof v !== "string" || !v) return d; try { return JSON.parse(v) as T; } catch { return d; } };

export function chargeToValues(c: AttributedCharge): V {
  return { ext_id: c.ledgerId, simulated: c.simulated, ledger_type: c.ledgerType, service: c.service, credits: c.credits, charged_at: c.chargedAt, llm_tier: c.llmTier,
    tokens_in: c.tokensIn, tokens_out: c.tokensOut, description: c.description, run_ext_id: c.runExtId, method: c.method, contact_id: c.contactId,
    list_id: c.listId, segment_key: c.segmentKey, explanation: c.explanation, result: c.result, is_waste: c.isWaste, waste_reason: c.wasteReason };
}
export function valuesToCharge(v: V): AttributedCharge {
  return { ledgerId: String(v.ext_id), ledgerType: String(v.ledger_type), service: String(v.service), credits: Number(v.credits), chargedAt: String(v.charged_at),
    llmTier: s(v.llm_tier), tokensIn: num(v.tokens_in), tokensOut: num(v.tokens_out), description: s(v.description), method: v.method as AttributedCharge["method"],
    runExtId: s(v.run_ext_id), listId: num(v.list_id), contactId: num(v.contact_id), segmentKey: s(v.segment_key), explanation: String(v.explanation ?? ""),
    result: v.result as AttributedCharge["result"], isWaste: bool(v.is_waste), wasteReason: (s(v.waste_reason) as AttributedCharge["wasteReason"]), simulated: bool(v.simulated) };
}
export function ledgerFromCharge(c: AttributedCharge): LedgerRow {
  return { id: c.ledgerId, type: c.ledgerType, amount: -c.credits, service: c.service, quantity: null, llm_tier: c.llmTier, description: c.description, created_at: c.chargedAt };
}

export function runToValues(r: Run): V {
  return { ext_id: r.extId, simulated: r.simulated ?? false, kind: r.kind, service: r.service ?? null, action_name: r.actionName, started_at: r.startedAt, completed_at: r.completedAt,
    status: r.status, source: r.source, tokens_in: r.tokensIn ?? null, tokens_out: r.tokensOut ?? null, list_id: r.listId ?? null,
    contact_ids: JSON.stringify(r.contactIds ?? []), contact_label: r.contactLabel ?? null, company_name: r.companyName ?? null, records_ok: r.recordsOk ?? null,
    records_failed: r.recordsFailed ?? null, records_skipped: r.recordsSkipped ?? null, quoted_credits: r.quotedCredits ?? null,
    reported_credits: r.reportedCredits ?? null, result_hint: r.resultHint ?? null };
}
export function valuesToRun(v: V): Run {
  return { extId: String(v.ext_id), kind: v.kind as Run["kind"], service: s(v.service), actionName: String(v.action_name ?? ""), startedAt: s(v.started_at),
    completedAt: s(v.completed_at), status: String(v.status ?? ""), source: v.source as Run["source"], tokensIn: num(v.tokens_in), tokensOut: num(v.tokens_out),
    listId: num(v.list_id), contactIds: json<number[]>(v.contact_ids, []), contactLabel: s(v.contact_label), companyName: s(v.company_name),
    recordsOk: num(v.records_ok), recordsFailed: num(v.records_failed), recordsSkipped: num(v.records_skipped), quotedCredits: num(v.quoted_credits),
    reportedCredits: num(v.reported_credits), resultHint: (s(v.result_hint) as Run["resultHint"]), simulated: bool(v.simulated) };
}

export function outcomeToValues(o: Outcome): V {
  return { ext_id: o.extId, simulated: o.simulated, type: o.type, occurred_at: o.occurredAt, contact_id: o.contactId, company_id: o.companyId, deal_id: o.dealId,
    amount: o.amount, list_id: o.listId, sequence_id: o.sequenceId, step: o.step, channel: o.channel, segment_key: o.segmentKey, source: o.source };
}
export function valuesToOutcome(v: V): Outcome {
  return { extId: String(v.ext_id), type: v.type as Outcome["type"], occurredAt: String(v.occurred_at), contactId: num(v.contact_id), companyId: num(v.company_id),
    dealId: s(v.deal_id), amount: num(v.amount), listId: num(v.list_id), sequenceId: s(v.sequence_id), step: num(v.step), channel: s(v.channel),
    segmentKey: s(v.segment_key), source: v.source as Outcome["source"], simulated: bool(v.simulated) };
}

export function statToValues(x: Stat): V {
  return { ext_id: `${x.period}|${x.dimension}|${x.value}`, simulated: x.simulated, period: x.period, dimension: x.dimension, value: x.value, credits: x.credits,
    credits_exact: x.creditsExact, meetings: x.meetings, deals: x.deals, won_value: x.wonValue, contacts_reached: x.contactsReached,
    cost_per_meeting: x.costPerMeeting, cost_per_deal: x.costPerDeal, vs_avg_pct: x.vsAvgPct, evidence_n: x.evidenceN, confidence: x.confidence, computed_at: x.computedAt };
}
export function valuesToStat(v: V): Stat {
  return { period: String(v.period), dimension: v.dimension as Stat["dimension"], value: String(v.value), credits: Number(v.credits), creditsExact: Number(v.credits_exact),
    meetings: Number(v.meetings), deals: Number(v.deals), wonValue: Number(v.won_value), contactsReached: Number(v.contacts_reached),
    costPerMeeting: num(v.cost_per_meeting), costPerDeal: num(v.cost_per_deal), vsAvgPct: num(v.vs_avg_pct), evidenceN: Number(v.evidence_n),
    confidence: v.confidence as Stat["confidence"], simulated: bool(v.simulated), computedAt: String(v.computed_at) };
}

export function findingToValues(f: Finding): V {
  return { ext_id: f.extId, simulated: f.simulated, kind: f.kind, title: f.title, body: f.body, evidence: JSON.stringify(f.evidence), credits_at_stake: f.creditsAtStake,
    confidence: f.confidence, status: f.status, snoozed_until: f.snoozedUntil, dismiss_count: f.dismissCount, action: f.action,
    action_payload: f.actionPayload ? JSON.stringify(f.actionPayload) : null, first_seen: f.firstSeen, last_seen: f.lastSeen,
    last_notified_stake: f.lastNotifiedStake, in_recap: f.inRecap };
}
export function valuesToFinding(v: V): Finding {
  return { extId: String(v.ext_id), kind: v.kind as Finding["kind"], title: String(v.title), body: String(v.body), evidence: json(v.evidence, {}),
    creditsAtStake: Number(v.credits_at_stake), confidence: v.confidence as Finding["confidence"], status: v.status as Finding["status"],
    snoozedUntil: s(v.snoozed_until), dismissCount: Number(v.dismiss_count ?? 0), action: s(v.action), actionPayload: json(v.action_payload, null),
    firstSeen: String(v.first_seen), lastSeen: String(v.last_seen), lastNotifiedStake: num(v.last_notified_stake), inRecap: bool(v.in_recap), simulated: bool(v.simulated) };
}
```

- [ ] **Step 9: Run the store tests.** Run `npm test -- tests/store`. Expected: PASS (7 tests).

- [ ] **Step 10: Create `advisor/scripts/bootstrap.ts`.** It archives the design probe object, creates the schema, and creates the two new contact fields if they're missing.

```ts
import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { ensureSchema } from "../src/lib/store/schema";

const objects = await g8Caller.call<{ slug: string }[]>(OPS.listObjects);
if (objects.some((o) => o.slug === "roi_probe") && process.argv.includes("--archive-probe")) {
  await g8Caller.call(OPS.archiveObject, { path: { object_slug: "roi_probe" } });
  console.log("archived roi_probe");
}
console.log(JSON.stringify(await ensureSchema(g8Caller)));
const fields = await g8Caller.call<{ id: number; title: string; name: string }[]>(OPS.listFields);
for (const title of ["roi_fit_reason", "record_consistency"]) {
  const f = fields.find((x) => x.title === title);
  if (f) { console.log(`field ${title} exists: ${f.id} ${f.name}`); continue; }
  const created = await g8Caller.call<{ id: number; name: string }>(OPS.createField, { body: { title, entity: "contacts", data_type: "text" } });
  console.log(`created field ${title}: ${created.id} ${created.name}`);
}
```

- [ ] **Step 11: Ask the user, then run the bootstrap live.** Ask: "May I archive the `roi_probe` test object from design and create the five `roi_*` objects and two contact fields in your org?" After yes:

```bash
cd /home/opc/graph8/advisor && npm run script -- scripts/bootstrap.ts --archive-probe
```
Expected: JSON listing the 5 created objects and their attributes, then two "created field" lines. Add the printed field IDs and names to `.env.local` as `ROI_FIT_REASON_COLUMN_ID`, `RECORD_CONSISTENCY_COLUMN_ID` and `RECORD_CONSISTENCY_FORMULA_NAME`. Run it a second time and confirm it creates nothing new.

- [ ] **Step 12: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): custom-object schema, idempotent record store, mappers, bootstrap"
```

---

### Task 12: Collectors (ledger, runs, contacts, outcomes, webhook handling)

**Files:**
- Create: `advisor/src/lib/sync/ledger.ts`, `advisor/src/lib/sync/capture.ts`, `advisor/src/lib/sync/contacts.ts`, `advisor/src/lib/sync/outcomes.ts`, `advisor/src/lib/sync/handle-event.ts`
- Modify: `advisor/src/app/api/webhooks/graph8/route.ts` (call `handleEvent`)
- Test: `advisor/tests/sync/ledger.test.ts`, `advisor/tests/sync/outcomes.test.ts`, `advisor/tests/sync/handle-event.test.ts`

**Interfaces:**
- Consumes: `G8Caller`/`OPS` (Task 2), `RecordStore` and mappers (Task 11), `runFromExecution` (Task 6), `segmentKey`/`recordConsistency` (Task 7), `WebhookEnvelope` (Task 3).
- Produces:
  - `fetchLedgerSince(c: G8Caller, known: Set<string>): Promise<LedgerRow[]>`
  - `fetchExecutionRun(c, executionId: string, actionNames: Record<string, string>): Promise<Run | null>`
  - `pollPipelineRuns(c, listIds: number[]): Promise<Run[]>`
  - `fetchOnboardingAnchors(c): Promise<{ firstStudioDocCreatedAt: string; lastResearchReportUpdatedAt: string; landingPageCreatedAt: string | null } | null>`
  - `fetchUnusedDocs(c): Promise<{ name: string; createdAt: string }[]>`
  - `loadContactInfo(c, row: { id: number; first_name: string | null; last_name: string | null }): Promise<ContactInfo>`
  - `loadContactIndex(c): Promise<Map<number, ContactInfo>>`
  - `pollDealOutcomes(c, contacts: Map<number, ContactInfo>): Promise<Outcome[]>`
  - `outcomeFromEvent(e: WebhookEnvelope, contacts?: Map<number, ContactInfo>): Outcome | null`
  - `handleEvent(e: WebhookEnvelope, deps: { c: G8Caller; outcomes: RecordStore; runs: RecordStore }): Promise<"outcome" | "run" | "ignored">`

- [ ] **Step 1: Write the failing ledger-sync test `advisor/tests/sync/ledger.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { fetchLedgerSince } from "@/lib/sync/ledger";
import { loadFixture } from "../fixtures";
import type { LedgerRow } from "@/lib/domain/types";

const ledger = loadFixture<LedgerRow[]>("ledger/ledger-2026-09-26.json");
const newestFirst = [...ledger].reverse();
function fake() {
  const c = new FakeG8();
  c.handlers.set(OPS.listUsageTransactions, (i) => { const p = Number(i.query?.page), l = Number(i.query?.limit); return newestFirst.slice((p - 1) * l, p * l); });
  return c;
}

describe("fetchLedgerSince", () => {
  it("pulls all 144 rows on first sync", async () => expect(await fetchLedgerSince(fake(), new Set())).toHaveLength(144));
  it("stops at the first known row and returns only newer ones", async () => {
    const known = new Set(ledger.slice(0, 140).map((r) => r.id));
    const c = fake();
    const rows = await fetchLedgerSince(c, known);
    expect(rows.map((r) => r.id)).toEqual(newestFirst.slice(0, 4).map((r) => r.id));
    expect(c.calls.filter((x) => x.op === OPS.listUsageTransactions)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement `advisor/src/lib/sync/ledger.ts`.** The ledger is ordered newest-first (observed).

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { LedgerRow } from "../domain/types";

export async function fetchLedgerSince(c: G8Caller, known: Set<string>): Promise<LedgerRow[]> {
  const out: LedgerRow[] = [];
  for (let page = 1; page < 500; page++) {
    const rows = await c.call<LedgerRow[]>(OPS.listUsageTransactions, { query: { page, limit: 100 } });
    for (const r of rows) { if (known.has(r.id)) return out; out.push(r); }
    if (rows.length < 100) return out;
  }
  return out;
}
```

- [ ] **Step 3: Run the test.** Run `npm test -- tests/sync/ledger.test.ts`. Expected: PASS (2 tests).

- [ ] **Step 4: Implement `advisor/src/lib/sync/capture.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { isNotFound } from "../g8/client";
import { OPS } from "../g8/ops";
import type { Run } from "../domain/types";
import { runFromExecution, type ExecutionRecord } from "../domain/runs";
import { toIso, toMs } from "../domain/time";

export async function fetchExecutionRun(c: G8Caller, executionId: string, actionNames: Record<string, string>): Promise<Run | null> {
  try { return runFromExecution(await c.callRaw<ExecutionRecord>(OPS.getExecution, { path: { execution_id: executionId } }), actionNames); }
  catch (e) { if (isNotFound(e)) return null; throw e; }
}

interface PipelineItem { id: string; name: string; last_run?: { run_id: string } | null }
interface PipelineRun { run_id: string; list_id: number; status: string; started_at?: string | null; pipeline_name?: string;
  step_progress?: { total_records?: number; processed_records?: number; successful?: number; failed?: number; skipped_by_reason?: Record<string, number> }[] }

export async function pollPipelineRuns(c: G8Caller, listIds: number[]): Promise<Run[]> {
  const runs: Run[] = [];
  for (const listId of listIds) {
    const res = await c.call<{ items: PipelineItem[] }>(OPS.listListPipelines, { path: { list_id: listId } });
    for (const p of res.items ?? []) {
      if (!p.last_run?.run_id) continue;
      const r = await c.call<PipelineRun>(OPS.getPipelineRun, { path: { run_id: p.last_run.run_id } });
      const prog = r.step_progress ?? [];
      const skipped = prog.reduce((s, x) => s + Object.values(x.skipped_by_reason ?? {}).reduce((a, b) => a + b, 0), 0);
      const started = r.started_at ?? null;
      runs.push({ extId: r.run_id, kind: "pipeline_run", service: "waterfall_enrichment", actionName: `List pipeline · ${p.name}`, startedAt: started,
        completedAt: r.status === "completed" && started ? toIso(toMs(started) + 180_000) : null, status: r.status, source: "poll", listId: r.list_id,
        recordsOk: prog.reduce((s, x) => s + (x.successful ?? 0), 0), recordsFailed: prog.reduce((s, x) => s + (x.failed ?? 0), 0), recordsSkipped: skipped });
    }
  }
  return runs;
}

export async function fetchOnboardingAnchors(c: G8Caller) {
  const docs = (await c.call<{ items: { created_at: string }[] }>(OPS.documentsAnalytics)).items ?? [];
  const reports = await c.call<{ updated_at: string }[]>(OPS.listResearchReports);
  const pages = (await c.call<{ items: { created_at: string }[] }>(OPS.listLandingPages)).items ?? [];
  if (!docs.length || !reports.length) return null;
  const asc = (xs: string[]) => [...xs].sort((a, b) => toMs(a) - toMs(b));
  return {
    firstStudioDocCreatedAt: asc(docs.map((d) => d.created_at))[0],
    lastResearchReportUpdatedAt: asc(reports.map((r) => r.updated_at)).at(-1)!,
    landingPageCreatedAt: pages.length ? asc(pages.map((p) => p.created_at))[0] : null,
  };
}

export async function fetchUnusedDocs(c: G8Caller): Promise<{ name: string; createdAt: string }[]> {
  const docs = (await c.call<{ items: { display_name: string; created_at: string; usage_count: number }[] }>(OPS.documentsAnalytics)).items ?? [];
  return docs.filter((d) => (d.usage_count ?? 0) === 0).map((d) => ({ name: d.display_name, createdAt: d.created_at }));
}
```

- [ ] **Step 5: Typecheck.** Run `npm run typecheck`. Expected: no errors.

- [ ] **Step 6: Implement `advisor/src/lib/sync/contacts.ts`.** Row IDs are used throughout.

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { ContactInfo } from "../domain/types";
import { recordConsistency, segmentKey } from "../domain/segments";

export interface ContactRow { id: number; first_name: string | null; last_name: string | null }
interface ContactDetail { work_email: string | null; job_title: string | null; seniority_level: string | null; job_department: string | null;
  company?: { name: string | null; domain: string | null; industry: string | null; employee_count: string | null } | null }

export async function loadContactInfo(c: G8Caller, row: ContactRow): Promise<ContactInfo> {
  const d = await c.call<ContactDetail>(OPS.getContact, { path: { contact_id: row.id } });
  const lists = await c.call<{ items: { audience_id: number }[] }>(OPS.getContactLists, { path: { contact_id: row.id } });
  const seqs = await c.call<{ items: { sequence_id?: string; id?: string }[] }>(OPS.getContactSequences, { path: { contact_id: row.id } });
  return {
    contactId: row.id, name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(), email: d.work_email, companyName: d.company?.name ?? null,
    companyDomain: d.company?.domain ?? null, listIds: (lists.items ?? []).map((l) => l.audience_id),
    sequenceIds: (seqs.items ?? []).map((q) => String(q.sequence_id ?? q.id)).filter((x) => x !== "undefined"),
    segmentKey: segmentKey({ seniority: d.seniority_level, department: d.job_department, industry: d.company?.industry, employeeCount: d.company?.employee_count }),
    consistency: recordConsistency(d.work_email, d.company?.domain ?? null),
  };
}

export async function loadContactIndex(c: G8Caller): Promise<Map<number, ContactInfo>> {
  const rows: ContactRow[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<ContactRow[]>(OPS.listContacts, { query: { page, limit: 200 } });
    rows.push(...r);
    if (r.length < 200) break;
  }
  const index = new Map<number, ContactInfo>();
  for (const row of rows) index.set(row.id, await loadContactInfo(c, row));
  return index;
}
```

- [ ] **Step 7: Write the failing outcome test `advisor/tests/sync/outcomes.test.ts`** (uses the real deal history fixtures)

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { pollDealOutcomes, outcomeFromEvent } from "@/lib/sync/outcomes";
import { loadFixture } from "../fixtures";

const won = loadFixture<{ data: Record<string, unknown> }>("graph8/deal_won.json").data;
const wonHist = loadFixture<{ data: { items: unknown[] } }>("graph8/deal_history_won.json").data;
const lostHist = loadFixture<{ data: { items: unknown[] } }>("graph8/deal_history_lost.json").data;
const stages = [{ id: "p", stages: [{ name: "Closed Won", stage_type: "won" }, { name: "Closed Lost", stage_type: "lost" }, { name: "New Meeting", stage_type: "open" }] }];

describe("pollDealOutcomes", () => {
  it("turns deal history into created / stage-changed / won / lost outcomes", async () => {
    const c = new FakeG8();
    const lost = { ...won, id: "9ff5c6ee-10ea-455e-966f-3a831765500a", name: "[sim] seed probe - PayLease", amount: 8000, primary_contact: { id: 77 } };
    c.handlers.set(OPS.listDealPipelines, () => stages);
    c.handlers.set(OPS.listDeals, (i) => (Number(i.query?.page) === 1 ? [won, lost] : []));
    c.handlers.set(OPS.listDealHistory, (i) => (i.path?.deal_id === won.id ? wonHist : lostHist));
    const out = await pollDealOutcomes(c, new Map());
    const types = out.map((o) => o.type).sort();
    // won deal: created + 1 stage move + won; lost deal (real history has 3 moves): created + 3 stage moves + lost
    expect(types).toEqual(["deal_created", "deal_created", "deal_lost", "deal_stage_changed", "deal_stage_changed", "deal_stage_changed", "deal_stage_changed", "deal_won"].sort());
    expect(out.find((o) => o.type === "deal_won")).toMatchObject({ amount: 12000, contactId: 81, simulated: true, source: "poll" });
  });
});

describe("outcomeFromEvent", () => {
  it("maps a meeting.booked envelope and keeps the envelope id", () => {
    const o = outcomeFromEvent({ id: "evt_9", event: "meeting.booked", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: { contact_id: 81, simulated: true } });
    expect(o).toMatchObject({ extId: "evt_9", type: "meeting_booked", contactId: 81, simulated: true, source: "sim" });
  });
  it("ignores events that aren't outcomes", () =>
    expect(outcomeFromEvent({ id: "e", event: "task.created", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: {} })).toBeNull());
});
```

- [ ] **Step 8: Implement `advisor/src/lib/sync/outcomes.ts`.** The data keys read in `outcomeFromEvent` must match the payloads captured in Task 3, Step 12. If the captured keys differ (for example `data.contact.id` instead of `data.contact_id`), extend `pick` to read them and add a test using the captured payload.

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { ContactInfo, Outcome, OutcomeType } from "../domain/types";
import type { WebhookEnvelope } from "../webhooks/verify";

interface Deal { id: string; name: string; amount: number | null; created_at: string; close_date: string | null; primary_contact?: { id: number } | null; company_id?: number | null }
interface HistoryItem { id: string; changed_at: string; change_type: string; from_value: string; to_value: string }

export async function pollDealOutcomes(c: G8Caller, contacts: Map<number, ContactInfo>): Promise<Outcome[]> {
  const pipelines = await c.call<{ stages: { name: string; stage_type: string }[] }[]>(OPS.listDealPipelines);
  const stageType = new Map(pipelines.flatMap((p) => p.stages.map((s) => [s.name, s.stage_type] as const)));
  const deals: Deal[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<Deal[]>(OPS.listDeals, { query: { page, limit: 100 } });
    deals.push(...r);
    if (r.length < 100) break;
  }
  const out: Outcome[] = [];
  for (const d of deals) {
    const contactId = d.primary_contact?.id ?? null;
    const simulated = d.name.startsWith("[sim]");
    const base = { companyId: d.company_id ?? null, dealId: d.id, listId: null, sequenceId: null, step: null, channel: null,
      segmentKey: contactId !== null ? contacts.get(contactId)?.segmentKey ?? null : null, source: "poll" as const, simulated, contactId };
    out.push({ ...base, extId: `deal:${d.id}:created`, type: "deal_created", occurredAt: d.created_at, amount: d.amount });
    const hist = await c.call<{ items: HistoryItem[] }>(OPS.listDealHistory, { path: { deal_id: d.id } });
    for (const h of (hist.items ?? []).filter((x) => x.change_type === "stage")) {
      out.push({ ...base, extId: `deal:${d.id}:${h.id}`, type: "deal_stage_changed", occurredAt: h.changed_at, amount: d.amount });
      const t = stageType.get(h.to_value);
      if (t === "won" || t === "lost") {
        const when = d.close_date ? `${d.close_date}T12:00:00Z` : h.changed_at;
        out.push({ ...base, extId: `deal:${d.id}:${t}`, type: t === "won" ? "deal_won" : "deal_lost", occurredAt: when, amount: d.amount });
      }
    }
  }
  return out;
}

const EVENT_TYPES: Record<string, OutcomeType> = {
  "engagement.email_sent": "email_sent", "engagement.email_replied": "email_replied", "engagement.email_bounced": "email_bounced",
  "meeting.booked": "meeting_booked", "meeting.no_show": "meeting_no_show",
};

function pick(d: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = k.split(".").reduce<unknown>((o, p) => (o && typeof o === "object" ? (o as Record<string, unknown>)[p] : undefined), d);
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

export function outcomeFromEvent(e: WebhookEnvelope, contacts?: Map<number, ContactInfo>): Outcome | null {
  const type = EVENT_TYPES[e.event];
  if (!type) return null;
  const d = e.data ?? {};
  const contactId = Number(pick(d, "contact_id", "contact.id")) || null;
  const simulated = pick(d, "simulated") === true;
  return {
    extId: e.id ?? `${e.event}:${e.timestamp}:${contactId}`, type, occurredAt: String(pick(d, "occurred_at") ?? e.timestamp), contactId,
    companyId: Number(pick(d, "company_id", "company.id")) || null, dealId: (pick(d, "deal_id") as string | null) ?? null,
    amount: Number(pick(d, "amount")) || null, listId: Number(pick(d, "list_id", "audience_id")) || null,
    sequenceId: (pick(d, "sequence_id", "sequence.id") as string | null) ?? null, step: Number(pick(d, "step", "step_order")) || null,
    channel: (pick(d, "channel") as string | null) ?? (type.startsWith("email") ? "email" : null),
    segmentKey: contactId !== null ? contacts?.get(contactId)?.segmentKey ?? null : null, source: simulated ? "sim" : "webhook", simulated,
  };
}
```

- [ ] **Step 9: Write the failing test `advisor/tests/sync/handle-event.test.ts`** (dedupe is Review Focus #2)

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { handleEvent } from "@/lib/sync/handle-event";

describe("handleEvent", () => {
  it("stores an outcome once even when the same delivery arrives three times", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    const deps = { c, outcomes: new RecordStore(c, "roi_outcome"), runs: new RecordStore(c, "roi_run") };
    const e = { id: "evt_1", event: "meeting.booked", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: { contact_id: 81 } };
    for (let i = 0; i < 3; i++) expect(await handleEvent(e, deps)).toBe("outcome");
    expect(await deps.outcomes.list()).toHaveLength(1);
  });
  it("records a workflow run from workflow.execution_completed", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    c.handlers.set("get_execution_workflows_executions__execution_id__get", () => ({ execution_id: "x1", action_id: "a", status: "completed", tokens_input: 10, tokens_output: 20, completed_at: "2026-09-26T10:00:00Z" }));
    const deps = { c, outcomes: new RecordStore(c, "roi_outcome"), runs: new RecordStore(c, "roi_run") };
    expect(await handleEvent({ id: "e2", event: "workflow.execution_completed", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: { execution_id: "x1" } }, deps)).toBe("run");
    expect((await deps.runs.list())[0].values.ext_id).toBe("x1");
  });
});
```

- [ ] **Step 10: Implement `advisor/src/lib/sync/handle-event.ts`**

```ts
import type { G8Caller } from "../g8/client";
import type { RecordStore } from "../store/records";
import { outcomeToValues, runToValues } from "../store/mappers";
import type { WebhookEnvelope } from "../webhooks/verify";
import { outcomeFromEvent } from "./outcomes";
import { fetchExecutionRun } from "./capture";

export async function handleEvent(e: WebhookEnvelope, deps: { c: G8Caller; outcomes: RecordStore; runs: RecordStore }): Promise<"outcome" | "run" | "ignored"> {
  const o = outcomeFromEvent(e);
  if (o) { await deps.outcomes.upsert(outcomeToValues(o)); return "outcome"; }
  if (e.event === "workflow.execution_completed" || e.event === "workflow.execution_failed") {
    const id = String((e.data ?? {}).execution_id ?? "");
    if (!id) return "ignored";
    const run = await fetchExecutionRun(deps.c, id, {});
    if (run) { await deps.runs.upsert(runToValues(run)); return "run"; }
  }
  return "ignored";
}
```

- [ ] **Step 11: Wire the webhook route.** In `advisor/src/app/api/webhooks/graph8/route.ts`, replace the `after(...)` callback body with:

```ts
  after(async () => {
    const { g8Caller } = await import("@/lib/g8/client");
    const { RecordStore } = await import("@/lib/store/records");
    const { handleEvent } = await import("@/lib/sync/handle-event");
    const result = await handleEvent(v.event, { c: g8Caller, outcomes: new RecordStore(g8Caller, "roi_outcome"), runs: new RecordStore(g8Caller, "roi_run") });
    console.log("graph8 webhook", v.event.event, result);
  });
```

- [ ] **Step 12: Run all tests.** Run `npm test`. Expected: PASS.

- [ ] **Step 13: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): collectors for ledger, runs, contacts, deal outcomes and webhook events"
```

---

### Task 13: Sync orchestration, cron, and importing the design-day runs

**Files:**
- Create: `advisor/src/lib/sync/run-sync.ts`, `advisor/src/app/api/cron/poll/route.ts`, `advisor/scripts/import-design-runs.ts`, `advisor/scripts/sync-once.ts`
- Test: `advisor/tests/sync/run-sync.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5–12.
- Produces:
  - `runSync(deps: { c: G8Caller; now?: string; contacts?: Map<number, ContactInfo> }): Promise<SyncSummary>`, where `interface SyncSummary { skipped?: "locked"; newLedgerRows: number; charges: number; coverage: { exact: number; window: number; none: number; total: number }; findings: number }`
  - `GET /api/cron/poll` (requires `Authorization: Bearer ${CRON_SECRET}`)

- [ ] **Step 1: Write the failing test `advisor/tests/sync/run-sync.test.ts`.** It runs the whole pipeline against a fake graph8 that serves the real ledger, with the design runs pre-imported, and must reproduce the design numbers.

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { runToValues } from "@/lib/store/mappers";
import { runSync } from "@/lib/sync/run-sync";
import { loadDesignInput } from "../helpers/design-fixture";
import { loadFixture } from "../fixtures";

describe("runSync", () => {
  it("reproduces the design-day coverage and waste end to end", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    const input = loadDesignInput();
    const runs = new RecordStore(c, "roi_run");
    for (const r of input.runs) await runs.upsert(runToValues(r));
    for (const p of input.advisorPosts) await runs.upsert(runToValues({ extId: `post:${p}`, kind: "advisor_post", actionName: "Recap post", startedAt: p, completedAt: p, status: "completed", source: "advisor" }));
    const newestFirst = [...input.ledger].reverse();
    c.handlers.set(OPS.listUsageTransactions, (i) => newestFirst.slice((Number(i.query?.page) - 1) * 100, Number(i.query?.page) * 100));
    c.handlers.set(OPS.listLists, () => []);
    c.handlers.set(OPS.documentsAnalytics, () => loadFixture<{ data: unknown }>("graph8/studio_documents_analytics.json").data);
    c.handlers.set(OPS.listResearchReports, () => loadFixture<{ data: unknown }>("graph8/research_reports.json").data);
    c.handlers.set(OPS.listLandingPages, () => loadFixture<{ data: unknown }>("graph8/landing_pages.json").data);
    c.handlers.set(OPS.listDealPipelines, () => []);
    c.handlers.set(OPS.listDeals, () => []);
    const summary = await runSync({ c, now: "2026-10-04T00:00:00Z", contacts: new Map() });
    expect(summary.coverage).toEqual({ exact: 216, window: 1033, none: 11, total: 1260 });
    expect(summary.charges).toBe(126);
    const findings = await new RecordStore(c, "roi_finding").list();
    expect(findings.map((f) => f.values.kind)).toEqual(expect.arrayContaining(["waste", "side_effect", "fix", "unused"]));
    const again = await runSync({ c, now: "2026-10-04T00:10:00Z", contacts: new Map() });
    expect(again.newLedgerRows).toBe(0);
  });
});
```

- [ ] **Step 2: Implement `advisor/src/lib/sync/run-sync.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { ContactInfo, Run } from "../domain/types";
import { attributeCharges, coverage } from "../domain/attribution";
import { onboardingWindow } from "../domain/runs";
import { computeStats } from "../domain/metrics";
import { generateFindings, mergeFindings } from "../domain/findings";
import { toIso, toMs } from "../domain/time";
import { RecordStore } from "../store/records";
import { chargeToValues, findingToValues, ledgerFromCharge, outcomeToValues, runToValues, statToValues, valuesToCharge, valuesToFinding, valuesToOutcome, valuesToRun } from "../store/mappers";
import { fetchLedgerSince } from "./ledger";
import { fetchOnboardingAnchors, fetchUnusedDocs, pollPipelineRuns } from "./capture";
import { loadContactIndex } from "./contacts";
import { pollDealOutcomes } from "./outcomes";

export interface SyncSummary { skipped?: "locked"; newLedgerRows: number; charges: number; coverage: { exact: number; window: number; none: number; total: number }; findings: number }
const LOCK_MS = 4 * 60_000;

export async function runSync(deps: { c: G8Caller; now?: string; contacts?: Map<number, ContactInfo> }): Promise<SyncSummary> {
  const now = deps.now ?? toIso(Date.now());
  const s = { charges: new RecordStore(deps.c, "roi_charge"), runs: new RecordStore(deps.c, "roi_run"), outcomes: new RecordStore(deps.c, "roi_outcome"),
    stats: new RecordStore(deps.c, "roi_stat"), findings: new RecordStore(deps.c, "roi_finding") };

  const runRecs = (await s.runs.list()).map((r) => valuesToRun(r.values));
  const lock = runRecs.find((r) => r.extId === "sync-lock");
  if (lock?.startedAt && lock.status === "running" && toMs(now) - toMs(lock.startedAt) < LOCK_MS)
    return { skipped: "locked", newLedgerRows: 0, charges: 0, coverage: { exact: 0, window: 0, none: 0, total: 0 }, findings: 0 };
  await s.runs.upsert(runToValues({ extId: "sync-lock", kind: "sync_lock", actionName: "sync", startedAt: now, completedAt: null, status: "running", source: "advisor" }));
  try {
    const existingCharges = (await s.charges.list()).map((r) => valuesToCharge(r.values));
    const fresh = await fetchLedgerSince(deps.c, new Set(existingCharges.map((x) => x.ledgerId)));
    const ledger = [...existingCharges.filter((x) => !x.simulated).map(ledgerFromCharge), ...fresh];

    const lists = await deps.c.call<{ id: number }[]>(OPS.listLists);
    const pipelineRuns = await pollPipelineRuns(deps.c, lists.map((l) => l.id));
    for (const r of pipelineRuns) await s.runs.upsert(runToValues(r));
    const runs: Run[] = [...runRecs.filter((r) => r.kind !== "sync_lock" && !pipelineRuns.some((p) => p.extId === r.extId)), ...pipelineRuns];

    const anchors = await fetchOnboardingAnchors(deps.c);
    const windows = anchors ? [onboardingWindow(anchors)] : [];
    const advisorPosts = runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!);
    const contacts = deps.contacts ?? (await loadContactIndex(deps.c));
    const real = attributeCharges({ ledger, runs, windows, advisorPosts }).map((ch) => ({ ...ch, segmentKey: ch.contactId !== null ? contacts.get(ch.contactId)?.segmentKey ?? null : null }));
    const simCharges = existingCharges.filter((x) => x.simulated);
    for (const ch of real) await s.charges.upsert(chargeToValues(ch));
    const charges = [...real, ...simCharges];

    for (const o of await pollDealOutcomes(deps.c, contacts)) await s.outcomes.upsert(outcomeToValues(o));
    const outcomes = (await s.outcomes.list()).map((r) => valuesToOutcome(r.values));

    const to = toMs(now), from = to - 30 * 86_400_000;
    const base = { charges, outcomes, contacts, period: "30d", from, to, now };
    const byList = computeStats({ ...base, dimension: "list" });
    const bySegment = computeStats({ ...base, dimension: "segment" });
    const byService = computeStats({ ...base, dimension: "service" });
    for (const st of [...byList, ...bySegment.slice(1), ...byService.slice(1)]) await s.stats.upsert(statToValues(st));

    const onboardingCredits = real.filter((ch) => ch.method === "time_window" && ch.service === "studio_global").reduce((a, ch) => a + ch.credits, 0);
    const fresh2 = generateFindings({ now, period: "30d", statsByList: byList, statsBySegment: bySegment, charges, runs, outcomes,
      unusedDocs: await fetchUnusedDocs(deps.c), onboardingCredits });
    const existingFindings = (await s.findings.list()).map((r) => valuesToFinding(r.values));
    const merged = mergeFindings(fresh2, existingFindings);
    for (const f of merged) await s.findings.upsert(findingToValues(f));

    return { newLedgerRows: fresh.length, charges: real.length, coverage: coverage(real), findings: merged.length };
  } finally {
    await s.runs.upsert(runToValues({ extId: "sync-lock", kind: "sync_lock", actionName: "sync", startedAt: now, completedAt: toIso(Date.now()), status: "done", source: "advisor" }));
  }
}
```

- [ ] **Step 3: Run the test.** Run `npm test -- tests/sync/run-sync.test.ts`. Expected: PASS. If the coverage differs, check that the `advisor_post` runs were imported and that `onboardingWindow` received all three anchors.

- [ ] **Step 4: Create the cron route `advisor/src/app/api/cron/poll/route.ts`**

```ts
import { g8Caller } from "@/lib/g8/client";
import { runSync } from "@/lib/sync/run-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  const summary = await runSync({ c: g8Caller });
  return Response.json(summary);
}
```

- [ ] **Step 5: Create `advisor/scripts/import-design-runs.ts`.** It writes the design-day runs (the fixture execution records plus `advisor-runs-2026-09-26.json`) into `roi_run`, so the live dashboard reproduces the real design-day numbers.

```ts
import fs from "node:fs";
import path from "node:path";
import { g8Caller } from "../src/lib/g8/client";
import { RecordStore } from "../src/lib/store/records";
import { runToValues } from "../src/lib/store/mappers";
import { runFromExecution, type ExecutionRecord } from "../src/lib/domain/runs";
import type { Run } from "../src/lib/domain/types";

const dir = path.resolve(process.cwd(), "../research/fixtures");
const a = JSON.parse(fs.readFileSync(path.join(dir, "advisor-runs-2026-09-26.json"), "utf8")) as { runs: Run[]; advisorPosts: string[]; actionNames: Record<string, string> };
const execs = fs.readdirSync(path.join(dir, "executions")).filter((f) => f.endsWith(".json"))
  .map((f) => runFromExecution(JSON.parse(fs.readFileSync(path.join(dir, "executions", f), "utf8")) as ExecutionRecord, a.actionNames))
  .filter((r): r is Run => r !== null);
const store = new RecordStore(g8Caller, "roi_run");
for (const r of [...execs, ...a.runs]) await store.upsert(runToValues(r));
for (const p of a.advisorPosts) await store.upsert(runToValues({ extId: `post:${p}`, kind: "advisor_post", actionName: "Recap post", startedAt: p, completedAt: p, status: "completed", source: "advisor" }));
console.log(`imported ${execs.length + a.runs.length} runs and ${a.advisorPosts.length} posts`);
```

- [ ] **Step 6: Create `advisor/scripts/sync-once.ts`**

```ts
import { g8Caller } from "../src/lib/g8/client";
import { runSync } from "../src/lib/sync/run-sync";
console.log(JSON.stringify(await runSync({ c: g8Caller }), null, 2));
```

- [ ] **Step 7: Run both against the live org** (reads plus writes to `roi_*` only; free)

```bash
cd /home/opc/graph8/advisor
npm run script -- scripts/import-design-runs.ts
npm run script -- scripts/sync-once.ts
```
Expected: `coverage.exact` is at least 216 and `coverage.total` is at least 1,260 (spend since design adds to both), with findings above 0. Record the printed summary in `docs/HANDOFF.md` under "First live sync".

- [ ] **Step 8: Commit**

```bash
cd /home/opc/graph8 && git add advisor docs/HANDOFF.md && git commit -m "feat(advisor): sync orchestration with lock, cron route, design-run import"
```

---

### Task 14: Auth gate, dashboard data and the Overview screen

**Files:**
- Create: `advisor/src/lib/auth.ts`, `advisor/src/app/login/page.tsx`, `advisor/src/app/login/actions.ts`, `advisor/src/app/(dash)/layout.tsx`, `advisor/src/app/(dash)/page.tsx`, `advisor/src/lib/dashboard/data.ts`, `advisor/src/lib/dashboard/scale.ts`, `advisor/src/components/Tag.tsx`, `KpiTile.tsx`, `HBarChart.tsx`, `LineChart.tsx`, `FindingCard.tsx`
- Modify: `advisor/src/app/globals.css` (replace with the tokens and styles from `docs/design/roi-advisor-ui.html`), `advisor/src/app/layout.tsx` (fonts)
- Test: `advisor/tests/dashboard/scale.test.ts`, `advisor/tests/dashboard/auth.test.ts`

**Interfaces:**
- Produces:
  - `isAuthed(): Promise<boolean>` and `sessionValue(pw: string): string`
  - `loadDashboardData(c?: G8Caller): Promise<DashboardData>`, where `interface DashboardData { charges: AttributedCharge[]; stats: Stat[]; findings: Finding[]; runs: Run[]; coverage: {exact:number;window:number;none:number;total:number}; waste: number; now: string }`
  - `linearScale(domain: [number, number], range: [number, number]): (v: number) => number`
  - `niceTicks(min: number, max: number, count: number): number[]`

- [ ] **Step 1: Write the failing tests `advisor/tests/dashboard/scale.test.ts` and `auth.test.ts`**

```ts
// scale.test.ts
import { describe, it, expect } from "vitest";
import { linearScale, niceTicks } from "@/lib/dashboard/scale";
describe("chart scales", () => {
  it("maps domain to range", () => { const s = linearScale([0, 900], [170, 556]); expect(s(0)).toBe(170); expect(s(900)).toBe(556); expect(s(450)).toBe(363); });
  it("makes readable ticks that cover the data", () => expect(niceTicks(326, 410, 4)).toEqual([300, 350, 400, 450]));
});
```

```ts
// auth.test.ts
import { describe, it, expect } from "vitest";
import { sessionValue } from "@/lib/auth";
describe("sessionValue", () => {
  it("is stable, secret-dependent, and not the password", () => {
    expect(sessionValue("pw")).toBe(sessionValue("pw"));
    expect(sessionValue("pw")).not.toBe(sessionValue("pw2"));
    expect(sessionValue("pw")).not.toContain("pw");
  });
});
```

- [ ] **Step 2: Implement `advisor/src/lib/dashboard/scale.ts`**

```ts
export function linearScale(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain, [r0, r1] = range;
  return (v) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

export function niceTicks(min: number, max: number, count: number): number[] {
  const raw = (max - min) / Math.max(count - 1, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
```

- [ ] **Step 3: Implement `advisor/src/lib/auth.ts`**

```ts
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "roi_session";
export function sessionValue(pw: string): string { return createHash("sha256").update(`roi-advisor:${pw}`).digest("hex"); }
export async function isAuthed(): Promise<boolean> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return false;
  return (await cookies()).get(SESSION_COOKIE)?.value === sessionValue(pw);
}
```

- [ ] **Step 4: Run the tests.** Run `npm test -- tests/dashboard`. Expected: PASS (3 tests).

- [ ] **Step 5: Create the login page and action**

```ts
// advisor/src/app/login/actions.ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionValue } from "@/lib/auth";

export async function login(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw || form.get("password") !== pw) return { error: "That password isn't right. Check DASHBOARD_PASSWORD in the Vercel project settings." };
  (await cookies()).set(SESSION_COOKIE, sessionValue(pw), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
  redirect("/");
}
```

```tsx
// advisor/src/app/login/page.tsx
"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="page" style={{ maxWidth: 420 }}>
      <h1>ROI Advisor</h1>
      <form action={action} style={{ display: "grid", gap: 10 }}>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        {state?.error && <p role="alert">{state.error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Create `advisor/src/lib/dashboard/data.ts`**

```ts
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
```

- [ ] **Step 7: Port the styles.** Copy the whole `<style>` block from `docs/design/roi-advisor-ui.html` into `advisor/src/app/globals.css`, replacing the create-next-app default CSS. In `advisor/src/app/layout.tsx`, set `<title>` to "ROI Advisor" and add the Google Fonts link from the design file inside `<head>`:

```tsx
import "./globals.css";
export const metadata = { title: "ROI Advisor", description: "Which graph8 credits turned into meetings and pipeline" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create the components.** Class names match the design file's CSS.

```tsx
// advisor/src/components/Tag.tsx
export function Tag({ simulated }: { simulated: boolean }) {
  return <span className={`tag ${simulated ? "sim" : "real"}`}>{simulated ? "SIM" : "REAL"}</span>;
}
```

```tsx
// advisor/src/components/KpiTile.tsx
import { Tag } from "./Tag";
export function KpiTile({ label, value, note, simulated, alert }: { label: string; value: string; note: string; simulated: boolean; alert?: boolean }) {
  return (
    <div className={`kpi${alert ? " alert" : ""}`}>
      <div className="k-top"><span className="k-label">{label}</span><Tag simulated={simulated} /></div>
      <div className="k-value">{value}</div>
      <div className="k-note">{note}</div>
    </div>
  );
}
```

```tsx
// advisor/src/components/HBarChart.tsx
import { linearScale } from "@/lib/dashboard/scale";
export interface Bar { label: string; value: number; note?: string }
export function HBarChart({ rows, max, avg, unit, labelW = 190, ariaLabel }: { rows: Bar[]; max: number; avg?: number; unit: string; labelW?: number; ariaLabel: string }) {
  const W = 620, valW = 64, rowH = 30, barH = 14, top = 6;
  const H = top + rows.length * rowH + (avg ? 22 : 6);
  const sx = linearScale([0, max], [labelW, W - valW]);
  const path = (x: number, y: number, w: number, h: number, r = 4) => { r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <line x1={labelW} x2={labelW} y1={top - 2} y2={top + rows.length * rowH - 4} className="axis" />
        {rows.map((r, i) => { const y = top + i * rowH + (rowH - barH) / 2 - 4; const w = Math.max(2, sx(r.value) - labelW); return (
          <g key={r.label}>
            <title>{`${r.label}: ${Math.round(r.value).toLocaleString("en-US")} ${unit}${r.note ? ` · ${r.note}` : ""}`}</title>
            <text x={labelW - 10} y={y + barH / 2 + 4} textAnchor="end">{r.label}</text>
            <path d={path(labelW, y, w, barH)} fill="var(--series)" />
            <text x={labelW + w + 6} y={y + barH / 2 + 4} className="val">{Math.round(r.value).toLocaleString("en-US")}</text>
          </g>); })}
        {avg !== undefined && (<g>
          <line x1={sx(avg)} x2={sx(avg)} y1={top - 2} y2={top + rows.length * rowH - 4} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={sx(avg)} y={top + rows.length * rowH + 11} textAnchor="middle">{`average ${Math.round(avg)}`}</text></g>)}
      </svg>
    </div>
  );
}
```

```tsx
// advisor/src/components/FindingCard.tsx
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
```

```tsx
// advisor/src/components/LineChart.tsx
import { linearScale, niceTicks } from "@/lib/dashboard/scale";
export function LineChart({ points, ariaLabel, unit }: { points: { label: string; value: number }[]; ariaLabel: string; unit: string }) {
  if (points.length < 2) return null;
  const W = 620, H = 200, L = 44, R = 40, T = 14, B = 28;
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 4);
  const sy = linearScale([ticks[0], ticks.at(-1)!], [H - B, T]);
  const sx = (i: number) => L + (i * (W - L - R)) / (points.length - 1);
  const xy = points.map((p, i) => [sx(i), sy(p.value)] as const);
  const line = "M" + xy.map(([x, y]) => `${x},${y}`).join("L");
  const area = `M${xy[0][0]},${sy(ticks[0])}` + xy.map(([x, y]) => `L${x},${y}`).join("") + `L${xy.at(-1)![0]},${sy(ticks[0])}Z`;
  const last = xy.at(-1)!;
  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="grid" /><text x={L - 8} y={sy(t) + 4} textAnchor="end">{t}</text></g>))}
        {points.map((p, i) => (i % 2 === 0 || i === points.length - 1 ? <text key={p.label} x={sx(i)} y={H - 8} textAnchor="middle">{p.label}</text> : null))}
        <path d={area} fill="var(--series-soft)" />
        <path d={line} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r={5} fill="var(--series)" stroke="var(--panel)" strokeWidth={2} />
        <text x={last[0] + 8} y={last[1] + 4} className="val">{Math.round(points.at(-1)!.value)}</text>
        {xy.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r={10} fill="transparent"><title>{`${points[i].label}: ${Math.round(points[i].value)} ${unit}`}</title></circle>))}
      </svg>
    </div>
  );
}
```

Use `LineChart` on the Overview once weekly snapshots exist (depth backlog item 5). The thin slice shows the two bar charts only.

- [ ] **Step 9: Create the gated layout and the Overview page**

```tsx
// advisor/src/app/(dash)/layout.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  return (
    <div className="page">
      <nav className="nav" aria-label="Screens"><ul>
        <li><Link href="/">Overview</Link></li><li><Link href="/charges">Charges</Link></li>
        <li><Link href="/recovery">Recovery</Link></li><li><Link href="/prespend">Before you spend</Link></li>
      </ul></nav>
      {children}
    </div>
  );
}
```

```tsx
// advisor/src/app/(dash)/page.tsx
import { loadDashboardData } from "@/lib/dashboard/data";
import { dashboardBuckets } from "@/lib/domain/gate";
import { KpiTile } from "@/components/KpiTile";
import { HBarChart } from "@/components/HBarChart";
import { FindingCard } from "@/components/FindingCard";
import { formatCostPerMeeting } from "@/lib/domain/metrics";
import { syncNow } from "./actions";

export default async function Overview() {
  const d = await loadDashboardData();
  const org = d.stats.find((s) => s.dimension === "org" && s.period === "30d");
  const byService = d.stats.filter((s) => s.dimension === "service").sort((a, b) => b.credits - a.credits);
  const byList = d.stats.filter((s) => s.dimension === "list" && s.costPerMeeting !== null).sort((a, b) => (a.costPerMeeting ?? 0) - (b.costPerMeeting ?? 0));
  const { open, watching } = dashboardBuckets(d.findings, d.now);
  const pct = d.coverage.total ? Math.round((d.coverage.exact / d.coverage.total) * 100) : 0;
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  return (
    <section>
      <div className="sec-head"><h2>Overview</h2><form action={syncNow}><button className="btn" type="submit">Sync now</button></form></div>
      <div className="kpis">
        <KpiTile label="Credits spent" value={n(d.coverage.total)} note={`${d.charges.filter((c) => !c.simulated).length} charges`} simulated={false} />
        <KpiTile label="Wasted" value={n(d.waste)} note="Failed jobs, unreadable results, side effects" simulated={false} alert />
        <KpiTile label="Traced exactly" value={`${pct}%`} note={`${n(d.coverage.exact)} credits tied to a contact, list or run`} simulated={false} />
        <KpiTile label="Meetings" value={org ? n(org.meetings) : "0"} note="Last 30 days" simulated={org?.simulated ?? false} />
        <KpiTile label="Credits per meeting" value={org?.costPerMeeting !== null && org ? n(org.costPerMeeting!) : "—"} note={org ? formatCostPerMeeting(org) : "No data yet"} simulated={org?.simulated ?? false} />
      </div>
      <div className="two">
        <div className="stack">
          <HBarChart ariaLabel="Credits by service" unit="credits" max={Math.max(1, ...byService.map((s) => s.credits))} rows={byService.map((s) => ({ label: s.value, value: s.credits }))} labelW={170} />
          {byList.length > 0 && <HBarChart ariaLabel="Credits per meeting by list" unit="credits per meeting" avg={org?.costPerMeeting ?? undefined}
            max={Math.max(...byList.map((s) => s.costPerMeeting ?? 0)) * 1.05} rows={byList.map((s) => ({ label: `List ${s.value}`, value: s.costPerMeeting ?? 0, note: `${s.meetings} meetings` }))} />}
        </div>
        <aside className="advisor"><div className="advisor-head"><h3>Advisor</h3><span className="muted">{open.length} open</span></div>
          {open.map((f) => <FindingCard key={f.extId} f={f} />)}
          {watching.length > 0 && <div className="watching">Watching (low confidence): {watching.map((f) => f.title).join(" · ")}</div>}
        </aside>
      </div>
    </section>
  );
}
```

```ts
// advisor/src/app/(dash)/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { g8Caller } from "@/lib/g8/client";
import { runSync } from "@/lib/sync/run-sync";
import { isAuthed } from "@/lib/auth";
export async function syncNow(): Promise<void> {
  if (!(await isAuthed())) throw new Error("Sign in first");
  await runSync({ c: g8Caller });
  revalidatePath("/");
}
```

- [ ] **Step 10: Build and look at it**

```bash
cd /home/opc/graph8/advisor && npm run build && npm run start &
sleep 6 && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/   # expect 307 (redirect to /login)
```
Sign in with `DASHBOARD_PASSWORD` in a browser (or through claude-in-chrome if available). Compare the Overview against `docs/design/roi-advisor-ui.html` and fix visible differences once. Stop the server.

- [ ] **Step 11: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): password gate, dashboard data loader, Overview screen"
```

---

### Task 15: Charges and Recovery screens, with the refund draft

**Files:**
- Create: `advisor/src/lib/recovery/refund.ts`, `advisor/src/components/CoverageBar.tsx`, `advisor/src/components/ChargesTable.tsx`, `advisor/src/app/(dash)/charges/page.tsx`, `advisor/src/app/(dash)/recovery/page.tsx`, `advisor/src/app/(dash)/recovery/actions.ts`, `advisor/src/app/(dash)/recovery/SendRefund.tsx`
- Test: `advisor/tests/recovery/refund.test.ts`

**Interfaces:**
- Consumes: `loadDashboardData` (Task 14), `AttributedCharge`, `Finding`.
- Produces:
  - `buildRefundDraft(p: { orgId: string; charges: AttributedCharge[]; reason: "failed_job" | "no_change" }): { message: string; credits: number; ledgerIds: string[] } | null`
  - Server action `sendRefund(prev, form: FormData)`, which requires the `confirm` checkbox

- [ ] **Step 1: Write the failing test `advisor/tests/recovery/refund.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { attributeCharges } from "@/lib/domain/attribution";
import { buildRefundDraft } from "@/lib/recovery/refund";
import { loadDesignInput } from "../helpers/design-fixture";

const charges = attributeCharges(loadDesignInput());
describe("buildRefundDraft", () => {
  it("drafts the real 77-credit refund with evidence", () => {
    const d = buildRefundDraft({ orgId: "org_5e2170609156", charges, reason: "failed_job" })!;
    expect(d.credits).toBe(77);
    expect(d.ledgerIds).toHaveLength(15);
    expect(d.message).toContain("77 credits");
    expect(d.message).toContain("fd26115a-92e4-4ab7-9195-36cbc224550f");
    expect(d.message).toContain("org_5e2170609156");
  });
  it("returns null when there is nothing to recover", () => expect(buildRefundDraft({ orgId: "o", charges: [], reason: "failed_job" })).toBeNull());
});
```

- [ ] **Step 2: Implement `advisor/src/lib/recovery/refund.ts`**

```ts
import type { AttributedCharge } from "../domain/types";
import { toMs } from "../domain/time";

export function buildRefundDraft(p: { orgId: string; charges: AttributedCharge[]; reason: "failed_job" | "no_change" }) {
  const xs = p.charges.filter((c) => c.wasteReason === p.reason && !c.simulated);
  if (!xs.length) return null;
  const credits = xs.reduce((s, c) => s + c.credits, 0);
  const byRun = new Map<string, AttributedCharge[]>();
  for (const c of xs) byRun.set(c.runExtId ?? "unknown", [...(byRun.get(c.runExtId ?? "unknown") ?? []), c]);
  const times = xs.map((c) => toMs(c.chargedAt)).sort((a, b) => a - b);
  const day = new Date(times[0]).toISOString().slice(0, 10);
  const span = `${new Date(times[0]).toISOString().slice(11, 16)}–${new Date(times.at(-1)!).toISOString().slice(11, 16)} UTC`;
  const why = p.reason === "failed_job" ? "for jobs that failed on every record" : "for results that can't be read back";
  const lines = [...byRun].map(([run, cs]) => `• Run ${run}: ${cs.reduce((s, c) => s + c.credits, 0)} credits, service "${cs[0].service}"`);
  const message = [`Hello graph8 support,`, ``, `We were charged ${credits} credits on ${day} (${span}) ${why}:`, ...lines,
    `• ${xs.length} ledger lines`, ``, `Please refund the ${credits} credits. Org: ${p.orgId}.`].join("\n");
  return { message, credits, ledgerIds: xs.map((c) => c.ledgerId) };
}
```

- [ ] **Step 3: Run the test.** Run `npm test -- tests/recovery`. Expected: PASS (2 tests).

- [ ] **Step 4: Create the send action, which requires an explicit in-page confirmation**

```ts
// advisor/src/app/(dash)/recovery/actions.ts
"use server";
import { g8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";

export async function sendRefund(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm you've read the message." };
  const message = String(form.get("message") ?? "");
  if (message.length < 40) return { ok: false, message: "The message is empty." };
  await g8Caller.call(OPS.contactSupport, { body: { message, urgency: "normal" } });
  return { ok: true, message: "Sent to graph8 support." };
}
```

```tsx
// advisor/src/app/(dash)/recovery/SendRefund.tsx
"use client";
import { useActionState } from "react";
import { sendRefund } from "./actions";
export function SendRefund({ draft }: { draft: string }) {
  const [state, action, pending] = useActionState(sendRefund, undefined);
  return (
    <form action={action} className="draft">
      <div className="draft-head"><strong>Refund request draft</strong><span className="muted">Goes to graph8 support after you confirm</span></div>
      <label htmlFor="refund-text" className="eyebrow" style={{ padding: "10px 14px 0", display: "block" }}>Message</label>
      <textarea id="refund-text" name="message" defaultValue={draft} />
      <div className="draft-foot">
        <label><input type="checkbox" name="confirm" value="yes" /> I've read this and want to send it</label>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send to graph8 support"}</button>
        {state && <span className="toast" role="status">{state.message}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Create the components and screens**

```tsx
// advisor/src/components/CoverageBar.tsx
export function CoverageBar({ exact, window, none }: { exact: number; window: number; none: number }) {
  const total = Math.max(exact + window + none, 1), pct = (x: number) => Math.round((x / total) * 100);
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  return (
    <div className="coverage">
      <h3>How the {n(total)} credits were matched</h3>
      <div className="covbar" aria-hidden="true">
        <div style={{ flex: exact, background: "var(--series-strong)" }} title={`Exact ${n(exact)}`} />
        <div style={{ flex: window, background: "var(--series)" }} title={`Time window ${n(window)}`} />
        <div style={{ flex: none, background: "var(--series-weak)" }} title={`Service only ${n(none)}`} />
      </div>
      <div className="covkey">
        <span><i className="sw" style={{ background: "var(--series-strong)" }} />Exact: {n(exact)} ({pct(exact)}%) · run, job or pipeline ID</span>
        <span><i className="sw" style={{ background: "var(--series)" }} />Time window: {n(window)} ({pct(window)}%) · matched by timestamp</span>
        <span><i className="sw" style={{ background: "var(--series-weak)" }} />Service only: {n(none)} ({pct(none)}%) · can't be traced</span>
      </div>
    </div>
  );
}
```

```tsx
// advisor/src/components/ChargesTable.tsx
import type { AttributedCharge } from "@/lib/domain/types";
import { EXACT_METHODS } from "@/lib/domain/attribution";
import { toMs } from "@/lib/domain/time";
import { Tag } from "./Tag";

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
          <td className="what">{c.explanation} {c.simulated && <Tag simulated />}<small>{c.service}</small></td>
          <td className="num">{c.credits.toLocaleString("en-US")}</td>
          <td><span className={`method ${m[0]}`}>{m[1]}</span></td>
          <td><span className="result"><i className="dot" style={{ background: color }} />{words}</span></td>
        </tr>);
      })}</tbody>
    </table></div>
  );
}
```

```tsx
// advisor/src/app/(dash)/charges/page.tsx
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
```

```tsx
// advisor/src/app/(dash)/recovery/page.tsx
import { loadDashboardData } from "@/lib/dashboard/data";
import { dashboardBuckets } from "@/lib/domain/gate";
import { buildRefundDraft } from "@/lib/recovery/refund";
import { Tag } from "@/components/Tag";
import { SendRefund } from "./SendRefund";
const LABEL: Record<string, string> = { waste: "Waste", fix: "Fix", side_effect: "Side effect", unused: "Unused" };
export default async function RecoveryPage() {
  const d = await loadDashboardData();
  const cards = dashboardBuckets(d.findings, d.now).open.filter((f) => ["waste", "fix", "side_effect", "unused"].includes(f.kind));
  const draft = buildRefundDraft({ orgId: process.env.G8_ORG_ID ?? "", charges: d.charges, reason: "failed_job" });
  return (
    <section>
      <div className="sec-head"><h2>Recovery</h2><p>Credits that bought nothing, with the evidence attached. Refund requests go to graph8 support only after you confirm.</p></div>
      <div className="frame"><div className="frame-body">
        <div className="cards">{cards.map((f) => (
          <div className="rcard" key={f.extId}>
            <span className={`kind ${f.kind === "unused" ? "info" : f.kind === "waste" ? "waste" : "fix"}`}>{LABEL[f.kind]}</span> <Tag simulated={f.simulated} />
            <div className="amt">{f.creditsAtStake.toLocaleString("en-US")}</div><p>{f.body}</p>
          </div>))}
          {cards.length === 0 && <p>Nothing to recover right now.</p>}
        </div>
        {draft && <SendRefund draft={draft.message} />}
      </div></div>
    </section>
  );
}
```

- [ ] **Step 6: Build and check.** Run `npm run build`. Then run `npm run start`, open `/charges` and `/recovery`, and confirm the coverage bar shows at least 216 exact and at least 1,033 time-window credits, and the refund draft says 77 credits. **Don't send it.** Sending is for the user to decide.

- [ ] **Step 7: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): Charges and Recovery screens with confirmed refund request"
```

---

### Task 16: Before-you-spend screen and the guardrail

**Files:**
- Create: `advisor/src/lib/guardrail/guardrail.ts`, `advisor/src/app/(dash)/prespend/page.tsx`, `advisor/src/app/(dash)/prespend/actions.ts`, `advisor/src/app/(dash)/prespend/ApplyGuardrail.tsx`
- Test: `advisor/tests/guardrail/guardrail.test.ts`

**Interfaces:**
- Consumes: `G8Caller`, `OPS`, `classifyFit`, `smoothedRate`, `estimateCredits`, `priceFor`, `shouldWarnPreSpend`, `recordConsistency`, `RecordStore`, `runToValues`.
- Produces:
  - `const RUN_CONDITION = 'NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))'`
  - `validateCondition(c, formula: string): Promise<void>` (throws with graph8's error text)
  - `assertConditionFilters(c, p: { listId: number; listSize: number; fieldName: string; value: string }): Promise<number>` (returns the match count; throws when it is 0 or equals the list size)
  - `writeFit(c, p: { columnId: number; fits: Map<number, string> }): Promise<number>`
  - `ensurePipeline(c, listId: number): Promise<{ id: string; name: string; configRef: string }>`
  - `setRunCondition(c, p: { listId: number; pipeline: { id: string; name: string; configRef: string }; condition: string | null }): Promise<void>`
  - `runGuardedPipeline(c, p: { listId: number; pipelineId: string; estimatedCredits: number; cap: number }): Promise<{ runId: string }>`
  - `readPipelineRun(c, runId: string): Promise<{ status: string; processed: number; successful: number; failed: number; skipped: number }>`

- [ ] **Step 1: Write the failing test `advisor/tests/guardrail/guardrail.test.ts`** (covers Review Focus #4)

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { assertConditionFilters, validateCondition, runGuardedPipeline, readPipelineRun, RUN_CONDITION } from "@/lib/guardrail/guardrail";
import { loadFixture } from "../fixtures";

describe("guardrail", () => {
  it("uses the validated function-style condition", () => expect(RUN_CONDITION).toBe('NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))'));
  it("refuses a condition graph8 says is invalid", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.validateFormula, () => ({ valid: false, errors: ["Invalid G8X syntax: Unexpected character '='"] }));
    await expect(validateCondition(c, "{{x}} == 1")).rejects.toThrow(/Unexpected character/);
  });
  it("refuses a filter that matches everyone (unknown operator) or no one", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.previewRoutingRule, () => ({ matching_count: 250 }));
    await expect(assertConditionFilters(c, { listId: 2, listSize: 250, fieldName: "udo_roi_fit_11e946f0", value: "low" })).rejects.toThrow(/every contact/);
    c.handlers.set(OPS.previewRoutingRule, () => ({ matching_count: 0 }));
    await expect(assertConditionFilters(c, { listId: 2, listSize: 250, fieldName: "udo_roi_fit_11e946f0", value: "low" })).rejects.toThrow(/no contact/);
    c.handlers.set(OPS.previewRoutingRule, () => ({ matching_count: 113 }));
    expect(await assertConditionFilters(c, { listId: 2, listSize: 250, fieldName: "udo_roi_fit_11e946f0", value: "low" })).toBe(113);
  });
  it("won't start a run above the credit cap", async () => {
    await expect(runGuardedPipeline(new FakeG8(), { listId: 2, pipelineId: "p", estimatedCredits: 498, cap: 50 })).rejects.toThrow(/cap/);
  });
  it("reads the real guardrail run: 3 processed, 1 successful, 2 skipped", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.getPipelineRun, () => loadFixture<{ data: unknown }>("graph8/pipeline_run_guardrail.json").data);
    expect(await readPipelineRun(c, "e2b2e81f")).toEqual({ status: "completed", processed: 3, successful: 1, failed: 0, skipped: 2 });
  });
});
```

- [ ] **Step 2: Implement `advisor/src/lib/guardrail/guardrail.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";

export const RUN_CONDITION = 'NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))';

export async function validateCondition(c: G8Caller, formula: string): Promise<void> {
  const r = await c.call<{ valid: boolean; errors: string[] }>(OPS.validateFormula, { body: { formula } });
  if (!r.valid) throw new Error(`graph8 rejected the condition: ${r.errors.join("; ")}`);
}

export async function assertConditionFilters(c: G8Caller, p: { listId: number; listSize: number; fieldName: string; value: string }): Promise<number> {
  const r = await c.call<{ matching_count: number }>(OPS.previewRoutingRule, { body: { source_list_id: p.listId, conditions: [{ field: p.fieldName, operator: "equals", value: p.value }] } });
  if (r.matching_count >= p.listSize) throw new Error(`The filter matches every contact on the list (${r.matching_count}). It isn't filtering; nothing was saved.`);
  if (r.matching_count === 0) throw new Error(`The filter matches no contact on the list. Write roi_fit values first.`);
  return r.matching_count;
}

export async function writeFit(c: G8Caller, p: { columnId: number; fits: Map<number, string> }): Promise<number> {
  let n = 0;
  for (const [contactId, fit] of p.fits) {
    await c.call(OPS.setFieldValue, { path: { column_id: p.columnId }, body: { entity: "contacts", record_id: contactId, value: fit } });
    n++;
  }
  return n;
}

interface Pipeline { id: string; name: string; steps: { id: string; name?: string; type: string; config_ref?: string }[] }

export async function ensurePipeline(c: G8Caller, listId: number): Promise<{ id: string; name: string; configRef: string }> {
  const existing = (await c.call<{ items: Pipeline[] }>(OPS.listListPipelines, { path: { list_id: listId } })).items ?? [];
  const p = existing.find((x) => x.name === "Verified emails")
    ?? await c.call<Pipeline>(OPS.createPipelineFromTemplate, { path: { list_id: listId }, body: { template_key: "verified_emails" } });
  const step = p.steps.find((s) => s.type === "waterfall");
  if (!step?.config_ref) throw new Error("The pipeline has no email-finder step to guard.");
  return { id: p.id, name: p.name, configRef: step.config_ref };
}

export async function setRunCondition(c: G8Caller, p: { listId: number; pipeline: { id: string; name: string; configRef: string }; condition: string | null }): Promise<void> {
  await c.call(OPS.updateListPipeline, { path: { list_id: p.listId, pipeline_id: p.pipeline.id }, body: { name: p.pipeline.name, enabled: false,
    steps: [{ id: "step_1", name: "Email finder", type: "waterfall", config_ref: p.pipeline.configRef, run_condition: p.condition,
      skip_existing_values: true, skip_recently_enriched: true, enabled: true }] } });
}

export async function runGuardedPipeline(c: G8Caller, p: { listId: number; pipelineId: string; estimatedCredits: number; cap: number }): Promise<{ runId: string }> {
  if (p.estimatedCredits > p.cap) throw new Error(`Estimated ${p.estimatedCredits} credits is above the per-action cap of ${p.cap}. Raise ACTION_CREDIT_CAP or narrow the list.`);
  const r = await c.call<{ run_id: string }>(OPS.runListPipeline, { path: { list_id: p.listId, pipeline_id: p.pipelineId } });
  return { runId: r.run_id };
}

export async function readPipelineRun(c: G8Caller, runId: string) {
  const r = await c.call<{ status: string; step_progress?: { processed_records?: number; successful?: number; failed?: number; skipped_by_reason?: Record<string, number> }[] }>(OPS.getPipelineRun, { path: { run_id: runId } });
  const sp = r.step_progress ?? [];
  const sum = (f: (x: (typeof sp)[number]) => number) => sp.reduce((s, x) => s + f(x), 0);
  return { status: r.status, processed: sum((x) => x.processed_records ?? 0), successful: sum((x) => x.successful ?? 0), failed: sum((x) => x.failed ?? 0),
    skipped: sum((x) => Object.values(x.skipped_by_reason ?? {}).reduce((a, b) => a + b, 0)) };
}
```

- [ ] **Step 3: Run the test.** Run `npm test -- tests/guardrail`. Expected: PASS (5 tests).

- [ ] **Step 4: Create the server actions `advisor/src/app/(dash)/prespend/actions.ts`**

```ts
"use server";
import { g8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";
import { loadContactInfo, type ContactRow } from "@/lib/sync/contacts";
import { RecordStore } from "@/lib/store/records";
import { runToValues, valuesToCharge, valuesToRun, valuesToStat } from "@/lib/store/mappers";
import { calibrationFactor, classifyFit, estimateCredits, priceFor, smoothedRate, type ProviderRow } from "@/lib/domain/prespend";
import { shouldWarnPreSpend } from "@/lib/domain/gate";
import { RUN_CONDITION, assertConditionFilters, ensurePipeline, readPipelineRun, runGuardedPipeline, setRunCondition, validateCondition, writeFit } from "@/lib/guardrail/guardrail";

export interface Advice {
  listId: number; listSize: number; missing: number; quote: number; estimate: number; flagged: number; warn: boolean;
  fits: Record<"high" | "medium" | "low" | "unknown", number>; fitByContact: [number, string][]; consistencyByContact: [number, string][];
}

export async function adviseList(listId: number): Promise<Advice> {
  if (!(await isAuthed())) throw new Error("Sign in first.");
  const c = g8Caller;
  const rows: (ContactRow & { work_email: string | null })[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<(ContactRow & { work_email: string | null })[]>(OPS.getListContacts, { path: { list_id: listId }, query: { page, limit: 200 } });
    rows.push(...r);
    if (r.length < 200) break;
  }
  const stats = (await new RecordStore(c, "roi_stat").list()).map((r) => valuesToStat(r.values));
  const org = stats.find((s) => s.dimension === "org");
  const orgRate = org && org.contactsReached > 0 ? org.meetings / org.contactsReached : 0;
  const seg = new Map(stats.filter((s) => s.dimension === "segment").map((s) => [s.value, s]));
  const fits: Advice["fits"] = { high: 0, medium: 0, low: 0, unknown: 0 };
  const fitByContact: [number, string][] = [], consistencyByContact: [number, string][] = [];
  let flagged = 0, missing = 0;
  for (const row of rows) {
    const info = await loadContactInfo(c, row);
    const s = seg.get(info.segmentKey);
    const n = s?.contactsReached ?? 0;
    const fit = classifyFit({ rate: smoothedRate(s?.meetings ?? 0, n, orgRate), orgRate, n, consistency: info.consistency });
    fits[fit]++; fitByContact.push([row.id, fit]); consistencyByContact.push([row.id, info.consistency]);
    if (info.consistency === "flagged") flagged++;
    if (!row.work_email && fit !== "low") missing++;
  }
  const providers = (await c.call<{ providers: ProviderRow[] }>(OPS.listProviders)).providers;
  const price = priceFor(providers, "leadmagic", "email_finder") ?? 3;
  const runs = (await new RecordStore(c, "roi_run").list()).map((r) => valuesToRun(r.values)).filter((r) => r.service === "waterfall_enrichment" && r.quotedCredits);
  const charges = (await new RecordStore(c, "roi_charge").list()).map((r) => valuesToCharge(r.values));
  const calibration = calibrationFactor(runs.map((r) => ({ quoted: r.quotedCredits!, actual: charges.filter((x) => x.runExtId === r.extId).reduce((s, x) => s + x.credits, 0) })));
  const estimate = estimateCredits({ records: missing, pricePerRecord: price, calibration });
  const pipes = (await c.call<{ items: { id: string }[] }>(OPS.listListPipelines, { path: { list_id: listId } })).items ?? [];
  const quote = pipes.length
    ? (await c.call<{ required_credits: number }>(OPS.estimateListPipeline, { path: { list_id: listId, pipeline_id: pipes[0].id } })).required_credits
    : rows.length * 2;
  const confidence = org?.confidence ?? "low";
  const warn = shouldWarnPreSpend({ plannedCredits: quote, projectedSaving: quote - estimate, confidence }) || (rows.length > 0 && flagged / rows.length >= 0.2);
  return { listId, listSize: rows.length, missing, quote, estimate, flagged, warn, fits, fitByContact, consistencyByContact };
}

export async function applyGuardrail(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm the run and its cost." };
  const c = g8Caller, listId = Number(form.get("listId"));
  try {
    const advice = await adviseList(listId);
    const fieldName = process.env.ROI_FIT_FORMULA_NAME ?? "udo_roi_fit_11e946f0";
    await writeFit(c, { columnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fits: new Map(advice.fitByContact) });
    if (process.env.RECORD_CONSISTENCY_COLUMN_ID) // created by scripts/bootstrap.ts (Task 11)
      await writeFit(c, { columnId: Number(process.env.RECORD_CONSISTENCY_COLUMN_ID), fits: new Map(advice.consistencyByContact) });
    await validateCondition(c, RUN_CONDITION);
    await assertConditionFilters(c, { listId, listSize: advice.listSize, fieldName, value: "low" });
    const pipeline = await ensurePipeline(c, listId);
    await setRunCondition(c, { listId, pipeline, condition: RUN_CONDITION });
    const before = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    const runs = new RecordStore(c, "roi_run");
    const startedAt = new Date().toISOString();
    const { runId } = await runGuardedPipeline(c, { listId, pipelineId: pipeline.id, estimatedCredits: advice.estimate, cap: Number(process.env.ACTION_CREDIT_CAP ?? 50) });
    await runs.upsert(runToValues({ extId: runId, kind: "pipeline_run", service: "waterfall_enrichment", actionName: `List pipeline · ${pipeline.name}`, startedAt,
      completedAt: null, status: "running", source: "advisor", listId, quotedCredits: advice.estimate }));
    let result = await readPipelineRun(c, runId);
    for (let i = 0; i < 36 && result.status !== "completed" && result.status !== "failed"; i++) { await new Promise((r) => setTimeout(r, 5000)); result = await readPipelineRun(c, runId); }
    const after = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    await runs.upsert(runToValues({ extId: runId, kind: "pipeline_run", service: "waterfall_enrichment", actionName: `List pipeline · ${pipeline.name}`, startedAt,
      completedAt: new Date().toISOString(), status: result.status, source: "advisor", listId, quotedCredits: advice.estimate,
      recordsOk: result.successful, recordsFailed: result.failed, recordsSkipped: result.skipped }));
    return { ok: true, message: `Enriched ${result.successful}, skipped ${result.skipped} low-fit contacts, ${Math.round(before - after)} credits.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 5: Create the page and the apply form**

```tsx
// advisor/src/app/(dash)/prespend/ApplyGuardrail.tsx
"use client";
import { useActionState } from "react";
import { applyGuardrail } from "./actions";
export function ApplyGuardrail({ listId, estimate }: { listId: number; estimate: number }) {
  const [state, action, pending] = useActionState(applyGuardrail, undefined);
  return (
    <form action={action} className="dialog-foot">
      <input type="hidden" name="listId" value={listId} />
      <label><input type="checkbox" name="confirm" value="yes" /> Run it (about {estimate} credits)</label>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Running…" : "Apply guardrail and enrich"}</button>
      {state && <span className="toast" role="status">{state.message}</span>}
    </form>
  );
}
```

```tsx
// advisor/src/app/(dash)/prespend/page.tsx
import { g8Caller } from "@/lib/g8/client";
import { OPS } from "@/lib/g8/ops";
import { RUN_CONDITION } from "@/lib/guardrail/guardrail";
import { adviseList } from "./actions";
import { ApplyGuardrail } from "./ApplyGuardrail";

export default async function PrespendPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const { list } = await searchParams;
  const lists = await g8Caller.call<{ id: number; title: string; total: number }[]>(OPS.listLists);
  const advice = list ? await adviseList(Number(list)) : null;
  const chosen = lists.find((l) => String(l.id) === list);
  return (
    <section>
      <div className="sec-head"><h2>Before you spend</h2><p>The Advisor speaks up only when it changes the decision, then graph8 enforces it through the list pipeline's run condition.</p></div>
      <form method="get" style={{ display: "flex", gap: 8 }}>
        <label htmlFor="list">List</label>
        <select id="list" name="list" defaultValue={list ?? ""}>{lists.map((l) => <option key={l.id} value={l.id}>{l.title} · {l.total}</option>)}</select>
        <button className="btn" type="submit">Check</button>
      </form>
      {advice && chosen && (
        <div className="dialog">
          <div className="dialog-head"><span className="eyebrow">Enrich list</span><h3>{chosen.title} · {advice.listSize} contacts</h3></div>
          <div className="dialog-body">
            <div className="est">
              <div><span className="muted">graph8 quote</span><span className="big struck">{advice.quote}</span><span>credits</span></div>
              <div><span className="muted">Advisor estimate</span><span className="big">~{advice.estimate}</span><span>{advice.missing} contacts need an email</span></div>
            </div>
            {advice.warn && <div className="callout"><strong>You could skip the contacts least likely to book</strong>
              <ul><li>{advice.flagged} records have an email that doesn&apos;t match their company</li><li>Fit: high {advice.fits.high} · medium {advice.fits.medium} · low {advice.fits.low} · unknown {advice.fits.unknown}</li></ul></div>}
            <div className="fitbar" aria-hidden="true">
              <div style={{ flex: advice.fits.high, background: "var(--series-strong)" }} /><div style={{ flex: advice.fits.medium, background: "var(--series)" }} />
              <div style={{ flex: advice.fits.low + advice.fits.unknown, background: "var(--series-weak)" }} />
            </div>
            <pre className="code">{RUN_CONDITION}</pre>
          </div>
          <ApplyGuardrail listId={advice.listId} estimate={advice.estimate} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Ask the user, then do one live run on the `[sim]` guardrail list (list 13, 3 contacts).** Ask: "May I run the guardrail on the 3-contact `[sim] guardrail probe` list? It costs at most about 9 credits." After yes, open `/prespend?list=13` and apply. Expected: `adviseList` classes row 66 (Scott Zeller) as `low`, because the email domain `rallyme.com` doesn't match `startupready.com`, which makes it flagged. Rows 81 and 249 come out `unknown`, because there isn't enough segment evidence yet. The run result reports at least 1 skipped contact (the pipeline run's `skipped_by_reason`) and at most 9 credits. Record the exact numbers in `docs/HANDOFF.md`.

- [ ] **Step 7: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): before-you-spend screen and guardrail with silent-failure checks"
```

---

### Task 17: Weekly recap into #roi-advisor

**Files:**
- Create: `advisor/src/lib/recap/recap.ts`, `advisor/src/app/api/cron/recap/route.ts`
- Test: `advisor/tests/recap/recap.test.ts`

**Interfaces:**
- Consumes: `recapSelection` (Task 9), `DashboardData` (Task 14), `RecordStore`, `runToValues`, `findingToValues`.
- Produces:
  - `buildRecapBlocks(p: { spendThisWeek: number; meetingsThisWeek: number; items: Finding[]; simulated: boolean }): WorkBlock[]`
  - `postRecap(c: G8Caller, blocks: WorkBlock[], channel: string): Promise<string>` (returns the post time in ISO)
  - `type WorkBlock = { type: "paragraph"; content: { type: "text"; text: string; marks?: { type: "bold" }[] }[] }`

- [ ] **Step 1: Write the failing test `advisor/tests/recap/recap.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { buildRecapBlocks, postRecap } from "@/lib/recap/recap";
import type { Finding } from "@/lib/domain/types";

const f = (title: string, body: string): Finding => ({ extId: title, kind: "waste", title, body, evidence: {}, creditsAtStake: 77, confidence: "high", status: "open",
  snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null, firstSeen: "2026-09-26T00:00:00Z", lastSeen: "2026-09-26T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false });

describe("recap", () => {
  it("builds a bold headline and one numbered line per item (max 3)", () => {
    const blocks = buildRecapBlocks({ spendThisWeek: 2900, meetingsThisWeek: 11, items: [f("a", "A"), f("b", "B"), f("c", "C")], simulated: true });
    expect(blocks[0].content[0]).toMatchObject({ text: "Last week: 2,900 credits → 11 meetings (264 each) [sim]", marks: [{ type: "bold" }] });
    expect(blocks.slice(1).map((b) => b.content[0].text)).toEqual(["1. A", "2. B", "3. C"]);
  });
  it("posts document blocks to the roi-advisor channel only", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.createWorkMessage, () => ({ id: "m1" }));
    await postRecap(c, buildRecapBlocks({ spendThisWeek: 1, meetingsThisWeek: 0, items: [f("a", "A")], simulated: false }), "roi-advisor");
    expect(c.calls[0].input.body).toMatchObject({ channel: "roi-advisor", document: { version: 1 } });
    await expect(postRecap(c, [], "work")).rejects.toThrow(/roi-advisor/);
  });
});
```

- [ ] **Step 2: Implement `advisor/src/lib/recap/recap.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import type { Finding } from "../domain/types";

export type WorkBlock = { type: "paragraph"; content: { type: "text"; text: string; marks?: { type: "bold" }[] }[] };
const para = (text: string, bold = false): WorkBlock => ({ type: "paragraph", content: [{ type: "text", text, ...(bold ? { marks: [{ type: "bold" as const }] } : {}) }] });

export function buildRecapBlocks(p: { spendThisWeek: number; meetingsThisWeek: number; items: Finding[]; simulated: boolean }): WorkBlock[] {
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  const each = p.meetingsThisWeek > 0 ? ` (${n(p.spendThisWeek / p.meetingsThisWeek)} each)` : "";
  return [para(`Last week: ${n(p.spendThisWeek)} credits → ${n(p.meetingsThisWeek)} meetings${each}${p.simulated ? " [sim]" : ""}`, true),
    ...p.items.slice(0, 3).map((f, i) => para(`${i + 1}. ${f.body}`))];
}

export async function postRecap(c: G8Caller, blocks: WorkBlock[], channel: string): Promise<string> {
  if (channel !== "roi-advisor") throw new Error("Recaps may only be posted to roi-advisor (other channels wake graph8's agent and cost credits).");
  await c.call(OPS.createWorkMessage, { body: { channel, document: { version: 1, blocks } } });
  return new Date().toISOString();
}
```

- [ ] **Step 3: Run the test.** Run `npm test -- tests/recap`. Expected: PASS (2 tests).

- [ ] **Step 4: Create `advisor/src/app/api/cron/recap/route.ts`**

```ts
import { g8Caller } from "@/lib/g8/client";
import { loadDashboardData } from "@/lib/dashboard/data";
import { recapSelection } from "@/lib/domain/gate";
import { toMs } from "@/lib/domain/time";
import { RecordStore } from "@/lib/store/records";
import { findingToValues, runToValues, valuesToOutcome } from "@/lib/store/mappers";
import { buildRecapBlocks, postRecap } from "@/lib/recap/recap";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request): Promise<Response> {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  const d = await loadDashboardData();
  const now = Date.now(), week = 7 * 86_400_000;
  const inWeek = (iso: string, k: number) => { const t = toMs(iso); return t > now - (k + 1) * week && t <= now - k * week; };
  const spendThisWeek = d.charges.filter((c) => inWeek(c.chargedAt, 0)).reduce((s, c) => s + c.credits, 0);
  const spendLastWeek = d.charges.filter((c) => inWeek(c.chargedAt, 1)).reduce((s, c) => s + c.credits, 0);
  const outcomes = (await new RecordStore(g8Caller, "roi_outcome").list()).map((r) => valuesToOutcome(r.values));
  const meetingsThisWeek = outcomes.filter((o) => o.type === "meeting_booked" && inWeek(o.occurredAt, 0)).length;
  const lastRecapAt = d.runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!).sort((a, b) => toMs(b) - toMs(a))[0] ?? null;
  const items = recapSelection(d.findings, { lastRecapAt, spendThisWeek, spendLastWeek });
  if (!items.length) return Response.json({ skipped: "quiet week" });
  const simulated = items.some((f) => f.simulated) || outcomes.some((o) => o.simulated && inWeek(o.occurredAt, 0));
  const postedAt = await postRecap(g8Caller, buildRecapBlocks({ spendThisWeek, meetingsThisWeek, items, simulated }), process.env.ROI_ADVISOR_CHANNEL ?? "roi-advisor");
  await new RecordStore(g8Caller, "roi_run").upsert(runToValues({ extId: `post:${postedAt}`, kind: "advisor_post", actionName: "Weekly recap", startedAt: postedAt,
    completedAt: postedAt, status: "completed", source: "advisor" }));
  const findings = new RecordStore(g8Caller, "roi_finding");
  for (const f of items) await findings.upsert(findingToValues({ ...f, inRecap: true, lastNotifiedStake: f.creditsAtStake }));
  return Response.json({ posted: items.length, postedAt });
}
```

- [ ] **Step 5: Live check.** Ask the user before the first post ("May I post a test recap to #roi-advisor? It costs 0 credits."). Then call the route locally: `curl -H "Authorization: Bearer local-cron-secret" http://localhost:3000/api/cron/recap`. Check the message in graph8's Work channel `#roi-advisor`, and check the ledger shows no new `studio_copilot` charge (`OPS.listUsageTransactions`, first page).

- [ ] **Step 6: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): weekly recap to #roi-advisor with quiet-week skip"
```

---

### Task 18: MCP tools over the Advisor's data

**Files:**
- Create: `advisor/src/lib/mcp/tools.ts`
- Modify: `advisor/src/app/api/[transport]/route.ts` (register the real tools in addition to `ping`)
- Test: `advisor/tests/mcp/tools.test.ts`

**Interfaces:**
- Consumes: `DashboardData` (Task 14), `computeStats`/`Stat`, `Finding`, `AttributedCharge`.
- Produces (pure functions over `DashboardData`, each returning a plain-text answer):
  - `roiSummary(d: DashboardData): string`
  - `costPerOutcome(d: DashboardData, p: { dimension: "list" | "segment" | "service"; value: string }): string`
  - `listFindings(d: DashboardData, p: { status?: string; kind?: string }): string`
  - `explainCharge(d: DashboardData, ledgerId: string): string`
  - `prespendEstimate(p: { listSize: number; missing: number; pricePerRecord: number; calibration: number }): string`
  - `registerTools(server: { registerTool: Function }, load: () => Promise<DashboardData>): void`

- [ ] **Step 1: Write the failing test `advisor/tests/mcp/tools.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { attributeCharges, coverage } from "@/lib/domain/attribution";
import { roiSummary, explainCharge, costPerOutcome, listFindings, prespendEstimate } from "@/lib/mcp/tools";
import type { DashboardData } from "@/lib/dashboard/data";
import { loadDesignInput } from "../helpers/design-fixture";

const charges = attributeCharges(loadDesignInput());
const d: DashboardData = { charges, runs: [], coverage: coverage(charges), waste: 115, now: "2026-10-04T00:00:00Z",
  stats: [{ period: "30d", dimension: "segment", value: "Vice President|Sales|Fintech|51-200", credits: 2100, creditsExact: 2100, meetings: 17, deals: 0, wonValue: 0,
    contactsReached: 212, costPerMeeting: 124, costPerDeal: null, vsAvgPct: -62, evidenceN: 17, confidence: "high", simulated: true, computedAt: "2026-10-04T00:00:00Z" }],
  findings: [] };

describe("MCP tools", () => {
  it("summarises spend, coverage and waste", () => expect(roiSummary(d)).toContain("1,260 credits"));
  it("explains a real charge", () => {
    const c = charges.find((x) => x.tokensIn === 214)!;
    expect(explainCharge(d, c.ledgerId)).toContain("Meeting Prep Brief · Jamie Elden, Listrak");
    expect(explainCharge(d, "nope")).toMatch(/No charge/);
  });
  it("answers cost per outcome with the simulated label", () =>
    expect(costPerOutcome(d, { dimension: "segment", value: "Vice President|Sales|Fintech|51-200" })).toBe(
      "Vice President|Sales|Fintech|51-200: 124 credits per meeting across 17 meetings (62% below average, high confidence). Includes simulated data."));
  it("says so when there are no findings", () => expect(listFindings(d, {})).toBe("No findings match."));
  it("estimates pre-spend credits", () => expect(prespendEstimate({ listSize: 250, missing: 13, pricePerRecord: 3, calibration: 1 })).toContain("39 credits"));
});
```

- [ ] **Step 2: Implement `advisor/src/lib/mcp/tools.ts`**

```ts
import { z } from "zod";
import type { DashboardData } from "../dashboard/data";
import { estimateCredits } from "../domain/prespend";

const n = (x: number) => Math.round(x).toLocaleString("en-US");

export function roiSummary(d: DashboardData): string {
  const pct = d.coverage.total ? Math.round((d.coverage.exact / d.coverage.total) * 100) : 0;
  const org = d.stats.find((s) => s.dimension === "org");
  const cpm = org?.costPerMeeting != null ? `${n(org.costPerMeeting)} credits per meeting` : "no meetings recorded yet";
  return `${n(d.coverage.total)} credits spent; ${pct}% traced exactly; ${n(d.waste)} wasted; ${cpm}.`;
}

export function costPerOutcome(d: DashboardData, p: { dimension: "list" | "segment" | "service"; value: string }): string {
  const s = d.stats.find((x) => x.dimension === p.dimension && x.value === p.value);
  if (!s) return `No data for ${p.dimension} "${p.value}".`;
  if (s.costPerMeeting === null) return `${p.value}: ${n(s.credits)} credits, no meetings yet.`;
  const vs = s.vsAvgPct === null ? "" : `${Math.abs(Math.round(s.vsAvgPct))}% ${s.vsAvgPct < 0 ? "below" : "above"} average, `;
  return `${p.value}: ${n(s.costPerMeeting)} credits per meeting across ${n(s.meetings)} meetings (${vs}${s.confidence} confidence).${s.simulated ? " Includes simulated data." : ""}`;
}

export function listFindings(d: DashboardData, p: { status?: string; kind?: string }): string {
  const xs = d.findings.filter((f) => (!p.status || f.status === p.status) && (!p.kind || f.kind === p.kind));
  return xs.length ? xs.map((f) => `[${f.kind}] ${f.title}: ${f.body} (${n(f.creditsAtStake)} credits, ${f.confidence})`).join("\n") : "No findings match.";
}

export function explainCharge(d: DashboardData, ledgerId: string): string {
  const c = d.charges.find((x) => x.ledgerId === ledgerId);
  if (!c) return `No charge with ledger ID ${ledgerId}.`;
  return `${c.chargedAt}: ${c.credits} credits for ${c.explanation} (service ${c.service}, matched by ${c.method}, result ${c.result}${c.isWaste ? `, waste: ${c.wasteReason}` : ""}).`;
}

export function prespendEstimate(p: { listSize: number; missing: number; pricePerRecord: number; calibration: number }): string {
  const est = estimateCredits({ records: p.missing, pricePerRecord: p.pricePerRecord, calibration: p.calibration });
  return `Enriching the ${n(p.missing)} of ${n(p.listSize)} contacts that need it costs about ${n(est)} credits.`;
}

type Server = { registerTool: (name: string, meta: { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny> }, cb: (a: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>) => void };
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function registerTools(server: Server, load: () => Promise<DashboardData>): void {
  server.registerTool("roi_summary", { title: "ROI summary", description: "Credits spent, share traced, waste and cost per meeting.", inputSchema: {} }, async () => text(roiSummary(await load())));
  server.registerTool("cost_per_outcome", { title: "Cost per outcome", description: "Credits per meeting for a list, segment or service.",
    inputSchema: { dimension: z.enum(["list", "segment", "service"]), value: z.string() } },
    async (a) => text(costPerOutcome(await load(), { dimension: a.dimension as "list" | "segment" | "service", value: String(a.value) })));
  server.registerTool("list_findings", { title: "List findings", description: "The Advisor's findings, optionally filtered.",
    inputSchema: { status: z.string().optional(), kind: z.string().optional() } }, async (a) => text(listFindings(await load(), { status: a.status as string | undefined, kind: a.kind as string | undefined })));
  server.registerTool("explain_charge", { title: "Explain a charge", description: "What one credit-ledger line paid for.", inputSchema: { ledger_id: z.string() } },
    async (a) => text(explainCharge(await load(), String(a.ledger_id))));
  server.registerTool("prespend_estimate", { title: "Pre-spend estimate", description: "Estimate enrichment credits for the contacts that need it.",
    inputSchema: { list_size: z.number().int(), missing: z.number().int(), price_per_record: z.number().default(3), calibration: z.number().default(1) } },
    async (a) => text(prespendEstimate({ listSize: Number(a.list_size), missing: Number(a.missing), pricePerRecord: Number(a.price_per_record ?? 3), calibration: Number(a.calibration ?? 1) })));
}
```

- [ ] **Step 3: Register the tools in the route.** In `advisor/src/app/api/[transport]/route.ts`, inside the `createMcpHandler` init callback and after the `ping` registration, add:

```ts
    registerTools(server as unknown as Parameters<typeof registerTools>[0], () => loadDashboardData());
```
Add the imports `import { registerTools } from "@/lib/mcp/tools";` and `import { loadDashboardData } from "@/lib/dashboard/data";`.

- [ ] **Step 4: Run tests and a local call.** Run `npm test` and expect PASS. Then repeat Task 4, Step 6 with `"method":"tools/call","params":{"name":"roi_summary","arguments":{}}`. Expected: the text contains "credits spent".

- [ ] **Step 5: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): MCP tools for summary, cost per outcome, findings, charges, estimates"
```

---

### Task 19: Simulated demo data and cleanup

**Files:**
- Create: `advisor/scripts/seed-sim.ts`, `advisor/scripts/sim-events.ts`, `advisor/scripts/cleanup-sim.ts`, `advisor/src/lib/sim/plan.ts`
- Test: `advisor/tests/sim/plan.test.ts`

**Interfaces:**
- Produces:
  - `buildSimPlan(seed: number, now: string, lists: { id: number; label: string; contactIds: number[]; costPerMeeting: number; meetings: number }[]): { charges: AttributedCharge[]; events: WebhookEnvelope[] }`. Deterministic for a given seed. Every charge has `simulated: true` and `ledgerId` starting `sim-`. Every event has `data.simulated === true` and an `id` starting `sim-`.

- [ ] **Step 1: Write the failing test `advisor/tests/sim/plan.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildSimPlan } from "@/lib/sim/plan";

const lists = [{ id: 101, label: "Fintech VPs", contactIds: [1, 2, 3, 4], costPerMeeting: 124, meetings: 17 },
  { id: 102, label: "Starter list", contactIds: [5, 6], costPerMeeting: 1200, meetings: 4 }];

describe("buildSimPlan", () => {
  const p = buildSimPlan(42, "2026-10-04T00:00:00Z", lists);
  it("is deterministic", () => expect(buildSimPlan(42, "2026-10-04T00:00:00Z", lists)).toEqual(p));
  it("labels everything simulated", () => {
    expect(p.charges.every((c) => c.simulated && c.ledgerId.startsWith("sim-"))).toBe(true);
    expect(p.events.every((e) => e.data.simulated === true && e.id!.startsWith("sim-"))).toBe(true);
  });
  it("hits the target cost per meeting per list", () => {
    for (const l of lists) {
      const credits = p.charges.filter((c) => c.listId === l.id).reduce((s, c) => s + c.credits, 0);
      const meetings = p.events.filter((e) => e.event === "meeting.booked" && e.data.list_id === l.id).length;
      expect(meetings).toBe(l.meetings);
      expect(credits / meetings).toBeCloseTo(l.costPerMeeting, 0);
    }
  });
  it("spreads events over the last 8 weeks", () => {
    const ts = p.events.map((e) => Date.parse(e.timestamp));
    expect(Math.min(...ts)).toBeGreaterThanOrEqual(Date.parse("2026-08-09T00:00:00Z"));
    expect(Math.max(...ts)).toBeLessThanOrEqual(Date.parse("2026-10-04T00:00:00Z"));
  });
});
```

- [ ] **Step 2: Implement `advisor/src/lib/sim/plan.ts`**

```ts
import type { AttributedCharge } from "../domain/types";
import type { WebhookEnvelope } from "../webhooks/verify";

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

export function buildSimPlan(seed: number, now: string, lists: { id: number; label: string; contactIds: number[]; costPerMeeting: number; meetings: number }[]) {
  const r = rng(seed), end = Date.parse(now), span = 56 * 86_400_000;
  const charges: AttributedCharge[] = [], events: WebhookEnvelope[] = [];
  let k = 0;
  for (const l of lists) {
    const total = l.costPerMeeting * l.meetings, parts = Math.max(1, l.contactIds.length * 3), each = total / parts;
    for (let i = 0; i < parts; i++) {
      const t = new Date(end - Math.floor(r() * span)).toISOString();
      charges.push({ ledgerId: `sim-${seed}-${k++}`, ledgerType: "usage", service: "waterfall_enrichment", credits: Math.round(each * 100) / 100, chargedAt: t, llmTier: null,
        tokensIn: null, tokensOut: null, description: `[sim] enrichment for ${l.label}`, method: "advisor", runExtId: `sim-run-${l.id}`, listId: l.id,
        contactId: l.contactIds[i % l.contactIds.length], segmentKey: null, explanation: `[sim] Email finder · ${l.label}`, result: "success", isWaste: false, wasteReason: null, simulated: true });
    }
    for (let m = 0; m < l.meetings; m++) {
      // keep the email sent 3 days earlier inside the 8-week window
      const contact = l.contactIds[m % l.contactIds.length], t = end - Math.floor(r() * (span - 3 * 86_400_000));
      const common = { org_id: "sim", data: { contact_id: contact, list_id: l.id, simulated: true } };
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_sent", timestamp: new Date(t - 3 * 86_400_000).toISOString(), ...common, data: { ...common.data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_replied", timestamp: new Date(t - 86_400_000).toISOString(), ...common, data: { ...common.data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "meeting.booked", timestamp: new Date(t).toISOString(), ...common });
    }
  }
  return { charges, events };
}
```

- [ ] **Step 3: Run the test.** Run `npm test -- tests/sim`. Expected: PASS (4 tests).

- [ ] **Step 4: Create the scripts.** Add `advisor/.sim-plan.json` to the repo-root `.gitignore` first (`echo "advisor/.sim-plan.json" >> /home/opc/graph8/.gitignore`).

```ts
// advisor/scripts/seed-sim.ts
import fs from "node:fs";
import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { RecordStore } from "../src/lib/store/records";
import { chargeToValues } from "../src/lib/store/mappers";
import { buildSimPlan } from "../src/lib/sim/plan";

type Row = { id: number; job_title: string | null; seniority_level: string | null; job_department: string | null };
const rows: Row[] = [];
for (let page = 1; ; page++) { const r = await c.call<Row[]>(OPS.getListContacts, { path: { list_id: 2 }, query: { page, limit: 200 } }); rows.push(...r); if (r.length < 200) break; }
const vps = rows.filter((r) => r.seniority_level === "Vice President").map((r) => r.id).slice(0, 20);
const founders = rows.filter((r) => /founder/i.test(r.job_title ?? "") && !vps.includes(r.id)).map((r) => r.id).slice(0, 20);
async function simList(title: string, ids: number[]): Promise<number> {
  const l = await c.call<{ id: number }>(OPS.createList, { body: { title, description: "[sim] demo list for ROI Advisor", type: "contacts" } });
  await c.call(OPS.addContactsToList, { path: { list_id: l.id }, body: { contact_ids: ids, conflict_resolution: "add_all" } });
  return l.id;
}
const vpList = await simList("[sim] Sales VPs", vps), founderList = await simList("[sim] Founders", founders);
const plan = buildSimPlan(20260926, new Date().toISOString(), [
  { id: vpList, label: "[sim] Sales VPs", contactIds: vps, costPerMeeting: 124, meetings: 17 },
  { id: founderList, label: "[sim] Founders", contactIds: founders, costPerMeeting: 433, meetings: 6 },
  { id: 2, label: "Starter list", contactIds: rows.slice(0, 30).map((r) => r.id), costPerMeeting: 1200, meetings: 4 },
]);
const charges = new RecordStore(c, "roi_charge");
for (const ch of plan.charges) await charges.upsert(chargeToValues(ch));
const STAGE = { new: "2df1e28d-344c-4940-8bc2-e456bfd874a8", discovery: "2e65b28e-5fc4-49f5-966e-5e8081a921c2", proposal: "3b1e986e-95e1-4179-ad02-2c93b228d5d3",
  won: "59e2345b-7d09-47fe-8ea8-a7e5cbb57437", lost: "3e17b0cb-e2cc-4cd5-993c-69d93858c866" };
const meetings = plan.events.filter((e) => e.event === "meeting.booked");
let made = 0;
for (const [i, m] of meetings.entries()) {
  const contactId = Number(m.data.contact_id), closeDate = m.timestamp.slice(0, 10);
  const deal = await c.call<{ id: string }>(OPS.createDeal, { body: { name: `[sim] deal ${i + 1}`, contact_ids: [contactId], owner_id: "mominimran000@gmail.com",
    amount: 6000 + (i % 5) * 3000, stage_id: STAGE.new, allow_duplicate: true, description: "[sim] ROI Advisor demo deal" } });
  await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.discovery } });
  if (i % 3 === 0) await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.won, close_date: closeDate } });
  else if (i % 3 === 1) await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.lost, close_date: closeDate, closed_lost_reason: "[sim] no budget" } });
  else await c.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: STAGE.proposal } });
  made++;
}
fs.writeFileSync(".sim-plan.json", JSON.stringify({ lists: { vpList, founderList }, events: plan.events }, null, 1));
console.log(JSON.stringify({ vpList, founderList, simCharges: plan.charges.length, deals: made, events: plan.events.length }));
```

```ts
// advisor/scripts/sim-events.ts
import fs from "node:fs";
import { createHmac } from "node:crypto";
import type { WebhookEnvelope } from "../src/lib/webhooks/verify";

const url = `${process.env.ADVISOR_URL}/api/webhooks/graph8`, secret = process.env.G8_WEBHOOK_SECRET;
if (!process.env.ADVISOR_URL || !secret) throw new Error("Set ADVISOR_URL and G8_WEBHOOK_SECRET in .env.local");
const { events } = JSON.parse(fs.readFileSync(".sim-plan.json", "utf8")) as { events: WebhookEnvelope[] };
let ok = 0, failed = 0;
for (const e of events) {
  const body = JSON.stringify(e), ts = Math.floor(Date.now() / 1000);
  const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-studio-signature": sig, "x-studio-timestamp": String(ts) }, body });
  if (res.ok) ok++; else { failed++; console.error(e.id, res.status, await res.text()); }
  await new Promise((r) => setTimeout(r, 100));
}
console.log(JSON.stringify({ sent: ok, failed }));
```

```ts
// advisor/scripts/cleanup-sim.ts
import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { RecordStore } from "../src/lib/store/records";

const apply = process.argv.includes("--apply");
const deals: { id: string; name: string }[] = [];
for (let page = 1; ; page++) { const r = await c.call<{ id: string; name: string }[]>(OPS.listDeals, { query: { page, limit: 100 } }); deals.push(...r); if (r.length < 100) break; }
const simDeals = deals.filter((d) => d.name.startsWith("[sim]"));
const simRecords: [string, string][] = [];
for (const slug of ["roi_charge", "roi_outcome", "roi_stat", "roi_finding", "roi_run"])
  for (const r of await new RecordStore(c, slug).list()) if (r.values.simulated === true) simRecords.push([slug, r.id]);
const lists = (await c.call<{ id: number; title: string }[]>(OPS.listLists)).filter((l) => l.title.startsWith("[sim]"));
console.log(JSON.stringify({ simDeals: simDeals.length, simRecords: simRecords.length, simListsToReviewWithUser: lists }));
if (!apply) { console.log("Dry run. Re-run with --apply to delete the deals and records listed above. Lists are never deleted by this script."); process.exit(0); }
for (const d of simDeals) await c.call(OPS.deleteDeal, { path: { deal_id: d.id } });
for (const [slug, id] of simRecords) await c.call(OPS.archiveRecord, { path: { object_slug: slug, record_id: id } });
console.log(`deleted ${simDeals.length} deals, archived ${simRecords.length} records`);
```

- [ ] **Step 5: Ask the user, then seed.** Ask: "May I create about 40 `[sim]` deals and 2 `[sim]` lists and send simulated email and meeting events to the Advisor? No emails go to anyone, and it costs no credits." After yes, run `seed-sim.ts`, then `sim-events.ts`, then `sync-once.ts`. Expected: the Overview shows SIM meetings and credits per meeting by list, close to the targets you seeded.

- [ ] **Step 6: Commit**

```bash
cd /home/opc/graph8 && git add advisor && git commit -m "feat(advisor): deterministic simulated demo data, signed event replay, cleanup"
```

---

### Task 20: Production wiring, demo rehearsal and handoff update

**Files:**
- Create: `advisor/vercel.json`, `docs/DEMO.md`
- Modify: `docs/HANDOFF.md` (status and anything learned), `README.md` (how to run)

- [ ] **Step 1: Create `advisor/vercel.json`.** Vercel Hobby plans allow crons only once a day. Check the plan with `npx vercel project inspect graph8-roi-advisor` or ask the user. On Hobby, change the poll schedule to `"0 6 * * *"` and rely on the "Sync now" button and the webhooks for freshness.

```json
{
  "crons": [
    { "path": "/api/cron/poll", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/recap", "schedule": "0 9 * * 1" }
  ]
}
```

- [ ] **Step 2: Set the remaining env vars in Vercel** (`CRON_SECRET` with a new random value, `ADVISOR_URL`, `ROI_ADVISOR_CHANNEL`, `G8_WEBHOOK_SECRET` if not done), then run `npx vercel deploy --prod`.

- [ ] **Step 3: Full verification**

```bash
cd /home/opc/graph8/advisor && npm run typecheck && npm test && npm run build
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" "$(grep '^ADVISOR_URL=' .env.local | cut -d= -f2-)/api/cron/poll"
```
Expected: typecheck clean, all tests pass, the build succeeds, and the cron returns a summary with `coverage.total` of at least 1,260. Use the production `CRON_SECRET` value for the last call.

- [ ] **Step 4: Write `docs/DEMO.md`.** Base it on spec §9.2, with the exact URLs, the password location, and what to click at each step:
  1. Problem (ledger)
  2. Overview (REAL numbers)
  3. SIM outcomes and findings
  4. Guardrail live on list 13
  5. Recap in `#roi-advisor`
  6. Ask via MCP from Claude, with the config snippet:

  ```json
  { "graph8-roi": { "url": "<ADVISOR_URL>/api/mcp", "headers": { "Authorization": "Bearer <MCP_TOKEN>" } } }
  ```

  Include a pre-demo checklist: run a sync, check the balance, confirm the SIM tags are visible, and run the cleanup plan after the demo.

- [ ] **Step 5: Update `docs/HANDOFF.md`.** Add a "Build status" section: tasks done, live URLs (without secrets), results of the two risk tasks, the first-sync numbers, known gaps, and the depth backlog order (spec §10). Update `README.md` with "How to run locally" (`cd advisor && npm install && npm run dev`) and "How to test" (`npm test`).

- [ ] **Step 6: Commit**

```bash
cd /home/opc/graph8 && git add advisor docs README.md && git commit -m "chore(advisor): production crons, demo script, handoff status"
```

---

## Depth backlog (after the thin slice works, in this order)

Each item extends the file named with it; write a test for each before the code.

1. **One-click actions** (`src/app/(dash)/actions.ts`): "Build lookalike list" (`OPS.saveContactSearch` with the winning segment's filters; charged 0 in testing), "Pause list", "Dismiss / snooze" (via `dismiss()` and a finding upsert).
2. **Cohort attribution** (`domain/metrics.ts`): credit a meeting to spend up to 30 days earlier on the same contact, not the same window.
3. **Slack or email recap** (`recap/recap.ts`), once the org connects Slack or a mailbox.
4. **App Page** version of the dashboard (spec §6.5), once graph8's AI generation works: `POST /app-pages` with `roi_stat` and `roi_finding` sources.
5. **Weekly `roi_stat` snapshots**, for exact trend lines (`LineChart` over snapshots).
6. **Per-user spend** (`triggered_by` on runs).
7. **Multi-list guardrails**, and "Enrich best-fit only" by record IDs (`bestFitSubset`).
8. **Anomaly detection** on spend per service, and price-change alerts from `OPS.listProviders`.
9. **Multi-org** keys (`X-Target-Org-Id`).
10. **Settings screen** (spec §6.1 item 5): thresholds from `gate.ts`/`findings.ts` moved into a `roi_stat`-style settings record, plus recap schedule and coverage tips. The thin slice keeps the thresholds as constants in code.
11. **Free failed attempts on the Charges screen**: store `hold` and `hold_release` ledger rows (a separate `roi_charge` `ledger_type`, never counted as spend), then show `countHolds()` (Task 5) as "N failed attempts at no cost".
12. **Engagement summaries** (`OPS.getContactEngagement`) as a second source of "contacts reached" and emails/calls per contact, so real sends count even when webhooks were missed.
