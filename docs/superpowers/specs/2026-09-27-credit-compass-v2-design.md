# Credit Compass v2: clearer insights, actions and your own account

- **Date:** 2026-09-27
- **Status:** Design approved section by section; this document awaits final review
- **Builds on:** `docs/superpowers/specs/2026-09-26-roi-advisor-design.md` (the thin slice, live at https://graph8-roi-advisor.vercel.app, repo `main` @ `c79c4d1`)
- **UI reference:** `docs/design/credit-compass-ui-v2.html` (clickable prototype, all four screens, real numbers from the store on Sep 27). Open it in a browser. It supersedes `docs/design/roi-advisor-ui.html` wherever they differ.
- **Target org:** `org_5e2170609156` ("Hackathon Momin Qureshi")

✅ means exercised live. ⚠ means proven with a caveat. ❓ means unproven and scheduled as a task.

---

## 1. Intent

**Who it is for.** Hackathon judges first, watching a live demo the user narrates, but every screen must also make sense to someone clicking around afterwards with no narration (and to a graph8 customer opening it cold).

**What success looks like.**

1. Each screen opens with one plain sentence that states its insight, computed from data, readable from across a room.
2. Every number on screen comes from one dataset and adds up: no chart or total contradicts another.
3. Every insight ends in something the user can do, and the button says exactly what happens in graph8.
4. The screens are fast on real data (Optimize spend under 3 s on the 250-contact Starter list).
5. A graph8 user can connect their own org and see their own numbers (last phase).

**Out of scope for this spec:** Slack/email recaps, App Page, per-user spend, anomaly detection, a settings screen, the refund send being exercised live.

---

## 2. What the live review found (2026-09-27)

Checked read-only against production (0 credits, nothing sent). The backend matches `docs/HANDOFF.md`; the problems are presentation and a few logic gaps.

| # | Problem | Evidence |
|---|---|---|
| 1 | Real and simulated data mixed inconsistently | Overview tile "REAL 1,260 credits" sat above a service chart led by `[sim] waterfall_enrichment 4,925`; the chart summed to ~6,170. The real 17-credit `waterfall_enrichment` row was merged into the sim bar and vanished. |
| 2 | Duplicate findings | "Waste 77" and "Fix 77" are the same AI enrichment jobs; "credits at stake" double counts. |
| 3 | Biggest real story missing | 860 of 1,260 real credits (68%) were onboarding research with 0 uses. The finding exists in code but `findings.ts:66` only fires for documents older than 7 days, and they were created Sep 26. |
| 4 | Findings not actionable | No buttons; generic copy ("… (1 runs)"). |
| 5 | Before-you-spend slow and weak | Check on the Starter list took **98.9 s** on a blank page (3 sequential API calls per contact, `prespend/actions.ts:33`). Fit is never high or medium on any list. Revenue lists appear twice. |
| 6 | Charges is a raw dump | 336 rows, 40 identical "Email verification ×40 · 1" rows, sim rows first, no filter. |
| 7 | Polish | No product name anywhere; charts untitled; "294 · 294 credits per meeting"; all-caps table headers and mono chips; mobile nav clipped. |
| 8 | Demo data unrealistic | The seed charged each sim contact about 6 times over 8 weeks (7,700 of 10,766 credits, 72%, are repeat enrichment), almost all contacts were first touched in week 1, and the sim lists have no real graph8 pipelines. |
| 9 | Housekeeping | Production dashboard password is the placeholder `change-me-local`; `docs/DEMO.md` step 6 still says graph8 can't call the MCP server (it can, HANDOFF §11). |

---

## 3. Decisions (made with the user, in order)

1. **Audience:** both, weighted to judges.
2. **No fixed deadline:** plan both items fully, ordered so any prefix leaves a better demo.
3. **One mixed dataset.** Real and simulated records are shown together, never split into zones. (An earlier "two zones" choice was reversed by the user: the split made results confusing.)
4. **No per-number markers.** No `*`, no REAL/SIM tags. One **"Includes demo data"** pill in the header, shown only while simulated records are loaded, with a one-sentence popover. The user discloses the simulation verbally in the demo. Simulated charges cannot be made real in graph8 (the ledger only records credits actually spent; the org holds ~8,740); booking real meetings costs ~20 credits each and emails third parties, so it is out.
5. **Overview = statement + flow.** A headline sentence, a quiet number strip, a three-column flow diagram, a "Do next" list, cost per meeting by list, and a trend.
6. **Overview details:** period switch "8 weeks | 30 days" (default 8 weeks), a "Never used" bucket for unused onboarding research, "booked" means the charged contact booked a meeting after the charge, product name "Credit Compass" in the header.
7. **Recovery = owners + weekly chart.** Three owner columns (graph8 should refund / already stopped / still usable) plus a weekly credits chart with waste in red; clicking a week filters the columns and the timeline. A claim tracker (found → requested → refunded).
8. **"Before you spend" is renamed "Optimize spend"** and becomes an action plan: data-backed actions with one-click changes in graph8, a record of changes made, then the enrichment planner.
9. **Planner:** where → how much → what it should book; enrichment type is selectable (Find emails / Verify emails / Find phones when proven); includes a forecast.
10. **Re-seed the demo data realistically** (user approved in principle; the destructive step still needs a go-ahead after the dry run).
11. **Connect your own graph8 account**: API-key connector behind a connector interface, plus a spike on graph8's app-install (consent) model, as the last phase.

---

## 4. Data and logic

### 4.1 One dataset

- `loadDashboardData` stops splitting real and simulated charges. `coverage`, `waste`, stats and findings are computed over all charges.
- Every record keeps `simulated`. The UI uses it for exactly one thing: `hasDemoData = any loaded record is simulated`, which shows the header pill.
- The MCP tools and the weekly recap append one short note ("Includes demo data.") when `hasDemoData`; they never present simulated numbers without it.

### 4.2 Periods and names

- Stats are computed and stored for `period: "8w"` (56 days, default) and `"30d"`. Pages read `?period=8w|30d`; every nav link carries it.
- List stats carry the list title (from `listLists`), not the ID. Charts and copy use names ("Sales VPs", never "List 15" or "[sim] List 2").

### 4.3 Outcome bucket per charge

A pure function `outcomeBucket(charge, ctx)` assigns exactly one bucket, first match wins:

| Order | Bucket | Rule |
|---|---|---|
| 1 | `waste` | `charge.isWaste` |
| 2 | `unused` | onboarding research (`studio_global`, onboarding time window) and all onboarding documents have `usage_count` 0 |
| 3 | `booked` | `contactId` set and that contact has a `meeting_booked` outcome at or after `chargedAt` |
| 4 | `nomeet` | `contactId` or `listId` set |
| 5 | `unknown` | everything else |

Invariant (tested): bucket totals sum to total credits for the period. The flow diagram, Charges chips, Overview strip and headlines all read from this one function.

Reference values on today's data (all time, before the re-seed): total 10,766 = booked 5,131 + nomeet 4,418 + unused 860 + unknown 242 + waste 115. These change after the re-seed; tests use fixtures, not these numbers.

### 4.4 Flow diagram data

`flowData(charges, lists)` returns three node columns and two link sets:

- **What you paid for:** services with plain names. Map: `waterfall_enrichment` → "Email finding", `studio_global` → "Onboarding research", `landing_page_template`/`image_generation`/`brand_snapshot_classify`/`voice_llm` → "Pages, images, skill runs" (group anything under 3% of spend into it), `ai_enrichment` → "AI enrichment", `email_verification` → "Email verification", `studio_copilot` → "Agent replies".
- **Who it was spent on:** lists by name; lists under 1% grouped as "Other lists"; `listId` null → "Not tied to a list".
- **What it bought:** the five buckets.
- Links: service→list and list→bucket, credits conserved at every node (tested).

### 4.5 Activities (Charges)

`groupActivities(charges, runs)` groups charges by `runExtId`; charges without a run group by `(service, listId, UTC day, explanation)`. Each activity has: time span, title (plain service name + list), charge count, credits, bucket split, a result summary when the run has one (for example "8 deliverable, 13 will bounce, 19 risky"; "failed on 11 of 11"), "how we know" in words (Run ID, Job ID, Token count, Time window, Service only), and its child lines (jobs, or ledger lines when there is one job).

### 4.6 Findings

- **Merge** findings whose evidence covers the same runs/jobs (the failed-job `waste` and the `billing_mismatch` `fix` become one "graph8 owes you" item; the billing mismatch becomes evidence text).
- **Unused docs:** drop the 7-day age gate; the finding fires whenever onboarding documents have 0 uses ("never used so far").
- **Owner** on each finding: `graph8_refund` (failed/unreadable jobs), `stopped` (a side effect with no matching charge since the fix, e.g. no `studio_copilot` charges after the last recap moved to `#roi-advisor`), `you_can_stop` (a side effect still happening), `usable` (unused), `handled` (estimate gap: estimates are adjusted).
- **New `repeat_enrichment` finding:** a charge for the same `(contactId, service)` within 30 days of an earlier successful one. Evidence: credits, charges, contacts, per list.
- Copy fixes: correct plurals; specific wording ("AI enrichment failed on all 11 records and was still charged 77 credits").

### 4.7 Actions

An **action** is a finding the app can act on in graph8. Each action has: evidence, an impact estimate, a confidence, the exact graph8 change in plain words, a button, and undo. Applying one writes a `roi_action` record: `{ext_id, kind, target (list/pipeline ids), applied_at, previous_settings, status: applied|undone, effect_since}`.

| Action | Impact estimate | graph8 change | Status |
|---|---|---|---|
| **Stop repeat enrichment** | repeat credits per 30 days | For each affected list's pipeline: set `skip_recently_enriched: true` (30-day window) and `skip_existing_values: true` on the enrichment step | ✅ both fields were set on list 13's step in the Task 16 live run |
| **Move spend to what books** (two steps) | meetings per week at half the best list's rate minus the worst list's | 1) Build a lookalike list: save a prospect search with the best list's segment filters (`POST /search/contacts/save`); 2) pause the worst list's pipeline (`enabled: false`) | ✅ lookalike save cost 0 (list 14); ⚠ pausing uses the `enabled` field seen on list 13's pipeline row, not yet tested on its own |
| **Skip contacts unlikely to book** | credits per run for the unlikely contacts in the target set | The existing guardrail: write `roi_fit`, set run condition `NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))`, silent-failure check | ✅ (Task 16) |

