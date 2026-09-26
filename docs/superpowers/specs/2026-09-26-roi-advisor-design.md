# ROI Advisor for graph8: design spec

- **Date:** 2026-09-26
- **Status:** Design approved section by section; this document awaits final review
- **Build window:** 1–2 days for a thin end-to-end slice, then the depth backlog in priority order
- **UI reference:** https://claude.ai/artifact/3kqkXtCv9t4DbuRcExPa3D (private design preview)
- **Target org for the POC:** `org_5e2170609156` ("Hackathon Momin Qureshi")

Every claim marked ✅ below was exercised live against graph8 through the CLI (`g8`), the hosted MCP server, the `@graph8/sdk` package or the REST API during design. ⚠ means proven with a caveat. ❓ means unproven and scheduled as an early build task.

---

## 1. Problem and value

### 1.1 The problem

Everything in graph8 costs credits: enrichment, AI skills, research, the dialer, sequences. A graph8 user gets two views that never meet:

- **The credit ledger** (`GET /usage/transactions`) says how much went to which *service* (`studio_global −20`, `ai_enrichment −30`). It never says which list, contact, campaign or sequence the credits were spent on.
- **Analytics** (about 260 read endpoints) report replies, meetings and deals by sequence, step, channel, list and segment. They never say what those results cost.

So nobody can answer the questions that drive budget and renewal decisions. Which lists and segments pay off? What should we do more of? Are we paying for work that failed?

Evidence from the target org (✅ REAL):

- 1,260 credits spent across 126 charges and 9 services. 860 of them (68%) went to onboarding research ("studio_global") that ran before anyone used the org.
- Skill runs are billed under the label `voice_llm`, even though no voice feature was used.
- 77 credits were charged for AI enrichment jobs that failed on all 11 records. The job record reports `total_credits_used: 0`.
- 14 credits were charged for LeadMagic results that no API route returns.
- 24 credits were charged when an automated post in the `#work` channel woke graph8's chief-of-staff agent.
- graph8's enrichment dashboard reports `total_cost: 0.0` after all of the above.
- graph8's estimates are off in both directions: AI enrichment was quoted 37 and charged 50, and a list pipeline was quoted 498 for 249 contacts when only 13 needed work.
- The executive dashboard's `cost_per_meeting_held` has no defined cost source, and it ignores deals entirely.

### 1.2 The value

**One line:** show a graph8 user which of their credits turned into meetings and pipeline, catch the spend that bought nothing, and step in before the next spend with a concrete "do this instead" drawn from their own history.

| Who | What they get |
|---|---|
| Budget owner / founder | Proof of return ("326 credits per meeting, down 12%"), visible waste, and a clear case at renewal |
| SDR / growth manager | "Do more of what worked": which segment, message step and channel produce meetings most cheaply, with one-click actions |
| Everyday user | A quiet check before spending that stops credits going to lists that won't convert |
| graph8 | Customers who can see their ROI renew and spend more on what works, and less frustration about failed charges |

### 1.3 Why this isn't a wrapper

graph8 has the ingredients: the ledger, engagement analytics, 97 webhook event types, list and segment data, and pipeline run conditions. It never joins them. The new parts are the link from credits to outcomes, and advice that graph8 enforces at the moment of spending.

---

## 2. Goals, non-goals, constraints

### 2.1 Goals (all included in the POC)

1. **ROI dashboard** with history: spend, outcomes, cost per meeting and per deal by list, segment, channel and step, and attribution coverage.
2. **Charge explainer**: every ledger line described in plain words, with how it was matched.
3. **Credit recovery**: failed jobs, unreadable results, billing mismatches, agent side effects and unused paid assets, with a refund-request draft.
4. **Pre-spend advisor and guardrail**: our own estimate plus a native graph8 run condition that skips low-fit contacts.
5. **Weekly recap** inside graph8 (Work channel): at most three items, skipped in a quiet week.
6. **MCP server** so AI agents (and graph8 workflows, if proven) can ask ROI questions.
7. **Add-ons folded in**: estimate-vs-actual calibration, free failed-attempt tracking from unmatched holds, billing-mismatch detection, lookalike lists from graph8's free search, a record-consistency signal (from the validated "Idea A"), an attribution coverage meter with "make it traceable" tips, a silent-failure guard, and agent-side-effect detection.

### 2.2 Non-goals for the POC

- Multi-org tenancy (one org and one API key).
- Real outbound sending. Outreach outcomes are simulated and labelled (§9).
- Replacing graph8's analytics. We join and interpret them.
- Automatic actions without a preview. Every action that spends or sends shows its cost first.

### 2.3 Approved decisions

| Decision | Choice | Why |
|---|---|---|
| Stack | Next.js (App Router, TypeScript) + `@graph8/sdk` 0.245.0 | Official SDK covers every operation needed (51/52 checked; the miss was a guessed path) |
| Hosting | Vercel | Public HTTPS for webhooks and MCP; CLI is installed and logged in (account to confirm) |
| Store | graph8 custom objects (option A); Postgres (Neon) is the fallback | "Built on graph8", visible in-app, App-Page-ready; tested at about 37 writes/s with unique-key dedupe |
| Dashboard | Our own web app | App Pages can't take custom HTML (AI-generated only), and graph8's AI is currently down |
| Guardrail | `roi_fit` contact field + list-pipeline `run_condition` | Proven live: low-fit contacts skipped |
| Recap channel | graph8 Work channel `#roi-advisor` (no agents) | No Slack or mailbox in the org; `#work` costs 24 credits per post |
| Demo data | Hybrid: real ledger + `[sim]` deals in graph8 + signed simulated outreach events | Honest, labelled, same code path as real events |
| Build shape | Thin slice of every part first, then depth in priority order | 1–2 day window, live demo |

