import json, re, collections, datetime

CLI_HELP = json.load(open("cli_help.json"))
CLI_ENDPOINTS = json.load(open("cli_endpoint_map.json"))
CLI_ENDPOINTS["list-fields"] = {"verb": "GET", "path": "/fields or /fields/companies (depends on --entity)"}

MCP = json.load(open("mcp_tools_raw.json"))["tools"]

# ---- CLI category groups (mirrors `g8 --help` epilog) ----
CLI_GROUPS = [
    ("Auth", ["login", "logout", "whoami"]),
    ("CRM", ["search-contacts", "search-companies", "create-contact", "create-list", "add-to-list"]),
    ("Prospecting", ["find-contacts", "find-companies", "build-list", "lookup-person", "lookup-company"]),
    ("Enrichment", ["enrich"]),
    ("Sequences", ["sequences", "add-to-sequence", "create-sequence", "sequence-preview",
                   "update-sequence", "update-sequence-step", "pause-sequence",
                   "resume-sequence", "sequence-analytics", "delete-sequence"]),
    ("Inbox", ["inbox-list", "inbox-get", "inbox-assign", "inbox-tag", "inbox-draft", "inbox-send"]),
    ("Deals", ["list-pipelines", "list-deals", "get-deal", "create-deal", "update-deal",
               "delete-deal", "list-contact-deals", "list-company-deals"]),
    ("Tasks", ["list-tasks", "list-contact-tasks", "create-task", "update-task", "delete-task"]),
    ("Notes", ["list-notes", "create-note", "update-note", "delete-note"]),
    ("Fields", ["list-fields", "create-field", "set-field-value", "delete-field"]),
    ("Quotes", ["list-quotes", "get-quote", "create-quote", "update-quote", "delete-quote",
                "duplicate-quote", "edit-quote-draft", "send-quote",
                "list-quotable-products", "get-quote-settings",
                "list-contact-quotes", "list-company-quotes"]),
    ("Stage Pipelines", ["list-stage-pipelines", "get-stage-pipeline", "list-stage-evidence",
                          "create-stage-pipeline", "update-stage-pipeline", "delete-stage-pipeline",
                          "create-stage", "update-stage", "delete-stage", "reorder-stages",
                          "suggest-stage-pipeline", "create-stage-pipeline-from-suggestion"]),
    ("Workflows", ["workflow-list", "workflow-get", "workflow-create", "workflow-update",
                   "workflow-delete", "workflow-validate", "workflow-execute",
                   "workflow-get-execution", "workflow-pause-execution",
                   "workflow-resume-execution", "workflow-stop-execution",
                   "workflow-trigger-status", "workflow-reset-trigger",
                   "workflow-node-types", "workflow-list-slack-users",
                   "workflow-list-slack-channels", "workflow-list-roam-users",
                   "workflow-list-roam-groups", "workflow-list-mcp-servers",
                   "workflow-list-dispositions", "workflow-list-form-fields"]),
    ("Skills", ["skill-list", "skill-get", "skill-get-variables", "skill-list-models",
                "skill-list-templates", "skill-create-llm", "skill-create-api",
                "skill-create-from-template", "skill-create-from-node",
                "skill-update", "skill-delete", "skill-validate", "skill-execute"]),
    ("Voice extras", ["voice-call-transcript", "voice-list-calls",
                       "voice-list-calls-for-contact", "voice-list-calls-for-sdr"]),
    ("Intent", ["intent-stats", "intent-list-keywords", "intent-create-from-domain",
                "intent-delete-keyword", "intent-keyword-companies", "intent-keyword-contacts",
                "intent-keyword-urls", "intent-pages-by-domain", "intent-search-pages",
                "intent-page-visitors", "intent-page-contacts", "intent-page-visitor-counts",
                "intent-url-companies"]),
    ("Studio", ["studio-global-context", "studio-icps", "studio-personas",
                "studio-intelligence-data", "studio-research-reports"]),
    ("Meetings", ["list-meetings", "get-meeting"]),
    ("Sync", ["sync-audience-list", "sync-audience-create", "sync-audience-update",
              "sync-audience-delete", "sync-audience-trigger", "sync-audience-runs",
              "sync-audience-errors", "sync-crm-list", "sync-crm-push",
              "sync-crm-fields", "sync-crm-status"]),
    ("Campaigns", ["campaigns", "campaign"]),
    ("Developer", ["snippet", "form", "logs", "usage", "usage-transactions",
                    "webhooks", "webhooks-events"]),
]

