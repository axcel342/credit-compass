# graph8 — High-Level Product Overview

_A synthesis of what graph8 actually offers a user, distinct from `g8-reference.md`
(the exhaustive CLI/MCP/API technical reference). Sourced from graph8's own
in-product framing — the MCP server's system instructions, its "outcome
toolbox" taxonomy, its built-in onboarding prompts, and its AI Skills catalog
— rather than guessed from the command list._

## What it is

graph8 describes itself, in its own words to the AI agents that operate it, as:

> "a B2B sales and marketing platform: CRM, prospecting, enrichment, sequences, campaigns."

That's the one-line pitch. In practice it's broader: a single data layer (contacts,
companies, deals) wrapped by a full outbound/inbound revenue workflow — find people,
reach them, talk to them, close them — plus two things that go beyond a typical
sales tool: an **SDR talent marketplace** and a **developer platform** for building
custom apps on top of the same CRM data.

## How users reach it

**Five** surfaces sit on top of the same backend, not three — the first pass at
this document only knew about the local CLI and the pip-installed MCP package.
Confirmed live in this session:

| Surface | Who uses it |
|---|---|
| **Web app** (`app.graph8.com`) | The primary human UI — not covered by this repo's tooling, referenced only when a CLI/MCP action says "open your workspace in the browser." |
| **`g8` CLI** (`pip install g8-mcp-server`) | Humans/scripts calling the platform directly from a terminal. |
| **Local MCP server** (`g8-mcp-server`, stdio) | An AI agent's client spawns this process itself; needs `G8_API_KEY` in its environment. Registers the **full** catalog — 586 tools. |
| **Hosted MCP endpoint** — `https://be.graph8.com/mcp/` | An AI agent's client connects over streamable HTTP with `Authorization: Bearer <api_key>` — **no local install at all**. Verified live: same server (`graph8` v0.79.0), but starts with only the **126 always-on tools**; the rest (marketplace, radar, workflows, skill authoring, ...) appear on demand after `g8_tool_search`, exactly as the server's own instructions describe. |
| **`@graph8/sdk` (npm)** | TypeScript/JavaScript, two halves: a **client-side** write-key SDK for a customer's own website (tracking, `identify()`, IP-based visitor company lookup, real-time intent alerts via `onIntent()`, embeddable copilot/webchat/calendar-booking widgets, progressive form lookup) — this is the runtime the CLI's `g8 snippet`/`g8 form` generators install; and a **server-side** API-key SDK (`npm install`, then `g8.init({ apiKey })`) with hand-written ergonomic clients (`g8.contacts`, `g8.sequences`, ...) plus `g8.api`, a fully-generated client covering **every published Developer API operation** — including Marketplace, Radar, Appointments, App Objects and every other MCP-only surface below — each with introspectable `tier`/`scope` (`g8.api.operation(id)`). |

This document is organized around **what a user is trying to accomplish**, not
around which of those three surfaces they use — graph8 itself organizes its own
tool catalog the same way (see "The 12 outcomes" below), explicitly to answer
"what am I trying to get done" rather than "which part of the architecture is this."

---

## The 12 outcomes

graph8 groups its entire tool surface into 12 named "toolboxes" — this is graph8's
own product taxonomy (used to decide what an agent sees by default), and it is the
clearest available statement of the platform's high-level offerings.

### 1. Find and enrich prospects
Search a B2B contact/company index, look up specific people or companies, enrich
records with missing emails/phones, and save results to lists.
**CLI:** `find-contacts`, `find-companies`, `lookup-person`, `lookup-company`, `build-list`, `enrich` (§2.3, §2.4 of the reference). **Free** to search; enrichment costs credits.

### 2. Run outbound campaigns
Build multi-step, multi-channel sequences and campaigns, attach an audience list,
manage sending mailboxes and deliverability/warmup health, and launch.
**CLI:** `sequences`, `create-sequence`, `campaigns`, `campaign` (§2.5, §2.20). **MCP:** the `gtm` family (54 tools) — campaign drafting, sequence steps, mailbox warmup, launch dry-runs, campaign metrics/ideas.
Launching sends real messages to real people — every path here is gated behind an explicit confirm step in graph8's own agent instructions.

