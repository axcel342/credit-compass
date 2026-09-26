# DRAFT — NOT SENT

**Draft message to graph8 support. Nothing here has been sent, and `contactSupport` was not called. This needs the user's explicit approval before it goes anywhere.**

All observations are from building the ROI Advisor on the v1 API on 2026-09-26 in org `org_5e2170609156`; the evidence is in `docs/superpowers/specs/2026-09-26-roi-advisor-design.md` (Appendix B) and `docs/HANDOFF.md`.

---

**Subject:** Product feedback from a hackathon build — 15 issues (billing, enrichments, webhooks, MCP)

Hi graph8 team,

We spent the day building a credit-ROI advisor on your v1 API. The API is mostly a pleasure to use, and the custom objects and webhooks worked exactly as advertised. Fifteen things cost us time or credits; each one below is something we saw directly, not a guess. Happy to share request logs or raw payloads for any of them.

1. **LLM features were down the whole session.** All 14 built-in skills and agent chat failed with provider-credit errors. Worth a balance check or an alert on your side.
2. **The workflow `web_search` node returns 0 results in ~100 ms with no error**, which looks like success to any workflow that follows it.
3. **AI enrichment charged 77 credits for jobs that failed on every record**, while the job's own report says 0 credits used. The estimate also quoted 37 and charged 50.
4. **A LeadMagic job-change result was charged but unreadable**: `/lists/{id}/data-columns` returns "Invalid organization ID" for the column the charge came from.
5. **The enrichment dashboard reports `total_cost: 0.0`** even for jobs that were charged.
6. **Skill runs are billed as `voice_llm`** on the ledger, which makes them impossible to trace back to the skill that spent the credits.
7. **`deal.won` doesn't fire on a manual Closed Won.** We could only detect wins by polling deal history.
8. **The pipeline estimator ignores run conditions and "skip existing values"** — it always quotes every contact, so the pre-spend estimate is wrong whenever a list pipeline is selective.
9. **Routing silently accepts unknown operators and then matches everyone.** A typo in a run condition fails open; we now compare the preview's `matching_count` against the list size before saving any rule.
10. **The `company_employee_count` `between` filter returns 0** regardless of the range.
11. **The documented tracking script `t.graph8.com/p.js` returns 404.**
12. **Two CLI bugs:** `skill-execute` drops its inputs (the REST call with `{"input_data": …}` works), and `skill-create-llm` sends `type` instead of `runtime_type`.
13. **MCP registration only accepts `sse`**, but public MCP servers are retiring SSE in favour of streamable HTTP. We could build the server but not register it from a workflow.
14. **`enrichment.job_*` webhooks never fire**, so enrichment completion can only be polled.
15. **Read-only calls appear to create "Revenue-…" lists.** Ten appeared in our org after read-only exploration and we didn't create them.

None of this stopped the build — we routed around each one — but 3, 4, 5, 8 and 9 involve credits, and 7 and 14 change how integrations must be written. If it's useful, we can send the exact request/response pairs and ids.

Thanks,
[your name]