seen = set(n for _, ns in CLI_GROUPS for n in ns)
assert seen == set(CLI_HELP.keys()), f"mismatch: {set(CLI_HELP) - seen} / {seen - set(CLI_HELP)}"

lines = []
def w(s=""):
    lines.append(s)

# ============================================================ HEADER
w("# graph8 (g8) Full Reference — CLI / API / MCP")
w()
w(f"_Generated {datetime.date.today().isoformat()} from the installed `g8-mcp-server` package "
  f"(source introspection: argparse CLI parser, MCP server tool registration, and generated "
  f"annotation data). This is a working reference, not official vendor documentation — "
  f"regenerate it after upgrading the package if the vendor ships a new version._")
w()
w("## Contents")
w()
w("1. [Overview](#1-overview)")
w("2. [CLI Reference](#2-cli-reference) — 153 commands")
w("3. [MCP Tool Reference](#3-mcp-tool-reference) — 586 tools")
w("4. [API Endpoint Reference](#4-api-endpoint-reference) — backend REST endpoints")
w()
w("---")
w()

# ============================================================ 1. OVERVIEW
w("## 1. Overview")
w()
w("graph8 exposes the same B2B sales/marketing platform through three surfaces:")
w()
w("| Surface | Binary / access | Consumer | Size |")
w("|---|---|---|---|")
w("| **CLI** | `g8` | Humans, scripts | 153 subcommands |")
w("| **MCP server** | `g8-mcp-server` (stdio) / `g8-controller-mcp-server` | AI agents (Claude, etc.) via the Model Context Protocol | 586 tools |")
w("| **Backend REST API** | `https://be.graph8.com/api/v1/...` | Both of the above, and direct integrations via an API key (\"Developer Platform\" / apps) | ~200+ distinct endpoints observed below |")
w()
w("**Auth**: `g8 login` (browser OAuth) or `g8 login --api-key` (paste a key from Settings → API). "
  "Credentials are stored in `~/.g8/credentials.json`. The MCP server reads the same key from the "
  "`G8_API_KEY` environment variable (local stdio mode) or the stored credentials file.")
w()
w("**Tiers** (used throughout the MCP section, derived from `tool_annotations_data.py`, itself generated "
  "from the backend's own scope policy):")
w()
w("| Tier | Meaning |")
w("|---|---|")
w("| `read` | Read-only, free |")
w("| `write` | Mutates CRM/org data, free |")
w("| `destructive` | Irreversible delete/removal |")
w("| `billable` | Consumes org credits |")
w("| `external` | Sends something outside graph8 (email, SMS, webhook, quote-send, sequence enrollment, ...) |")
w()
w("**MCP tool naming**: every MCP tool is prefixed `g8_`. Tools are grouped below by the Python module "
  "in the installed package that registers them (`g8_mcp_server/tools/<module>.py`), which is graph8's own "
  "functional grouping and generally the most useful way to browse or grep the list.")
w()
w("---")
w()

# ============================================================ 2. CLI REFERENCE
w("## 2. CLI Reference")
w()
w("Full `--help` output for every subcommand, grouped exactly as `g8 --help` groups them. "
  "Where the command's implementation makes a single clearly-identifiable backend call, "
  "that call is noted as **Calls:**.")
w()