### 2.4 Constraints discovered (all ✅ unless marked)

- **Rate limits:** 50 requests/second and 1,000/minute (headers `x-ratelimit-limit-second`, `x-ratelimit-limit-minute`, `x-ratelimit-reset`). A 60-request burst produced 8 × HTTP 429.
- **Cloudflare blocks Python urllib's default user agent** (error 1010). The Node SDK and curl work.
- **Two contact IDs exist.** The CRM row ID (1–250) is used by lists, deals, fields, enrichment and `GET /contacts/{id}`. The global ID (e.g. 1088906) is returned as `data.id` by the contact detail. **Deals take row IDs** in `contact_ids`, despite docs saying "mashup IDs".
- **Standalone skill runs** can't be listed (`GET /workflows/executions` returns workflow runs only) and emit no webhook. Each run can still be fetched by ID.
- **Enrichment jobs** emit no webhook (`enrichment.job_completed` / `job_failed` did not fire in testing).
- **Workflow runs** emit `workflow.execution_completed` ✅.
- **`deal.won` did not fire** on a manual move to Closed Won. `deal.created`, `deal.updated` and `deal.stage_changed` fire.
- **Deals can't be backdated.** `created_at` is ignored and history is stamped "now". A past `close_date` is accepted.
- **Custom fields on contacts are text only** (`POST /fields`). Values don't appear in contact or list API responses, but routing and run conditions read them.
- **Custom objects can't reference built-in objects** (contacts, companies, deals). Store IDs as plain fields.
- **App Pages** read only custom objects or Workbench tables. Content is AI-generated (`generate`, `chat-edit`); there's no custom HTML.
- **Hosted app runtime doesn't exist yet** (`AppRuntimeResponse` docs say so), so our engine runs outside graph8.
- **MCP server registration** (`POST /voice/mcp-servers`) accepts only `sse` (or local `stdio`). Registered servers appear in `GET /workflows/mcp-servers`. ❓ graph8 fetching tools from an external server returned 502 in testing (the stand-in server had retired SSE).
- **Posting in a Work channel that contains agents triggers an agent reply** that is charged (`studio_copilot`, about 12 credits per reply at about 96k input tokens).
- **API request log** (`GET /logs`) keeps only the last 100 requests, so it isn't usable for attribution.
- **Side effect:** ten "Revenue-…" lists (Suspects, Leads, Trial, Customers, Churned, each twice) appeared in the org after read-only analytics and revenue calls. Cause unconfirmed.

---

## 3. Architecture

```
graph8 (system of record + UI surfaces)                  ROI Advisor (Next.js on Vercel)
┌─────────────────────────────────────────┐              ┌──────────────────────────────────────┐
│ Credit ledger  /usage/transactions      │──poll───────▶│ Collectors  /api/cron/poll (5 min)   │
│ Deals + history, engagement summaries   │──poll───────▶│             /api/webhooks/graph8     │
│ Webhooks (deal.*, workflow.*, engage.*) │──push───────▶│   (HMAC verify, dedupe by event id)  │
│ List pipelines (last_run, pipeline-runs)│──poll───────▶│ Attribution (pure functions)         │
│ Custom objects roi_*                    │◀──write──────│ Insights + findings + surfacing gate │
│ Contact field roi_fit + run_condition   │◀──write──────│ Surfaces: dashboard, pre-spend flow, │
│ Work channel #roi-advisor               │◀──post───────│   recap cron, MCP server /api/mcp    │
│ (stretch) App Page over roi_* objects   │              └──────────────────────────────────────┘
└─────────────────────────────────────────┘
```

| # | Component | Thin slice (1–2 days) | Depth backlog |
|---|---|---|---|
| 1 | Collectors | Webhook receiver with signature check. Cron every 5 minutes polls the ledger, deals and deal history, engagement summaries, list-pipeline `last_run`, docs, reports and landing pages. Idempotent writes by `ext_id`. | Backfill of older history; retry queue; poll less often when webhooks are healthy; multi-org keys |
| 2 | Attribution | Rules in §5.2: exact token joins, job windows, pipeline runs, time windows; a `method` on every link | Confidence per link; step and channel joins from engagement payloads; shared-charge splitting |
| 3 | Insights | Metrics (§5.4), findings catalogue (§5.6), surfacing gate (§5.7) | Trend/anomaly detection, learning from dismissals, forecasts with ranges |
| 4 | Surfaces | Dashboard, pre-spend guardrail, recap, MCP (§6) | One-click actions everywhere, Slack/email recaps, App Page, multi-list guardrails |

---

## 4. Data model (graph8 custom objects)