### 3. Work the inbox
Triage replies across email, SMS and LinkedIn in one unified inbox: summarize
intent, tag (positive / objection / meeting-request / unsubscribe), assign to a
human owner, draft and send responses.
**CLI:** `inbox-list`, `inbox-get`, `inbox-assign`, `inbox-tag`, `inbox-draft`, `inbox-send` (§2.6).

### 4. Book meetings
Real calendar availability, booking and rescheduling, event-type and schedule
management — a built-in scheduling layer (comparable to Calendly) wired directly
into contact/deal records.
**MCP:** the eight `appointments_*` modules (core, bookings, event types, schedules,
routing forms, out-of-office, integrations, workflows — 61 tools total, second only
to the core `platform` module's 65). Thin on the CLI (`list-meetings`, `get-meeting`
only) — this surface is mostly agent/API-driven today.

### 5. Manage pipeline
The core CRM: contacts, companies, deals across custom pipelines/stages, tasks,
notes, custom fields, and quote-to-cash (create/send/track quotes with signature
and payment terms).
**CLI:** Deals, Tasks, Notes, Fields, Quotes, Stage Pipelines groups (§2.7–§2.11) — the single largest block of the CLI, 47 commands.

### 6. Run calls
An AI-driven parallel dialer: create dialer sessions bound to a contact list, place
one-off AI-agent calls, review call transcripts and AI-generated call grading, track
missed callbacks and follow-up commitments.
**CLI:** `voice-call-transcript`, `voice-list-calls*` (§2.15). **MCP:** `voice` module (16 tools) — session creation supports both "queue a list for an SDR" and "call this one number right now with an AI agent" modes.

### 7. Act on buyer signals
Turn anonymous website traffic and tracked keyword/domain research into a
prioritized, actionable list: identify visiting companies and the people at them,
resolve intent by keyword or by page, surface lead-capture form submissions as
signals.
**CLI:** the full Intent group (§2.16) — 13 commands for keyword tracking, page-level
visitor resolution, and company/contact resolution per keyword. Notably async: intent
signal seeded from a domain expands over ~24h as a backend resolver cycle runs, not
instantly.

### 8. Track competitors
"Radar" — the platform's competitive-intelligence layer: monitor named competitors'
moves, scan for messaging/product gaps, surface opportunities.
**MCP only:** the `radar` module (42 tools) — no CLI equivalent yet. This is the
newest / most agent-first surface in the catalog.

### 9. Automate work
A full no-/low-code workflow builder — triggers, branching nodes, Slack/Roam/voice
actions — plus first-class "Skill" authoring: define reusable LLM prompts or API-call
wrappers that workflows (or ad-hoc agent calls) invoke as steps.
**CLI:** Workflows and Skills groups (§2.13, §2.14) — 34 commands. **MCP:** `workflows` (30) + `skills_authoring` (28, half of which is the `g8_workflow_skill_*` family — LLM-node authoring reached through the workflow builder) = 58 tools.
See "AI Skills" below — this is also where graph8 ships 14 ready-made Skills out of the box.

### 10. Embed graph8 in my product
Instrument a customer's *own* website/product with graph8, at two levels:

- **Runtime widgets** (via `@graph8/sdk`'s client-side write-key SDK, which is what
  `g8 snippet` generates code for): event tracking + `identify()`, IP-based visitor
  → company identification, a real-time `onIntent('high', ...)` listener for
  showing a CTA when a hot account is on the page, an embeddable AI copilot
  widget, a webchat widget, a calendar-booking widget, and progressive
  lead-capture forms that pre-fill known fields for a returning visitor.
- **Codebase-aware GTM generation** (distinctive): **scan a connected GitHub/GitLab
  repo** so graph8 reads your own tech stack and product surface to ground its
  ICP/persona/campaign generation in what you actually sell, rather than a
  manually-typed ICP description.