- The headline sums impact **without double counting**: a credit that two actions would save counts once (compute on the set of charges each action removes).
- Apply and undo are server actions behind an in-card confirm step. Undo restores `previous_settings` exactly.
- "Changes you've made" lists `roi_action` rows with their effect since applying (contacts skipped and credits saved from pipeline runs after `applied_at`; lookalike list size and whether it has been enriched).
- No action spends credits. Running an enrichment stays in the planner, behind its own confirmation.

### 4.8 Fit fix and contact cache

- **Hypothesis to confirm first (failing test before the fix):** the four-part segment key `seniority|department|industry|employees` spreads 250 contacts so thinly that almost no segment reaches `n ≥ 3`, so `classifyFit` returns `unknown` for everyone not flagged. Fit is therefore only ever `low` or `unknown`.
- **Fix:** back off through levels until one has `n ≥ 3`: full segment → seniority + department → seniority → the contact's list → org. Record which level decided the fit (shown in the planner's "who gets skipped" note).
- **Cache:** sync computes per contact `{contactId, listIds, hasEmail, hasPhone, consistency, segmentKey, fit, fitLevel}` into a new custom object `roi_contact` (unique `ext_id` = contact id). The planner reads the cache (one paged list call) and fetches only contacts added to the list since the last sync. Target: under 3 s for the Starter list in production. The sync's own per-contact loading moves to bounded concurrency (10 in flight, under the 50/s limit).

