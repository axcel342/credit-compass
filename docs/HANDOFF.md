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
