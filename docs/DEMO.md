# ROI Advisor — live demo script (about 5 minutes)

Rehearsal-ready against production. Two rules for the demo: never present `[sim]` data as real, and never send anything to graph8 support or to contacts.

## Live URLs

| What | Where |
|---|---|
| Dashboard (password-gated) | https://graph8-roi-advisor.vercel.app |
| Login | https://graph8-roi-advisor.vercel.app/login |
| MCP endpoint (bearer auth) | https://graph8-roi-advisor.vercel.app/api/mcp |
| graph8 org | Hackathon Momin Qureshi (`org_5e2170609156`) |
| Recap channel inside graph8 | `#roi-advisor` (`roi-advisor`, id `7705335b-6dba-51d8-baf9-207a0d19fe4f`) |

**Password:** lives only in the Vercel project's `DASHBOARD_PASSWORD` environment variable (Production) and in `advisor/.env.local` on this machine. It is never written into the repo or this file. Read it from Vercel → `graph8-roi-advisor` → Settings → Environment Variables (or from `.env.local`) without putting it on screen.

## Pre-demo checklist (once, ~2 minutes)

1. **Run a sync** so the numbers are current: click **Sync now** on the Overview page, or from this machine
   `curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' advisor/.env.local | cut -d= -f2-)" https://graph8-roi-advisor.vercel.app/api/cron/poll`
   Expected: `coverage.total` 1,260 (or higher if new spend happened) and `findings` ≥ 7. The Vercel plan is Hobby, so crons run daily (poll 06:00 UTC) — **Sync now** is what keeps the demo fresh.
2. **Check the balance:** `curl -s https://be.graph8.com/api/v1/usage -H "Authorization: Bearer <G8_API_KEY>"` → `data.available_credits`. Expected ~8,740 before the demo; the demo itself should spend 0.
3. **Confirm the SIM tags are visible:** "SIM" on the KPI tiles and findings, `[sim]` in the list names on the "Credits per meeting by list" chart, and `[sim]` names on lists 15/16 and their deals inside graph8. Everything simulated carries `[sim]` or a SIM tag.
4. **Log in once** and leave the dashboard open on **Overview**.
5. **Cleanup plan (after the demo, never during):** `npm run script -- scripts/cleanup-sim.ts` prints a dry run (sim deals + records + lists to review); re-run with `--apply` **only after the user approves**. The script never deletes lists, so lists 13–16 stay behind for review.

## Click steps (spec §9.2)

1. **The problem, REAL — graph8's ledger.** In graph8, open the usage/transactions view and show the wallet charges (`studio_global −20` × 43 and friends). Point out that analytics show what ran but never what it cost or whether it worked.
2. **Overview, REAL.** Open https://graph8-roi-advisor.vercel.app → log in. Read the KPI row: **1,260 credits, 126 charges, 115 wasted, 17% traced exactly**; show the "Credits by service" bars and the Advisor's open finding cards. Click **Recovery** to show the refund draft that is ready to send (do **not** tick the confirmation box).
3. **SIM outcomes and findings.** Back on **Overview**, scroll to "Credits per meeting by list": list 15 `[sim] Sales VPs` ≈ **78**, list 16 `[sim] Founders` ≈ **294**, Starter list ≈ **1,239** credits per meeting — last **30 days**. Say "SIM" out loud and note the window is a partial sample of the 8-week seed. The Advisor's "scale / cut" finding cards say what to do next.
4. **Guardrail live on list 13.** Open **Before you spend** → pick list 13 `[sim] guardrail probe` → **Check**. Show graph8's quote vs the Advisor estimate, the fit counts and the run condition `NOT(EQ({{udo_roi_fit_11e946f0}}, "low"))`. To run it live: tick **Run it (about N credits)** and press **Apply guardrail and enrich** (this spends credits — only run it if it is in the demo budget). Otherwise show the earlier live run record: one low-fit contact skipped, **0 credits**.
5. **Recap in `#roi-advisor`.** In graph8 → Work → `#roi-advisor`: the recap posted by the app's cron route (3 items). It lands in an agent-free channel: **0 credits**. Optionally re-post through `/api/cron/recap` with the `CRON_SECRET` bearer (also 0 credits, still only `#roi-advisor`) — mention it, don't do it unless rehearsing.
6. **Ask via MCP.** Add this entry under `mcpServers` in Claude Desktop (`claude_desktop_config.json`) or Cursor (`.cursor/mcp.json`) — replacing `<ADVISOR_URL>` with the dashboard URL and `<MCP_TOKEN>` with the Vercel env value:
   ```json
   { "graph8-roi": { "url": "<ADVISOR_URL>/api/mcp", "headers": { "Authorization": "Bearer <MCP_TOKEN>" } } }
   ```
   Then ask: *"Cost per meeting for fintech VPs?"* — `cost_per_outcome` answers from the same stats the dashboard shows. Tools: `roi_summary`, `cost_per_outcome`, `list_findings`, `explain_charge`, `prespend_estimate`.
   **Note:** outside agents (Claude, Cursor) work over streamable HTTP today. graph8 itself cannot call the server yet: its MCP registration only accepts SSE and the SSE transport still needs the Redis session store, so that item is **pending**. Spec §6.4 fallback applies — inside graph8, the answers live in `#roi-advisor` and the `roi_*` custom objects.

## Known numbers to say out loud

- REAL: 1,260 credits over 126 charges; 216 exact / 1,033 time-window / 11 service-only; 115 waste; 5 free failed attempts.
- SIM (30-day window): list 15 ≈ 78, list 16 ≈ 294, Starter ≈ 1,239 credits per meeting.
- Guardrail: row 66 low, rows 81 and 249 unknown; the live run skipped 1 record and spent 0 credits.
- Recap: 3 items, 0 charges.