Every object has a unique text attribute `ext_id` (dedupe: a duplicate create returns `409 conflict`, which is treated as success ✅) and a checkbox `simulated`. References to contacts, companies and deals are stored as text or number IDs, because references to built-in objects are rejected ✅. Attribute types available: text, number, currency, date, timestamp, checkbox, select, status, email_address, phone_number, domain, location, personal_name, record_reference (custom objects only), rating, actor_reference.

### 4.1 `roi_charge`: one per ledger transaction

| Field | Type | Notes |
|---|---|---|
| `ext_id` | text, unique | Ledger transaction ID |
| `ledger_type` | select | `usage`, `hold`, `hold_release`, `refund`, `one_time` |
| `service` | select | e.g. `studio_global`, `voice_llm`, `ai_enrichment` |
| `credits` | number | Positive for spend |
| `charged_at` | timestamp | |
| `llm_tier` | text | `g8_t1`… |
| `tokens_in`, `tokens_out` | number | Parsed from "LLM charge: … (in:X, out:Y)" |
| `description` | text | Raw ledger description |
| `run_ext_id` | text | Linked `roi_run.ext_id` |
| `method` | select | `exact_tokens`, `job_window`, `pipeline_run`, `advisor`, `time_window`, `none` |
| `contact_id`, `company_id`, `list_id` | text | Row IDs |
| `segment_key` | text | §4.7 |
| `explanation` | text | e.g. "Meeting Prep Brief · Jamie Elden, Listrak" |
| `result` | select | `success`, `failed`, `empty`, `unreadable`, `side_effect`, `unknown` |
| `is_waste` | checkbox | |
| `waste_reason` | select | `failed_job`, `no_change`, `billing_mismatch`, `agent_side_effect` |
| `simulated` | checkbox | |

### 4.2 `roi_run`: one per unit of work that spends credits

`ext_id` (execution, job, pipeline-run or document ID), `kind` (select: `skill_run`, `workflow_run`, `ai_enrichment_job`, `waterfall_job`, `pipeline_run`, `verification`, `studio_doc`, `research_report`, `landing_page`, `agent_reply`), `action_name`, `input_summary`, `record_ids` (text, JSON), `list_id`, `status`, `started_at`, `completed_at`, `tokens_in`, `tokens_out`, `credits_linked`, `records_ok`, `records_failed`, `records_skipped`, `quoted_credits`, `source` (select: `webhook`, `poll`, `advisor`), `simulated`.

### 4.3 `roi_outcome`: one per result event

`ext_id` (webhook envelope `id`, or `deal:{id}:{to_stage}` for polled changes), `type` (select: `email_sent`, `email_replied`, `email_bounced`, `meeting_booked`, `meeting_held`, `meeting_no_show`, `deal_created`, `deal_stage_changed`, `deal_won`, `deal_lost`), `occurred_at`, `contact_id`, `company_id`, `deal_id`, `amount`, `list_id`, `sequence_id`, `step`, `channel`, `segment_key`, `source` (select: `webhook`, `poll`, `sim`), `simulated`.

### 4.4 `roi_stat`: precomputed totals the dashboard reads

`ext_id` (`{period}|{dimension}|{value}`, e.g. `30d|list|2`), `period`, `dimension` (select: `list`, `segment`, `channel`, `step`, `service`, `org`), `value`, `credits`, `credits_exact`, `meetings`, `deals`, `won_value`, `cost_per_meeting`, `cost_per_deal`, `vs_avg_pct`, `evidence_n`, `confidence` (select: `high`, `medium`, `low`), `computed_at`.

### 4.5 `roi_finding`: what the Advisor says

`ext_id` (`{kind}|{scope}|{period}`), `kind` (select: `scale`, `cut`, `waste`, `fix`, `unused`, `data_risk`, `what_worked`, `traceability`, `side_effect`), `title`, `body`, `evidence` (text, JSON), `credits_at_stake`, `confidence`, `status` (select: `open`, `dismissed`, `snoozed`, `applied`), `snoozed_until`, `dismiss_count`, `action`, `action_payload` (text, JSON), `first_seen`, `last_seen`, `last_notified_stake`, `in_recap`, `simulated`.

### 4.6 Contact fields (read by graph8's own routing and run conditions)

| Field | Status |
|---|---|
| `roi_fit`: text, values `high` / `medium` / `low` / `unknown` | ✅ exists: column ID **757**, formula name **`udo_roi_fit_11e946f0`** |
| `roi_fit_reason`: text | To create |
| `record_consistency`: text, `ok` / `flagged` | To create |

The Advisor keeps its own copy of these values in `roi_stat` and `roi_finding`, because contact reads don't return custom field values ✅.

### 4.7 Segment key

`{seniority}|{department}|{industry}|{size band}`, e.g. `Vice President|Sales|Computer Software|51-200`, built from the contact and company fields graph8 already stores ✅.

### 4.8 Depth backlog

Weekly `roi_stat` snapshots (exact trends), `triggered_by` per run (per-user spend), a price-table cache, multi-currency deals, multi-org tenancy, and moving to Postgres if paging through records gets slow.

---

## 5. Attribution and insight rules

### 5.1 What counts as spend ✅

- Spend = ledger rows with `type = "usage"` ("Credit charge" and "LLM charge").
- `hold` / `hold_release` rows are excluded. A successful provider step shows hold → charge → release. A **hold with no following charge is a failed attempt at no cost**, which is counted for failure-rate tracking.
- `refund` and `one_time` rows affect the balance only.
- The ledger pages newest-first (`page`, `limit` ≤ 100). Incremental sync pages until it meets a known `ext_id`.