### 4.9 Planner (Optimize spend)

- **Enrichment types** come from graph8's list-pipeline templates, each with a target rule and a price:
  - Find emails: contacts without an email; the "Verified emails" template (✅ exists).
  - Verify emails: contacts with an email; price 1 credit (✅ ledger).
  - Find phones: shown disabled ("Available once graph8's phone template is checked") until a template is confirmed live ❓.
- **Cost walk:** graph8's quote (✅ `estimateListPipeline`, which ignores skip-existing and run conditions) → minus contacts already done → minus unlikely contacts skipped by the guardrail → Advisor estimate (records × price × calibration). Show "−0, nobody to skip" honestly when a step removes nothing (for Find emails on the Starter list, every unlikely contact already has an email).
- **Forecast:** expected meetings = contacts in the final set × the list's meetings per contact reached (smoothed toward the org rate, `smoothedRate`, k = 5); an 80% range from the Poisson distribution; "low confidence" when the list has fewer than 5 meetings of history.
- The run button keeps its checkbox confirmation and says what it does ("Verify 126 contacts").

### 4.10 Trend and cohorts

- **Rolling 4-week cost per meeting**, one point per week (credits in the 4 weeks ending that week ÷ meetings booked in them). On today's data this reads 832 → 449 → 296 → 232 → 275.
- **First-touch cohorts:** each contact belongs to the week of its first charge; the cohort's cost per meeting is its credits ÷ meetings its contacts booked, each meeting counted once. Cohorts from the last 3 weeks are marked "still maturing". Shown as a toggle on the trend ("By week spent" / "Rolling 4 weeks").
- Stored as `roi_stat` rows with `period: "week:YYYY-MM-DD"` so the recap and MCP can read the same numbers.

