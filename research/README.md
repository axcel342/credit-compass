# Research material from the design phase

Everything here was captured live from graph8 org `org_5e2170609156` on 2026-09-26. It contains no secrets. The API key and webhook secret are in the gitignored `/home/opc/graph8/.env`.

## fixtures/ (test inputs taken from the real org)

| Path | What it is | Used for |
|---|---|---|
| `ledger/ledger-2026-09-26.json` | All 144 credit-ledger rows (`GET /usage/transactions`), oldest first | Ledger sync, spend rules, hold netting, attribution tests |
| `executions/*.json` | Skill and workflow execution records (`GET /workflows/executions/{id}`) with `tokens_input` / `tokens_output`, `input_data`, `output_data`. `exec_workflow_*` records hold tokens inside `output_data.node_results`. `sys_*` are failed system-skill runs (no tokens). | Exact token-join tests (13 of 15 `voice_llm` charges match) |
| `graph8/pipeline_run_guardrail.json` | `GET /enrichment/lists/pipeline-runs/{run_id}` for the guardrail test (3 processed, 1 successful, 2 skipped) | Pipeline-run attribution and guardrail parsing |
| `graph8/deal_history_*.json`, `deal_won.json` | Deal history (stage moves, `days_in_previous_stage`) and a deal record | Won/lost detection by polling |
| `graph8/ai_job_failed_*.json` | Failed AI enrichment job (0 of 10 successful; `total_credits_used: 0`) | Waste and billing-mismatch findings |
| `graph8/studio_documents_analytics.json` | 23 onboarding documents, `usage_count` 0, `credits_used` totalling 60 | Unused-asset finding, time-window attribution |
| `graph8/providers.json` | Provider price table (`GET /enrichment/providers`) | Pre-spend estimate |
| `graph8/webhook_events_catalog.json` | The 97 webhook event types | Receiver routing |
| `graph8/validate1.json` | SDK validation output: ledger paging, token-join gaps (0–1 s), contact lists and sequences, engagement summary | Reference |
| `idea-a/validation-sample-40.json` | 40 contacts (20 flagged, 20 consistent) with email verification and person-lookup results | `record_consistency` signal tests |
| `idea-a/web-check-sample-10.json` | The 10 contacts checked against public web evidence | Reference |

**Expected values** (recompute these in tests): spend 1,260; exact 216 / time window 1,033 / service only 11; 13 exact token matches; 8 holds → 5 free failed attempts; waste 115 (77 + 14 + 24).

## reference/ (graph8 contract and schemas)

- `sdk-operations.json`: every operation in `@graph8/sdk` 0.245.0's contract, keyed by `"METHOD /path"`, giving `{id, tier, scope}`. Use it to find operation IDs for `g8.api.call`.
- `workflow-node-types.json`: `GET /workflows/node-types/schema` (node types, config fields, output schemas, authoring rules, interpolation syntax).
- `analytics-endpoints.json`, `analytics-response-fields.json`: the 260 read analytics operations and the fields each returned.
- `waterfall-templates.json`, `list-pipeline-templates.json`: enrichment templates (per-column provider steps; list pipeline template keys).
- `system-skills.json`: the 14 built-in skills (all `claude-sonnet-4-6`; all were failing during design).

## scripts/ (probe scripts used during design)

These are kept for reference, not as app code. They expect `G8_API_KEY` in the environment.

- `guard.py`: credit spend guard (reads the balance, refuses to exceed a cap).
- `run.sh`: execute a skill and poll its execution.
- `jc_run.sh`: run a waterfall enrichment job and poll it.
- `mcp_*.py`: hosted-MCP client scripts. Run them with `/home/opc/.local/share/uv/tools/g8-mcp-server/bin/python`.
- `sdk/*.mjs`: SDK probes:
  - `contract.mjs`: checks that operations exist in the contract
  - `validate1.mjs`: ledger, joins and history checks
  - `capture.mjs`: webhook capture test
  - `bulk.mjs`: custom-object write throughput
  - `sig.mjs`: webhook signature verification
  - `quiet_channel.mjs`: agent-free Work channel test
  - `work_post.mjs`: posting to a Work channel
  - `jc.mjs`: job-change matching
  - `run.mjs`: skill runs through the SDK

  Run `npm install` in `sdk/` first.

## probes/

G8X formula-validator inputs used to discover the run-condition grammar.