### 5.2 Linking charges to work

| Charge | Link rule | Method | Evidence |
|---|---|---|---|
| LLM charge with `(in:X, out:Y)` | Match a `roi_run` with identical token counts, nearest within **±10 s** | `exact_tokens` | ✅ 13 exact; the charge lands 0–1 s after the run completes |
| `ai_enrichment` | Charges inside a captured AI job's start → finish (+60 s) window. Per-record lines split across the job's records; surcharge spread evenly. **No price formula** (price varies by job type: "custom" charged 2 per record + surcharge, "web-research" charged 3 + 19 for 1 record) | `job_window` | ✅ one job window observed |
| `waterfall_enrichment` from a list pipeline | `GET /enrichment/lists/pipeline-runs/{run_id}` or the pipeline's `last_run` gives list, job, and processed / successful / failed / skipped counts; match charges in the run window | `pipeline_run` | ✅ run e2b2e81f: 3 processed, 1 successful, 2 skipped, 3 credits |
| Any spend started by the Advisor (verification, guardrailed enrichment, MCP-triggered work) | The Advisor records the run before calling graph8 | `advisor` | ✅ 40 verifications traced exactly |
| Workflow run | `workflow.execution_completed` webhook, then fetch the execution (tokens, cost, inputs) | `exact_tokens` | ✅ event fired |
| `studio_global`, `landing_page_template`, `image_generation`, `brand_snapshot_classify` | Time window against document, report, page and brand-kit creation times | `time_window` | ⚠ plausible, not proven; graph8's own document `credits_used` covers only 60 of 860 |
| `studio_copilot` | Time window against automated Work posts by the Advisor | `time_window` | ✅ 2 charges at 15:40:42/53 followed our post at 15:40:38 |
| Everything else, including skill runs started in graph8's UI | "Service only" bucket, never spread over lists | `none` | ✅ 11 credits in this state today |

**Coverage today (REAL):** exact 216 credits (17%), time window 1,033 (82%), service only 11 (1%). The dashboard always shows this split.

### 5.3 Linking outcomes back

- Outcome → contact → **sequence first** (`GET /contacts/{id}/sequences` ✅), then that sequence's list.
- With no sequence: **split evenly** across the contact's lists (`GET /contacts/{id}/lists` ✅; it has no "added at" date, so "most recent list" isn't possible).
- Deals: primary contact from the deal record ✅. Stage changes and won/lost detection by polling `GET /deals/{id}/history` ✅ (from, to, `changed_at`, `days_in_previous_stage`), because `deal.won` didn't fire.
- Engagement webhook `data` fields are untyped in the SDK ❓. The first deployed receiver records real payloads (build task 2).

### 5.4 Metrics (per list, segment, channel or step; default window 30 days)

- `spend(v)`: attributed charges only.
- `meetings(v)`, `deals(v)`, `won_value(v)`.
- `cost_per_meeting = spend ÷ meetings`. With 0 meetings the card shows "N credits, no meetings yet", never a divided number.
- `credits_per_1k_pipeline`.
- `vs_avg = (cpm(v) − cpm(org)) ÷ cpm(org)`.

### 5.5 Confidence

- **High:** ≥ 10 outcomes, ≥ 500 credits, and ≥ 50% of the spend linked exactly.
- **Medium:** ≥ 3 outcomes.
- **Low:** otherwise.
- If less than 50% of the spend is exact, confidence is capped at medium.

### 5.6 Findings catalogue

| Kind | Fires when | Action |
|---|---|---|
| `scale` | cpm ≤ 0.6 × org average, confidence ≥ medium, ≥ 5 meetings | Build a lookalike list with the same filters via graph8's free prospect search (`POST /search/contacts/save`, charged 0 in testing ✅) |
| `cut` | cpm ≥ 2 × average, **or** ≥ 1,000 credits and ≥ 100 contacts reached with 0 meetings | Pause, or apply the guardrail (§6.2) |
| `waste` (failed job) | Charges on a run with 0 successful records | Refund draft (§6.1, Recovery) |
| `waste` (no change) | Charged enrichment where the target field didn't change afterwards | Refund draft; try another provider |
| `fix` (billing mismatch) | Job reports `total_credits_used = 0` but ledger charged, **or** actual > quote × 1.2 | Refund draft; recalibrate estimates |
| `side_effect` | `studio_copilot` charges within 60 s of an automated Advisor post | Move posts to an agent-free channel |
| `unused` | Paid document, report or page with `usage_count = 0` after 7 days | Open, or link to a campaign |
| `data_risk` | A list about to be enriched or sequenced has ≥ 20% `record_consistency = flagged` | Warning in the pre-spend check |
| `what_worked` | A step or channel gets ≥ 2 × the reply rate for a segment | "Use as step 1" |
| `traceability` | Service-only spend ≥ 10% of the period, or repeated identical skill runs from the UI | "Run it inside a workflow so it can be traced" |

### 5.7 Surfacing gate (the anti-spam rules)