for group_name, cmd_names in CLI_GROUPS:
    w(f"### 2.{CLI_GROUPS.index((group_name, cmd_names)) + 1} {group_name}")
    w()
    for cmd in cmd_names:
        w(f"#### `g8 {cmd}`")
        w()
        ep = CLI_ENDPOINTS.get(cmd)
        if ep:
            w(f"**Calls:** `{ep['verb']} /api/v1{ep['path']}`")
            w()
        elif cmd in ("login", "logout", "whoami", "snippet", "form"):
            w("**Calls:** local only (no direct backend call in the base path; `login`/`whoami` "
              "validate the key against the API as a side effect).")
            w()
        w("```")
        w(CLI_HELP[cmd])
        w("```")
        w()

w("---")
w()

# ============================================================ 3. MCP TOOL REFERENCE
w("## 3. MCP Tool Reference")
w()
w(f"All **{len(MCP)}** tools registered by `g8-mcp-server` in default (`all`) mode, grouped by the "
  "source module that registers them. Each entry shows the tool's tier/scope, its full description "
  "(as returned by `tools/list` over MCP), and its JSON input schema.")
w()

MODULE_FIX = {
    "g8_get_event_type": "g8_mcp_server.tools.appointments",
    "g8_list_bookings": "g8_mcp_server.tools.appointments_bookings",
    "g8_get_booking": "g8_mcp_server.tools.appointments_bookings",
    "g8_create_booking": "g8_mcp_server.tools.appointments_bookings",
    "g8_cancel_booking": "g8_mcp_server.tools.appointments_bookings",
    "g8_reschedule_booking": "g8_mcp_server.tools.appointments_bookings",
    "g8_list_event_types": "g8_mcp_server.tools.appointments_event_types",
    "g8_workflow_skill_list": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_get": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_extract_variables": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_list_models": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_list_templates": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_create_llm": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_create_api": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_update_llm": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_update_api": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_delete": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_validate_template": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_create_from_template": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_create_from_node": "g8_mcp_server.tools.skills_authoring",
    "g8_workflow_skill_execute": "g8_mcp_server.tools.skills_authoring",
}

MODULE_TITLES = {
    "analytics": "Analytics",
    "api_coverage_crm": "CRM (generated API-coverage tools)",
    "api_coverage_dev": "Developer Platform (generated API-coverage tools)",
    "appointments": "Appointments — core",
    "appointments_bookings": "Appointments — bookings",
    "appointments_event_types": "Appointments — event types",
    "appointments_integrations": "Appointments — integrations",
    "appointments_ooo": "Appointments — out of office",
    "appointments_routing_forms": "Appointments — routing forms",
    "appointments_schedules": "Appointments — schedules/availability",
    "appointments_workflows": "Appointments — workflows",
    "app_platform": "App Platform (dashboard apps)",
    "boundary_reads": "Boundary reads (cross-mode read helpers)",
    "clickhouse": "ClickHouse (raw analytics queries)",
    "connection_keys": "Connection / API key management",
    "controller_access": "Controller access",
    "crm_companies": "CRM — companies (write)",
    "custom_objects": "Custom Objects",
    "dev": "Developer Platform — misc",
    "discovery": "Tool discovery (`g8_tool_search`)",
    "dispatch": "Dispatch",
    "forms": "Forms",
    "forms_signals": "Forms — signals",
    "gtm": "GTM / Campaigns",
    "inbox": "Inbox (unified email/SMS/LinkedIn)",
    "intent": "Intent data (buying signals)",
    "knowledge": "Knowledge base",
    "landing_pages": "Landing Pages",
    "library": "Content Library",
    "marketplace": "Marketplace",
    "meetings": "Meetings",
    "newsletter": "Newsletter",
    "opensearch": "OpenSearch (raw search queries)",
    "orgs": "Organizations",
    "pipelines": "Deal Pipelines / Stage Checklists",
    "platform": "Platform (contacts, lists, sequences, tasks, notes core)",
    "playbooks": "Playbooks",
    "quotes": "Quotes (quote-to-cash)",
    "radar": "Radar (company/contact intelligence)",
    "skills_authoring": "Skills authoring (incl. workflow-skill-*)",
    "snippet": "Tracking snippet",
    "support": "Support",
    "sync": "Sync (audience + CRM sync)",
    "voice": "Voice / Dialer",
    "work": "Work (team room: channels, routines)",
    "workflows": "Workflows (automation builder)",
}