### 4.11 Realistic re-seed

A new seed (`scripts/seed-sim.ts` v2, deterministic) replacing the current simulated records:

- Each simulated contact is enriched once, in a specific week across the 8 weeks, spread so that cohorts exist in most weeks; about 15% are re-enriched within 30 days (so the repeat finding shows a believable amount).
- Meetings land 1–3 weeks after the contact's enrichment; deals follow meetings as today (New → Discovery → Won/Lost/Proposal).
- Cost per meeting by list stays near the seeded targets: Sales VPs ~124, Founders ~433, Starter list ~1,200.
- Each simulated list gets a real graph8 list pipeline created from the "Verified emails" template with `enabled: false` (nothing runs), so actions have something to change.
- Every record stays `simulated: true`, names keep `[sim]`, event ids start `sim-`.
- **Sequence:** `cleanup-sim.ts` dry run → show the user the counts → **user approves** → `--apply` → seed → replay events → sync → check the invariants (bucket totals, list targets, cohorts non-empty). 0 credits; no emails to anyone; lists are never deleted.

---

## 5. Screens

All four are in `docs/design/credit-compass-ui-v2.html`. Placeholders in the prototype: fit counts (41/96/112) and the Optimize spend numbers, which change after the re-seed and the fit fix.

### 5.1 Shell

- Header: **Credit Compass** · "Includes demo data" pill (only when `hasDemoData`; popover: "Meetings, deals and the email-finding spend on the Sales VPs, Founders and Starter lists are simulated for this demo. Everything else comes from this org's real graph8 ledger.") · tabs **Overview / Charges / Recovery / Optimize spend** · period switch · Sync now.
- `/prespend` redirects to `/optimize`. Page title "Credit Compass".
- Mobile: tabs scroll horizontally with the active tab visible; no page-level horizontal scroll.

### 5.2 Overview