- **Dashboard:** every finding. Low-confidence findings go in a "Watching" section.
- **Weekly recap:** top 3 open findings by `credits_at_stake × weight(confidence)` (high 1.0, medium 0.6), confidence ≥ medium. Skipped entirely when no finding changed and spend moved less than 10%.
- **Pre-spend warning:** only if the projected saving is ≥ 15% of the planned spend **and** ≥ 100 credits, with confidence ≥ medium.
- **Dedupe:** a finding updates in place and is re-notified only when `credits_at_stake` grows ≥ 50% over `last_notified_stake`.
- **Dismiss:** hidden for 30 days. After 3 dismissals of the same kind, that kind appears on the dashboard only.

### 5.8 Pre-spend estimate and `roi_fit`

- **Meeting rate per segment**, smoothed toward the org average: `(n·rate_seg + 5·rate_org) / (n + 5)`.
- **Contacts the run would touch:** routing preview `POST /enrichment/list-routing/rules/preview` with the same conditions gives `matching_count` ✅. graph8's own pipeline estimate ignores run conditions and "skip existing values" ✅, so it isn't used for counts.
- **Price:** the provider table `GET /enrichment/providers` ✅ (e.g. Icypeas email 2, LeadMagic email 3, email verification 1), adjusted by the observed quote-vs-actual gap per service.
- **Projected cost per meeting** = estimated credits ÷ Σ expected meetings.
- **Best-fit subset:** rank by expected meetings per credit, drop `record_consistency = flagged`, and stop where the next contact would cost more per meeting than the org average.
- **`roi_fit`:**
  - **High:** ≥ 1.5 × org rate and consistent.
  - **Low:** ≤ 0.5 × org rate, or flagged.
  - **Unknown:** evidence n < 3.
  - **Medium:** otherwise.

### 5.9 Depth backlog

Cohort attribution (outcomes arriving weeks after the spend), multi-touch weighting across list, sequence and channel, confidence intervals, per-org thresholds, per-record surcharge allocation, price-change alerts from the provider table, and replaying attribution against the real ledger as a regression suite.

---

## 6. Surfaces

### 6.1 Dashboard (Next.js, Vercel, password-protected)

Screens match the UI reference:

1. **Overview.**
   - Tiles: credits spent, wasted, traced exactly %, meetings, credits per meeting with its change.
   - Charts, each single-series with a hover tooltip and no dual axes: spend by service; cost per meeting by the chosen breakdown with the average reference line; weekly credits per meeting.
   - Advisor panel with open findings (kind chip, provenance tag, confidence, evidence, action) and a "Watching" section.
2. **Charges.** Coverage bar (exact / time window / service only) and the charge table: time, what it paid for, credits, method, result.
3. **Recovery.**
   - Cards for failed jobs, no usable result, side effects and unused assets.
   - A refund-request draft built from evidence (job IDs, ledger IDs, times).
   - "Send to graph8 support" posts to `POST /support/contact` (`message`, `urgency`) only after an in-page confirmation. ✅ The route and schema exist; nothing was sent during design.
4. **Before you spend.** List picker → our estimate next to graph8's quote → fit breakdown → data-risk callout → the run condition to write → "Apply guardrail and enrich" / "Enrich all anyway".
5. **Settings.** Thresholds (§5.6–5.7), recap schedule, and a coverage tips list.

**REAL / SIM labels** appear on every tile, chart and finding (solid outline for REAL, dashed and hatched for SIM).

**Deep links:** only `app.graph8.com/agents/workflows/{action_id}` is documented. Contact and deal links are verified with a logged-in user during build; until then the dashboard shows IDs.

### 6.2 Pre-spend guardrail (inside graph8) ✅

1. Write `roi_fit` per contact: CLI `g8 set-field-value --column-id 757 --record-id <row id> --value <fit>`, or SDK `set_field_value_fields__column_id__values_patch`.
2. Set the list pipeline step's `run_condition` via `PUT /enrichment/lists/{list_id}/pipelines/{pipeline_id}`:
   ```
   NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))
   ```
   G8X is function-style: `EQ`, `NOT`, `CONTAINS` and `ISBLANK` validate; `==`, `!=`, `<>` and JavaScript statements are rejected. Validate every condition first with `POST /enrichment/ai-formula/validate` (free).
3. Run: `POST /enrichment/lists/{list_id}/pipelines/{pipeline_id}/runs`. Read the result from `GET /enrichment/lists/pipeline-runs/{run_id}` (`skipped_by_reason`). The per-pipeline `/runs` list stays empty, so don't use it.
4. **Silent-failure guard:** before saving a routing rule, compare its preview `matching_count` with the list size. An unknown operator such as `is` silently matches everyone ✅.

Pipelines are created from templates (`POST /enrichment/lists/{id}/pipelines/from-template`, keys: `verified_emails`, `full_contact_info`, `full_outbound_prep`, `qualify_then_email`, `qualify_accounts`, `company_profile`). Note that the "Verified emails" template only fills contacts without an email.

### 6.3 Weekly recap

- A Vercel cron (Mondays 09:00 UTC) computes the recap and posts it through `POST /work/messages` (SDK `create_work_message_work_messages_post`) to channel **`roi-advisor`** (`7705335b-6dba-51d8-baf9-207a0d19fe4f`), which has no agents ✅ (0 credits).
- Content is sent as rich `document` blocks, since markdown isn't rendered ✅.
- Never post automated content into `#work` or other channels with agents: each post triggers a charged agent reply (about 24 credits) ✅.
- **Depth:** Slack or email when the org connects them (graph8 workflow Slack and email nodes exist but need an integration or mailbox); wins to `#wins`; an opt-in "ask graph8's agent to review this recap" mode that shows its cost first.