by_module = collections.defaultdict(list)
for t in MCP:
    mod_full = MODULE_FIX.get(t["name"], t["module"])
    short = mod_full.rsplit(".", 1)[-1] if mod_full != "?" else "unknown"
    by_module[short].append(t)

w("| Module | Tools | Title |")
w("|---|---|---|")
for short in sorted(by_module):
    title = MODULE_TITLES.get(short, short.replace("_", " ").title())
    w(f"| `{short}` | {len(by_module[short])} | [{title}](#module-{short.replace('_','-')}) |")
w()

TIER_BADGE = {
    "read": "🟢 read",
    "write": "🟡 write",
    "destructive": "🔴 destructive",
    "billable": "💳 billable",
    "external": "📤 external",
}

for short in sorted(by_module):
    title = MODULE_TITLES.get(short, short.replace("_", " ").title())
    w(f"### <a name=\"module-{short.replace('_','-')}\"></a>3.{sorted(by_module).index(short)+1} {title} (`{short}`, {len(by_module[short])} tools)")
    w()
    for t in sorted(by_module[short], key=lambda x: x["name"]):
        tier = TIER_BADGE.get(t.get("tier"), t.get("tier") or "—")
        scope = t.get("scope") or "—"
        w(f"#### `{t['name']}`")
        w()
        w(f"- **Tier:** {tier}  **Scope:** `{scope}`")
        ops = t.get("operations") or []
        if ops:
            ops_str = "; ".join(f"`{m} {p}`" for m, p, _, _ in ops)
            w(f"- **Backend call(s):** {ops_str}")
        w()
        desc = (t.get("description") or "").strip()
        if desc:
            w(desc)
            w()
        w("<details><summary>Input schema</summary>")
        w()
        w("```json")
        w(json.dumps(t["inputSchema"], indent=2))
        w("```")
        w()
        w("</details>")
        w()

w("---")
w()

# ============================================================ 4. API ENDPOINT REFERENCE
w("## 4. API Endpoint Reference")
w()
w("Every distinct backend REST endpoint referenced by the 586 MCP tools above (there is no separately "
  "published OpenAPI spec; this is reconstructed from the tool → endpoint bindings the package ships). "
  "Grouped by the first path segment. Each row lists the tier/scope graph8 enforces and every MCP tool "
  "known to call it.")
w()

endpoint_map = collections.defaultdict(lambda: {"tier": None, "scope": None, "tools": set()})
for t in MCP:
    for m, p, tier, scope in (t.get("operations") or []):
        key = (m, p)
        endpoint_map[key]["tier"] = tier
        endpoint_map[key]["scope"] = scope
        endpoint_map[key]["tools"].add(t["name"])

def group_key(path):
    parts = [seg for seg in path.split("/") if seg]
    # paths already look like /api/v1/<resource>/...; skip the api/v1 prefix
    if len(parts) >= 3 and parts[0] == "api" and parts[1].startswith("v"):
        parts = parts[2:]
    return parts[0] if parts else path

groups = collections.defaultdict(list)
for (m, p), info in endpoint_map.items():
    groups[group_key(p)].append((m, p, info))

w(f"**Total distinct endpoints:** {len(endpoint_map)} across {len(groups)} resource areas.")
w()

for i, area in enumerate(sorted(groups), 1):
    w(f"### 4.{i} `/{area}/*`")
    w()
    w("| Method | Path | Tier | Scope | Called by |")
    w("|---|---|---|---|---|")
    for m, p, info in sorted(groups[area], key=lambda x: (x[1], x[0])):
        tools_str = ", ".join(f"`{n}`" for n in sorted(info["tools"])[:6])
        if len(info["tools"]) > 6:
            tools_str += f", _+{len(info['tools'])-6} more_"
        w(f"| {m} | `{p}` | {info['tier']} | `{info['scope']}` | {tools_str} |")
    w()

with open("g8-reference.md", "w") as f:
    f.write("\n".join(lines))

print("wrote g8-reference.md,", len(lines), "lines")