**CLI:** `snippet`, `form` (§2.20). **MCP:** repo connect/scan/install-patch tools, plus `landing_pages`. This is the "dev mode" referenced throughout the MCP server's prompt templates (`gtm_setup`, `campaign_review`, `icp_refinement`).

### 11. Hire and manage SDR talent
A marketplace for outsourced sales development: browse available talent, post roles,
run offers/hiring, handle invoicing and payouts.
**MCP only:** `marketplace` module (36 tools) — **no CLI equivalent**, graph8 is not
just selling software here, it's brokering human SDR labor on top of the same CRM
data. Entry-point tool: `g8_marketplace_browse_talent` (read, free). See
["Exploring the MCP-only outcomes yourself"](#exploring-the-mcp-only-outcomes-yourself) below — verified live against this account.

### 12. Build an app on graph8
A developer platform for building custom mini-apps against graph8's own data model:
declare an app and custom objects/schema, publish versions, install into a tenant org,
and generate dashboards over the resulting data.
**MCP only:** `app_platform` (10) + `custom_objects` (18) = 28 tools — **no CLI
equivalent** — this is the least CRM-shaped, most platform-shaped part of the
product: graph8 as a backend for other people's tools, not just a sales tool
itself. Entry-point tools: `g8_app_list`, `g8_object_list` (both read, free). See
["Exploring the MCP-only outcomes yourself"](#exploring-the-mcp-only-outcomes-yourself) below.

---

## AI Skills — the cross-cutting layer

Independent of the 12 outcomes above, every graph8 org ships with 14 pre-built
**Skills** — reusable LLM prompt templates an agent (or a workflow node) can run
against a record to produce a structured output. Confirmed live in this account
(`g8 skill-list`): Deep Company Research, Segment Validation, Meeting Prep Brief,
Competitive Landscape Snapshot, Buying Signals Scan, Contact Dossier, Org Chart
Mapping, Product/Service Mapping, Lead Scoring, Opportunity Fit Check, Risk
Analysis, Contact Enrichment, Industry Trends Extract, Custom Case Study Match.

All 14 explicitly forbid fabrication ("do not fabricate facts... cite the URL for
every externally-sourced fact") and require calling out unverifiable claims rather
than hedging — a real, if minor, design signal about how graph8 wants its AI
outputs trusted. Users can also author their **own** Skills (outcome 9, above) —
either an LLM-prompt skill or a thin API-call wrapper — and reuse them inside
workflows.

## The billing model, briefly

Actions split into two buckets, and graph8 is explicit about which is which at the
tool level (the `tier` field throughout `g8-reference.md` §3):

- **Free:** everything read-only, most CRM writes (creating a contact, a note, a
  task), searching the prospect index.
- **Costs credits, or leaves graph8 (`billable`/`external` tier):** enrichment,
  launching a campaign, enrolling someone in a sequence, sending a quote, an
  AI-drafted inbox reply, a dialer call. `g8 usage` / `g8 usage-transactions`
  show the org's balance and ledger.

graph8's own agent-facing instructions are unusually blunt about this boundary —
every credit-consuming or message-sending tool is required to preview with
`dry_run` and get explicit user confirmation before spending anything or
contacting a real person.

---

## Exploring the MCP-only outcomes yourself

Marketplace (outcome 11) and Build-an-app (outcome 12) have **zero CLI subcommands**
— confirmed by grepping all 153 `g8` subcommands for `marketplace`/`app`/`object`
and finding nothing. The `g8` CLI simply hasn't been extended to cover them yet.
Three ways in were actually tested against this account, in order of how "real"
an integration each represents:

**1. The hosted MCP endpoint — no install, no local process.** Point any MCP
client at `https://be.graph8.com/mcp/` (streamable HTTP) with
`Authorization: Bearer <api_key>`. Connecting live just now: `serverInfo`
reports `graph8 v0.79.0` (same version as the pip package), and the initial
`tools/list` returns exactly **126** always-on tools — marketplace and
build-an-app tools are *not* in that list. Calling
`g8_tool_search(query="marketplace")` returns 8 matches (`g8_marketplace_browse_talent`,
`g8_marketplace_accept_offer`, ...) and — confirmed — the very next `tools/list`
call then includes them (126 → 134). This is the progressive-discovery behavior
`_SERVER_INSTRUCTIONS` describes, observed working exactly as documented, live,
with zero local setup.

**2. `@graph8/sdk` from Node — the officially-generated path.** `npm install @graph8/sdk`,
then `g8.init({ apiKey })` gives `g8.api`, a client generated from graph8's own
published OpenAPI contract that reaches *every* Developer API operation,
Marketplace and App Objects included, with introspectable tier/scope:

```js
import { g8 } from '@graph8/sdk';
g8.init({ apiKey: process.env.G8_API_KEY });

const talent = await g8.api.call('browse_talent_marketplace_talent_get', { query: { limit: 1 } });
console.log(g8.api.operation('browse_talent_marketplace_talent_get'));
// { method: 'GET', path: '/api/v1/marketplace/talent', tag: 'marketplace', tier: 'read', scope: 'marketplace:read' }
```
Run against this account, `talent` came back with a real, currently-hireable SDR
profile (Poland, "Strategic" tier, $1500/mo, `availability_status: "open"`).
There's also a small hand-written `createMarketplaceClient` in the SDK (`profile()`,
`offers()`, `acceptOffer()`, `hirings()`) for the SDR's own side of a hiring, separate
from `g8.api`'s full org-side surface.

**3. The raw REST endpoint — works with nothing but `curl`.** Same data, no
dependency at all:

```bash
curl -s "https://be.graph8.com/api/v1/marketplace/talent?limit=1" \
  -H "Authorization: Bearer $G8_API_KEY"
curl -s "https://be.graph8.com/api/v1/apps" -H "Authorization: Bearer $G8_API_KEY"
curl -s "https://be.graph8.com/api/v1/objects" -H "Authorization: Bearer $G8_API_KEY"
```
Verified live: the apps call returns `{"data": [], "pagination": null}` and the
objects call returns only the three built-in objects (`contacts`, `companies`,
`deals`) — this org has built **zero apps** and defined **zero custom objects**.
Both features are fully live on the backend for this account; nobody here has
used them yet.

Any of the three works for exploring *any* MCP-only tool without the web app —
useful for `radar` (competitor tracking, also CLI-less) too. The SDK is the
most convenient for repeated/typed use; raw `curl` needs nothing installed;
the hosted MCP endpoint is what an actual AI agent (Claude Desktop, Cursor,
etc.) should be pointed at, since it's the one built for autonomous tool-calling
rather than one-off scripting.

---

## Cross-reference to the technical reference

| Outcome | CLI groups (`g8-reference.md` §2) | MCP modules (§3) |
|---|---|---|
| Find & enrich prospects | CRM, Prospecting, Enrichment | `platform`, `radar` (partial), `opensearch`, `clickhouse` |
| Run outbound campaigns | Sequences, Campaigns | `gtm`, `newsletter` |
| Work the inbox | Inbox | `inbox` |
| Book meetings | Meetings | `appointments*` (7 modules) |
| Manage pipeline | Deals, Tasks, Notes, Fields, Quotes, Stage Pipelines | `platform`, `pipelines`, `quotes`, `crm_companies`, `custom_objects` |
| Run calls | Voice extras | `voice` |
| Act on buyer signals | Intent | `intent`, `forms_signals` |
| Track competitors | _(none)_ | `radar` |
| Automate work | Workflows, Skills | `workflows`, `skills_authoring` |
| Embed in my product | Developer (`snippet`, `form`) | `landing_pages`, `forms`, dev-mode repo tools in `dev`/`api_coverage_dev` |
| Hire SDR talent | _(none)_ | `marketplace` |
| Build an app | _(none)_ | `app_platform`, `custom_objects` |

Sync (CRM/audience sync), Studio (ICPs/personas/global context), Work (team room),
Knowledge base, and Library/Playbooks sit alongside these 12 as supporting
infrastructure rather than outcomes in their own right — see the CLI's Sync/Studio
groups and the MCP's `sync`, `orgs`, `work`, `knowledge`, `library`, `playbooks`
modules for those.