### 6.4 MCP server

- **Route:** `/api/mcp` using Vercel's `mcp-handler`.
- **Transports:** streamable HTTP (Claude, Cursor, other agents) plus legacy SSE for graph8, which registers only `sse` servers. SSE on Vercel needs shared session state: Upstash Redis via the Vercel Marketplace (free tier), subject to user approval.
- **Tools:** `roi_summary(period)`, `cost_per_outcome(dimension, value, outcome, period)`, `prespend_estimate(list_id, action)`, `list_findings(status, kind)`, `explain_charge(ledger_id)`. Read-only in the thin slice. Any spending tool (depth) previews its cost first.
- **Auth:** bearer token in environment variables.
- **graph8 registration:** `POST /voice/mcp-servers {transport_type:"sse", connection_url}`. It appears in `GET /workflows/mcp-servers` ✅. ❓ A graph8 workflow `tool` node calling our tool is build task 3. **Fallback if it fails:** the MCP server serves outside agents only, and inside graph8 the answers live in the Work channel and custom objects.

### 6.5 Stretch: App Page

When graph8's AI generation works again, create an App Page (`POST /app-pages` with sources = `roi_stat` and `roi_finding` custom objects) and generate the dashboard in-app. It shares the data contract, so no engine changes are needed.

---

## 7. Error handling

| Risk | Handling | Evidence |
|---|---|---|
| Rate limits | Token bucket ≤ 40/s and ≤ 900/min per process. On 429, wait until `x-ratelimit-reset`, then retry (max 3). Cron work is chunked. | ✅ headers and 429 observed |
| At-least-once webhooks | Verify with `g8.webhooks.constructEvent(rawBody, X-Studio-Signature, X-Studio-Timestamp, secret, {toleranceSeconds:300})`. Dedupe by envelope `id`. Return 200 fast and process after the response (`waitUntil`). | ✅ valid accepted; tampered, stale and wrong secret rejected |
| Duplicate writes | `ext_id` unique; 409 = already stored | ✅ |
| Silent failures | Zero matches, zero successes, empty search results, and rules matching the whole list raise a `fix` finding instead of passing silently | ✅ observed repeatedly |
| Advisor-initiated spend | In-page preview with our estimate, a hard per-action credit cap, dry-run in development | ✅ pattern used throughout design |
| Agent side effects | Automated posts only to agent-free channels; the `side_effect` finding catches regressions | ✅ |
| graph8 AI or search outage | The core never calls graph8 LLM features; the App Page is gated | ✅ outage observed |
| Untraceable spend | "Service only" bucket, coverage meter, `traceability` finding | ✅ |
| Contact ID confusion | One helper resolves row ID ↔ global ID; every graph8 call documents which ID it takes | ✅ |
| Secrets | `G8_API_KEY`, `G8_WEBHOOK_SECRET`, `DASHBOARD_PASSWORD`, `MCP_TOKEN` in Vercel env only; no browser access to graph8 | Checked at first deploy |
| Cron overlap | A lock record (`roi_run` of kind `sync_lock` with TTL) or a Vercel single-concurrency cron | Build |

---

## 8. Testing

1. **Unit tests (TDD) for pure modules**, using fixtures from the real ledger (144 rows) and saved execution records. Expected results:
   - Spend total = 1,260
   - Exact / window / service-only = 216 / 1,033 / 11
   - Waste = 115 (77 failed AI jobs + 14 unreadable + 24 agent side effect)
   - 13 exact token matches
   - Hold/release netting: 8 holds, 3 followed by a charge, 5 free failed attempts
   - Finding gate cases: materiality, confidence, dedupe, dismissals
2. **Contract test (CI):** every SDK operation ID the app uses exists in `@graph8/sdk`, with the expected tier.
3. **Integration tests** against the hackathon org: reads by default; writes only to `[sim]`-tagged records and the `roi_*` objects.
4. **Webhook tests:** signed and tampered payloads sent to the deployed receiver.
5. **Demo rehearsal checklist** plus a `[sim]` cleanup script (§11).

---

## 9. Demo data and script

### 9.1 Data

- **REAL:** the ledger and everything derived from it: waste, coverage, charge explanations, the guardrail run, verification results, 115 of 238 records with email/company conflicts.
- **SIM, inside graph8:** 30–60 `[sim]` deals on real contacts across 2–3 lists and segments, with stage moves and won/lost outcomes. `close_date` spread over past weeks.
- **SIM, outreach:** sent to our own webhook route as events in graph8's envelope format (`{id, event, timestamp, org_id, data}`), signed with the real webhook secret, `data.simulated = true`. Trend timestamps come from these events, because graph8 won't backdate deals.

### 9.2 Script (about 5 minutes)

