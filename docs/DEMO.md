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
3. **Confirm the demo-data note.** The header pill says **Includes demo data** (hover or focus it for the one-sentence popover); lists 15/16 and their deals still carry `[sim]` names inside graph8. The dashboard shows no per-number SIM/REAL tags.
4. **Log in once** and leave the dashboard open on **Overview**.
5. **Cleanup plan (after the demo, never during):** `npm run script -- scripts/cleanup-sim.ts` prints a dry run (sim deals + records + lists to review); re-run with `--apply` **only after the user approves**. The script never deletes lists, so lists 13–16 stay behind for review.

## Click steps

1. **Overview.** Read the chain left to right (credits spent, meetings booked, won value); say once that meetings, deals and the email-finding spend are simulated (the pill says so). Point at the first Do next row, then click "Booked a meeting" in the bar.
2. **Charges** opens filtered. Clear the filter; expand the AI enrichment row ("3 jobs").
3. **Recovery.** Click "Request a refund of 91"; show the refund items and the draft. **Do not send.**
4. **Optimize spend.** Walk the three action cards; show "Changes you've made"; in the planner switch Find emails ↔ Verify emails to show the cost walk and forecast. **Do not run.**
5. **Weekly recap in `#roi-advisor`** and **MCP** as before (`cost_per_outcome` now accepts "Sales VPs").
   - Recap: graph8 → Work → `#roi-advisor` holds the cron-posted recap (3 items, 0 credits). Optionally re-post through `/api/cron/recap` with the `CRON_SECRET` bearer (also 0 credits, still only `#roi-advisor`) — mention it, don't do it unless rehearsing.
   - MCP: add this entry under `mcpServers` in Claude Desktop (`claude_desktop_config.json`) or Cursor (`.cursor/mcp.json`) — replacing `<ADVISOR_URL>` with the dashboard URL and `<MCP_TOKEN>` with the Vercel env value:

     ```json
     { "graph8-roi": { "url": "<ADVISOR_URL>/api/mcp", "headers": { "Authorization": "Bearer <MCP_TOKEN>" } } }
     ```

     Then ask: *"Cost per meeting for fintech VPs?"* — `cost_per_outcome` answers from the same stats the dashboard shows and also takes a list name ("Sales VPs"). Tools: `roi_summary`, `cost_per_outcome`, `list_findings`, `explain_charge`, `prespend_estimate`.
   - graph8 itself **can** call the server over SSE: registered as MCP server `d96d0ab1-84ff-46e9-a80f-3361c07c8765` and proven by the `[sim] ROI Advisor MCP test` workflow (0 credits; HANDOFF §11). Outside agents use streamable HTTP. Argument passing for tool nodes with required inputs is still untested.

## Known numbers to say out loud

- Demo dataset, last 8 weeks (includes demo data): **10,766 credits → 27 meetings and 9 won deals**; booked 2,897 / no meeting 6,652 / unused 860 / unknown 242 / waste 115; repeat enrichment 12%; charges span all 8 weeks.
- Credits per meeting by list: **Sales VPs 124** (17 meetings), **Founders 433** (6), **Starter list 1,232.75** (4).
- Fit spread after the 27 Sep sync (255 contacts): **33 high / 100 medium / 122 low / 0 unknown**.
- Planner on the Starter list: the headline contrasts graph8's quote for find emails (≈ 498, what graph8's estimator says) with the Advisor estimate the cost walk shows (≈ 36); verify emails walks 250 → −12 (no email) → −121 (unlikely) → ≈ 117 (no graph8 quote for verify). Read the exact numbers off the screen.
- If asked which part is real: the graph8 ledger contributed 1,260 credits over 126 charges (216 exact / 1,033 time-window / 11 service-only), 115 waste, 5 free failed attempts; the rest is the demo seed.
- Recap: 3 items, 0 charges.
