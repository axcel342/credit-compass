# Handoff: Credit Compass (ROI Advisor) POC on graph8

Read this first if you are picking up the build. It carries the context of the design conversation (2026-09-26) that isn't obvious from the spec, the plan or the code.

**Read in this order:**

1. This file
2. `docs/superpowers/specs/2026-09-26-roi-advisor-design.md` (the approved design, with validation evidence)
3. `docs/superpowers/plans/2026-09-26-roi-advisor.md` (the task-by-task implementation plan)
4. `docs/design/roi-advisor-ui.html` (the approved UI; open it in a browser). Earlier mockups are in `docs/design/mockups/`.
5. `research/README.md` (fixtures from the real org, reference data, probe scripts)

Background on graph8 itself: `g8-product-overview.md` (what the product offers) and `g8-reference.md` (every CLI command, MCP tool and REST endpoint, generated from the installed package).

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

**Steps 1–6 passed (2026-09-26, Task 4 risk probe).** The MCP server is built and locally verified: the auth tests pass (4/4), streamable HTTP `POST /api/mcp` `tools/list` returns the `ping` tool, a request without the bearer token returns 401, and `/api/sse` correctly reports `redisUrl is required` until a Redis URL is configured. The Upstash add is the only thing outstanding.

**Blocked at Redis (brief Step 7):** `npx vercel integration add upstash/upstash-kv` failed with Vercel API 422 `no_eligible_plan` and opened a browser checkout; no `REDIS_URL`/`KV_URL` was created and the CLI lists only paid plans. Decision: the user will add the free Upstash Redis from the browser later, and it is not blocking the build.

**Fallback in force until then (spec §6.4):** graph8 cannot call the MCP server. The MCP server serves outside agents over streamable HTTP; inside graph8, answers live in the `#roi-advisor` channel and the `roi_*` custom objects.

**To resume:** once `REDIS_URL`/`KV_URL` exists in the Vercel project (names only; then `npx vercel deploy --prod`), registration can proceed by running the already-created `scripts/register-mcp.ts`, then the graph8 `[sim] ROI Advisor MCP test` probe workflow (brief Steps 8–10).

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
- **Stats, 30d list dimension** (target cpm is the full 8-week seed target; the stats window is the last 30 days, so only part of each list's meetings fall inside it — full-window targets are asserted in `tests/sim/plan.test.ts`):

  | List | Credits | Meetings | Cost/meeting | Seeded target |
  |---|---|---|---|---|
  | 15 `[sim] Sales VPs` | 1,089.03 | 14 | 77.79 | 124 |
  | 16 `[sim] Founders` | 1,472.20 | 5 | 294.44 | 433 |
  | 2 Starter list | 2,477.52 | 2 | 1,238.76 | 1,200 |

- **Cleanup dry run** (`scripts/cleanup-sim.ts`, no `--apply`): **30** `[sim]` deals (27 new + 3 earlier `[sim]` probe deals), **444** sim records across `roi_charge`/`roi_outcome`/`roi_stat`/`roi_finding`/`roi_run`, and 4 `[sim]` lists flagged for review (15/16 plus pre-existing 13/14). Nothing was deleted; lists are never deleted by the script.
- **Live shapes validated (no script adaptation needed):** `listLists`/`listDeals`/`getListContacts`/`listDealPipelines` all return unwrapped arrays; deal stage UUIDs in the script match the Sales Pipeline live; `getListContacts` rows carry `id`, `job_title`, `seniority_level` (68 VPs, 188 founder-titled on list 2); `createList` accepts `type: "contacts"`; `addContactsToList` accepts `conflict_resolution: "add_all"` upfront; `allow_duplicate: true` works. ⚠ Two notes that correct §5.3/§5: a backdated `close_date` **is** accepted by `PATCH /deals/{id}` (stored as `…T00:00:00Z`), and `closed_lost_reason` is accepted but silently dropped by the API (lost deals keep the stage, not the reason).