1. **The problem, REAL:** graph8's ledger ("studio_global −20" × 43) and analytics that show no cost.
2. **Overview, REAL:** 1,260 credits, 17% traced exactly, 115 wasted, and the refund draft.
3. **Outcomes, SIM:** cost per meeting by list and segment; "scale" and "cut" findings.
4. **Guardrail, REAL:** open the Starter list, see the warning, apply the guardrail, run it, and show graph8's own run record with the skipped contacts.
5. **Recap, REAL:** it arrives in `#roi-advisor` inside graph8.
6. **Ask:** Claude connected to the MCP server answers "cost per meeting for fintech VPs?" (depends on build tasks 2–3).

---

## 10. Build plan

**Day 1, morning (risk first)**

1. Scaffold the Next.js app, password gate, SDK client with rate limiter, environment variables; deploy to Vercel (after confirming the account).
2. Webhook receiver: repoint or create the graph8 webhook to our URL; capture real payloads for `deal.*` (via a `[sim]` deal) and `workflow.execution_completed` (via the free web-search workflow); store them as fixtures. **Resolves:** engagement payload fields.
3. MCP server (SSE + HTTP, Upstash Redis); register in graph8; call one tool from a graph8 workflow `tool` node. **Decides:** in-graph8 MCP or the fallback.
4. Bootstrap script for the five `roi_*` objects and the two new contact fields (idempotent).

**Day 1, afternoon**

5. Ledger sync (incremental) and the attribution engine (TDD with real fixtures).
6. Run capture: pipeline `last_run` polling, workflow webhooks, the Advisor-initiated spend wrapper, and time windows for studio, pages and agent replies.
7. Outcomes: deal polling and history, engagement summaries, the simulated event generator (signed).
8. Metrics, findings and the surfacing gate (TDD).

**Day 2**

9. Dashboard: Overview, Charges, Recovery, Before you spend.
10. Guardrail flow end to end on a real list, with the silent-failure guard.
11. Recap cron to `#roi-advisor`.
12. Seed demo data, rehearse, run the cleanup script.

**Depth backlog, in priority order:** one-click actions (lookalike list, pause, refund send) → cohort attribution → Slack/email recaps → App Page → trend snapshots → per-user spend → multi-list guardrails → anomaly detection → multi-org.

---

## 11. Inventory of test artifacts in the org (cleanup)

Created during design (tagged `[sim]` or `[audit-probe]` unless noted):

- **Skills:** 5 `[audit-probe]` clones:
  - `b478aaa0-88bf-44b4-955b-a13fe6523fd7`
  - `7faf5ecf-a506-487d-a3fb-1c5265bacc63`
  - `8ef835d7-e77d-414a-82ae-8e3ae622f4e4`
  - `45da006d-421c-4c25-b33f-f9f8cab35ed9`
  - `c9f0e9d7-63ed-4ee5-932d-21093510b350`
- **Workflows:**
  - `[audit-probe] Grounded buying signals` (`4e719a05-183b-4e2f-bf3f-d5e147374cce`)
  - `[audit-probe] web_search check` (`712e4f5b-faee-45fd-9150-ea5853cc08dd`)
- **AI enrichment config:** `ai_enrich_fc58ddc7`. **LeadMagic test waterfall configs:** 6 columns on list 2.
- **Lists:** 13 `[sim] guardrail probe`, 14 `[sim] lookalike probe`.
- **Pipelines:**
  - "Verified emails" on list 2 (`a4ff1149-4ef7-4f94-961b-21527d9d6518`, run condition cleared)
  - `[sim] guardrail probe pipeline` on list 13 (`5275d21c-5050-466f-b89d-517afce9c45f`)
- **Deals:**
  - `[sim] ROI probe – Listrak` (`13d1fb15-1014-4da8-9ec6-9c1b4785e17f`, Closed Won $12k)
  - `[sim] seed probe – PayLease` (`9ff5c6ee-10ea-455e-966f-3a831765500a`, Closed Lost)