- Headline: "{total} credits bought {meetings} meetings and {won} won deals." Lede: "{unused+waste} of them bought nothing you've used: {unused} on onboarding research nobody has opened, and {waste} on jobs that failed." (Each clause omitted when zero.)
- Number strip: credits per meeting · spent on contacts who booked · wasted · traced to a contact, list or run.
- **Flow diagram** (the one bold element): three columns, bands coloured by outcome, hover shows credits, clicking a band opens Charges filtered to that list/outcome. Labels have a halo so they stay readable over bands. Below 700 px: a stacked "what it bought" bar plus a list.
- **Do next:** top 4 findings/actions by credits at stake, each with one button that navigates (Optimize spend, Recovery) or acts (Build a lookalike list, with confirm).
- Right column: credits per meeting by list (lowest first, best list in the booked colour) and the trend (§4.10).

### 5.3 Charges

- Headline: "{traced}% of your credits trace back to a contact, list or run." Lede explains graph8's ledger records only service, amount, time.
- Outcome chips with credit totals (All / Booked a meeting / No meeting yet / Never used / Can't tell yet / Wasted) and a list filter; state in `?outcome=&list=`.
- Activity table (§4.5): When · What it paid for (with a mini outcome bar) · Credits · What it bought · How we know. Rows expand (`<details>`) into jobs or ledger lines.

### 5.4 Recovery

- Headline: "{waste} credits bought nothing. graph8 owes you {refundable} of them." Lede names the pattern (for today's data: "All of it on Sep 26, the day graph8's AI provider ran out of credit"), computed from the waste dates.
- **Weekly bars:** credits per week, waste in red with a label; clicking a week sets `?week=` and filters the owner columns and the timeline; "Show all weeks" clears it; a quiet week says "No waste, nothing to recover."
- **Owner columns:** graph8 should refund (with "Request a refund of {n}") · Already stopped · Paid for, still usable ("Open them in graph8" only if a verified app URL exists; otherwise omit).
- **Timeline** of the selected period's waste and unused spend.
- **Refund claim:** tracker Found → Requested → Refunded; draft built from the ticked refundable items; Copy text; send stays behind the checkbox. "Requested" is set when the support request succeeds (stored as a `roi_action` of kind `refund_request`). "Refunded" is a manual "Mark as refunded" until graph8's refund ledger shape is known ❓.

### 5.5 Optimize spend

- Headline: "{n} changes would save about {credits} credits a month and move spend to the lists that book." (Built from §4.7; falls back to "Your spend looks efficient right now" when no action applies.)
- Action cards (§4.7), highest impact first: title, impact (green), evidence sentence + a small chart, "In graph8:" plain description, confidence, button, "0 credits". Multi-step actions show steps with checkmarks.
- **Changes you've made:** `roi_action` rows with effect since and Undo.
- **Plan your next enrichment** (§4.9): list picker, enrichment-type switch, cost walk, forecast, "The rule graph8 will run" collapsed, checkbox + run button.

---

## 6. Components

| Component | Kind | Notes |
|---|---|---|
| `DemoDataPill` | server | renders only with `hasDemoData`; popover on hover and focus |
| `PeriodSwitch` | client | sets `?period=` |
| `Headline`, `StatStrip` | server | text from `lib/dashboard/story.ts` |
| `FlowDiagram` | server | SVG from pure `layoutFlow()`; links on bands; mobile fallback |
| `ActivityTable` | server | `<details>` rows; chips via links |
| `WeeklyBars` | client | selection via `?week=` |
| `OwnerColumns`, `Timeline`, `ClaimTracker` | server | |
| `ActionCard`, `AppliedChanges` | server + server actions | in-card confirm; undo |
| `Planner` | client + server actions | `?list=&type=` |
| `HBarChart`, `LineChart`, `SendRefund` | existing | reused; `SendRefund` gains Copy text and the Requested state |
| `KpiTile`, `Tag` (REAL/SIM), kind chips on `FindingCard` | existing | removed |

Pure logic lives in `lib/` with unit tests: `outcomeBucket`, `flowData`, `layoutFlow`, `groupActivities`, `story.*`, finding merge/owner, `repeatEnrichment`, action impact without double counting, fit backoff, forecast, rolling trend, cohorts.

---

## 7. Visual rules

- **Type:** Archivo for headlines (h1 ~34 px, 700, −0.02em, balanced wrap, max ~34ch), IBM Plex Sans for body (15 px), tabular figures for numbers. Both fonts are already loaded in `layout.tsx`.
- **No template tells:** no all-caps labels or table headers, no monospace except the run-condition code, no middle-dot-joined meta strings, no eyebrow labels above headings.
- **One colour language:** outcome tokens `--booked #1f8a5b`, `--nomeet #8fa3b8`, `--unused #d99a1e`, `--unknown #b9c2cc`, `--waste #d03b3b`, flow bands `--flow #9db8d9`, accent `--accent #2350C8`; each defined for light and dark mode in `globals.css`. Colour is never the only signal: every coloured mark has a label or number.
- **Emphasis:** one bold element per screen (Overview flow; Charges chips+table; Recovery weekly bars; Optimize action cards). Everything else quiet: white panels, 1 px borders, no shadows beyond the existing token.
- **Copy:** sentence case, plain verbs, buttons say exactly what happens and the confirmation repeats the verb ("Turn on for 3 pipelines" → "Turned on for 3 pipelines"). Errors say what failed and what to do.
- **Quality floor:** visible keyboard focus, `prefers-reduced-motion` respected, 390 px width with no horizontal page scroll, contrast AA.

---

## 8. Connect your own graph8 account (last phase)

### 8.1 Spike: graph8 app install

graph8 has an app platform: an app is installed into a client org, starts unconsented, and a credential is bound to one tenant after consent. Creating an app needs the org to be allowlisted as an app builder (else `403 builder_not_allowlisted`). Read-only check on Sep 27: `GET /apps` and `GET /installed-apps` return 200 with empty lists ✅; creation is ❓. The spike makes **one** `POST /apps` (after the user's OK; it creates an empty app record), records the result and, if allowed, the consent flow. Outcome feeds a later decision; the API-key connector ships regardless.

### 8.2 API-key connector

- **Connector interface:** `Connector { verify(): OrgInfo & {missingScopes}; caller(): G8Caller }`, implemented by `ApiKeyConnector` now and an `AppInstallConnector` later.
- **Workspaces:** `{id, orgId, orgName, demo: boolean, keyCipher, keyHash, webhookId, webhookSecretCipher, mcpTokenHash, createdAt}` stored in the existing Upstash Redis. Keys are encrypted with AES-256-GCM using `WORKSPACE_KEY_SECRET` (new env var); never logged, never sent to the browser.
- **Sign-in:** the demo workspace keeps the shared dashboard password (rotated, see §10). A connected org signs in with its API key; the app finds the workspace by `keyHash` and sets a signed session cookie with the workspace id. No new account system.
- **Connect flow:** paste key → `GET /me` + `GET /api-keys/scopes` → show the org name and any missing scopes with plain explanations → bootstrap the org (custom objects `roi_*`, the `roi_fit` and `record_consistency` fields, a webhook to `/api/webhooks/graph8/{workspaceId}` with its own secret) → first sync with progress → dashboard. Bootstrap is idempotent (409-safe).
- **Everything per workspace:** a request-scoped `G8Caller`, crons iterate workspaces (sequentially, each with the sync lock), webhooks route by workspace id, MCP tokens per workspace.
- **Disconnect:** deletes the key and the webhook; the `roi_*` data stays in the customer's own org (offer the archive script separately).
- A new workspace shows no demo-data pill unless it has simulated records.

---

## 9. Build order

Each task leaves the live demo better. ⏸ marks a stop for the user.

**Phase 1: demo credibility**

1. Data foundation (§4.1–4.6): one dataset, periods, names, outcome buckets, activities, finding merge/owners/unused gate/repeat finding.
2. Realistic re-seed (§4.11). ⏸ Before `--apply`.
3. Shell (§5.1): header, pill, tabs, period switch, `/optimize` route and redirect; remove REAL/SIM tags and `KpiTile`.
4. Overview (§5.2).
5. Charges (§5.3).
6. Recovery (§5.4).
7. Fit fix and `roi_contact` cache (§4.8).
8. Optimize spend: planner (§4.9), read-only.
9. Optimize spend: actions, changes made, undo (§4.7). ⏸ Live tests on simulated lists only; any change to the real Starter list (list 2) needs the user's OK and is undone immediately.

**Phase 2: depth**

10. Trend and cohorts (§4.10).
11. MCP and recap notes (§4.1); update `docs/DEMO.md` (new click path, fix the stale MCP line) and `docs/HANDOFF.md`; deploy and verify production.

**Phase 3: your own account**

12. App-install spike (§8.1). ⏸ Before `POST /apps`.
13. Workspaces, connector interface, key encryption, sign-in (§8.2).
14. Connect flow and bootstrap (§8.2).
15. Fan-out: crons, webhooks, MCP per workspace; disconnect.

Rough size: Phase 1 ~1.5 days, Phase 2 ~0.5 day, Phase 3 ~1 day.

---

## 10. Testing, verification and safety

**Testing**

- Test first for every pure function in §6. Required invariants: bucket totals equal total credits; flow credits conserved at every node; each meeting counted once across cohorts; action impacts never double count; headlines match their inputs (including zero and singular cases).
- Fake-client tests for exact graph8 payloads of each action and its undo, the connector's scope check, key encryption round trip, idempotent bootstrap.
- Contract tests (existing `tests/g8/contract.test.ts` pattern) for new ops: prospect search save, pipeline templates, `api-keys/scopes`, `/me`, `/apps`.
- **Every UI task:** Playwright screenshots at 1440 and 390 px of each touched screen, compared against `docs/design/credit-compass-ui-v2.html`; no console errors. (`playwright-core` and a Chromium build are available on the machine; the agent may add `playwright-core` as a dev dependency.)
- Performance: Optimize spend for the Starter list under 3 s in production (measure and record).
- Finish: `npm run typecheck`, `npm test`, `npm run build`; redeploy the existing Vercel project (`npx vercel deploy --prod --scope momin11`); re-check production screens.

**Safety**

- Expected credit spend for the whole plan: **0**. Anything that spends credits (running a pipeline, a verification, a live enrichment) needs an estimate and the user's OK.
- Nothing goes to people: the refund request is never sent live; no contact is emailed; automated posts go only to `#roi-advisor`.
- Deletion: only simulated records and `[sim]` deals, only after the user sees the dry run. Lists are never deleted. Revenue lists 3–12 are never touched.
- Org changes: action tests on simulated lists; the real Starter list only with the user's OK, undone immediately.
- Secrets: connector keys and webhook secrets encrypted at rest, never logged or sent to the browser; `.env*` stays out of git.
- Housekeeping for the user (not the agent): rotate the production `DASHBOARD_PASSWORD` (currently the placeholder) and the Upstash REST token pasted in an earlier session.

---

## 11. Open questions and unproven items

| Item | Status | Plan |
|---|---|---|
| Pausing a list pipeline with `enabled: false` alone | ⚠ | Task 9 live test on a simulated list |
| Find phones template and price | ❓ | Task 8 reads templates; stays disabled until confirmed |
| graph8 app URLs for "Open in graph8" deep links | ❓ | Omit buttons whose URL pattern isn't verified |
| How a refund shows up in graph8's ledger | ❓ | Manual "Mark as refunded" until seen |
| App-builder allowlisting and consent flow | ❓ | Task 12 spike |
| Fit root cause (sparse segments) | hypothesis | Task 7 proves it with a failing test before the fix |
