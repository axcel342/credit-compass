# Handoff: Credit Compass (ROI Advisor) POC on graph8

Read this first if you are picking up the build. It carries the context of the design conversation (2026-09-26) that isn't obvious from the spec, the plan or the code.

**Read in this order:**

1. This file
2. `docs/superpowers/specs/2026-09-26-roi-advisor-design.md` (the approved design, with validation evidence)
3. `docs/superpowers/plans/2026-09-26-roi-advisor.md` (the task-by-task implementation plan)
4. `docs/design/credit-compass-ui-v2.html` (the approved UI; open it in a browser). Earlier mockups are in `docs/design/mockups/`.
5. `research/README.md` (fixtures from the real org, reference data, probe scripts)

Background on graph8 itself: `g8-product-overview.md` (what the product offers) and `g8-reference.md` (every CLI command, MCP tool and REST endpoint, generated from the installed package).

---

## v2 build status (2026-09-27)

**All three phases complete and deployed** (`main` tip `c2f1d98`): Tasks 1–15 of `docs/superpowers/plans/2026-09-27-credit-compass-v2.md`. **54 test files / 240 tests** (239 at the whole-branch review; +1 for the open-findings default), `tsc --noEmit` clean, `next build` clean, production E2E passed for all three phases. The three phase PRs (**#1**, **#2**, **#3**) are merged to `main`; production is deployed at https://graph8-roi-advisor.vercel.app.

- **Phase 1 (Tasks 1–9):** one dataset with 8-week/30-day periods, outcome buckets and activities, the Overview statement with the three-column credit flow, Charges grouped by activity, Recovery with the weekly waste chart and refund draft, the Optimize planner (enrichment types, cost walk, forecast, fit bar) and Optimize actions with apply/undo.
- **Phase 2 (Tasks 10–11):** rolling cost-per-meeting trend and first-touch cohorts; MCP/recap demo-data wording, demo script and this handoff.
- **Phase 3 (Tasks 12–15) — connect your own graph8 account:**
  - **App-install spike:** the org **is allowlisted**; draft app `dapp_601136e18d90` exists (no install, no cleanup defined) — §16.
  - **Workspaces:** each connected key is encrypted at rest with AES-256-GCM under `WORKSPACE_KEY_SECRET`, and the `cc_ws` session cookie is HMAC-signed with `SESSION_SECRET`; both were added to Vercel production.
  - **`/connect`** API-key flow with idempotent bootstrap (objects, fields and the per-workspace webhook are reused on reconnect via the key hash).
  - **Per-workspace crons, webhooks and MCP:** crons fan out over workspaces, webhooks deliver to `/api/webhooks/graph8/{workspace}`, and MCP resolves the workspace from its bearer token.
  - **Disconnect fails closed:** if the graph8 webhook cannot be removed, the workspace and cookie stay so the user can retry.
  - **SSE is demo-token-only by decision** — workspace MCP uses streamable HTTP `POST /api/mcp` with its bearer token; the `/api/sse` session path is gated to `MCP_TOKEN` (SSE isolation between the demo and workspace callers could not be distinguished on this single-org setup).
- **Live actions applied and undone:** Task 9 ran `applyRepeatSkip` on sim lists 15 and 16 (`{ changed: [15, 16] }`), then `undoAction` on both. Read-back: both pipelines exactly as found (`enabled: false`, `run_condition: null`, both skip flags true); no run, **0 credits**, list 2 never touched. The two `roi_action` rows remain as undo history and show as "Undone Sep 27" in "Changes you've made".
- **Re-seed numbers** (`npm run script -- scripts/check-sim.ts`, re-run 2026-09-27; detail in §15): `total` **10,766**, `bucketsAddUp` true, buckets booked 2,897.26 / no meeting 6,651.74 / unused 860 / unknown 242 / waste 115; per list Starter 1,232.75 (4 meetings), Sales VPs 124 (17), Founders 433 (6); `repeatShare` 0.121; `cohortWeeks` 8; meetings 27; won 9. Stats store both the 8-week and 30-day periods; the dashboard reads the 8-week ones.
- **Fit spread:** 255 cached contacts after the 27 Sep 08:14 UTC sync — **high 33 / medium 100 / low 122 / unknown 0**.
- **Deferred (not blocking):** Redis workspace index pruning (a rotated key can leave a stale `cc:wskey:*` entry); a removed workspace whose cookie is still present falls back to the demo org instead of returning to `/connect`; a rotated `WORKSPACE_KEY_SECRET` makes decrypt throw 500 (clearing `cc_ws` recovers to demo); the Recovery week filter can contradict the chart when waste spans weeks.

## Build status (end of Task 20, 2026-09-26)

**Thin slice complete.** Tasks 1–20 of `docs/superpowers/plans/2026-09-26-roi-advisor.md` are done and deployed. Final production build: `tsc --noEmit` clean, 108 tests across 29 files pass, `next build` succeeds.

A final whole-branch review added one fix wave (commit `619c01c` + `5951893`): cron routes fail closed when `CRON_SECRET` is unset, `roi_fit` treats a zero org meeting rate as unknown evidence, webhook outcomes fall back to ingest time when the envelope has no timestamp and envelopes without `id`/`event` are rejected, findings that disappear become `applied` while dismissed/snoozed ones keep their state and regenerated findings resurface as open, charts label SIM rows `[sim]`, and the guardrail reuses only the `Verified emails` pipeline. Production was redeployed and re-verified after the fixes (cron `216/1033/11` total `1,260`, 7 findings; unauthenticated cron returns 401; SSE `event: endpoint`).

### Live

- Dashboard (password-gated): https://graph8-roi-advisor.vercel.app — the password lives only in the Vercel `DASHBOARD_PASSWORD` env var and locally in `advisor/.env.local`, never in the repo.
- MCP endpoint (bearer `MCP_TOKEN`): https://graph8-roi-advisor.vercel.app/api/mcp
- Webhook receiver: https://graph8-roi-advisor.vercel.app/api/webhooks/graph8
- Crons (`advisor/vercel.json`): `/api/cron/poll` **daily 06:00 UTC** and `/api/cron/recap` **Mondays 09:00 UTC**. The team is on the **Hobby** plan (`npx vercel teams ls`), and Hobby allows only daily schedules, so the plan's `*/10 * * * *` poll became `0 6 * * *`; freshness during a demo comes from **Sync now** and the webhooks.
- `CRON_SECRET` was rotated for Task 20 (new random value in `advisor/.env.local` and Vercel production only; `.env.example` lists the name).

### Risk tasks

| Risk | Result |
|---|---|
| Webhook receiver (Task 3) | **PASS.** Real `deal.created`, `deal.stage_changed` and `workflow.execution_completed` deliveries verified with signatures and stored. `deal.updated` never fires (see §10). |
| MCP from graph8 (Task 4) | **PASS.** Registered as SSE server `d96d0ab1-84ff-46e9-a80f-3361c07c8765`; the `[sim] ROI Advisor MCP test` workflow called `ping` over SSE (execution `99cd7178-0ef7-440a-a00c-f276689459dd`, 0 credits, output "ROI Advisor is up"). The §6.4 fallback is not needed. |

### Live numbers

- First live sync: **126 charges, 1,260 credits**, coverage exact **216** / window **1,033** / service-only **11**; findings **5** at first sync → **7** after the sim data.
- Guardrail live run (list 13): row **66 low**, rows **81 + 249 unknown**; run `f9cf7ef4…` skipped **1**, spent **0 credits**.
- Recap posted to `#roi-advisor`: **3 items, 0 charges**.
- Production cron re-check (Task 20): `{"newLedgerRows":2,"charges":126,"coverage":{"exact":216,"window":1033,"none":11,"total":1260},"findings":7}`.
- Demo script: `docs/DEMO.md`. Sim cleanup is still a dry run only (`--apply` needs user approval; lists are never deleted by the script).

### Known gaps

- ~~SSE / graph8-registered MCP pending Redis~~ Resolved 2026-09-26: registered and probed live (§11). MCP tool-node argument passing for tools with required inputs is untested (`ping` takes none).
- The 30-day stats are a partial sample of the seeded 8-week targets, so the 30-day view's cost-per-meeting differs from the full-window targets (the dashboard defaults to 8 weeks).
- Dashboard deep links show contact/deal IDs rather than `app.graph8.com` URLs.
- The refund send path is built and confirm-gated but has not been exercised (0 support requests sent).
- No Slack/email recap (the org has no mailbox or Slack) and no App Page (graph8's LLM features were down).
- Sim artifacts are still in the org; the cleanup dry run lists 30 deals, 444 records and lists 13–16 for review.

### Depth backlog (spec §10 order)

One-click actions (lookalike list, pause, refund send) → cohort attribution → Slack/email recaps → App Page → weekly `roi_stat` snapshots → per-user spend → multi-list guardrails → anomaly detection → multi-org. The task-20 brief carries the fuller 12-item version (adds the settings screen, the free-failed-attempts display and engagement summaries).

---

## 1. What we're building and why

**ROI Advisor** answers the question graph8 leaves open: *which of my credits turned into meetings and pipeline, which bought nothing, and where should I spend next?*

graph8's credit ledger records only service, amount and time. Its analytics show results but no cost. The Advisor joins the two, explains every charge, finds waste, and enforces its advice through graph8's own list-pipeline run conditions. It posts a weekly recap inside graph8 and answers questions over MCP.

**Context:** a graph8 hackathon. The target is a **1–2 day thin, end-to-end, live-demoable slice of every part**, then depth work in priority order if time allows. The user explicitly asked that the plan keep depth so the thin slice can be improved after it works.

## 2. How we got here (so you don't re-litigate settled choices)

1. **Idea exploration.** Four POC ideas were proposed: AI output auditor, outreach experiment engine, credit ROI ledger, workflow regression tests. Ideas that duplicate existing graph8 features were ruled out; graph8's API exposes 3,139 operations, far more than documented, including Desk, committees, sales coach, TAM, social listening, NPS and security questionnaires.
2. **AI Output Auditor (dropped).** A spike found real problems: skills have no search tool and invent citations. But graph8's LLM provider account ran out of credit mid-session (all 14 system skills and agent chat failed), so it couldn't be tested end to end.
3. **Idea A, contact record consistency (validated; now an input signal).** 48% of the org's contacts have an email domain that doesn't match their company. Flagged vs consistent contacts, checked with graph8's own tools: bounce 45% vs 20%; graph8's lookup gives a different company 60% vs 0%; any problem 85% vs 20% (p = 0.0001). Web checks confirmed 3 of 4 flagged cases (1 false positive: a founder of two companies). The bad data comes from graph8's global index and is worst in founder / 1–50-employee segments. The ROI Advisor uses this as the `record_consistency` signal.
4. **ROI Advisor (current).** The user chose it, then approved: all three surfaces (dashboard, non-spammy coach, pre-spend advisor), all add-ons, a hybrid simulation approach, Vercel hosting, graph8 custom objects as the store, and the five design sections, each validated live.

## 3. How the user wants work done (follow these)

- **Validate against the real platform before relying on anything.** Use the CLI (`g8`), the hosted MCP server (`https://be.graph8.com/mcp/`) or the SDK (`@graph8/sdk`). Report results as ✅ proven / ⚠ proven with a caveat / ❓ unproven. Don't present assumptions as facts. When something breaks an assumption, say so and change the design.
- **Spend carefully and ask first.**
  - Design validation ran under a user-set **500-credit cap**; 164 were used.
  - Before spending credits in the build, estimate the cost, use a guard (see `research/scripts/guard.py`) and ask the user for a build budget if one isn't given.
  - Never send anything to real people (emails, SMS, calls, support tickets, sequences) without explicit confirmation.
- **Label simulated data `[sim]` everywhere** (names, descriptions, the `simulated` flag) and never present it as real.
- **Keep asking what else would add value** at each step, and surface add-on ideas.
- **Explain in plain language.** The user likes visual mockups for UI decisions.
- **Don't delete things you didn't create.** Ask about the ten "Revenue-…" lists (ids 3–12); they appeared after read-only calls and we didn't create them.
- **Confirm before outward-facing actions:**
  - Deploying to Vercel (account `axcel342` is confirmed as the user's; still ask before the first deploy and before creating the project)
  - Adding Upstash Redis
  - Posting in graph8 Work channels other than `#roi-advisor`
  - Registering MCP servers in graph8

## 4. Environment and access

- **Machine:** Linux arm64, Node 22.23, npm 10.9, git 2.52, Vercel CLI 60.1.3 (logged in as `axcel342`, confirmed as the user's account). GitHub CLI `gh` is logged in as the same account.
- **Python helpers:** the CLI `g8` lives at `/home/opc/.local/bin/g8` (package `g8-mcp-server` 0.79.0). Its Python environment has the `mcp` client: `/home/opc/.local/share/uv/tools/g8-mcp-server/bin/python`.
- **Secrets:** `/home/opc/graph8/.env` (gitignored): `G8_API_KEY`, `G8_ORG_ID`, `G8_PROBE_WEBHOOK_SECRET`. Never commit or print them. `.env.example` lists every variable the app needs.
- **API base:** `https://be.graph8.com/api/v1`. Python's `urllib` is blocked by Cloudflare (error 1010); use Node, curl or the SDK.
- **Org:** `org_5e2170609156` ("Hackathon Momin Qureshi"). Balance about 8,740 credits at handoff. 250 contacts and 249 companies (starter list = list 2), 1 default deal pipeline, no mailbox, no Slack, no phone numbers.

## 5. graph8 behaviours that will bite you (all observed live)

These are also in spec §2.4 and Appendix A–B; the ones most likely to cost time are repeated here.

1. **Two contact IDs.** Lists, deals, fields, enrichment and `GET /contacts/{id}` use the **CRM row ID** (1–250). The contact detail's `data.id` is a **global ID** (e.g. 1088906). Deals take row IDs.
2. **Standalone skill runs** aren't listable and send no webhook. **Enrichment jobs** send no webhook. **Workflow runs** do (`workflow.execution_completed`).
3. **`deal.won` doesn't fire.** Poll `GET /deals/{id}/history`. Closed Won needs `close_date`. Deals can't be backdated.
4. **The G8X run-condition grammar is function-style:** `NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))`. `==` and JavaScript are rejected. Validate with `POST /enrichment/ai-formula/validate`.
5. **The pipeline estimator ignores run conditions and "skip existing values"**: it always quotes every contact. Count contacts yourself with the routing preview (`equals` operator; unknown operators silently match everyone).
6. **Posting in a Work channel with agents triggers a charged agent reply** (about 24 credits). Automated posts go only to `#roi-advisor` (`7705335b-6dba-51d8-baf9-207a0d19fe4f`, no agents, 0 credits). Markdown isn't rendered; send `document` blocks.
7. **Rate limits:** 50/s and 1,000/min, with 429 on overflow.
8. **Custom objects:** a unique `ext_id` gives idempotent writes (409 on duplicate). No references to built-in objects. List reads have no filters (page through them).
9. **Custom contact fields are text only**, and values don't come back on contact reads (routing still sees them).
10. **MCP registration accepts only `sse`.** graph8 fetching tools from an external server is unproven (502 with a stand-in).
11. **graph8's LLM features were down during design** (provider out of credit). The core design doesn't depend on them.
12. **CLI bugs:** `g8 skill-execute` drops inputs (call `POST /skills/{id}/execute` with `{"input_data":…}`); `g8 skill-create-llm` sends `type` (use `POST /skills` with `runtime_type`).
13. **SDK quirks:** the upsert type for custom-object records is mis-generated (use create and handle 409). Prospect search and saving a list are tiered "billable" but charged 0.

## 6. Real numbers the tests and the demo rely on

Recomputed from the committed fixtures (`research/fixtures/ledger/ledger-2026-09-26.json` plus `research/fixtures/executions/`):

| Quantity | Value |
|---|---|
| Ledger rows / usage rows / services | 144 / 126 / 9 |
| Spend | **1,260** credits |
| `voice_llm` (skill run) charges matched exactly by token count | **13 of 15** (82 credits); 11 credits service-only |
| Attribution split | exact **216**, time window **1,033**, service only **11** |
| Holds | 8, of which 3 were followed by a charge → **5 free failed attempts** |
| Waste | **115** = 77 failed AI enrichment + 14 unreadable LeadMagic + 24 agent side effect |
| Estimate gap | AI enrichment quoted 37, charged 50 |
| Idea A signal | 115 of 238 contacts with email ≠ company domain |
| Guardrail run (list 13) | 3 processed, 1 successful, 2 skipped, 3 credits |

## 7. Pending decisions for the user

1. ~~Is the Vercel account `axcel342` theirs?~~ **Answered 2026-09-26: yes.** The code lives in the private GitHub repo `axcel342/credit-compass`. Still ask before creating the Vercel project and deploying.
2. May we add Upstash Redis (free tier) for MCP SSE? If not, graph8 can't call our MCP server; outside agents still can.
3. Credit budget for the build (not set; design validation had a 500 cap).
4. What to do with the ten "Revenue-…" lists we didn't create.
5. Whether to report the graph8 issues in spec Appendix B to graph8.

## 8. Artifacts already in the org

The full cleanup inventory with IDs is in spec §11. **Keep:** the `roi_fit` field (column 757), the `#roi-advisor` channel. **Delete before the build creates real objects:** the `roi_probe` custom object. **Repoint or replace:** the probe webhook `1bfeaf5a-744f-4900-a8c9-f4da660a97a0` (it points at a non-existent graph8 path and is subscribed to deal, workflow and enrichment events).

## 9. Links

- UI design artifact (private to the user): https://claude.ai/artifact/3kqkXtCv9t4DbuRcExPa3D. The same page is at `docs/design/roi-advisor-ui.html`.

## 10. Captured webhook payloads

Captured live on 2026-09-26 (Task 3 risk probe) to pin down real payload shapes. Trigger: one `[sim] payload capture` deal, created then moved New Meeting → Discovery Held, plus one manual run of workflow `712e4f5b-faee-45fd-9150-ea5853cc08dd` (`[audit-probe] web_search check`; 0 credits, `cost_usd: null`). Receiver: webhook `b114e5b9-c1ba-4874-b722-1f70318712da` ("ROI Advisor receiver") → `https://graph8-roi-advisor.vercel.app/api/webhooks/graph8`. Raw captured lines, values included: `research/fixtures/webhooks/captured-20260926T1758.txt`.

Delivery results (`GET /webhooks/{id}/deliveries`): all three deliveries recorded `status: success`, `response_code: 200` (about 17:50 UTC). **`deal.updated` did NOT arrive**: moving the deal emitted only `deal.stage_changed` and produced no `deal.updated` delivery. No other subscribed event types fired (no deal.won/deleted, no failures, no enrichment/engagement/meeting events). `outcomeFromEvent` (Task 12) must therefore key off `deal.created`, `deal.stage_changed` and `workflow.execution_completed`.

### `deal.created` — `data` keys (verbatim order)

`amount`, `source`, `deal_id`, `currency`, `owner_id`, `stage_id`, `amount_to`, `deal_name`, `eda_event`, `changed_at`, `company_id`, `invoked_by`, `stage_name`, `amount_from`, `owner_id_to`, `pipeline_id`, `amount_delta`, `company_name`, `close_date_to`, `owner_id_from`, `pipeline_name`, `changed_fields`, `g8_correlation`, `close_date_from`, `idempotency_key`

- `g8_correlation` (object) keys: `event`, `org_id`, `eda_event`, `company_id`, `idempotency_key`
- name/email-bearing keys, values redacted here: `deal_name`, `invoked_by`, `company_name`

### `deal.stage_changed` — `data` keys (verbatim order)

`amount`, `source`, `deal_id`, `currency`, `owner_id`, `deal_name`, `eda_event`, `changed_at`, `company_id`, `invoked_by`, `pipeline_id`, `to_stage_id`, `company_name`, `from_stage_id`, `pipeline_name`, `to_stage_name`, `g8_correlation`, `from_stage_name`, `idempotency_key`

- `g8_correlation` (object) keys: `event`, `org_id`, `eda_event`, `company_id`, `idempotency_key`
- name/email-bearing keys, values redacted here: `deal_name`, `invoked_by`, `company_name`, `to_stage_name`, `from_stage_name`, `pipeline_name`

### `workflow.execution_completed` — `data` keys (verbatim order)

`email`, `org_id`, `status`, `cost_usd`, `action_id`, `eda_event`, `timestamp`, `action_name`, `duration_ms`, `workflow_id`, `execution_id`, `runtime_type`, `tokens_input`, `trigger_type`, `error_message`, `tokens_output`, `workflow_name`, `g8_correlation`, `idempotency_key`

- `g8_correlation` (object) keys: `event`, `org_id`, `eda_event`, `occurred_at`, `idempotency_key`
- name/email-bearing keys, values redacted here: `email`, `action_name`, `workflow_name`

### Types worth knowing for `outcomeFromEvent`

- `changed_at` is a unix-seconds float; `timestamp` (workflow) is an ISO-8601 string.
- `cost_usd` was `null` for the free run; `tokens_input` / `tokens_output` were `0`; `duration_ms` is a number.
- `status` was `"completed"`, `trigger_type` `"manual"`, `runtime_type` `"workflow"`, `error_message` `null`.
- On `deal.created`, `amount_delta` is `null`, `changed_fields` is an empty string, and `company_name`/`pipeline_name` were empty strings.
- ID fields (`deal_id`, `company_id`, `stage_id`, `to_stage_id`, `from_stage_id`, `pipeline_id`, `owner_id`, `action_id`, `workflow_id`, `execution_id`) are strings; `company_id` is a string even though contact IDs are numbers.

## 11. MCP from graph8: result

**PASS (2026-09-26, Task 4 risk probe).** Steps 1–6 held (auth tests 4/4; streamable HTTP `POST /api/mcp` `tools/list` returns `ping`; missing bearer token → 401). After the user added Upstash Redis from the browser, live validation found one real bug and it was fixed: `mcp-handler@1.1.0` only reads `redisUrl` from its default config object, so passing a config without it made `/api/sse` fail with `redisUrl is required`. The route now passes `redisUrl: process.env.REDIS_URL ?? process.env.KV_URL` (commit `7fc769f`). Production SSE then verified: `GET /api/sse?key=…` → **HTTP 200** with `event: endpoint` + `data: /api/message?sessionId=…` (83 bytes).

Registered in graph8 with `scripts/register-mcp.ts`: **mcp_server_id `d96d0ab1-84ff-46e9-a80f-3361c07c8765`** (name "ROI Advisor", transport `sse`), visible to workflows: true.

Probe workflow `[sim] ROI Advisor MCP test` (action_id `7c67f0f9-fc71-4d0d-86dd-7dd2a3b4f19a`) validated clean (`{"valid":true,"errors":[],"warnings":[],"missing_references":[]}`) and executed: **execution_id `99cd7178-0ef7-440a-a00c-f276689459dd`**, status `completed`, 0 credits (`cost_usd: null`, tokens 0), tool node output:

`{"tool":"ping","content":"ROI Advisor is up","is_error":false,"mcp_server":"ROI Advisor"}`

graph8 can call an external MCP tool over SSE, so spec §6.4's fallback is **not** needed. Nuance: the brief's `tool_config: { arguments: { note: "from graph8" } }` passed validation but the argument did not reach the tool (output lacks `: from graph8`); argument passing for MCP tool nodes with required inputs is still to be pinned down. The note is optional and the probe's intent — can graph8 call our tool — is proven.

## 12. First live sync

Ran `npm run script -- scripts/import-design-runs.ts` (23 runs, 1 post) then `npm run script -- scripts/sync-once.ts` against the live org on 2026-09-26. Printed summary:

- newLedgerRows: 0 (on the final re-run; first run ingested 144)
- charges: 126
- coverage: exact 216, window 1033, none 11, total 1260
- findings: 5

## 13. Guardrail live run

Task 16 ran the guardrailed pre-spend flow once on list 13 `[sim] guardrail probe` (3 contacts) on 2026-09-26, through the same functions `applyGuardrail` calls (temp script; the request-scoped `isAuthed` check was skipped). No secrets below.

Fit classes written to `roi_fit` (column 757) and `record_consistency` (column 1515):

| Row | Segment n | Consistency | `roi_fit` |
|---|---|---|---|
| 66 | 1 | flagged (rallyme.com vs startupready.com) | **low** |
| 81 | 0 | ok | unknown |
| 249 | 0 | unknown | unknown |

- `POST /enrichment/ai-formula/validate` for `NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))`: `valid: true`, no errors, `fieldDependencies: ["udo_roi_fit_11e946f0"]`.
- Silent-failure check: routing preview `matching_count = 1` against a 3-contact list, so the condition filters (not 0, not everyone).
- Pipeline reused, not created: `[sim] guardrail probe pipeline` `5275d21c-5050-466f-b89d-517afce9c45f` (list 13's existing waterfall step `step_1`, `config_ref CONTACT_WORK_EMAIL_32aa4784488a`). The stored step now has `run_condition NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))`, `skip_existing_values: true`, `skip_recently_enriched: true`, `enabled: true`; the pipeline row has `enabled: false` (manual runs still start).
- Run **`f9cf7ef4-f37d-4e5b-8a54-b03dfd20ff88`**: `completed`; processed **2**, successful **0**, failed **1**, skipped **1** (`skipped_by_reason {"skipped":1}`; `total_records` 2 because row 66 was excluded by the run condition, row 81 skipped by skip-existing, row 249 attempted and failed).
- **Credits spent: 0.** Balance before 8,740 → after 8,740 available credits (the one attempted record failed; no charge).
- The `roi_run` record for the run was upserted (status completed, records_ok 0, records_failed 1, records_skipped 1, quoted 3).

This is a different run from the design-validation one in §6 (`e2b2e81f…`, 3 processed / 1 successful / 2 skipped / 3 credits). The failed row 249 means that contact still has no email; re-running would need fresh approval.

Live shapes confirmed: `getListContacts` rows already carry `work_email`; `listListPipelines` returns `{items}`; `estimateListPipeline` returns `required_credits` (9 for 3 contacts); `previewRoutingRule` returns `matching_count` and accepts `{source_list_id, conditions:[{field, operator:"equals", value}]}`; `setFieldValue` body is `{entity, record_id, value}`. The only adaptation needed was `ensurePipeline`: list 13's pipeline is named `[sim] guardrail probe pipeline`, not "Verified emails", so it reuses an existing pipeline whose waterfall step has a `config_ref` before falling back to `createPipelineFromTemplate`.

## 14. Recap live check

Task 17 posted the first weekly recap from the built app (`node next start -p 3200`) via `GET /api/cron/recap` with the `CRON_SECRET` bearer token on 2026-09-26, approved by the user (expected 0 credits). Response: `{"posted":3,"postedAt":"2026-09-26T20:57:37.831Z"}` (HTTP 200). The message is in `#roi-advisor` (`roi-advisor`, id `7705335b-6dba-51d8-baf9-207a0d19fe4f`), message id `63582eba50cf55fffecec1e525bdf3adc1672ab43c4a82434b84c4e9e316c515`, posted at 20:57:37 UTC: headline "Last week: 1,260 credits → 0 meetings [sim]" plus 3 numbered findings (labels are real/sim per the findings). Ledger check: `GET /usage/transactions` first page (100 rows) still shows exactly the same 2 `studio_copilot` rows as before the post (`48300463…` and `4ede3332…`, both 15:40 UTC) — **0 new charges**. No live-shape adaptation was needed: the app's `document` shape (`{version:1, blocks:[{type:"paragraph",content:[{type:"text",text,marks?}]}]}`) matched the existing `[sim] quiet-channel probe` message already in the channel, and `channel: "roi-advisor"` (the channel name) was accepted.

## 15. Sim demo data

Task 19 seeded deterministic simulated demo data and replayed it as signed webhooks. **0 credits, no emails to anyone.** Every record carries `simulated: true` / `[sim]` names, event envelope ids start `sim-`, and `data.simulated === true`; none of it is real.

- **Redeploy first:** the production deployment predated the webhook `handleEvent` wiring, so it was redeployed (`npx vercel deploy --prod --scope momin11`; plain `--prod` returned "Not authorized"). `/login` → 200 after deploy. The live receiver now stores event outcomes.
- **Seed** (`scripts/seed-sim.ts`): lists **15** `[sim] Sales VPs` (20 contacts) and **16** `[sim] Founders` (20 contacts), **210** sim charges in `roi_charge` (target totals: 2,108 / 2,598 / 4,800 credits for lists 15 / 16 / 2), **27** `[sim]` deals (one per seeded meeting; New → Discovery then Won/Lost/Proposal), **81** events in `advisor/.sim-plan.json` (gitignored).
- **Replay** (`scripts/sim-events.ts`): 81/81 delivered, 0 failed. Stored: 81 `roi_outcome` records with `sim-` ext ids and `source: "sim"` (plus 109 polled deal outcomes; `roi_outcome` total 190). Charges verified: 336 total = 126 real + 210 sim.
- **Sync** (`npm run script -- scripts/sync-once.ts`): `newLedgerRows: 2`, `charges: 126`, coverage exact 216 / window 1033 / none 11 / total 1260, `findings: 7`.
- **Stats, 30d list dimension** (this table is the 30-day view from the first Task 19 seed and is superseded by the v2 re-seed below; stats now carry both 8-week and 30-day periods, and full-window targets are asserted in `tests/sim/plan.test.ts`):

  | List | Credits | Meetings | Cost/meeting | Seeded target |
  |---|---|---|---|---|
  | 15 `[sim] Sales VPs` | 1,089.03 | 14 | 77.79 | 124 |
  | 16 `[sim] Founders` | 1,472.20 | 5 | 294.44 | 433 |
  | 2 Starter list | 2,477.52 | 2 | 1,238.76 | 1,200 |

- **Cleanup dry run** (`scripts/cleanup-sim.ts`, no `--apply`): **30** `[sim]` deals (27 new + 3 earlier `[sim]` probe deals), **444** sim records across `roi_charge`/`roi_outcome`/`roi_stat`/`roi_finding`/`roi_run`, and 4 `[sim]` lists flagged for review (15/16 plus pre-existing 13/14). Nothing was deleted; lists are never deleted by the script.
- **Live shapes validated (no script adaptation needed):** `listLists`/`listDeals`/`getListContacts`/`listDealPipelines` all return unwrapped arrays; deal stage UUIDs in the script match the Sales Pipeline live; `getListContacts` rows carry `id`, `job_title`, `seniority_level` (68 VPs, 188 founder-titled on list 2); `createList` accepts `type: "contacts"`; `addContactsToList` accepts `conflict_resolution: "add_all"` upfront; `allow_duplicate: true` works. ⚠ Two notes that correct §5.3/§5: a backdated `close_date` **is** accepted by `PATCH /deals/{id}` (stored as `…T00:00:00Z`), and `closed_lost_reason` is accepted but silently dropped by the API (lost deals keep the stage, not the reason).

### Re-seed v2 (2026-09-27)

Task 2 re-seeded with plan v2: `cleanup-sim.ts --apply` → `seed-sim.ts` → `sim-events.ts` → `sync-once.ts` → `check-sim.ts`. **0 credits, no emails.** The authorized `--apply` deleted 27 `[sim]` deals and archived 342 sim records from the prior run; lists were never touched (15/16 reused by exact title, 13/14 untouched). Seed: 81 sim charges, 27 `[sim]` deals, 81 events, all delivered (0 failed); sync: 2 new ledger rows, 126 charges, 8 findings. Pipelines for list 15 `02f9be92-bace-4b33-9b76-8aafb41d94d0` and list 16 `760e82bd-f078-49dc-ad59-e2a0e8f8420a`, both `enabled: false`. `check-sim.ts` printed:

```json
{
 "total": 10766,
 "bucketsAddUp": true,
 "buckets": { "booked": 2897.2599999999998, "nomeet": 6651.740000000004, "unused": 860, "unknown": 242, "waste": 115 },
 "perList": [["Starter list", 1232.75, 4], ["Sales VPs", 124, 17], ["Founders", 433, 6]],
 "repeatShare": 0.121,
 "cohortWeeks": 8,
 "meetings": 27,
 "won": 9
}
```

`bucketsAddUp: true`, perList matches targets (Starter reads 1,232.75 from its real spend on top of the 1,200 sim target), cohortWeeks 8, meetings 27, won 9, `repeatShare` 0.121 (spec ~15%). The first re-seed read `repeatShare` 0.428 because the Starter list reused the first 30 rows of list 2, overlapping the VP/Founder selections, so cross-list charges counted as repeats; `scripts/seed-sim.ts` now picks Starter contacts disjoint from `vps`/`founders` (commit `cfd1305`) and the re-run above is the corrected data. All repeat credits are simulated (real repeat credits: 0).

## 16. App-install spike (2026-09-27)

Task 12 ran `scripts/app-spike.ts` (ops `list_apps_apps_get` / `create_app_apps_post`, added to `src/lib/g8/ops.ts`) on 2026-09-27, authorized by the user. It did one `GET /apps` and one `POST /apps` with `{name: "Credit Compass", slug: "credit-compass"}`. **0 credits, no install, nothing sent to anyone, no other app mutation.**

- Before: `GET /apps` → `[]` (org had no apps).
- Result: the org **is allowlisted** as an app builder. Exact response:

  ```json
  {"app_id":"dapp_601136e18d90","builder_org_id":"org_5e2170609156","slug":"credit-compass","name":"Credit Compass","status":"draft","registered_origins":[],"default_hostname":null,"source_repo_url":null,"source_provider":null,"source_default_branch":null,"source_credential_ref":null,"created_at":null,"archived_at":null}
  ```

- What it means: an app record (`dapp_601136e18d90`, status `draft`) now exists in `org_5e2170609156`. It is **not installed anywhere** and must not be; installing is a later, separately-approved step. Because the org can create apps, Phase 3's `AppInstallConnector` (consent + tenant-bound credential via `createGraph8ServiceClient`) can replace the API-key connector later. If a future org is refused with 403 `builder_not_allowlisted`, the action is to ask graph8 to enable that org as an app builder.