- **Custom object:** `roi_probe` (82 records). Delete before creating the real `roi_*` objects.
- **Webhook:** `[sim] ROI probe` (`1bfeaf5a-744f-4900-a8c9-f4da660a97a0`), pointing at a non-existent graph8 path. Repoint in build task 2 or delete.
- **MCP registration:** `[sim] MCP probe (DeepWiki)` (`79ce2523-4ebc-417c-9c5b-78d2ae4da279`, id 20).
- **Work:** channel `roi-advisor` (keep); `[sim]` messages in `#work` (plus the agent's reply) and in `#roi-advisor`.
- **Contact field:** `roi_fit` (keep). Values set on rows 66, 81 and 249.
- **Agent chat sessions:** 2.
- **Not created by us:** ten "Revenue-…" lists (ids 3–12). Ask graph8 before deleting.

**Validation spend:** 164 credits of the 500 cap (balance 8,740).

---

## 12. Open questions and risks

| # | Question / risk | Resolution path |
|---|---|---|
| 1 | Engagement webhook `data` fields (contact, sequence, step, channel?) | Build task 2 captures real payloads; the simulator mirrors them |
| 2 | Can graph8 call an external MCP tool? | Build task 3; fallback defined (§6.4) |
| 3 | Vercel account `axcel342`: is it the user's? | Confirm before the first deploy |
| 4 | Upstash Redis for SSE | User approval; without it, no in-graph8 MCP |
| 5 | Time-window matching for onboarding research | Label it `time_window` with medium confidence; improve if graph8 exposes per-document charges |
| 6 | graph8 AI outage (skills, agent chat, App Page generation) | The core doesn't depend on it; App Page stays a stretch goal |
| 7 | Origin of the "Revenue-…" lists | Ask graph8; don't delete without confirmation |

---

## Appendix A: graph8 facts the build relies on

- **API:** `https://be.graph8.com/api/v1`, `Authorization: Bearer <key>`.
- **Hosted MCP:** `https://be.graph8.com/mcp/` (call `g8_current_org` first; `g8_tool_search` activates non-default tools).
- **SDK:** `@graph8/sdk` 0.245.0 (`g8.init({apiKey})`, `g8.api.call(operationId, {path, query, body})`, `g8.api.operation(id)` gives tier and scope).
- **CLI:** `g8` from `g8-mcp-server` 0.79.0. Known bugs: `skill-execute` drops inputs; `skill-create-llm` sends `type` instead of `runtime_type`.
- **Webhook envelope:** `{event, timestamp, data, org_id, id}`. Headers: `X-Studio-Signature` (`sha256=` + HMAC-SHA256 of `"{ts}.{rawBody}"`), `X-Studio-Timestamp`, `X-Studio-Delivery-Id`. Delivery is at least once, with 3 attempts.
- **Deal pipeline:** "Sales Pipeline" `444cc04f-7601-4071-a9a3-fdb4a35acef4`. Stage IDs:
  - New Meeting: `2df1e28d-344c-4940-8bc2-e456bfd874a8`
  - Discovery Held: `2e65b28e-5fc4-49f5-966e-5e8081a921c2`
  - Solution Fit: `383188e1-1fe6-47d2-be38-90a1e4e28818`
  - Proposal Sent: `3b1e986e-95e1-4179-ad02-2c93b228d5d3`
  - Verbal Commit: `dfb6b07f-2599-4054-a0d9-9a079bd21ccf`
  - Closed Won: `59e2345b-7d09-47fe-8ea8-a7e5cbb57437` (needs `close_date`)
  - Closed Lost: `3e17b0cb-e2cc-4cd5-993c-69d93858c866`
  - Long Term Nurture: `6674aeac-a698-4a12-bfe3-1fdaec67cfd2`
  - Weak Responsiveness: `af270719-0a08-4e89-864c-b21bfeecea57`
- **Deal creation:** `owner_id` accepts the user email. `contact_ids` = CRM row IDs sharing one company.
- **Key SDK operation IDs:**
  - `list_usage_transactions_usage_transactions_get`
  - `get_execution_workflows_executions__execution_id__get`
  - `list_workflow_executions_workflows_executions_get`
  - `get_enrichment_job_enrichment_jobs__job_id__get`
  - `get_ai_batch_job_status_enrichment_ai_batch_jobs__job_id__status_get`
  - `get_waterfall_job_progress_enrichment_waterfall_jobs__job_id__progress_get`
  - `list_deal_history_deals__deal_id__history_get`
  - `get_contact_lists_contacts__contact_id__lists_get`
  - `get_contact_sequences_contacts__contact_id__sequences_get`
  - `get_contact_engagement_summary_contacts__contact_id__engagement_summary_get`
  - `create_object_record_objects__object_slug__records_post`
  - `list_object_records_objects__object_slug__records_get`
  - `set_field_value_fields__column_id__values_patch`
  - `preview_routing_rule_enrichment_list_routing_rules_preview_post`
  - `validate_ai_enrichment_credits_enrichment_ai_validate_credits_post`
  - `list_enrichment_providers_enrichment_providers_get`
  - `save_contact_search_search_contacts_save_post`
  - `create_work_message_work_messages_post`
  - `create_mcp_server_voice_mcp_servers_post`
  - `list_mcp_servers_workflows_mcp_servers_get`
  - `execute_workflow_workflows__action_id__execute_post`
- **Prices seen:**
  - Email verification: 1 credit
  - Person lookup: listed 2, charged 0
  - Prospect search and saving a list: 0
  - LeadMagic job-change detector: 7 per success
  - Waterfall email step on a list pipeline: 3 per success
  - AI enrichment: varies by job type
  - Agent reply: about 12 per message

## Appendix B: graph8 issues found (candidate feedback to graph8)

1. All 14 built-in skills and agent chat failed because graph8's Anthropic account ran out of credit.
2. Workflow `web_search` node returns 0 results in about 100 ms with no error.
3. AI enrichment charged 77 credits for jobs that failed on every record; the job reports 0 credits used.
4. The LeadMagic job-change result was charged but can't be read (`/lists/{id}/data-columns` returns "Invalid organization ID").
5. The enrichment dashboard reports `total_cost: 0.0` despite charges.
6. Skill runs are billed as `voice_llm`.
7. `deal.won` doesn't fire on a manual Closed Won.
8. The pipeline estimator ignores run conditions and "skip existing values".
9. Routing silently accepts unknown operators (matches all).
10. The `company_employee_count` `between` filter returns 0.
11. The documented tracking script `t.graph8.com/p.js` returns 404.
12. The CLI `skill-execute` and `skill-create-llm` bugs (Appendix A).
13. Public MCP servers are retiring the SSE transport, but graph8's MCP registration only accepts SSE.
14. `enrichment.job_*` webhooks don't fire.
15. Read-only calls appear to create "Revenue-…" lists.
