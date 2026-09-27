# Credit Compass v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the live Credit Compass thin slice into a demo that gets its value across on its own: one mixed dataset with a demo-data pill, a statement-plus-flow Overview, grouped Charges, owner-based Recovery, an action-driven Optimize spend screen, a trend with cohorts, realistic demo data, and finally a way for any graph8 user to connect their own org.

**Architecture:** The engine stays as it is: pure TypeScript domain modules in `advisor/src/lib/domain`, graph8 custom objects as the store, Next.js 16 App Router pages on Vercel. This plan adds pure modules for outcome buckets, activities, flow layout, headlines, recovery items, fit backoff, the planner, actions and trends, each tested first; pages become thin renderers of those modules. A `currentCaller()` seam (Task 3) is the only way pages reach graph8, so Phase 3 can swap the single-org client for a per-workspace one without touching pages.

**Tech Stack:** Node 22, Next.js 16.3.6 (App Router, React 19.2.8, server actions), `@graph8/sdk` 0.245.0 (`g8` singleton today, `createApiClient` per workspace in Phase 3), vitest 5.0.2, tsx, `redis` 4.7.1 (already installed via `mcp-handler`; made a direct dependency in Task 13), `playwright-core` for screenshots (dev dependency, Task 3).

**Spec:** `docs/superpowers/specs/2026-09-27-credit-compass-v2-design.md`. Visual reference: `docs/design/credit-compass-ui-v2.html` (open it in a browser; it is a clickable prototype of all four screens). Background: `docs/HANDOFF.md` (graph8 behaviours, working rules) and `docs/superpowers/specs/2026-09-26-roi-advisor-design.md` (the thin slice).

## Global Constraints

- App root: `advisor/` in the repo `/home/opc/graph8`. Run npm commands from `advisor/`; commit from the repo root after every task. Branch: work on `main` unless the executor sets up a worktree (the user approved work on `main` before).
- **Read `advisor/AGENTS.md` first.** Next.js 16 differs from older versions: page `searchParams` and `params` are Promises; check `advisor/node_modules/next/dist/docs/` before using an unfamiliar API.
- Pinned versions stay pinned: `next@16.3.6`, `@graph8/sdk@0.245.0`, `mcp-handler@1.1.0` (never 2.x: graph8 only registers SSE MCP servers), `vitest@5.0.2`.
- graph8 is reached only through a `G8Caller` (`src/lib/g8/client.ts`). Pages and server actions get it from `currentCaller()` (Task 3). Rate limit stays 40/s and 900/min per process.
- **Credits: expected spend for this whole plan is 0.** Any step that would spend credits (running a pipeline, a verification, an enrichment) must stop and ask the user with an estimate. The only credit-spending UI path is the planner's run button, behind a checkbox and `ACTION_CREDIT_CAP` (default 50).
- **Nothing to people:** never send the refund request live (0 support requests), never email or sequence a contact, post automated messages only to Work channel `roi-advisor` (id `7705335b-6dba-51d8-baf9-207a0d19fe4f`).
- **Deletion:** only `simulated: true` records and deals named `[sim]…`, only via `scripts/cleanup-sim.ts --apply`, only after the user has seen the dry-run output. Never delete lists. Never touch the Revenue lists (ids 3–12).
- **Org changes:** creating the planned custom objects `roi_contact` and `roi_action` and planned `[sim]` pipelines (created with `enabled: false`) is part of this plan. Changing settings on the real Starter list (list 2) needs the user's OK and must be undone right after the test.
- ⏸ **Stops:** Task 2 (before `cleanup-sim.ts --apply`), Task 9 (before any change to list 2), Task 12 (before `POST /apps`). At a stop, show the user what will happen and wait.
- **One dataset:** never split real and simulated records in totals, charts or copy. `simulated` stays on every record; the UI uses it only for the header pill (`hasDemoData`). MCP answers and the recap add "Includes demo data." when `hasDemoData`.
- **Copy rules (spec §7):** sentence case; no all-caps labels or table headers; monospace only for the run-condition code; no middle-dot-joined meta strings in new UI; buttons say exactly what happens and the result message repeats the verb ("Turn on for 3 pipelines" → "Turned on for 3 pipelines"); plurals are correct ("1 run", "3 runs").
- **Colour tokens (spec §7), light and dark:** `--booked #1f8a5b`, `--nomeet #8fa3b8`, `--unused #d99a1e`, `--unknown #b9c2cc`, `--waste #d03b3b`, `--flow #9db8d9`, `--accent #2350C8`. Colour is never the only signal: every coloured mark has a label or number.
- **Periods:** `8w` = the 56 days before now (default), `30d` = the 30 days before now. URL param `?period=8w|30d`, carried on every nav link.
- **Every UI task ends with screenshots** at 1440×900 and 390×844 via `npm run shots` (Task 3), compared by eye against `docs/design/credit-compass-ui-v2.html`, with no console errors. Attach what you saw to the task report.
- Secrets only from env vars; never log or print them. Connector keys (Phase 3) are encrypted at rest and never sent to the browser.

## Review Focus

1. **Empty and zero states:** a period with no meetings, no charges or no waste (for example `30d` after the re-seed, or a freshly connected org) must render sentences like "No meetings yet in the last 30 days", never `NaN`, `Infinity`, "0 meetings and 0 won deals" or a divide-by-zero. Test: Task 4 (`story.test.ts`, zero cases) and Task 6 (`recovery.test.ts`, no waste).
2. **A meeting that happened before the charge** must not make that charge "booked" (credits spent after a meeting didn't buy it). Test: Task 1 (`buckets.test.ts`).
3. **Applying an action twice, or undoing after someone changed the pipeline in graph8,** must not create a second `roi_action`, and undo must restore the settings captured at the first apply, not the current ones. Test: Task 9 (`apply-actions.test.ts`).
4. **Lists with duplicate titles or 0 contacts** (the org has two of every Revenue list, most empty) must not appear twice or as empty choices in the planner; duplicates get their id in brackets. Test: Task 8 (`planner.test.ts`, `listChoices`).
5. **A pasted API key with surrounding whitespace, the wrong org, or missing scopes** must be trimmed, explained in plain words and never stored when verification fails. Test: Task 14 (`connect.test.ts`).

---

## File Structure

New and changed files, grouped by responsibility (paths under `advisor/`):

```
src/lib/domain/
  types.ts           + OutcomeBucket, Period, FindingKind "repeat_enrichment", Action types, ContactCacheRow   (Tasks 1, 6, 7, 9)
  period.ts          NEW parsePeriod, periodWindow                                                         (Task 1)
  names.ts           NEW serviceName, listLabel                                                            (Task 1)
  buckets.ts         NEW meetingsByContact, outcomeBucket, bucketTotals                                     (Task 1)
  activities.ts      NEW groupActivities                                                                    (Task 1)
  repeat.ts          NEW repeatEnrichment                                                                   (Task 1)
  findings.ts        merge billing mismatch into waste, unused gate, repeat finding, names, plurals        (Task 1)
  metrics.ts         unchanged API; called for both periods                                                 (Task 1)
  fit.ts             NEW rateTables, classifyWithBackoff                                                    (Task 7)
  planner.ts         NEW ENRICHMENT_TYPES, listChoices, costWalk, forecastMeetings, poissonRange            (Task 8)
  actions.ts         NEW buildActions, combinedSavings                                                     (Task 9)
  trend.ts           NEW rollingCostPerMeeting, firstTouchCohorts                                           (Task 10)
src/lib/dashboard/
  data.ts            loadDashboardData (cached, all records) + periodView                                  (Task 1)
  story.ts           NEW headline and lede builders for every screen                                       (Tasks 4–6, 9)
  flow.ts            NEW flowData, layoutFlow                                                              (Task 4)
  recovery.ts        NEW recoveryItems, weeklySpend, refundDraftFor                                        (Task 6)
src/lib/sim/plan.ts  buildSimPlan v2 (one enrichment per contact, ~15% repeats, lagged meetings)           (Task 2)
src/lib/store/schema.ts, mappers.ts   + roi_action (Task 6), roi_contact (Task 7)
src/lib/sync/contacts.ts   bounded concurrency; writes roi_contact                                         (Task 7)
src/lib/sync/run-sync.ts   both periods, list names, roi_contact                                           (Tasks 1, 7)
src/lib/util/concurrency.ts NEW mapLimit                                                                   (Task 7)
src/lib/guardrail/pipeline.ts NEW readPipeline, patchPipeline, installGuardrail                            (Task 9)
src/lib/workspace/current.ts  NEW currentCaller (single org now, per workspace in Phase 3)                 (Task 3, 13)
src/lib/workspace/*.ts   NEW crypto, store, connector, bootstrap                                           (Tasks 13–15)
src/components/
  Header.tsx, NavTabs.tsx, PeriodSwitch.tsx, DemoDataPill.tsx     NEW                                     (Task 3)
  Headline.tsx, StatStrip.tsx, FlowDiagram.tsx, DoNext.tsx        NEW                                     (Task 4)
  ActivityTable.tsx, OutcomeChips.tsx                              NEW                                     (Task 5)
  WeeklyBars.tsx, OwnerColumns.tsx, Timeline.tsx, ClaimTracker.tsx NEW                                    (Task 6)
  Planner.tsx, CostWalk.tsx, ForecastBar.tsx                       NEW                                     (Task 8)
  ActionCard.tsx, AppliedChanges.tsx                               NEW                                     (Task 9)
  TrendChart.tsx                                                   NEW                                     (Task 10)
  HBarChart.tsx      drop the [sim] prefix                                                                 (Task 4)
  KpiTile.tsx, Tag.tsx, FindingCard.tsx, ChargesTable.tsx, CoverageBar.tsx   DELETED                        (Tasks 3–5)
src/app/(dash)/
  layout.tsx         header, nav, pill                                                                     (Task 3)
  page.tsx           Overview                                                                              (Task 4)
  charges/page.tsx   Charges                                                                               (Task 5)
  recovery/*         Recovery                                                                              (Task 6)
  optimize/*         NEW Optimize spend (replaces prespend/)                                               (Tasks 8, 9)
src/app/connect/*    NEW connect flow                                                                      (Task 14)
src/app/api/webhooks/graph8/[workspace]/route.ts  NEW per-workspace receiver                               (Task 15)
scripts/seed-sim.ts, scripts/cleanup-sim.ts   v2 seed; cleanup also covers roi_contact/roi_action sims      (Task 2)
scripts/shots.mjs    NEW screenshot helper                                                                  (Task 3)
scripts/app-spike.ts NEW one-off POST /apps probe                                                          (Task 12)
tests/...            one test file per new module, named after it
```

---
## Phase 1: demo credibility

### Task 1: Data foundation (one dataset, periods, names, outcome buckets, activities, findings)

Spec §4.1–4.6. Invisible on its own; every later task reads these functions.

**Files:**
- Modify: `src/lib/domain/types.ts`
- Create: `src/lib/domain/period.ts`, `src/lib/domain/names.ts`, `src/lib/domain/buckets.ts`, `src/lib/domain/activities.ts`, `src/lib/domain/repeat.ts`
- Modify: `src/lib/domain/findings.ts`, `src/lib/sync/run-sync.ts`, `src/lib/dashboard/data.ts`, `src/app/(dash)/page.tsx` (one line)
- Test: `tests/domain/period.test.ts`, `tests/domain/names.test.ts`, `tests/domain/buckets.test.ts`, `tests/domain/activities.test.ts`, `tests/domain/repeat.test.ts`, `tests/domain/findings.test.ts` (update), `tests/dashboard/data.test.ts`

**Interfaces:**
- Consumes: `AttributedCharge`, `Outcome`, `Run`, `Stat`, `Finding` (`types.ts`); `toMs`, `toIso` (`time.ts`); `computeStats` (`metrics.ts`); `RecordStore`, mappers.
- Produces (later tasks use these exact names):
  - `type OutcomeBucket = "booked" | "nomeet" | "unused" | "unknown" | "waste"`; `type Period = "8w" | "30d"`
  - `parsePeriod(v: unknown): Period`, `periodWindow(p: Period, now: string): { from: number; to: number }`, `inWindow(iso: string, w): boolean`, `PERIOD_LABEL: Record<Period, string>`
  - `serviceName(service: string): string`, `listLabel(title: string): string`, `listNamesFrom(lists: { id: number; title: string }[]): Map<string, string>`
  - `BUCKETS`, `BUCKET_LABEL`, `meetingsByContact(outcomes): Map<number, number[]>`, `isOnboardingResearch(c): boolean`, `outcomeBucket(c, ctx: BucketContext): OutcomeBucket`, `bucketTotals(charges, ctx): Record<OutcomeBucket, number>`
  - `groupActivities(charges, runs, bucketOf, listNames): Activity[]` with `Activity`, `ActivityChild`
  - `repeatEnrichment(charges, windowDays = 30): RepeatSummary`
  - `loadDashboardData(c?: G8Caller): Promise<DashboardData>` (request-cached) and `periodView(d: DashboardData, period: Period): PeriodView`

- [ ] **Step 1: Add the shared types**

In `src/lib/domain/types.ts`, change the `FindingKind` line and append the new types at the end of the file:

```ts
export type FindingKind = "scale" | "cut" | "waste" | "fix" | "unused" | "data_risk" | "what_worked" | "traceability" | "side_effect" | "repeat_enrichment";
```

```ts
export type OutcomeBucket = "booked" | "nomeet" | "unused" | "unknown" | "waste";
export type Period = "8w" | "30d";
```

- [ ] **Step 2: Write the failing tests for periods and names**

`tests/domain/period.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parsePeriod, periodWindow, inWindow, PERIOD_LABEL } from "@/lib/domain/period";

describe("period", () => {
  it("defaults to 8 weeks and accepts 30d", () => {
    expect(parsePeriod(undefined)).toBe("8w");
    expect(parsePeriod("nonsense")).toBe("8w");
    expect(parsePeriod("30d")).toBe("30d");
  });
  it("builds a window that ends at now", () => {
    const w = periodWindow("8w", "2026-09-27T00:00:00Z");
    expect(w.to).toBe(Date.parse("2026-09-27T00:00:00Z"));
    expect(w.to - w.from).toBe(56 * 86_400_000);
    expect(inWindow("2026-08-02T00:00:00Z", w)).toBe(true);
    expect(inWindow("2026-08-01T23:59:59Z", w)).toBe(false);
  });
  it("labels periods in plain words", () => expect(PERIOD_LABEL["30d"]).toBe("the last 30 days"));
});
```

`tests/domain/names.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serviceName, listLabel, listNamesFrom } from "@/lib/domain/names";

describe("names", () => {
  it("names ledger services in plain words", () => {
    expect(serviceName("waterfall_enrichment")).toBe("Email finding");
    expect(serviceName("studio_global")).toBe("Onboarding research");
    expect(serviceName("brand_new_thing")).toBe("Brand new thing");
  });
  it("drops the [sim] prefix and the setup suffix from list titles", () => {
    expect(listLabel("[sim] Sales VPs")).toBe("Sales VPs");
    expect(listLabel("Starter list (proactive setup)")).toBe("Starter list");
  });
  it("adds the id when two lists share a name", () => {
    const m = listNamesFrom([{ id: 5, title: "Revenue-Leads" }, { id: 6, title: "Revenue-Leads" }, { id: 15, title: "[sim] Sales VPs" }]);
    expect(m.get("5")).toBe("Revenue-Leads (5)");
    expect(m.get("6")).toBe("Revenue-Leads (6)");
    expect(m.get("15")).toBe("Sales VPs");
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `cd advisor && npx vitest run tests/domain/period.test.ts tests/domain/names.test.ts`
Expected: FAIL, "Failed to resolve import @/lib/domain/period" (and names).

- [ ] **Step 4: Implement `period.ts` and `names.ts`**

`src/lib/domain/period.ts`:

```ts
import type { Period } from "./types";
import { toMs } from "./time";

export const PERIOD_DAYS: Record<Period, number> = { "8w": 56, "30d": 30 };
export const PERIOD_LABEL: Record<Period, string> = { "8w": "the last 8 weeks", "30d": "the last 30 days" };

export function parsePeriod(v: unknown): Period {
  return v === "30d" ? "30d" : "8w";
}

export function periodWindow(p: Period, now: string): { from: number; to: number } {
  const to = toMs(now);
  return { from: to - PERIOD_DAYS[p] * 86_400_000, to };
}

export function inWindow(iso: string, w: { from: number; to: number }): boolean {
  const t = toMs(iso);
  return t >= w.from && t <= w.to;
}
```

`src/lib/domain/names.ts`:

```ts
const SERVICE: Record<string, string> = {
  waterfall_enrichment: "Email finding", studio_global: "Onboarding research", ai_enrichment: "AI enrichment",
  email_verification: "Email verification", studio_copilot: "Agent replies", voice_llm: "Skill runs",
  landing_page_template: "Landing page", image_generation: "Image generation", brand_snapshot_classify: "Brand classifier",
};

export function serviceName(service: string): string {
  return SERVICE[service] ?? service.replace(/_/g, " ").replace(/^./, (ch) => ch.toUpperCase());
}

export function listLabel(title: string): string {
  return title.replace(/^\[sim\]\s*/, "").replace(/\s*\(proactive setup\)$/, "").trim();
}

export function listNamesFrom(lists: { id: number; title: string }[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const l of lists) counts.set(listLabel(l.title), (counts.get(listLabel(l.title)) ?? 0) + 1);
  return new Map(lists.map((l) => {
    const label = listLabel(l.title);
    return [String(l.id), (counts.get(label) ?? 0) > 1 ? `${label} (${l.id})` : label];
  }));
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/domain/period.test.ts tests/domain/names.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing test for outcome buckets**

`tests/domain/buckets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { outcomeBucket, bucketTotals, meetingsByContact, BUCKETS } from "@/lib/domain/buckets";
import { attributeCharges } from "@/lib/domain/attribution";
import type { AttributedCharge, Outcome } from "@/lib/domain/types";
import { loadDesignInput } from "../helpers/design-fixture";

const charge = (p: Partial<AttributedCharge>): AttributedCharge => ({
  ledgerId: "l1", ledgerType: "usage", service: "waterfall_enrichment", credits: 10, chargedAt: "2026-09-01T10:00:00Z", llmTier: null,
  tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: null, contactId: null, segmentKey: null,
  explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const meeting = (contactId: number, at: string): Outcome => ({ extId: `m${contactId}${at}`, type: "meeting_booked", occurredAt: at, contactId, companyId: null,
  dealId: null, amount: null, listId: null, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });

const ctx = { meetingsByContact: meetingsByContact([meeting(7, "2026-09-10T00:00:00Z")]), onboardingUnused: true };

describe("outcomeBucket", () => {
  it("puts waste first, even when the contact later booked", () =>
    expect(outcomeBucket(charge({ contactId: 7, isWaste: true }), ctx)).toBe("waste"));
  it("marks onboarding research as never used only while the documents are unused", () => {
    const c = charge({ service: "studio_global", method: "time_window" });
    expect(outcomeBucket(c, ctx)).toBe("unused");
    expect(outcomeBucket(c, { ...ctx, onboardingUnused: false })).toBe("unknown");
  });
  it("counts a charge as booked only when the meeting came after it", () => {
    expect(outcomeBucket(charge({ contactId: 7, chargedAt: "2026-09-01T00:00:00Z" }), ctx)).toBe("booked");
    expect(outcomeBucket(charge({ contactId: 7, chargedAt: "2026-09-11T00:00:00Z" }), ctx)).toBe("nomeet");
  });
  it("puts list-only charges in no meeting yet and untied charges in can't tell", () => {
    expect(outcomeBucket(charge({ listId: 2 }), ctx)).toBe("nomeet");
    expect(outcomeBucket(charge({}), ctx)).toBe("unknown");
  });
});

describe("bucketTotals", () => {
  it("always adds up to total spend (real design-day ledger)", () => {
    const charges = attributeCharges(loadDesignInput());
    const totals = bucketTotals(charges, { meetingsByContact: new Map(), onboardingUnused: true });
    const sum = BUCKETS.reduce((s, b) => s + totals[b], 0);
    expect(sum).toBeCloseTo(charges.reduce((s, c) => s + c.credits, 0), 6);
    expect(totals.waste).toBe(115);
    expect(totals.unused).toBe(860);
  });
});
```

- [ ] **Step 7: Run it to see it fail**

Run: `npx vitest run tests/domain/buckets.test.ts`
Expected: FAIL, cannot resolve `@/lib/domain/buckets`.

- [ ] **Step 8: Implement `buckets.ts`**

```ts
import type { AttributedCharge, Outcome, OutcomeBucket } from "./types";
import { toMs } from "./time";

export const BUCKETS: OutcomeBucket[] = ["booked", "nomeet", "unused", "unknown", "waste"];
export const BUCKET_LABEL: Record<OutcomeBucket, string> = {
  booked: "Booked a meeting", nomeet: "No meeting yet", unused: "Never used", unknown: "Can't tell yet", waste: "Wasted",
};

export interface BucketContext { meetingsByContact: Map<number, number[]>; onboardingUnused: boolean }

export function meetingsByContact(outcomes: Outcome[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const o of outcomes) {
    if (o.type !== "meeting_booked" || o.contactId === null) continue;
    m.set(o.contactId, [...(m.get(o.contactId) ?? []), toMs(o.occurredAt)].sort((a, b) => a - b));
  }
  return m;
}

export function isOnboardingResearch(c: AttributedCharge): boolean {
  return c.service === "studio_global" && c.method === "time_window";
}

export function outcomeBucket(c: AttributedCharge, ctx: BucketContext): OutcomeBucket {
  if (c.isWaste) return "waste";
  if (ctx.onboardingUnused && isOnboardingResearch(c)) return "unused";
  if (c.contactId !== null) {
    const t = toMs(c.chargedAt);
    if ((ctx.meetingsByContact.get(c.contactId) ?? []).some((m) => m >= t)) return "booked";
  }
  if (c.contactId !== null || c.listId !== null) return "nomeet";
  return "unknown";
}

export function bucketTotals(charges: AttributedCharge[], ctx: BucketContext): Record<OutcomeBucket, number> {
  const t: Record<OutcomeBucket, number> = { booked: 0, nomeet: 0, unused: 0, unknown: 0, waste: 0 };
  for (const c of charges) t[outcomeBucket(c, ctx)] += c.credits;
  return t;
}
```

- [ ] **Step 9: Run it to see it pass**

Run: `npx vitest run tests/domain/buckets.test.ts`
Expected: PASS (5 tests). If `totals.unused` is not 860, print `charges.filter(isOnboardingResearch)` and check the design fixture's onboarding window; the real org's 860 `studio_global` credits are all `time_window` in `docs/HANDOFF.md` §6.

- [ ] **Step 10: Write the failing test for repeat enrichment**

`tests/domain/repeat.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { repeatEnrichment } from "@/lib/domain/repeat";
import type { AttributedCharge } from "@/lib/domain/types";

const c = (id: string, contactId: number | null, at: string, p: Partial<AttributedCharge> = {}): AttributedCharge => ({
  ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment", credits: 10, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null,
  description: null, method: "advisor", runExtId: null, listId: 15, contactId, segmentKey: null, explanation: "x", result: "success",
  isWaste: false, wasteReason: null, simulated: false, ...p });

describe("repeatEnrichment", () => {
  it("counts a second charge for the same contact and service within 30 days", () => {
    const r = repeatEnrichment([c("a", 1, "2026-09-01T00:00:00Z"), c("b", 1, "2026-09-20T00:00:00Z"), c("c", 2, "2026-09-02T00:00:00Z")]);
    expect(r).toMatchObject({ credits: 10, charges: 1, contacts: 1, ledgerIds: ["b"] });
    expect(r.byList.get(15)).toBe(10);
  });
  it("ignores repeats after the window, after a failed first attempt, and wasted repeats", () => {
    expect(repeatEnrichment([c("a", 1, "2026-07-01T00:00:00Z"), c("b", 1, "2026-09-01T00:00:00Z")]).charges).toBe(0);
    expect(repeatEnrichment([c("a", 1, "2026-09-01T00:00:00Z", { result: "failed" }), c("b", 1, "2026-09-02T00:00:00Z")]).charges).toBe(0);
    expect(repeatEnrichment([c("a", 1, "2026-09-01T00:00:00Z"), c("b", 1, "2026-09-02T00:00:00Z", { isWaste: true })]).charges).toBe(0);
  });
  it("ignores charges without a contact", () => expect(repeatEnrichment([c("a", null, "2026-09-01T00:00:00Z"), c("b", null, "2026-09-02T00:00:00Z")]).charges).toBe(0));
});
```

- [ ] **Step 11: Run it to see it fail**

Run: `npx vitest run tests/domain/repeat.test.ts`
Expected: FAIL, cannot resolve `@/lib/domain/repeat`.

- [ ] **Step 12: Implement `repeat.ts`**

```ts
import type { AttributedCharge } from "./types";
import { toMs } from "./time";

export interface RepeatSummary { credits: number; charges: number; contacts: number; byList: Map<number | null, number>; ledgerIds: string[]; simulated: boolean }

export function repeatEnrichment(charges: AttributedCharge[], windowDays = 30): RepeatSummary {
  const win = windowDays * 86_400_000;
  const lastSuccess = new Map<string, number>();
  const out: RepeatSummary = { credits: 0, charges: 0, contacts: 0, byList: new Map(), ledgerIds: [], simulated: false };
  const who = new Set<number>();
  for (const c of [...charges].sort((a, b) => toMs(a.chargedAt) - toMs(b.chargedAt))) {
    if (c.contactId === null) continue;
    const key = `${c.contactId}|${c.service}`, t = toMs(c.chargedAt), prev = lastSuccess.get(key);
    if (prev !== undefined && t - prev <= win && !c.isWaste) {
      out.credits += c.credits; out.charges++; out.ledgerIds.push(c.ledgerId); who.add(c.contactId);
      out.byList.set(c.listId, (out.byList.get(c.listId) ?? 0) + c.credits);
      out.simulated ||= c.simulated;
    }
    if (c.result === "success") lastSuccess.set(key, t);
  }
  out.contacts = who.size;
  return out;
}
```

- [ ] **Step 13: Run it to see it pass**

Run: `npx vitest run tests/domain/repeat.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 14: Write the failing test for activities**

`tests/domain/activities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupActivities } from "@/lib/domain/activities";
import { outcomeBucket } from "@/lib/domain/buckets";
import type { AttributedCharge, Run } from "@/lib/domain/types";

const c = (id: string, p: Partial<AttributedCharge>): AttributedCharge => ({
  ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment", credits: 10, chargedAt: "2026-09-26T14:34:00Z", llmTier: null,
  tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: null, contactId: null, segmentKey: null,
  explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const names = new Map([["15", "Sales VPs"], ["2", "Starter list"]]);
const ctx = { meetingsByContact: new Map([[1, [Date.parse("2026-10-01T00:00:00Z")]]]), onboardingUnused: true };
const bucketOf = (x: AttributedCharge) => outcomeBucket(x, ctx);
const runs: Run[] = [
  { extId: "job-a", kind: "ai_enrichment_job", actionName: "AI enrichment", startedAt: null, completedAt: null, status: "failed", source: "poll", recordsOk: 0, recordsFailed: 10 },
  { extId: "job-b", kind: "ai_enrichment_job", actionName: "AI enrichment", startedAt: null, completedAt: null, status: "failed", source: "poll", recordsOk: 0, recordsFailed: 1 },
];

describe("groupActivities", () => {
  const charges = [
    c("s1", { runExtId: "sim-run-15", listId: 15, contactId: 1, chargedAt: "2026-08-02T00:00:00Z", explanation: "[sim] Email finder · [sim] Sales VPs", simulated: true }),
    c("s2", { runExtId: "sim-run-15", listId: 15, contactId: 1, chargedAt: "2026-09-02T00:00:00Z", explanation: "[sim] Email finder · [sim] Sales VPs", simulated: true }),
    c("a1", { service: "ai_enrichment", method: "job_window", runExtId: "job-a", listId: 2, credits: 50, isWaste: true, wasteReason: "failed_job", result: "failed", explanation: "AI enrichment · Current employer check" }),
    c("a2", { service: "ai_enrichment", method: "job_window", runExtId: "job-b", listId: 2, credits: 22, isWaste: true, wasteReason: "failed_job", result: "failed", explanation: "AI enrichment · Current employer check" }),
    c("k1", { service: "voice_llm", method: "exact_tokens", runExtId: "run-1", credits: 7, explanation: "Meeting Prep Brief · Jamie Elden, Listrak" }),
    c("k2", { service: "voice_llm", method: "none", credits: 5, explanation: "voice_llm charge, details unavailable" }),
  ];
  const acts = groupActivities(charges, runs, bucketOf, names);

  it("keeps one activity per run across days, named by service and list", () => {
    const sim = acts.find((a) => a.service === "waterfall_enrichment")!;
    expect(sim).toMatchObject({ title: "Email finding", detail: "Sales VPs", charges: 2, credits: 20, from: "2026-08-02T00:00:00.000Z", how: "Run ID", simulated: true, children: [] });
    expect(sim.buckets.booked).toBe(20);
  });
  it("puts several jobs with the same purpose under one activity with a child per job", () => {
    const ai = acts.find((a) => a.service === "ai_enrichment")!;
    expect(ai.credits).toBe(72);
    expect(ai.children.map((x) => [x.label, x.credits, x.result])).toEqual([["Job job-a, 10 records", 50, "Failed on 10 of 10"], ["Job job-b, 1 record", 22, "Failed on 1 of 1"]]);
    expect(ai.result).toBe("Wasted: failed on 11 of 11");
  });
  it("groups a day's skill runs together and describes how each was matched", () => {
    const sk = acts.find((a) => a.service === "voice_llm")!;
    expect(sk).toMatchObject({ title: "Skill runs", credits: 12, how: "Token count, Service only", result: "Can't tell yet" });
    expect(sk.detail).toBe("Meeting Prep Brief");
  });
  it("sorts by credits, largest first", () => expect(acts.map((a) => a.credits)).toEqual([72, 20, 12]));
});
```

- [ ] **Step 15: Run it to see it fail**

Run: `npx vitest run tests/domain/activities.test.ts`
Expected: FAIL, cannot resolve `@/lib/domain/activities`.

- [ ] **Step 16: Implement `activities.ts`**

```ts
import type { AttributedCharge, Method, OutcomeBucket, Run, WasteReason } from "./types";
import { serviceName } from "./names";
import { toMs } from "./time";

export interface ActivityChild { key: string; label: string; credits: number; charges: number; result: string }
export interface Activity {
  key: string; title: string; detail: string; service: string; listId: number | null; from: string; to: string;
  credits: number; charges: number; buckets: Record<OutcomeBucket, number>; how: string; result: string | null; simulated: boolean;
  ledgerIds: string[]; children: ActivityChild[];
}

const HOW: Record<Method, string> = { advisor: "Run ID", pipeline_run: "Run ID", job_window: "Job ID", exact_tokens: "Token count", time_window: "Time window", none: "Service only" };
const WASTE: Record<WasteReason, string> = { failed_job: "Wasted: the job failed", no_change: "Wasted: the result can't be read back", billing_mismatch: "Wasted: billing mismatch", agent_side_effect: "Wasted: side effect" };
const day = (iso: string) => new Date(toMs(iso)).toISOString().slice(0, 10);
const clean = (s: string) => s.replace(/\[sim\]\s*/g, "");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function groupKey(c: AttributedCharge): string {
  if (c.method === "exact_tokens" || c.method === "none") return `${c.service}|day:${day(c.chargedAt)}`;
  const base = `${c.service}|${c.listId ?? "-"}|${clean(c.explanation)}`;
  return c.runExtId ? base : `${base}|${day(c.chargedAt)}`;
}

function detailOf(xs: AttributedCharge[], listNames: Map<string, string>): string {
  const first = xs[0];
  if (first.listId !== null) return listNames.get(String(first.listId)) ?? `List ${first.listId}`;
  const heads = [...new Set(xs.map((x) => clean(x.explanation).split(" · ")))].filter((p) => p.length > 1).map((p) => p[0]);
  const tails = [...new Set(xs.map((x) => clean(x.explanation).split(" · ")).filter((p) => p.length > 1 && first.method !== "exact_tokens").map((p) => p.slice(1).join(", ")))];
  if (first.method === "exact_tokens" || first.method === "none") return [...new Set(heads)].slice(0, 3).join(", ");
  return tails[0] ?? "";
}

function recordsOf(runIds: string[], runs: Map<string, Run>) {
  let ok = 0, failed = 0, known = false;
  for (const id of runIds) { const r = runs.get(id); if (r && (r.recordsOk != null || r.recordsFailed != null)) { known = true; ok += r.recordsOk ?? 0; failed += r.recordsFailed ?? 0; } }
  return known ? { ok, failed, total: ok + failed } : null;
}

export function groupActivities(charges: AttributedCharge[], runs: Run[], bucketOf: (c: AttributedCharge) => OutcomeBucket, listNames: Map<string, string>): Activity[] {
  const runMap = new Map(runs.map((r) => [r.extId, r]));
  const groups = new Map<string, AttributedCharge[]>();
  for (const c of charges) groups.set(groupKey(c), [...(groups.get(groupKey(c)) ?? []), c]);
  const out: Activity[] = [];
  for (const [key, xs] of groups) {
    const sorted = [...xs].sort((a, b) => toMs(a.chargedAt) - toMs(b.chargedAt));
    const buckets: Record<OutcomeBucket, number> = { booked: 0, nomeet: 0, unused: 0, unknown: 0, waste: 0 };
    for (const c of xs) buckets[bucketOf(c)] += c.credits;
    const credits = xs.reduce((s, c) => s + c.credits, 0);
    const kids = new Map<string, AttributedCharge[]>();
    for (const c of sorted) { const k = c.runExtId ?? c.ledgerId; kids.set(k, [...(kids.get(k) ?? []), c]); }
    const children: ActivityChild[] = kids.size <= 1 ? [] : [...kids].map(([k, cs]) => {
      const rec = cs[0].runExtId ? recordsOf([cs[0].runExtId], runMap) : null;
      const label = cs[0].method === "job_window" || cs[0].method === "pipeline_run" ? `Job ${k.slice(0, 8)}${rec ? `, ${plural(rec.total, "record")}` : ""}` : clean(cs[0].explanation);
      const allWaste = cs.every((c) => c.isWaste);
      return { key: k, label, credits: cs.reduce((s, c) => s + c.credits, 0), charges: cs.length,
        result: allWaste && rec ? `Failed on ${rec.failed} of ${rec.total}` : allWaste ? WASTE[cs[0].wasteReason ?? "failed_job"] : "" };
    });
    const only = (b: OutcomeBucket) => buckets[b] > 0 && buckets[b] === credits;
    const rec = recordsOf([...new Set(xs.map((c) => c.runExtId).filter((x): x is string => !!x))], runMap);
    const result = only("waste") ? (rec && xs[0].wasteReason === "failed_job" ? `Wasted: failed on ${rec.failed} of ${rec.total}` : WASTE[xs[0].wasteReason ?? "failed_job"])
      : only("unused") ? "Never used" : only("unknown") ? "Can't tell yet" : null;
    out.push({ key, title: serviceName(xs[0].service), detail: detailOf(sorted, listNames), service: xs[0].service, listId: xs[0].listId,
      from: new Date(toMs(sorted[0].chargedAt)).toISOString(), to: new Date(toMs(sorted.at(-1)!.chargedAt)).toISOString(),
      credits, charges: xs.length, buckets, how: [...new Set(xs.map((c) => HOW[c.method]))].join(", "), result,
      simulated: xs.some((c) => c.simulated), ledgerIds: xs.map((c) => c.ledgerId), children });
  }
  return out.sort((a, b) => b.credits - a.credits);
}
```

- [ ] **Step 17: Run it to see it pass**

Run: `npx vitest run tests/domain/activities.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 18: Update the findings tests for the new behaviour**

In `tests/domain/findings.test.ts`, add `listNames` to the `generateFindings` call and replace three tests. The call becomes:

```ts
const findings = generateFindings({ now: "2026-10-04T00:00:00Z", period: "8w", statsByList, statsBySegment: [], charges, runs: input.runs, outcomes: [],
  unusedDocs: Array.from({ length: 23 }, (_, i) => ({ name: `doc ${i}`, createdAt: "2026-09-26T09:00:00Z" })), onboardingCredits: 860,
  listNames: new Map([["fintech", "Fintech VPs"], ["starter", "Starter list"]]) });
```

Replace the billing-mismatch test, the "unused after 7 days" test and the scale/cut test with:

```ts
  it("folds the billing mismatch into the failed-job finding instead of listing the same 77 credits twice", () => {
    expect(findings.some((f) => f.extId.startsWith("fix|billing_mismatch"))).toBe(false);
    const w = byKind("waste").find((f) => f.creditsAtStake === 77)!;
    expect(w.title).toBe("graph8 owes you for jobs that failed");
    expect(w.body).toBe("77 credits went to 3 jobs that failed on every record. graph8's job records say 0 credits were used.");
  });
  it("reports unused documents without waiting 7 days", () => {
    const f = byKind("unused")[0];
    expect(f.evidence).toMatchObject({ documents: 23 });
    expect(f.title).toBe("23 paid documents never used");
  });
  it("names lists in scale and cut findings", () => {
    expect(byKind("scale").map((f) => f.title)).toEqual(["Scale Fintech VPs"]);
    expect(byKind("scale")[0].body).toBe("Fintech VPs book meetings at 124 credits each, 62% below your average.");
    expect(byKind("cut")[0].body).toBe("Starter list costs 1,200 credits per meeting, over twice your average.");
  });
  it("uses correct plurals", () => expect(byKind("waste").find((f) => f.creditsAtStake === 14)!.body).toBe("14 credits went to 1 job whose result can't be read back."));
```

Add a repeat-enrichment test at the end of the `generateFindings` block:

```ts
  it("raises repeat enrichment when the same contacts are charged again within 30 days", () => {
    const base = charges[0];
    const again = [0, 1, 2, 3, 4, 5].map((i) => ({ ...base, ledgerId: `rep${i}`, service: "waterfall_enrichment", contactId: 42, listId: 15, credits: 20,
      isWaste: false, wasteReason: null, result: "success" as const, chargedAt: `2026-09-0${i + 1}T00:00:00Z` }));
    const fs = generateFindings({ now: "2026-10-04T00:00:00Z", period: "8w", statsByList: [], statsBySegment: [], charges: again, runs: [], outcomes: [],
      unusedDocs: [], onboardingCredits: 0, listNames: new Map([["15", "Sales VPs"]]) });
    const r = fs.find((f) => f.kind === "repeat_enrichment")!;
    expect(r).toMatchObject({ creditsAtStake: 100, title: "Paying to enrich the same contacts again", action: "Turn on skip recently enriched" });
    expect(r.evidence).toMatchObject({ charges: 5, contacts: 1, byList: { "15": 100 } });
  });
```

- [ ] **Step 19: Run the findings tests to see them fail**

Run: `npx vitest run tests/domain/findings.test.ts`
Expected: FAIL on the five new expectations (billing mismatch still separate, 7-day gate, list names, plurals, no repeat finding) and a type error on `listNames`.

- [ ] **Step 20: Change `findings.ts`**

1. Add `listNames: Map<string, string>` to `FindingContext`, and import `repeatEnrichment`:

```ts
import { repeatEnrichment } from "./repeat";
export interface FindingContext {
  now: string; period: string; statsByList: Stat[]; statsBySegment: Stat[]; charges: AttributedCharge[]; runs: Run[]; outcomes: Outcome[];
  unusedDocs: { name: string; createdAt: string }[]; onboardingCredits: number; listNames: Map<string, string>;
}
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;
```

2. Replace the `wasteGroups` loop and the billing-mismatch block with:

```ts
  const mismatchRuns = new Set(ctx.runs.filter((r) => r.reportedCredits === 0).map((r) => r.extId)
    .filter((id) => ctx.charges.some((c) => c.runExtId === id && c.credits > 0)));
  const failed = ctx.charges.filter((c) => c.wasteReason === "failed_job");
  if (failed.length) {
    const runs = [...new Set(failed.map((c) => c.runExtId).filter((x): x is string => !!x))];
    const alsoMismatch = runs.length > 0 && runs.every((id) => mismatchRuns.has(id));
    out.push(mk(ctx, "waste", "failed_job", { title: "graph8 owes you for jobs that failed",
      body: `${n(sum(failed))} credits went to ${plural(runs.length, "job")} that failed on every record.${alsoMismatch ? " graph8's job records say 0 credits were used." : ""}`,
      stake: sum(failed), confidence: "high", evidence: { runs, ledgerIds: failed.map((c) => c.ledgerId), billingMismatch: alsoMismatch }, action: "Refund request", payload: { reason: "failed_job" } }));
  }
  const unreadable = ctx.charges.filter((c) => c.wasteReason === "no_change");
  if (unreadable.length) {
    const runs = [...new Set(unreadable.map((c) => c.runExtId).filter((x): x is string => !!x))];
    out.push(mk(ctx, "waste", "no_change", { title: "graph8 owes you for results you can't use",
      body: `${n(sum(unreadable))} credits went to ${runs.length === 1 ? "1 job whose result" : `${plural(runs.length, "job")} whose results`} can't be read back.`,
      stake: sum(unreadable), confidence: "high", evidence: { runs, ledgerIds: unreadable.map((c) => c.ledgerId) }, action: "Refund request", payload: { reason: "no_change" } }));
  }
  const failedRuns = new Set(failed.map((c) => c.runExtId));
  const otherMismatch = [...mismatchRuns].filter((id) => !failedRuns.has(id));
  if (otherMismatch.length) {
    const xs = ctx.charges.filter((c) => c.runExtId !== null && otherMismatch.includes(c.runExtId));
    out.push(mk(ctx, "fix", "billing_mismatch", { title: "Charged for jobs that report no charge",
      body: `graph8's job records say 0 credits were used, but the ledger charged ${n(sum(xs))}.`, stake: sum(xs), confidence: "high",
      evidence: { runs: otherMismatch }, action: "Refund request" }));
  }
```

   Keep the side-effect block and, inside the `for (const r of ctx.runs)` loop, keep only the estimate-gap branch (delete the `reportedCredits === 0` branch there).

3. In the scale/cut loop, name the list:

```ts
    const name = ctx.listNames.get(s.value) ?? `list ${s.value}`;
```

   and use `title: \`Scale ${name}\``, body `` `${name} book meetings at ${n(s.costPerMeeting)} credits each, ${Math.round((1 - s.costPerMeeting / orgCpm) * 100)}% below your average.` `` for scale; `title: \`Cut back on ${name}\``, body `` tooCostly ? `${name} costs ${n(s.costPerMeeting!)} credits per meeting, over twice your average.` : `${name} took ${n(s.credits)} credits and booked no meetings.` `` for cut.

4. Replace the unused block (drop the age gate):

```ts
  if (ctx.unusedDocs.length) out.push(mk(ctx, "unused", "studio_docs", { title: `${plural(ctx.unusedDocs.length, "paid document")} never used`,
    body: `${plural(ctx.unusedDocs.length, "onboarding document")} ${ctx.unusedDocs.length === 1 ? "has" : "have"} never been used. They came out of about ${n(ctx.onboardingCredits)} credits of research.`,
    stake: ctx.onboardingCredits, confidence: "medium", evidence: { documents: ctx.unusedDocs.length } }));
```

5. Before the traceability block, add the repeat finding:

```ts
  const rep = repeatEnrichment(ctx.charges);
  if (rep.credits >= 50) out.push(mk(ctx, "repeat_enrichment", "contacts", { title: "Paying to enrich the same contacts again",
    body: `${n(rep.credits)} credits went to contacts that were enriched again within 30 days.`, stake: rep.credits, confidence: "high",
    evidence: { charges: rep.charges, contacts: rep.contacts, byList: Object.fromEntries([...rep.byList].map(([k, v]) => [String(k), Math.round(v)])) },
    action: "Turn on skip recently enriched", simulated: rep.simulated }));
```

   Delete the now-unused `toMs` import if the linter flags it.

- [ ] **Step 21: Run the findings tests to see them pass**

Run: `npx vitest run tests/domain/findings.test.ts`
Expected: PASS. The "1 job whose result" test proves the plural; the "3 jobs" body proves the merge.

- [ ] **Step 22: Write the failing test for the loader and period view**

`tests/dashboard/data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { chargeToValues, outcomeToValues, statToValues } from "@/lib/store/mappers";
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import type { AttributedCharge, Stat } from "@/lib/domain/types";

const ch = (id: string, at: string, p: Partial<AttributedCharge> = {}): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits: 100, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: "r", listId: 15, contactId: 1,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const st = (period: string, credits: number): Stat => ({ period, dimension: "org", value: "all", credits, creditsExact: credits, meetings: 1, deals: 0, wonValue: 0,
  contactsReached: 1, costPerMeeting: credits, costPerDeal: null, vsAvgPct: null, evidenceN: 1, confidence: "low", simulated: false, computedAt: "2026-09-27T00:00:00Z" });

async function seeded() {
  const g = new FakeG8();
  g.handlers.set(OPS.listLists, () => [{ id: 15, title: "[sim] Sales VPs", total: 20 }]);
  await ensureSchema(g);
  const charges = new RecordStore(g, "roi_charge");
  await charges.upsert(chargeToValues(ch("old", "2026-08-10T00:00:00Z")));
  await charges.upsert(chargeToValues(ch("new", "2026-09-20T00:00:00Z", { simulated: true })));
  await new RecordStore(g, "roi_outcome").upsert(outcomeToValues({ extId: "m1", type: "meeting_booked", occurredAt: "2026-09-21T00:00:00Z", contactId: 1,
    companyId: null, dealId: null, amount: null, listId: 15, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true }));
  const stats = new RecordStore(g, "roi_stat");
  await stats.upsert(statToValues(st("8w", 200)));
  await stats.upsert(statToValues(st("30d", 100)));
  return g;
}

describe("loadDashboardData + periodView", () => {
  it("loads one dataset and flags demo data", async () => {
    const d = await loadDashboardData(await seeded());
    expect(d.charges).toHaveLength(2);
    expect(d.hasDemoData).toBe(true);
    expect(d.listNames.get("15")).toBe("Sales VPs");
  });
  it("narrows charges, stats and buckets to the period", async () => {
    const d = await loadDashboardData(await seeded());
    const v8 = periodView({ ...d, now: "2026-09-27T00:00:00Z" }, "8w"), v30 = periodView({ ...d, now: "2026-09-27T00:00:00Z" }, "30d");
    expect(v8.charges.map((c) => c.ledgerId)).toEqual(["old", "new"]);
    expect(v30.charges.map((c) => c.ledgerId)).toEqual(["new"]);
    expect(v8.org?.credits).toBe(200);
    expect(v30.org?.credits).toBe(100);
    expect(v8.buckets.booked).toBe(200);
    expect(v8.coverage.total).toBe(200);
    expect(v8.meetings).toBe(1);
  });
});
```

- [ ] **Step 23: Run it to see it fail**

Run: `npx vitest run tests/dashboard/data.test.ts`
Expected: FAIL (`periodView` is not exported; `hasDemoData` missing).

- [ ] **Step 24: Rewrite `src/lib/dashboard/data.ts`**

```ts
import { cache } from "react";
import type { G8Caller } from "../g8/client";
import { g8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { RecordStore } from "../store/records";
import { valuesToCharge, valuesToFinding, valuesToOutcome, valuesToRun, valuesToStat } from "../store/mappers";
import { coverage } from "../domain/attribution";
import { bucketTotals, meetingsByContact, outcomeBucket, type BucketContext } from "../domain/buckets";
import { listNamesFrom } from "../domain/names";
import { inWindow, periodWindow } from "../domain/period";
import type { AttributedCharge, Finding, Outcome, OutcomeBucket, Period, Run, Stat } from "../domain/types";

export interface ListInfo { id: number; title: string; total: number }
export interface DashboardData {
  charges: AttributedCharge[]; outcomes: Outcome[]; stats: Stat[]; findings: Finding[]; runs: Run[]; lists: ListInfo[];
  listNames: Map<string, string>; hasDemoData: boolean; now: string;
  /** All-time coverage and waste, kept for the MCP tools and the recap. */
  coverage: ReturnType<typeof coverage>; waste: number;
}

export const loadDashboardData = cache(async (c: G8Caller = g8Caller): Promise<DashboardData> => {
  const [ch, oc, st, fi, ru] = await Promise.all(["roi_charge", "roi_outcome", "roi_stat", "roi_finding", "roi_run"].map((slug) => new RecordStore(c, slug).list()));
  const lists = await c.call<ListInfo[]>(OPS.listLists);
  const charges = ch.map((r) => valuesToCharge(r.values)), outcomes = oc.map((r) => valuesToOutcome(r.values));
  return { charges, outcomes, stats: st.map((r) => valuesToStat(r.values)), findings: fi.map((r) => valuesToFinding(r.values)), runs: ru.map((r) => valuesToRun(r.values)),
    lists, listNames: listNamesFrom(lists), hasDemoData: charges.some((x) => x.simulated) || outcomes.some((o) => o.simulated), now: new Date().toISOString(),
    coverage: coverage(charges), waste: charges.filter((x) => x.isWaste).reduce((s, x) => s + x.credits, 0) };
});

export interface PeriodView {
  period: Period; window: { from: number; to: number }; charges: AttributedCharge[]; outcomes: Outcome[]; stats: Stat[]; org: Stat | undefined;
  coverage: ReturnType<typeof coverage>; waste: number; buckets: Record<OutcomeBucket, number>; bucketOf: (c: AttributedCharge) => OutcomeBucket;
  bucketCtx: BucketContext; meetings: number; won: number;
}

export function periodView(d: DashboardData, period: Period): PeriodView {
  const window = periodWindow(period, d.now);
  const charges = d.charges.filter((c) => inWindow(c.chargedAt, window));
  const outcomes = d.outcomes.filter((o) => inWindow(o.occurredAt, window));
  const bucketCtx: BucketContext = { meetingsByContact: meetingsByContact(d.outcomes),
    onboardingUnused: d.findings.some((f) => f.kind === "unused" && f.extId.startsWith("unused|studio_docs") && f.status !== "applied") };
  const stats = d.stats.filter((s) => s.period === period);
  return { period, window, charges, outcomes, stats, org: stats.find((s) => s.dimension === "org"), coverage: coverage(charges),
    waste: charges.filter((c) => c.isWaste).reduce((s, c) => s + c.credits, 0), buckets: bucketTotals(charges, bucketCtx),
    bucketOf: (c) => outcomeBucket(c, bucketCtx), bucketCtx,
    meetings: outcomes.filter((o) => o.type === "meeting_booked").length, won: outcomes.filter((o) => o.type === "deal_won").length };
}
```

   In `src/app/(dash)/page.tsx`, change the `org` line so the old Overview keeps working until Task 4:

```ts
  const org = d.stats.find((s) => s.dimension === "org" && s.period === "8w");
```

- [ ] **Step 25: Compute stats for both periods and pass list names in the sync**

In `src/lib/sync/run-sync.ts`:

1. Import `listNamesFrom` from `../domain/names` and change the lists call to keep titles:

```ts
    const lists = await deps.c.call<{ id: number; title: string }[]>(OPS.listLists);
```

2. Replace the stats block (from `const to = toMs(now)` through the `for (const st of …)` upsert loop) with:

```ts
    const to = toMs(now);
    const periods = [["8w", 56], ["30d", 30]] as const;
    let byList8w: Stat[] = [], bySegment8w: Stat[] = [];
    for (const [period, days] of periods) {
      const base = { charges, outcomes, contacts, period, from: to - days * 86_400_000, to, now };
      const byList = computeStats({ ...base, dimension: "list" });
      const bySegment = computeStats({ ...base, dimension: "segment" });
      const byService = computeStats({ ...base, dimension: "service" });
      for (const st of [...byList, ...bySegment.slice(1), ...byService.slice(1)]) await s.stats.upsert(statToValues(st));
      if (period === "8w") { byList8w = byList; bySegment8w = bySegment; }
    }
```

3. Change the findings call to use the 8-week stats and list names:

```ts
    const fresh2 = generateFindings({ now, period: "8w", statsByList: byList8w, statsBySegment: bySegment8w, charges, runs, outcomes,
      unusedDocs: await fetchUnusedDocs(deps.c), onboardingCredits, listNames: listNamesFrom(lists) });
```

   Add `import type { Stat } from "../domain/types";`. Findings stored under the old `30d` ids stop being generated, so the existing stale-finding rule marks them `applied` (hidden). That is intended.

- [ ] **Step 26: Run the whole suite and the type check**

`DashboardData` gained fields, so update the literal in `tests/mcp/tools.test.ts`: add `outcomes: [], lists: [], listNames: new Map(), hasDemoData: true,` to `d`, and change its stat's `period: "30d"` to `period: "8w"`.

Run: `npx vitest run && npm run typecheck`
Expected: all tests pass (the sync test in `tests/sync/run-sync.test.ts` may need `OPS.listLists` to return objects with `title`; if it fails with `listLabel` on `undefined`, add `title: "List 13"` to its fake list rows). `tsc` clean.

- [ ] **Step 27: Commit**

```bash
cd /home/opc/graph8
git add advisor/src/lib/domain advisor/src/lib/dashboard/data.ts advisor/src/lib/sync/run-sync.ts "advisor/src/app/(dash)/page.tsx" advisor/tests
git commit -m "feat(advisor): one dataset, 8-week and 30-day periods, outcome buckets, activities, merged findings"
```

---
### Task 2: Realistic demo data (re-seed)

Spec §4.11. Runs early so every later screen is checked against the final data. 0 credits, no emails. ⏸ Stop before `--apply`.

**Files:**
- Modify: `src/lib/sim/plan.ts` (v2), `scripts/seed-sim.ts`
- Create: `src/lib/guardrail/pipeline.ts`, `scripts/check-sim.ts`
- Test: `tests/sim/plan.test.ts` (rewrite), `tests/guardrail/pipeline.test.ts`

**Interfaces:**
- Consumes: `repeatEnrichment` (Task 1), `bucketTotals`, `meetingsByContact` (Task 1), `OPS.listListPipelines`, `OPS.createPipelineFromTemplate`, `OPS.updateListPipeline`.
- Produces:
  - `buildSimPlan(seed: number, now: string, lists: SimListSpec[], opts?: { weeks?: number; repeatShare?: number }): { charges: AttributedCharge[]; events: WebhookEnvelope[] }`
  - `interface SimListSpec { id: number; label: string; contactIds: number[]; costPerMeeting: number; meetings: number }`
  - `pipeline.ts`: `interface PipelineStep`, `interface ListPipeline`, `interface PipelineSettings`, `listPipelines(c, listId)`, `findEnrichmentPipeline(c, listId): Promise<ListPipeline | null>`, `settingsOf(p): PipelineSettings`, `patchPipeline(c, listId, p, patch): Promise<PipelineSettings>` (returns the settings **before** the patch), `restorePipeline(c, listId, p, prev)`, `ensureEnrichmentPipeline(c, listId, { enabled }): Promise<ListPipeline>`

- [ ] **Step 1: Rewrite the sim plan tests**

Replace `tests/sim/plan.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { buildSimPlan } from "@/lib/sim/plan";
import { repeatEnrichment } from "@/lib/domain/repeat";

const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const lists = [
  { id: 15, label: "[sim] Sales VPs", contactIds: ids(100, 20), costPerMeeting: 124, meetings: 17 },
  { id: 16, label: "[sim] Founders", contactIds: ids(200, 20), costPerMeeting: 433, meetings: 6 },
  { id: 2, label: "Starter list", contactIds: ids(300, 30), costPerMeeting: 1200, meetings: 4 },
];
const NOW = "2026-09-27T12:00:00Z", DAY = 86_400_000;
const p = buildSimPlan(20260927, NOW, lists);
const booked = p.events.filter((e) => e.event === "meeting.booked");

describe("buildSimPlan v2", () => {
  it("is deterministic and labels everything simulated", () => {
    expect(buildSimPlan(20260927, NOW, lists)).toEqual(p);
    expect(p.charges.every((c) => c.simulated && c.ledgerId.startsWith("sim-") && c.explanation.startsWith("[sim]"))).toBe(true);
    expect(p.events.every((e) => e.data.simulated === true && e.id!.startsWith("sim-"))).toBe(true);
  });
  it("hits each list's cost per meeting exactly", () => {
    for (const l of lists) {
      const credits = p.charges.filter((c) => c.listId === l.id).reduce((s, c) => s + c.credits, 0);
      const meetings = booked.filter((e) => e.data.list_id === l.id).length;
      expect(meetings).toBe(l.meetings);
      expect(credits / meetings).toBeCloseTo(l.costPerMeeting, 1);
    }
  });
  it("enriches every contact once, and re-enriches about 15% within 30 days", () => {
    for (const l of lists) {
      const counts = l.contactIds.map((id) => p.charges.filter((c) => c.contactId === id).length);
      expect(counts.every((n) => n === 1 || n === 2)).toBe(true);
      expect(counts.filter((n) => n === 2).length).toBe(Math.round(l.contactIds.length * 0.15));
    }
    const rep = repeatEnrichment(p.charges);
    const total = p.charges.reduce((s, c) => s + c.credits, 0);
    expect(rep.credits / total).toBeGreaterThan(0.08);
    expect(rep.credits / total).toBeLessThan(0.2);
  });
  it("books each meeting 7 to 21 days after the contact's first enrichment, and never in the future", () => {
    for (const e of booked) {
      const first = Math.min(...p.charges.filter((c) => c.contactId === e.data.contact_id).map((c) => Date.parse(c.chargedAt)));
      const lag = Date.parse(e.timestamp) - first;
      expect(lag).toBeGreaterThanOrEqual(7 * DAY);
      expect(lag).toBeLessThanOrEqual(21 * DAY);
      expect(Date.parse(e.timestamp)).toBeLessThan(Date.parse(NOW));
    }
  });
  it("spreads first enrichments over at least 7 of the 8 weeks, so cohorts exist", () => {
    const start = Date.parse(NOW) - 56 * DAY;
    const firstWeek = new Set(lists.flatMap((l) => l.contactIds).map((id) =>
      Math.floor((Math.min(...p.charges.filter((c) => c.contactId === id).map((c) => Date.parse(c.chargedAt))) - start) / (7 * DAY))));
    expect(firstWeek.size).toBeGreaterThanOrEqual(7);
  });
  it("refuses more meetings than contacts", () =>
    expect(() => buildSimPlan(1, NOW, [{ ...lists[0], meetings: 21 }])).toThrow("more meetings than contacts"));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/sim/plan.test.ts`
Expected: FAIL (the old plan charges each contact about 3 times and spreads meetings independently of charges).

- [ ] **Step 3: Rewrite `src/lib/sim/plan.ts`**

```ts
import type { AttributedCharge } from "../domain/types";
import type { WebhookEnvelope } from "../webhooks/verify";

export interface SimListSpec { id: number; label: string; contactIds: number[]; costPerMeeting: number; meetings: number }

const DAY = 86_400_000, WEEK = 7 * DAY;
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function shuffled<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function buildSimPlan(seed: number, now: string, lists: SimListSpec[], opts: { weeks?: number; repeatShare?: number } = {}) {
  const weeks = opts.weeks ?? 8, repeatShare = opts.repeatShare ?? 0.15;
  const r = rng(seed), end = Date.parse(now), start = end - weeks * WEEK;
  const charges: AttributedCharge[] = [], events: WebhookEnvelope[] = [];
  let k = 0;
  const iso = (t: number) => new Date(t).toISOString();
  for (const l of lists) {
    if (l.meetings > l.contactIds.length) throw new Error(`List ${l.label} has more meetings than contacts`);
    const first = l.contactIds.map((id, i) => ({ id, t: start + (i % weeks) * WEEK + Math.floor(r() * (WEEK - DAY)) }));
    const mature = first.filter((f) => f.t <= end - 8 * DAY);
    if (mature.length < l.meetings) throw new Error(`List ${l.label} has too few contacts enriched early enough to book ${l.meetings} meetings`);
    const repeats = shuffled(mature, r).slice(0, Math.round(l.contactIds.length * repeatShare))
      .map((f) => ({ id: f.id, t: Math.min(f.t + (7 + Math.floor(r() * 15)) * DAY, end - DAY) }));
    const all = [...first, ...repeats].sort((a, b) => a.t - b.t);
    const total = Math.round(l.costPerMeeting * l.meetings * 100);
    const each = Math.floor(total / all.length);
    all.forEach((x, i) => {
      const cents = i === all.length - 1 ? total - each * (all.length - 1) : each;
      charges.push({ ledgerId: `sim-${seed}-${k++}`, ledgerType: "usage", service: "waterfall_enrichment", credits: cents / 100, chargedAt: iso(x.t), llmTier: null,
        tokensIn: null, tokensOut: null, description: `[sim] enrichment for ${l.label}`, method: "advisor", runExtId: `sim-run-${l.id}`, listId: l.id,
        contactId: x.id, segmentKey: null, explanation: `[sim] Email finder · ${l.label}`, result: "success", isWaste: false, wasteReason: null, simulated: true });
    });
    for (const [m, f] of shuffled(mature, r).slice(0, l.meetings).entries()) {
      const t = Math.min(f.t + (7 + Math.floor(r() * 15)) * DAY, end - DAY);
      const data = { contact_id: f.id, list_id: l.id, simulated: true };
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_sent", timestamp: iso(t - 3 * DAY), org_id: "sim", data: { ...data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "engagement.email_replied", timestamp: iso(t - DAY), org_id: "sim", data: { ...data, step: 1 + (m % 3), channel: "email" } });
      events.push({ id: `sim-${seed}-${k++}`, event: "meeting.booked", timestamp: iso(t), org_id: "sim", data });
    }
  }
  return { charges, events };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/sim/plan.test.ts`
Expected: PASS (6 tests). If "at least 7 of the 8 weeks" fails, check that `first` uses `i % weeks` (round-robin by week), not a random week.

- [ ] **Step 5: Write the failing test for the pipeline helpers**

`tests/guardrail/pipeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureEnrichmentPipeline, findEnrichmentPipeline, patchPipeline, restorePipeline, settingsOf, type ListPipeline } from "@/lib/guardrail/pipeline";

function fake(initial: ListPipeline[]) {
  const g = new FakeG8();
  let pipes = structuredClone(initial);
  g.handlers.set(OPS.listListPipelines, () => ({ items: pipes }));
  g.handlers.set(OPS.createPipelineFromTemplate, () => { const p: ListPipeline = { id: "new", name: "Verified emails", enabled: true,
    steps: [{ id: "s1", name: "Email finder", type: "waterfall", config_ref: "CFG", run_condition: null, skip_existing_values: true, skip_recently_enriched: false, enabled: true }] };
    pipes.push(p); return p; });
  g.handlers.set(OPS.updateListPipeline, (i) => { const b = i.body as ListPipeline; pipes = pipes.map((p) => (p.id === i.path?.pipeline_id ? { ...p, ...b } : p)); return b; });
  return g;
}
const existing: ListPipeline = { id: "p1", name: "Verified emails", enabled: true, steps: [{ id: "s1", name: "Email finder", type: "waterfall", config_ref: "CFG",
  run_condition: null, skip_existing_values: false, skip_recently_enriched: false, enabled: true }] };

describe("pipeline helpers", () => {
  it("finds the list's enrichment pipeline", async () => {
    expect((await findEnrichmentPipeline(fake([existing]), 15))?.id).toBe("p1");
    expect(await findEnrichmentPipeline(fake([]), 15)).toBeNull();
  });
  it("patches a step and returns the settings from before the patch", async () => {
    const g = fake([existing]);
    const prev = await patchPipeline(g, 15, existing, { step: { skip_recently_enriched: true, skip_existing_values: true } });
    expect(prev).toEqual(settingsOf(existing));
    const body = g.calls.find((c) => c.op === OPS.updateListPipeline)!.input.body as ListPipeline;
    expect(body).toMatchObject({ name: "Verified emails", enabled: true });
    expect(body.steps![0]).toMatchObject({ id: "s1", type: "waterfall", config_ref: "CFG", skip_recently_enriched: true, skip_existing_values: true, run_condition: null });
  });
  it("restores exactly the previous settings", async () => {
    const g = fake([existing]);
    const prev = await patchPipeline(g, 15, existing, { enabled: false });
    const now = (await findEnrichmentPipeline(g, 15))!;
    await restorePipeline(g, 15, now, prev);
    expect(settingsOf((await findEnrichmentPipeline(g, 15))!)).toEqual(prev);
  });
  it("creates a missing pipeline from the template, switched off", async () => {
    const g = fake([]);
    const p = await ensureEnrichmentPipeline(g, 15, { enabled: false });
    expect(p.id).toBe("new");
    expect(settingsOf((await findEnrichmentPipeline(g, 15))!).enabled).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run tests/guardrail/pipeline.test.ts`
Expected: FAIL, cannot resolve `@/lib/guardrail/pipeline`.

- [ ] **Step 7: Implement `src/lib/guardrail/pipeline.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";

export interface PipelineStep { id: string; name?: string; type: string; config_ref?: string; run_condition?: string | null;
  skip_existing_values?: boolean; skip_recently_enriched?: boolean; enabled?: boolean }
export interface ListPipeline { id: string; name: string; enabled?: boolean; steps?: PipelineStep[] }
export interface StepSettings { id: string; run_condition: string | null; skip_existing_values: boolean; skip_recently_enriched: boolean; enabled: boolean }
export interface PipelineSettings { enabled: boolean; steps: StepSettings[] }
export type PipelinePatch = { enabled?: boolean; step?: Partial<Omit<StepSettings, "id">> };

export async function listPipelines(c: G8Caller, listId: number): Promise<ListPipeline[]> {
  return (await c.call<{ items: ListPipeline[] }>(OPS.listListPipelines, { path: { list_id: listId } })).items ?? [];
}

export async function findEnrichmentPipeline(c: G8Caller, listId: number): Promise<ListPipeline | null> {
  const ps = await listPipelines(c, listId);
  return ps.find((p) => p.name === "Verified emails") ?? ps.find((p) => (p.steps ?? []).some((s) => s.type === "waterfall" && s.config_ref)) ?? null;
}

export function settingsOf(p: ListPipeline): PipelineSettings {
  return { enabled: p.enabled !== false, steps: (p.steps ?? []).map((s) => ({ id: s.id, run_condition: s.run_condition ?? null,
    skip_existing_values: s.skip_existing_values === true, skip_recently_enriched: s.skip_recently_enriched === true, enabled: s.enabled !== false })) };
}

async function put(c: G8Caller, listId: number, p: ListPipeline, s: PipelineSettings): Promise<void> {
  const byId = new Map(s.steps.map((x) => [x.id, x]));
  await c.call(OPS.updateListPipeline, { path: { list_id: listId, pipeline_id: p.id }, body: { name: p.name, enabled: s.enabled,
    steps: (p.steps ?? []).map((st) => ({ id: st.id, name: st.name, type: st.type, config_ref: st.config_ref, ...byId.get(st.id) })) } });
}

/** Applies the patch to every enrichment (waterfall) step and returns the settings from before the patch. */
export async function patchPipeline(c: G8Caller, listId: number, p: ListPipeline, patch: PipelinePatch): Promise<PipelineSettings> {
  const prev = settingsOf(p);
  const wf = new Set((p.steps ?? []).filter((s) => s.type === "waterfall").map((s) => s.id));
  await put(c, listId, p, { enabled: patch.enabled ?? prev.enabled,
    steps: prev.steps.map((s) => (wf.has(s.id) && patch.step ? { ...s, ...patch.step } : s)) });
  return prev;
}

export async function restorePipeline(c: G8Caller, listId: number, p: ListPipeline, prev: PipelineSettings): Promise<void> {
  await put(c, listId, p, prev);
}

export async function ensureEnrichmentPipeline(c: G8Caller, listId: number, o: { enabled: boolean }): Promise<ListPipeline> {
  const p = (await findEnrichmentPipeline(c, listId))
    ?? await c.call<ListPipeline>(OPS.createPipelineFromTemplate, { path: { list_id: listId }, body: { template_key: "verified_emails" } });
  if (settingsOf(p).enabled !== o.enabled) await patchPipeline(c, listId, p, { enabled: o.enabled });
  return p;
}
```

- [ ] **Step 8: Run it to see it pass**

Run: `npx vitest run tests/guardrail/pipeline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Update `scripts/seed-sim.ts` to reuse lists, create switched-off pipelines and use plan v2**

Replace the list creation and plan call. The top of the script keeps the `rows`, `vps` and `founders` selection unchanged. Replace `simList` and everything down to the `buildSimPlan` call with:

```ts
import { ensureEnrichmentPipeline } from "../src/lib/guardrail/pipeline";

const existingLists = await c.call<{ id: number; title: string }[]>(OPS.listLists);
async function simList(title: string, ids: number[]): Promise<number> {
  const found = existingLists.find((l) => l.title === title);
  if (found) return found.id; // reuse: lists are never deleted, so re-seeding must not create duplicates
  const l = await c.call<{ id: number }>(OPS.createList, { body: { title, description: "[sim] demo list for Credit Compass", type: "contacts" } });
  await c.call(OPS.addContactsToList, { path: { list_id: l.id }, body: { contact_ids: ids, conflict_resolution: "add_all" } });
  return l.id;
}
const vpList = await simList("[sim] Sales VPs", vps), founderList = await simList("[sim] Founders", founders);
for (const id of [vpList, founderList]) {
  const p = await ensureEnrichmentPipeline(c, id, { enabled: false });
  console.log(`pipeline for list ${id}: ${p.id} (switched off)`);
}
const plan = buildSimPlan(20260927, new Date().toISOString(), [
  { id: vpList, label: "[sim] Sales VPs", contactIds: vps, costPerMeeting: 124, meetings: 17 },
  { id: founderList, label: "[sim] Founders", contactIds: founders, costPerMeeting: 433, meetings: 6 },
  { id: 2, label: "Starter list", contactIds: rows.slice(0, 30).map((r) => r.id), costPerMeeting: 1200, meetings: 4 },
]);
```

   Keep the rest (charge upserts, deals, `.sim-plan.json`, summary) as it is.

- [ ] **Step 10: Add the invariant check script**

`scripts/check-sim.ts` (read-only; prints what the demo will show):

```ts
import { g8Caller as c } from "../src/lib/g8/client";
import { loadDashboardData, periodView } from "../src/lib/dashboard/data";
import { repeatEnrichment } from "../src/lib/domain/repeat";
import { BUCKETS } from "../src/lib/domain/buckets";
import { toMs } from "../src/lib/domain/time";

const d = await loadDashboardData(c);
const v = periodView(d, "8w");
const total = v.charges.reduce((s, x) => s + x.credits, 0);
const bucketSum = BUCKETS.reduce((s, b) => s + v.buckets[b], 0);
const perList = v.stats.filter((s) => s.dimension === "list" && s.meetings > 0).map((s) => [d.listNames.get(s.value) ?? s.value, s.costPerMeeting, s.meetings]);
const rep = repeatEnrichment(v.charges);
const firstWeek = new Map<number, number>();
for (const ch of v.charges) if (ch.contactId !== null) firstWeek.set(ch.contactId, Math.min(firstWeek.get(ch.contactId) ?? Infinity, toMs(ch.chargedAt)));
const weeks = new Set([...firstWeek.values()].map((t) => Math.floor((t - v.window.from) / (7 * 86_400_000))));
console.log(JSON.stringify({ total: Math.round(total), bucketsAddUp: Math.abs(total - bucketSum) < 0.01, buckets: v.buckets, perList,
  repeatShare: +(rep.credits / total).toFixed(3), cohortWeeks: weeks.size, meetings: v.meetings, won: v.won }, null, 1));
```

- [ ] **Step 11: Run the full test suite, type check, commit the code**

Run: `npx vitest run && npm run typecheck`
Expected: PASS, clean.

```bash
cd /home/opc/graph8
git add advisor/src/lib/sim/plan.ts advisor/src/lib/guardrail/pipeline.ts advisor/scripts/seed-sim.ts advisor/scripts/check-sim.ts advisor/tests/sim advisor/tests/guardrail/pipeline.test.ts
git commit -m "feat(advisor): realistic sim plan v2 and pipeline read/patch/restore helpers"
```

- [ ] **Step 12: Dry-run the cleanup and stop for the user** ⏸

Run: `cd advisor && npm run script -- scripts/cleanup-sim.ts`
Expected output shape: `{"simDeals":30,"simRecords":~444,"simListsToReviewWithUser":[…13,14,15,16…]}` then "Dry run…".

**Stop.** Show the user the counts and say: "Re-seeding deletes these simulated deals and archives these simulated records, then seeds new ones (0 credits, no emails). Lists stay. OK to run `--apply`?" Continue only on an explicit yes.

- [ ] **Step 13: Apply, seed, replay, sync, check**

Only after the user's yes:

```bash
cd advisor
npm run script -- scripts/cleanup-sim.ts --apply
npm run script -- scripts/seed-sim.ts
npm run script -- scripts/sim-events.ts
npm run script -- scripts/sync-once.ts
npm run script -- scripts/check-sim.ts
```

Expected from `check-sim.ts`: `bucketsAddUp: true`; `perList` close to Sales VPs ~124, Founders ~433, Starter list ~1,200 (the Starter list also carries a little real spend, so it can read slightly higher); `repeatShare` between 0.08 and 0.2; `cohortWeeks` ≥ 7; `meetings` 27. If `sim-events.ts` reports failures, check `ADVISOR_URL` and `G8_WEBHOOK_SECRET` in `.env.local` and that production is up (`curl -s -o /dev/null -w '%{http_code}' $ADVISOR_URL/login` → 200).

- [ ] **Step 14: Record the result in the handoff and commit**

Append a "Re-seed v2 (2026-09-27)" paragraph to `docs/HANDOFF.md` §15 with the printed `check-sim.ts` JSON (no secrets), the new pipeline ids, and "0 credits, no emails". Then:

```bash
cd /home/opc/graph8 && git add docs/HANDOFF.md && git commit -m "docs: record the v2 demo-data re-seed"
```

---
### Task 3: Shell (header, demo-data pill, tabs, period switch, Optimize route, screenshots)

Spec §5.1, §7. After this task every screen carries the new header and no REAL/SIM tags remain.

**Files:**
- Create: `src/lib/workspace/current.ts`, `src/components/Header.tsx`, `src/components/NavTabs.tsx`, `src/components/PeriodSwitch.tsx`, `src/components/DemoDataPill.tsx`, `scripts/shots.mjs`
- Modify: `src/app/(dash)/layout.tsx`, `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/globals.css`, `next.config.ts`, `package.json`, `advisor/.gitignore`, `src/components/FindingCard.tsx`, `src/components/ChargesTable.tsx`, `src/components/KpiTile.tsx`, `src/components/HBarChart.tsx`, `src/app/(dash)/recovery/page.tsx`
- Move: `src/app/(dash)/prespend/` → `src/app/(dash)/optimize/`
- Delete: `src/components/Tag.tsx`
- Test: `tests/workspace/current.test.ts`

**Interfaces:**
- Consumes: `loadDashboardData` (`hasDemoData`), `syncNow` (`src/app/(dash)/actions.ts`), `isAuthed`.
- Produces: `currentCaller(): Promise<G8Caller>` (request-cached; every page and server action uses it from now on), `DEMO_NOTE` string, `<Header hasDemoData />`, route `/optimize`, `npm run shots -- <paths…>`.

- [ ] **Step 1: Write the failing test for `currentCaller`**

`tests/workspace/current.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { currentCaller } from "@/lib/workspace/current";
import { g8Caller } from "@/lib/g8/client";

describe("currentCaller", () => {
  it("returns the single-org caller until workspaces exist", async () => expect(await currentCaller()).toBe(g8Caller));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/workspace/current.test.ts`
Expected: FAIL, cannot resolve `@/lib/workspace/current`.

- [ ] **Step 3: Implement `src/lib/workspace/current.ts`**

```ts
import { cache } from "react";
import { g8Caller, type G8Caller } from "../g8/client";

/** The graph8 caller for this request. Phase 3 (Task 13) makes it per workspace; pages never import g8Caller directly. */
export const currentCaller = cache(async (): Promise<G8Caller> => g8Caller);
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/workspace/current.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the header components**

`src/components/DemoDataPill.tsx`:

```tsx
export const DEMO_NOTE = "Meetings, deals and the email-finding spend on the Sales VPs, Founders and Starter lists are simulated for this demo. Everything else comes from this org's real graph8 ledger.";

export function DemoDataPill() {
  return (
    <span className="demo-pill" tabIndex={0} aria-describedby="demo-note">
      Includes demo data
      <span role="tooltip" id="demo-note" className="demo-pop">{DEMO_NOTE}</span>
    </span>
  );
}
```

`src/components/NavTabs.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [["/", "Overview"], ["/charges", "Charges"], ["/recovery", "Recovery"], ["/optimize", "Optimize spend"]] as const;

export function NavTabs() {
  const path = usePathname();
  const q = useSearchParams().get("period") === "30d" ? "?period=30d" : "";
  return (
    <nav aria-label="Screens" className="tabs">
      {TABS.map(([href, label]) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={`${href}${q}`} aria-current={on ? "page" : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
```

`src/components/PeriodSwitch.tsx`:

```tsx
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [["8w", "8 weeks"], ["30d", "30 days"]] as const;

export function PeriodSwitch() {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const current = sp.get("period") === "30d" ? "30d" : "8w";
  const choose = (p: string) => {
    const q = new URLSearchParams(sp.toString());
    if (p === "8w") q.delete("period"); else q.set("period", p);
    const s = q.toString();
    router.push(s ? `${path}?${s}` : path);
  };
  return (
    <div className="seg" role="group" aria-label="Period">
      {OPTIONS.map(([p, label]) => (
        <button key={p} type="button" aria-pressed={current === p} className={current === p ? "on" : undefined} onClick={() => choose(p)}>{label}</button>
      ))}
    </div>
  );
}
```

`src/components/Header.tsx`:

```tsx
import { Suspense } from "react";
import { NavTabs } from "./NavTabs";
import { PeriodSwitch } from "./PeriodSwitch";
import { DemoDataPill } from "./DemoDataPill";
import { syncNow } from "@/app/(dash)/actions";

export function Header({ hasDemoData }: { hasDemoData: boolean }) {
  return (
    <header className="topbar">
      <span className="brand">Credit Compass</span>
      {hasDemoData && <DemoDataPill />}
      <Suspense><NavTabs /></Suspense>
      <span className="spacer" />
      <Suspense><PeriodSwitch /></Suspense>
      <form action={syncNow}><button className="btn ghost" type="submit">Sync now</button></form>
    </header>
  );
}
```

- [ ] **Step 6: Use the header in the dashboard layout; rename the app**

`src/app/(dash)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  const d = await loadDashboardData(await currentCaller());
  return (
    <div className="page">
      <Header hasDemoData={d.hasDemoData} />
      <main>{children}</main>
    </div>
  );
}
```

   In `src/app/layout.tsx` change the metadata to `{ title: "Credit Compass", description: "Which graph8 credits turned into meetings, and what to change next" }`. In `src/app/login/page.tsx` change `<h1>ROI Advisor</h1>` to `<h1>Credit Compass</h1>`.

   In `src/app/(dash)/actions.ts`, use the seam: replace `import { g8Caller } from "@/lib/g8/client";` with `import { currentCaller } from "@/lib/workspace/current";` and `await runSync({ c: g8Caller });` with `await runSync({ c: await currentCaller() });`. Change `revalidatePath("/")` to `revalidatePath("/", "layout")` so every tab refreshes after a sync.

- [ ] **Step 7: Move the pre-spend screen to `/optimize` and redirect the old URL**

```bash
cd /home/opc/graph8/advisor && git mv "src/app/(dash)/prespend" "src/app/(dash)/optimize"
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/prespend", destination: "/optimize", permanent: false }];
  },
};

export default nextConfig;
```

   Fix any import that still says `prespend` (`grep -rn prespend src tests`; the page imports `./actions` and `./ApplyGuardrail` relatively, so usually nothing changes).

- [ ] **Step 8: Remove the REAL/SIM tags**

- Delete `src/components/Tag.tsx`.
- `src/components/FindingCard.tsx`: remove the `Tag` import and the `<Tag simulated={f.simulated} />` element.
- `src/components/ChargesTable.tsx`: remove the `Tag` import and `{c.simulated && <Tag simulated />}`.
- `src/components/KpiTile.tsx`: remove the `Tag` import, the `simulated` prop and its `<Tag … />` (callers pass `simulated`; delete those props in `src/app/(dash)/page.tsx`).
- `src/app/(dash)/recovery/page.tsx`: remove the `Tag` import and ` <Tag simulated={f.simulated} />`.
- `src/components/HBarChart.tsx`: change the label text to `{r.label}` (drop the `[sim] ` prefix).

Run: `grep -rn "Tag\b\|\[sim\] \${" src` → only comments or nothing.

- [ ] **Step 9: Add the design tokens and shell styles**

In `src/app/globals.css`:

1. Inside the light `:root` block add:

```css
  --booked:#1f8a5b; --nomeet:#8fa3b8; --unused:#d99a1e; --unknown:#b9c2cc; --waste:#d03b3b; --flow:#9db8d9; --maybe:#7fbf9f;
```

   and inside **both** dark blocks (`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`) add:

```css
    --booked:#3fb27f; --nomeet:#6f8298; --unused:#e0a93a; --unknown:#5d6873; --waste:#e0605f; --flow:#35557a; --maybe:#4f9a78;
```

   Set `--accent:#2350C8;` in light (already) and keep the dark accent.

2. Change the table header rule so it is not all caps and the method chip is not monospace:

```css
th{text-align:left;font-size:13px;color:var(--muted);font-weight:500;padding:9px 12px;border-bottom:1px solid var(--line);background:var(--panel)}
.method{font-size:12.5px;padding:1px 7px;border-radius:4px;white-space:nowrap}
```

3. Append the shell styles:

```css
/* shell */
.topbar{position:sticky;top:0;z-index:10;background:var(--bg);display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;border-bottom:1px solid var(--line);padding:12px 0}
.topbar .spacer{flex:1}
.brand{font:700 16px var(--f-display);letter-spacing:-.01em}
.demo-pill{position:relative;font-size:12px;border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:1px 10px;color:var(--ink-2);cursor:help}
.demo-pop{display:none;position:absolute;top:130%;left:0;width:min(320px,80vw);background:var(--ink);color:var(--bg);border-radius:8px;padding:10px 12px;font-size:12.5px;line-height:1.45;z-index:20}
.demo-pill:hover .demo-pop,.demo-pill:focus .demo-pop{display:block}
.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;max-width:100%}
.tabs a{font-size:14px;font-weight:500;color:var(--ink-2);text-decoration:none;padding:6px 10px;border-radius:6px;white-space:nowrap}
.tabs a[aria-current="page"]{color:var(--ink);background:var(--panel);box-shadow:inset 0 0 0 1px var(--line)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;background:var(--panel)}
.seg button{font:500 13px var(--f-body);border:0;background:none;padding:4px 11px;color:var(--ink-2);cursor:pointer}
.seg button.on{background:var(--ink);color:var(--bg)}
.seg button:disabled{color:var(--muted);opacity:.6;cursor:not-allowed}
.btn.ghost{background:var(--panel);color:var(--accent);border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}
.btn.primary:disabled,.btn:disabled{opacity:.45;cursor:not-allowed}
.headline{font:700 clamp(26px,3.4vw,34px)/1.12 var(--f-display);letter-spacing:-.02em;margin:30px 0 8px;max-width:34ch;text-wrap:balance}
.lede{color:var(--ink-2);font-size:16px;max-width:68ch;margin:0}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 20px}
.ph{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.ph h2{font:600 15px var(--f-display)}
.small{font-size:12.5px;color:var(--muted)}
@media (max-width:760px){.topbar{gap:8px 12px}.topbar .spacer{display:none}}
```

   Leave the older `.kpi`, `.finding`, `.rcard`, `.dialog` rules in place; later tasks delete them when their screens are rewritten.

- [ ] **Step 10: Add the screenshot helper**

Add the dev dependency (matches the Chromium build already on the machine):

```bash
cd advisor && npm install --save-dev --save-exact playwright-core@1.63.0
```

Add `"shots": "node --env-file=.env.local scripts/shots.mjs"` to `scripts` in `package.json`, and `/.shots/` to `advisor/.gitignore`.

`scripts/shots.mjs`:

```js
// Usage: npm run shots -- / /charges?period=30d   (BASE_URL defaults to http://localhost:3000)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const exe = process.env.CHROME_PATH ?? `${homedir()}/.cache/ms-playwright/chromium-1243/chrome-linux-arm64/chrome`;
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/charges", "/recovery", "/optimize"];
mkdirSync(".shots", { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}/login`);
  await page.fill("input[type=password]", process.env.DASHBOARD_PASSWORD ?? "");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.keyboard.press("Enter")]);
  for (const p of paths) {
    const t0 = Date.now();
    await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 120000 });
    const file = `.shots/${w}${p.replace(/[/?=&]+/g, "_") || "_root"}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${w}px ${p} ${Date.now() - t0}ms ${file}${overflow ? " HORIZONTAL-OVERFLOW" : ""}`);
  }
  if (errors.length) console.log(`${w}px console errors:`, errors);
  await page.close();
}
await browser.close();
```

- [ ] **Step 11: Verify and look at it**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS, clean, build succeeds.

Start the app and take screenshots:

```bash
cd advisor && (npm run dev > /tmp/cc-dev.log 2>&1 &) && sleep 8 && npm run shots -- / /charges /recovery /optimize /prespend
```

Expected: each line prints a file; no `HORIZONTAL-OVERFLOW`; no console errors; `/prespend` lands on the Optimize page. Open `.shots/1440_root.png` and `.shots/390_root.png`: "Credit Compass", the "Includes demo data" pill, four tabs with Overview highlighted, "8 weeks | 30 days", "Sync now"; no REAL or SIM tags anywhere. Hover or focus the pill in a real browser to see the popover. Stop the dev server afterwards (`pkill -f "next dev"` only if you started it; do not kill other people's servers).

- [ ] **Step 12: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/scripts/shots.mjs advisor/package.json advisor/package-lock.json advisor/.gitignore advisor/next.config.ts advisor/tests/workspace
git commit -m "feat(advisor): Credit Compass shell with demo-data pill, tabs, period switch and /optimize"
```

---
### Task 4: Overview (headline, number strip, flow diagram, Do next, cost per meeting by list)

Spec §5.2, §4.4. The one bold element is the flow diagram.

**Files:**
- Create: `src/lib/dashboard/story.ts`, `src/lib/dashboard/flow.ts`, `src/components/Headline.tsx`, `src/components/StatStrip.tsx`, `src/components/FlowDiagram.tsx`, `src/components/DoNext.tsx`
- Modify: `src/app/(dash)/page.tsx` (rewrite), `src/components/HBarChart.tsx` (per-row colour), `src/app/globals.css`
- Delete: `src/components/KpiTile.tsx`, `src/components/FindingCard.tsx`
- Test: `tests/dashboard/story.test.ts`, `tests/dashboard/flow.test.ts`, `tests/dashboard/donext.test.ts`

**Interfaces:**
- Consumes: `periodView`, `PeriodView` (Task 1), `BUCKETS`, `BUCKET_LABEL`, `serviceName`, `PERIOD_LABEL`, `parsePeriod`, `dashboardBuckets` (`gate.ts`), `currentCaller` (Task 3).
- Produces:
  - `story.ts`: `n(x)`, `plural(k, one, many?)`, `overviewHeadline({ total, meetings, won, periodLabel })`, `overviewLede({ unused, waste })`, `statStrip({ total, meetings, booked, waste, traced })` → `StatItem[]` (`{ value; label; tone?: "bad" }`). Tasks 5, 6, 9 add more builders to this file.
  - `flow.ts`: `flowData(charges, bucketOf, listNames): FlowData`, `layoutFlow(data, opts?): FlowLayout`, types `FlowNode`, `FlowLink`, `LaidNode`, `LaidLink`.
  - `doNextItems(findings, max = 4): DoNextItem[]` (in `DoNext.tsx`'s sibling `src/lib/dashboard/donext.ts`), `DoNextItem { id; text; sub; label; href }`.
  - Charges URL filters used by flow links: `/charges?outcome=<bucket>&list=<id|none|other>&service=<service>` (Task 5 implements them).

- [ ] **Step 1: Write the failing tests for the Overview sentences**

`tests/dashboard/story.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { overviewHeadline, overviewLede, statStrip, plural } from "@/lib/dashboard/story";

describe("Overview sentences", () => {
  it("states credits, meetings and won deals", () =>
    expect(overviewHeadline({ total: 10766.4, meetings: 27, won: 10, periodLabel: "the last 8 weeks" })).toBe("10,766 credits bought 27 meetings and 10 won deals."));
  it("handles one meeting and no won deals", () =>
    expect(overviewHeadline({ total: 500, meetings: 1, won: 0, periodLabel: "the last 30 days" })).toBe("500 credits bought 1 meeting."));
  it("never divides by zero or says 0 meetings", () => {
    expect(overviewHeadline({ total: 1260, meetings: 0, won: 0, periodLabel: "the last 30 days" })).toBe("1,260 credits spent in the last 30 days, and no meetings booked yet.");
    expect(overviewHeadline({ total: 0, meetings: 0, won: 0, periodLabel: "the last 30 days" })).toBe("No credits spent in the last 30 days.");
    expect(statStrip({ total: 0, meetings: 0, booked: 0, waste: 0, traced: 0 }).map((s) => s.value)).toEqual(["—", "0", "0", "0%"]);
  });
  it("explains what bought nothing, leaving out empty parts", () => {
    expect(overviewLede({ unused: 860, waste: 115 })).toBe("975 of them bought nothing you've used: 860 on onboarding research nobody has opened, and 115 on jobs that failed.");
    expect(overviewLede({ unused: 0, waste: 115 })).toBe("115 of them bought nothing you've used: 115 on jobs that failed.");
    expect(overviewLede({ unused: 0, waste: 0 })).toBeNull();
  });
  it("builds the number strip", () => {
    expect(statStrip({ total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722 })).toEqual([
      { value: "399", label: "credits per meeting" }, { value: "5,131", label: "spent on contacts who booked" },
      { value: "115", label: "wasted", tone: "bad" }, { value: "90%", label: "traced to a contact, list or run" }]);
  });
  it("pluralises", () => { expect(plural(1, "job")).toBe("1 job"); expect(plural(3, "job")).toBe("3 jobs"); expect(plural(2, "company", "companies")).toBe("2 companies"); });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/dashboard/story.test.ts`
Expected: FAIL, cannot resolve `@/lib/dashboard/story`.

- [ ] **Step 3: Implement the Overview part of `src/lib/dashboard/story.ts`**

```ts
export const n = (x: number) => Math.round(x).toLocaleString("en-US");
export const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${Math.round(k) === 1 ? one : many}`;
export interface StatItem { value: string; label: string; tone?: "bad" }

export function overviewHeadline(p: { total: number; meetings: number; won: number; periodLabel: string }): string {
  if (p.total <= 0) return `No credits spent in ${p.periodLabel}.`;
  if (p.meetings <= 0) return `${n(p.total)} credits spent in ${p.periodLabel}, and no meetings booked yet.`;
  const won = p.won > 0 ? ` and ${plural(p.won, "won deal")}` : "";
  return `${n(p.total)} credits bought ${plural(p.meetings, "meeting")}${won}.`;
}

export function overviewLede(p: { unused: number; waste: number }): string | null {
  const parts: string[] = [];
  if (p.unused > 0) parts.push(`${n(p.unused)} on onboarding research nobody has opened`);
  if (p.waste > 0) parts.push(`${n(p.waste)} on jobs that failed`);
  if (!parts.length) return null;
  return `${n(p.unused + p.waste)} of them bought nothing you've used: ${parts.join(", and ")}.`;
}

export function statStrip(p: { total: number; meetings: number; booked: number; waste: number; traced: number }): StatItem[] {
  return [
    { value: p.meetings > 0 ? n(p.total / p.meetings) : "—", label: "credits per meeting" },
    { value: n(p.booked), label: "spent on contacts who booked" },
    { value: n(p.waste), label: "wasted", ...(p.waste > 0 ? { tone: "bad" as const } : {}) },
    { value: `${p.total > 0 ? Math.round((p.traced / p.total) * 100) : 0}%`, label: "traced to a contact, list or run" },
  ];
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/dashboard/story.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing tests for the flow diagram**

`tests/dashboard/flow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { flowData, layoutFlow } from "@/lib/dashboard/flow";
import type { AttributedCharge, OutcomeBucket } from "@/lib/domain/types";

const c = (id: string, service: string, credits: number, listId: number | null, bucket: OutcomeBucket): AttributedCharge & { b: OutcomeBucket } => ({
  ledgerId: id, ledgerType: "usage", service, credits, chargedAt: "2026-09-01T00:00:00Z", llmTier: null, tokensIn: null, tokensOut: null, description: null,
  method: "advisor", runExtId: null, listId, contactId: null, segmentKey: null, explanation: "x", result: "success", isWaste: bucket === "waste",
  wasteReason: null, simulated: false, b: bucket });
const charges = [
  c("1", "waterfall_enrichment", 4800, 2, "booked"), c("2", "waterfall_enrichment", 2000, 2, "nomeet"), c("3", "waterfall_enrichment", 2108, 15, "booked"),
  c("4", "studio_global", 860, null, "unused"), c("5", "ai_enrichment", 77, 2, "waste"), c("6", "voice_llm", 93, null, "unknown"),
  c("7", "landing_page_template", 100, null, "unknown"), c("8", "email_verification", 40, 2, "nomeet"), c("9", "image_generation", 25, null, "unknown"),
  c("10", "studio_copilot", 24, null, "waste"), c("11", "waterfall_enrichment", 3, 13, "nomeet"),
];
const names = new Map([["2", "Starter list"], ["15", "Sales VPs"], ["13", "Guardrail probe"]]);
const data = flowData(charges, (x) => (x as typeof charges[number]).b, names);
const total = charges.reduce((s, x) => s + x.credits, 0);

describe("flowData", () => {
  it("names services, keeps the top five and groups the rest", () => {
    const col0 = data.nodes.filter((x) => x.col === 0).map((x) => x.label);
    expect(col0).toEqual(["Email finding", "Onboarding research", "Landing page", "Skill runs", "AI enrichment", "Other services"]);
  });
  it("groups tiny lists and untied spend", () => {
    const col1 = data.nodes.filter((x) => x.col === 1).map((x) => x.label);
    expect(col1).toEqual(["Starter list", "Sales VPs", "Other lists", "Not tied to a list"]);
  });
  it("orders outcomes as booked, no meeting, never used, can't tell, wasted and links them to Charges", () => {
    const col2 = data.nodes.filter((x) => x.col === 2);
    expect(col2.map((x) => x.label)).toEqual(["Booked a meeting", "No meeting yet", "Never used", "Can't tell yet", "Wasted"]);
    expect(col2[0].href).toBe("/charges?outcome=booked");
  });
  it("conserves credits at every node", () => {
    for (const node of data.nodes) {
      const inn = data.links.filter((l) => l.target === node.id).reduce((s, l) => s + l.value, 0);
      const out = data.links.filter((l) => l.source === node.id).reduce((s, l) => s + l.value, 0);
      if (node.col > 0) expect(inn).toBeCloseTo(node.value, 6);
      if (node.col < 2) expect(out).toBeCloseTo(node.value, 6);
    }
    expect(data.nodes.filter((x) => x.col === 2).reduce((s, x) => s + x.value, 0)).toBeCloseTo(total, 6);
  });
});

describe("layoutFlow", () => {
  const lay = layoutFlow(data);
  it("keeps every node inside the drawing and in its column", () => {
    for (const node of lay.nodes) {
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y + node.h).toBeLessThanOrEqual(lay.height + 0.001);
      expect(node.h).toBeGreaterThanOrEqual(3);
    }
  });
  it("gives every band a path, a colour, a link and a tooltip", () => {
    const band = lay.links.find((l) => l.target === "b:booked" && l.source === "l:15")!;
    expect(band.d.startsWith("M")).toBe(true);
    expect(band.colorVar).toBe("var(--booked)");
    expect(band.href).toBe("/charges?list=15&outcome=booked");
    expect(band.title).toBe("Sales VPs → Booked a meeting: 2,108 credits");
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run tests/dashboard/flow.test.ts`
Expected: FAIL, cannot resolve `@/lib/dashboard/flow`.

- [ ] **Step 7: Implement `src/lib/dashboard/flow.ts`**

```ts
import type { AttributedCharge, OutcomeBucket } from "../domain/types";
import { BUCKETS, BUCKET_LABEL } from "../domain/buckets";
import { serviceName } from "../domain/names";
import { n } from "./story";

export interface FlowNode { id: string; key: string; label: string; value: number; col: 0 | 1 | 2; href: string }
export interface FlowLink { source: string; target: string; value: number }
export interface FlowData { nodes: FlowNode[]; links: FlowLink[] }
export interface LaidNode extends FlowNode { x: number; y: number; h: number }
export interface LaidLink extends FlowLink { d: string; h: number; colorVar: string; href: string; title: string }
export interface FlowLayout { width: number; height: number; nodeWidth: number; nodes: LaidNode[]; links: LaidLink[] }

const TOP_SERVICES = 5, SMALL_LIST_SHARE = 0.01;

export function flowData(charges: AttributedCharge[], bucketOf: (c: AttributedCharge) => OutcomeBucket, listNames: Map<string, string>): FlowData {
  const total = charges.reduce((s, c) => s + c.credits, 0) || 1;
  const bySvc = new Map<string, number>(), byList = new Map<string, number>();
  for (const c of charges) {
    bySvc.set(c.service, (bySvc.get(c.service) ?? 0) + c.credits);
    const lk = c.listId === null ? "none" : String(c.listId);
    byList.set(lk, (byList.get(lk) ?? 0) + c.credits);
  }
  const topSvc = [...bySvc].sort((a, b) => b[1] - a[1]).slice(0, TOP_SERVICES).map(([s]) => s);
  const svcKey = (s: string) => (topSvc.includes(s) ? s : "other");
  const listKey = (c: AttributedCharge) => {
    if (c.listId === null) return "none";
    return (byList.get(String(c.listId)) ?? 0) / total < SMALL_LIST_SHARE ? "other" : String(c.listId);
  };
  const acc = new Map<string, number>();
  const add = (k: string, v: number) => acc.set(k, (acc.get(k) ?? 0) + v);
  for (const c of charges) {
    const s = `s:${svcKey(c.service)}`, l = `l:${listKey(c)}`, b = `b:${bucketOf(c)}`;
    add(s, c.credits); add(l, c.credits); add(b, c.credits); add(`${s}>${l}`, c.credits); add(`${l}>${b}`, c.credits);
  }
  const nodes: FlowNode[] = [];
  const svcOrder = [...topSvc.filter((s) => acc.has(`s:${s}`)), ...(acc.has("s:other") ? ["other"] : [])];
  for (const s of svcOrder) nodes.push({ id: `s:${s}`, key: s, col: 0, value: acc.get(`s:${s}`)!, label: s === "other" ? "Other services" : serviceName(s),
    href: s === "other" ? "/charges" : `/charges?service=${s}` });
  const listIds = [...acc.keys()].filter((k) => /^l:[^>]+$/.test(k)).map((k) => k.slice(2));
  const named = listIds.filter((k) => k !== "other" && k !== "none").sort((a, b) => acc.get(`l:${b}`)! - acc.get(`l:${a}`)!);
  for (const l of [...named, ...listIds.filter((k) => k === "other"), ...listIds.filter((k) => k === "none")])
    nodes.push({ id: `l:${l}`, key: l, col: 1, value: acc.get(`l:${l}`)!, href: `/charges?list=${l}`,
      label: l === "none" ? "Not tied to a list" : l === "other" ? "Other lists" : listNames.get(l) ?? `List ${l}` });
  for (const b of BUCKETS) if (acc.has(`b:${b}`)) nodes.push({ id: `b:${b}`, key: b, col: 2, value: acc.get(`b:${b}`)!, label: BUCKET_LABEL[b], href: `/charges?outcome=${b}` });
  const links: FlowLink[] = [...acc].filter(([k]) => k.includes(">")).map(([k, value]) => { const [source, target] = k.split(">"); return { source, target, value }; });
  return { nodes, links };
}

export function layoutFlow(data: FlowData, o = { width: 1000, height: 380, nodeWidth: 10, gap: 14, minH: 3, colX: [190, 520, 820] }): FlowLayout {
  const cols = [0, 1, 2].map((ci) => data.nodes.filter((x) => x.col === ci));
  const total = cols[0].reduce((s, x) => s + x.value, 0) || 1;
  const maxGaps = Math.max(...cols.map((c) => Math.max(0, c.length - 1))) * o.gap;
  const extra = Math.max(...cols.map((c) => c.length)) * o.minH;
  const scale = Math.max(0.0001, (o.height - maxGaps - extra) / total);
  const laid = new Map<string, LaidNode & { out: number; in: number }>();
  for (const [ci, col] of cols.entries()) {
    let y = 0;
    for (const node of col) {
      const h = Math.max(o.minH, node.value * scale);
      laid.set(node.id, { ...node, x: o.colX[ci], y, h, out: 0, in: 0 });
      y += h + o.gap;
    }
  }
  const order = (id: string) => data.nodes.findIndex((x) => x.id === id);
  const links: LaidLink[] = [...data.links].sort((a, b) => order(a.source) - order(b.source) || order(a.target) - order(b.target)).map((l) => {
    const A = laid.get(l.source)!, B = laid.get(l.target)!;
    const h = Math.max(1.5, l.value * scale);
    const y0 = A.y + A.out, y1 = B.y + B.in; A.out += h; B.in += h;
    const x0 = A.x + o.nodeWidth, x1 = B.x, mx = (x0 + x1) / 2;
    const f = (v: number) => Math.round(v * 10) / 10;
    const d = `M${f(x0)} ${f(y0)}C${f(mx)} ${f(y0)} ${f(mx)} ${f(y1)} ${f(x1)} ${f(y1)}L${f(x1)} ${f(y1 + h)}C${f(mx)} ${f(y1 + h)} ${f(mx)} ${f(y0 + h)} ${f(x0)} ${f(y0 + h)}Z`;
    const toBucket = B.col === 2;
    const href = toBucket ? `/charges?list=${A.key}&outcome=${B.key}` : `/charges?service=${A.key === "other" ? "" : A.key}&list=${B.key}`.replace("service=&", "");
    return { ...l, d, h, colorVar: toBucket ? `var(--${B.key})` : "var(--flow)", href, title: `${A.label} → ${B.label}: ${n(l.value)} credits` };
  });
  const height = Math.max(o.height, ...[...laid.values()].map((x) => x.y + x.h));
  return { width: o.width, height, nodeWidth: o.nodeWidth, nodes: [...laid.values()].map(({ out: _o, in: _i, ...x }) => x), links };
}
```

- [ ] **Step 8: Run it to see it pass**

Run: `npx vitest run tests/dashboard/flow.test.ts`
Expected: PASS (6 tests). If "inside the drawing" fails, the `extra` reserve for `minH` nodes is too small; keep `height` the max of the requested height and the tallest column, as written.

- [ ] **Step 9: Write the failing test for Do next**

`tests/dashboard/donext.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { doNextItems } from "@/lib/dashboard/donext";
import type { Finding } from "@/lib/domain/types";

const f = (kind: Finding["kind"], stake: number, body: string, confidence: Finding["confidence"] = "high"): Finding => ({ extId: `${kind}|x|8w`, kind, title: kind, body,
  evidence: {}, creditsAtStake: stake, confidence, status: "open", snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null,
  firstSeen: "2026-09-27T00:00:00Z", lastSeen: "2026-09-27T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false });

describe("doNextItems", () => {
  it("orders by credits at stake weighted by confidence and gives each a button that says what it does", () => {
    const items = doNextItems([f("waste", 77, "A"), f("cut", 4931, "B", "medium"), f("scale", 2108, "C"), f("unused", 860, "D", "medium"), f("fix", 13, "E")]);
    expect(items.map((x) => [x.text, x.label, x.href])).toEqual([
      ["B", "See how to cut it", "/optimize#move-spend"], ["C", "Build a lookalike list", "/optimize#move-spend"],
      ["D", "See it in Recovery", "/recovery"], ["A", "Request a refund", "/recovery#claim"]]);
    expect(items[0].sub).toBe("4,931 credits at stake");
  });
  it("skips kinds that have nothing to do", () => expect(doNextItems([f("what_worked", 0, "x"), f("traceability", 50, "y")])).toEqual([]));
});
```

- [ ] **Step 10: Run it to see it fail**

Run: `npx vitest run tests/dashboard/donext.test.ts`
Expected: FAIL, cannot resolve `@/lib/dashboard/donext`.

- [ ] **Step 11: Implement `src/lib/dashboard/donext.ts`**

```ts
import type { Finding } from "../domain/types";
import { n } from "./story";

export interface DoNextItem { id: string; text: string; sub: string; label: string; href: string }
const WEIGHT = { high: 1, medium: 0.6, low: 0.2 } as const;
const BUTTON: Partial<Record<Finding["kind"], [string, string]>> = {
  cut: ["See how to cut it", "/optimize#move-spend"], scale: ["Build a lookalike list", "/optimize#move-spend"],
  repeat_enrichment: ["Stop paying twice", "/optimize#repeat"], waste: ["Request a refund", "/recovery#claim"],
  unused: ["See it in Recovery", "/recovery"], side_effect: ["See it in Recovery", "/recovery"], fix: ["Plan the next enrichment", "/optimize#plan"],
};

export function doNextItems(findings: Finding[], max = 4): DoNextItem[] {
  return findings.filter((f) => BUTTON[f.kind])
    .sort((a, b) => b.creditsAtStake * WEIGHT[b.confidence] - a.creditsAtStake * WEIGHT[a.confidence])
    .slice(0, max)
    .map((f) => ({ id: f.extId, text: f.body, sub: `${n(f.creditsAtStake)} credits at stake`, label: BUTTON[f.kind]![0], href: BUTTON[f.kind]![1] }));
}
```

- [ ] **Step 12: Run it to see it pass**

Run: `npx vitest run tests/dashboard/donext.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 13: Add the Overview components**

`src/components/Headline.tsx`:

```tsx
export function Headline({ text, lede }: { text: string; lede?: string | null }) {
  return (<div className="head"><h1 className="headline">{text}</h1>{lede && <p className="lede">{lede}</p>}</div>);
}
```

`src/components/StatStrip.tsx`:

```tsx
import type { StatItem } from "@/lib/dashboard/story";
export function StatStrip({ items }: { items: StatItem[] }) {
  return (<dl className="strip">{items.map((s) => (<div key={s.label}><dt>{s.label}</dt><dd className={s.tone === "bad" ? "bad" : undefined}>{s.value}</dd></div>))}</dl>);
}
```

`src/components/FlowDiagram.tsx`:

```tsx
import Link from "next/link";
import type { FlowLayout } from "@/lib/dashboard/flow";
import { n } from "@/lib/dashboard/story";

export function FlowDiagram({ layout, periodQuery }: { layout: FlowLayout; periodQuery: string }) {
  const q = (href: string) => (periodQuery ? `${href}${href.includes("?") ? "&" : "?"}${periodQuery}` : href);
  const total = layout.nodes.filter((x) => x.col === 2).reduce((s, x) => s + x.value, 0) || 1;
  return (
    <>
      <svg className="flow" viewBox={`-10 -30 ${layout.width + 20} ${layout.height + 40}`} role="img"
        aria-label={`Where ${n(total)} credits went, from what you paid for to who it was spent on to what it bought`}>
        <g className="flow-heads"><text x={185} y={-12} textAnchor="end">What you paid for</text><text x={538} y={-12}>Who it was spent on</text><text x={838} y={-12}>What it bought</text></g>
        {layout.links.map((l) => (
          <a key={`${l.source}>${l.target}`} href={q(l.href)}>
            <path d={l.d} fill={l.colorVar} className={l.colorVar === "var(--flow)" ? "band" : "band outcome"}><title>{l.title}</title></path>
          </a>))}
        {layout.nodes.map((x) => (
          <a key={x.id} href={q(x.href)}>
            <rect x={x.x} y={x.y} width={layout.nodeWidth} height={x.h} rx={1} fill={x.col === 2 ? `var(--${x.key})` : "var(--ink-2)"}><title>{`${x.label}: ${n(x.value)} credits`}</title></rect>
            <text className="flow-label" x={x.col === 0 ? x.x - 8 : x.x + layout.nodeWidth + 8} y={x.y + x.h / 2 + 4} textAnchor={x.col === 0 ? "end" : "start"}>
              {x.label} <tspan fontWeight={600}>{n(x.value)}</tspan>
            </text>
          </a>))}
      </svg>
      <div className="flow-mobile" aria-hidden="true">
        <div className="stack-bar">{layout.nodes.filter((x) => x.col === 2).map((x) => <span key={x.id} style={{ flex: x.value, background: `var(--${x.key})` }} />)}</div>
        <ul>{layout.nodes.filter((x) => x.col === 2).map((x) => (
          <li key={x.id}><Link href={q(x.href)}><i className="dot" style={{ background: `var(--${x.key})` }} />{x.label}</Link><b>{n(x.value)}</b></li>))}</ul>
      </div>
    </>
  );
}
```

`src/components/DoNext.tsx`:

```tsx
import Link from "next/link";
import type { DoNextItem } from "@/lib/dashboard/donext";
export function DoNext({ items }: { items: DoNextItem[] }) {
  return (
    <section className="panel" aria-labelledby="donext-h">
      <div className="ph"><h2 id="donext-h">Do next</h2><span className="small">Most credits at stake first</span></div>
      {items.length === 0 && <p className="small">Nothing needs doing right now.</p>}
      {items.map((x) => (
        <div className="todo" key={x.id}><div><p>{x.text}</p><span className="small">{x.sub}</span></div><Link className="btn primary" href={x.href}>{x.label}</Link></div>))}
    </section>
  );
}
```

In `src/components/HBarChart.tsx`, add `color?: string` to `Bar` and use `fill={r.color ?? "var(--series)"}` on the bar path.

- [ ] **Step 14: Rewrite the Overview page**

`src/app/(dash)/page.tsx`:

```tsx
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { dashboardBuckets } from "@/lib/domain/gate";
import { overviewHeadline, overviewLede, statStrip } from "@/lib/dashboard/story";
import { flowData, layoutFlow } from "@/lib/dashboard/flow";
import { doNextItems } from "@/lib/dashboard/donext";
import { Headline } from "@/components/Headline";
import { StatStrip } from "@/components/StatStrip";
import { FlowDiagram } from "@/components/FlowDiagram";
import { DoNext } from "@/components/DoNext";
import { HBarChart } from "@/components/HBarChart";

export default async function Overview({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = parsePeriod((await searchParams).period);
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const total = v.coverage.total;
  const byList = v.stats.filter((s) => s.dimension === "list" && s.costPerMeeting !== null).sort((a, b) => a.costPerMeeting! - b.costPerMeeting!);
  const best = byList[0]?.value;
  return (
    <>
      <Headline text={overviewHeadline({ total, meetings: v.meetings, won: v.won, periodLabel: PERIOD_LABEL[period] })} lede={overviewLede({ unused: v.buckets.unused, waste: v.buckets.waste })} />
      <StatStrip items={statStrip({ total, meetings: v.meetings, booked: v.buckets.booked, waste: v.buckets.waste, traced: v.coverage.exact })} />
      <section className="panel">
        <div className="ph"><h2>Where every credit went</h2><span className="small">Click a band to see its charges</span></div>
        {total > 0 ? <FlowDiagram layout={layoutFlow(flowData(v.charges, v.bucketOf, d.listNames))} periodQuery={period === "30d" ? "period=30d" : ""} />
          : <p className="small">No charges in {PERIOD_LABEL[period]}. Switch to 8 weeks or run Sync now.</p>}
      </section>
      <div className="grid2">
        <DoNext items={doNextItems(dashboardBuckets(d.findings, d.now).open)} />
        <section className="panel">
          <div className="ph"><h2>Credits per meeting, by list</h2><span className="small">Lower is better</span></div>
          {byList.length ? <HBarChart ariaLabel="Credits per meeting by list" unit="credits per meeting" labelW={130} max={Math.max(...byList.map((s) => s.costPerMeeting!)) * 1.05}
            rows={byList.map((s) => ({ label: d.listNames.get(s.value) ?? `List ${s.value}`, value: s.costPerMeeting!, note: `${s.meetings} meetings`, color: s.value === best ? "var(--booked)" : "var(--nomeet)" }))} />
            : <p className="small">No meetings in {PERIOD_LABEL[period]} yet.</p>}
        </section>
      </div>
    </>
  );
}
```

Delete `src/components/KpiTile.tsx` and `src/components/FindingCard.tsx` (`grep -rn "KpiTile\|FindingCard" src` → nothing).

- [ ] **Step 15: Add the Overview styles**

Append to `src/app/globals.css`:

```css
/* overview */
main{display:grid;gap:16px}
.strip{display:flex;flex-wrap:wrap;gap:12px 40px;margin:10px 0 0}
.strip div{display:flex;flex-direction:column-reverse}
.strip dt{font-size:13px;color:var(--muted)}
.strip dd{margin:0;font:700 24px var(--f-display);font-variant-numeric:tabular-nums}
.strip dd.bad{color:var(--waste)}
.grid2{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:900px){.grid2{grid-template-columns:1fr}}
.flow{display:block;width:100%;height:auto;font:12px var(--f-body);fill:var(--ink)}
.flow .flow-heads text{font-size:11px;fill:var(--muted)}
.flow .flow-label{paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round}
.flow .band{fill-opacity:.35;transition:fill-opacity .15s}.flow .band.outcome{fill-opacity:.5}
.flow a:hover .band,.flow a:focus .band{fill-opacity:.85}
.flow a:focus-visible{outline:none}.flow a:focus-visible .band{stroke:var(--ink);stroke-width:1}
.flow-mobile{display:none}
@media (max-width:700px){.flow{display:none}.flow-mobile{display:block}}
.stack-bar{display:flex;height:18px;border-radius:5px;overflow:hidden;margin-bottom:10px}
.flow-mobile ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.flow-mobile li{display:flex;justify-content:space-between;gap:10px;font-size:14px}
.flow-mobile a{color:var(--ink);text-decoration:none}
.todo{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;border-top:1px solid var(--line-2);padding:12px 0}
.todo:first-of-type{border-top:0;padding-top:2px}
.todo p{margin:0}
a.btn{text-decoration:none;display:inline-block}
@media (prefers-reduced-motion: reduce){.flow .band{transition:none}}
```

- [ ] **Step 16: Verify, screenshot, compare**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS, clean, build ok.

Run the dev server and `npm run shots -- / "/?period=30d"`. Compare `.shots/1440_root.png` with the Overview in `docs/design/credit-compass-ui-v2.html`: headline sentence with the re-seeded numbers, lede, four-number strip, the three-column flow with outcome colours and halo labels, Do next with buttons, list bars with the cheapest list green. `.shots/390_root.png`: the stacked bar and list instead of the flow; no horizontal overflow. Hover a band in a real browser: the tooltip shows "A → B: N credits"; clicking opens `/charges?…` (Task 5 makes that page honour the filters).

- [ ] **Step 17: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests/dashboard
git commit -m "feat(advisor): Overview as a statement with a three-column credit flow and Do next"
```

---
### Task 5: Charges (activities, outcome chips, filters from the flow)

Spec §5.3, §4.5.

**Files:**
- Create: `src/lib/dashboard/filters.ts`, `src/components/OutcomeChips.tsx`, `src/components/ActivityTable.tsx`
- Modify: `src/lib/dashboard/story.ts` (add `chargesHeadline`), `src/app/(dash)/charges/page.tsx` (rewrite), `src/app/globals.css`
- Delete: `src/components/ChargesTable.tsx`, `src/components/CoverageBar.tsx`
- Test: `tests/dashboard/filters.test.ts`, `tests/dashboard/story.test.ts` (add)

**Interfaces:**
- Consumes: `groupActivities`, `Activity` (Task 1), `periodView`, `BUCKETS`, `BUCKET_LABEL`, `serviceName`, `n`, `plural` (Task 4).
- Produces: `parseChargeFilter(sp): ChargeFilter` (`{ outcome: OutcomeBucket | null; list: string | null; service: string | null }`), `applyChargeFilter(charges, f, bucketOf): AttributedCharge[]`, `filterHref(f, patch, periodQuery): string`, `chargesHeadline({ traced, total, periodLabel })`.

- [ ] **Step 1: Write the failing tests**

`tests/dashboard/filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseChargeFilter, applyChargeFilter, filterHref } from "@/lib/dashboard/filters";
import type { AttributedCharge, OutcomeBucket } from "@/lib/domain/types";

const c = (id: string, service: string, credits: number, listId: number | null, b: OutcomeBucket) => ({ ledgerId: id, ledgerType: "usage", service, credits,
  chargedAt: "2026-09-01T00:00:00Z", llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId, contactId: null,
  segmentKey: null, explanation: "x", result: "success", isWaste: b === "waste", wasteReason: null, simulated: false, b }) as AttributedCharge & { b: OutcomeBucket };
const xs = [c("1", "waterfall_enrichment", 9000, 2, "booked"), c("2", "waterfall_enrichment", 3, 13, "nomeet"), c("3", "studio_global", 860, null, "unused"), c("4", "ai_enrichment", 77, 2, "waste")];
const bucketOf = (x: AttributedCharge) => (x as (typeof xs)[number]).b;

describe("charge filters", () => {
  it("parses only known values", () => {
    expect(parseChargeFilter({ outcome: "waste", list: "2", service: "ai_enrichment" })).toEqual({ outcome: "waste", list: "2", service: "ai_enrichment" });
    expect(parseChargeFilter({ outcome: "bogus", list: "2; drop", service: "x y" })).toEqual({ outcome: null, list: null, service: null });
  });
  it("filters by outcome, list (including none and other) and service", () => {
    expect(applyChargeFilter(xs, { outcome: "waste", list: null, service: null }, bucketOf).map((x) => x.ledgerId)).toEqual(["4"]);
    expect(applyChargeFilter(xs, { outcome: null, list: "none", service: null }, bucketOf).map((x) => x.ledgerId)).toEqual(["3"]);
    expect(applyChargeFilter(xs, { outcome: null, list: "other", service: null }, bucketOf).map((x) => x.ledgerId)).toEqual(["2"]);
    expect(applyChargeFilter(xs, { outcome: null, list: "2", service: "waterfall_enrichment" }, bucketOf).map((x) => x.ledgerId)).toEqual(["1"]);
  });
  it("builds links that keep the period and the other filters", () =>
    expect(filterHref({ outcome: null, list: "2", service: null }, { outcome: "waste" }, "period=30d")).toBe("/charges?outcome=waste&list=2&period=30d"));
});
```

Add to `tests/dashboard/story.test.ts`:

```ts
import { chargesHeadline } from "@/lib/dashboard/story";
describe("Charges sentence", () => {
  it("states how much traces back", () => expect(chargesHeadline({ traced: 9722, total: 10766, periodLabel: "the last 8 weeks" })).toBe("90% of your credits trace back to a contact, list or run."));
  it("handles no charges", () => expect(chargesHeadline({ traced: 0, total: 0, periodLabel: "the last 30 days" })).toBe("No charges in the last 30 days."));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/dashboard/filters.test.ts tests/dashboard/story.test.ts`
Expected: FAIL (missing module and export).

- [ ] **Step 3: Implement**

`src/lib/dashboard/filters.ts`:

```ts
import type { AttributedCharge, OutcomeBucket } from "../domain/types";
import { BUCKETS } from "../domain/buckets";

export interface ChargeFilter { outcome: OutcomeBucket | null; list: string | null; service: string | null }
const SMALL_LIST_SHARE = 0.01; // same rule as the flow diagram's "Other lists"

export function parseChargeFilter(sp: Record<string, string | string[] | undefined>): ChargeFilter {
  const one = (k: string) => { const v = sp[k]; return typeof v === "string" ? v : null; };
  const outcome = one("outcome"), list = one("list"), service = one("service");
  return {
    outcome: outcome && (BUCKETS as string[]).includes(outcome) ? (outcome as OutcomeBucket) : null,
    list: list && /^(\d+|none|other)$/.test(list) ? list : null,
    service: service && /^[a-z_]+$/.test(service) ? service : null,
  };
}

export function applyChargeFilter(charges: AttributedCharge[], f: ChargeFilter, bucketOf: (c: AttributedCharge) => OutcomeBucket): AttributedCharge[] {
  const total = charges.reduce((s, c) => s + c.credits, 0) || 1;
  const perList = new Map<number, number>();
  for (const c of charges) if (c.listId !== null) perList.set(c.listId, (perList.get(c.listId) ?? 0) + c.credits);
  const listMatch = (c: AttributedCharge) => {
    if (!f.list) return true;
    if (f.list === "none") return c.listId === null;
    if (f.list === "other") return c.listId !== null && (perList.get(c.listId) ?? 0) / total < SMALL_LIST_SHARE;
    return String(c.listId) === f.list;
  };
  return charges.filter((c) => listMatch(c) && (!f.service || c.service === f.service) && (!f.outcome || bucketOf(c) === f.outcome));
}

export function filterHref(f: ChargeFilter, patch: Partial<ChargeFilter>, periodQuery: string): string {
  const m = { ...f, ...patch };
  const q = new URLSearchParams();
  if (m.outcome) q.set("outcome", m.outcome);
  if (m.list) q.set("list", m.list);
  if (m.service) q.set("service", m.service);
  const s = [q.toString(), periodQuery].filter(Boolean).join("&");
  return s ? `/charges?${s}` : "/charges";
}
```

Append to `src/lib/dashboard/story.ts`:

```ts
export function chargesHeadline(p: { traced: number; total: number; periodLabel: string }): string {
  if (p.total <= 0) return `No charges in ${p.periodLabel}.`;
  return `${Math.round((p.traced / p.total) * 100)}% of your credits trace back to a contact, list or run.`;
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/dashboard/filters.test.ts tests/dashboard/story.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the components**

`src/components/OutcomeChips.tsx`:

```tsx
import Link from "next/link";
import type { OutcomeBucket } from "@/lib/domain/types";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { filterHref, type ChargeFilter } from "@/lib/dashboard/filters";
import { n } from "@/lib/dashboard/story";

export function OutcomeChips({ f, totals, all, periodQuery }: { f: ChargeFilter; totals: Record<OutcomeBucket, number>; all: number; periodQuery: string }) {
  return (
    <nav className="chips" aria-label="Filter by what it bought">
      <Link className="chip" aria-current={!f.outcome ? "true" : undefined} href={filterHref(f, { outcome: null }, periodQuery)}>All <b>{n(all)}</b></Link>
      {BUCKETS.filter((b) => totals[b] > 0).map((b) => (
        <Link key={b} className="chip" aria-current={f.outcome === b ? "true" : undefined} href={filterHref(f, { outcome: b }, periodQuery)}>
          <i className="dot" style={{ background: `var(--${b})` }} />{BUCKET_LABEL[b]} <b>{n(totals[b])}</b></Link>))}
    </nav>
  );
}
```

`src/components/ActivityTable.tsx`:

```tsx
import type { Activity } from "@/lib/domain/activities";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { n } from "@/lib/dashboard/story";

const when = (a: Activity) => {
  const d = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const t = new Date(a.from).toISOString().slice(11, 16);
  return a.from.slice(0, 10) === a.to.slice(0, 10) ? `${d(a.from)}, ${t}` : `${d(a.from)} to ${d(a.to)}`;
};
const SHORT: Record<string, string> = { booked: "booked", nomeet: "no meeting yet", unused: "never used", unknown: "can't tell yet", waste: "wasted" };

export function ActivityTable({ rows }: { rows: Activity[] }) {
  if (!rows.length) return <p className="small">No charges match this filter.</p>;
  return (
    <div className="table-wrap"><table className="acts-table">
      <thead><tr><th>When</th><th>What it paid for</th><th className="num">Credits</th><th>What it bought</th><th>How we know</th></tr></thead>
      {rows.map((a) => {
        const parts = BUCKETS.filter((b) => a.buckets[b] > 0);
        return (
          <tbody key={a.key}>
            <tr>
              <td>{when(a)}</td>
              <td className="what"><b>{a.title}</b>{a.detail ? `, ${a.detail}` : ""}<small>{a.charges} {a.charges === 1 ? "charge" : "charges"}</small>
                {parts.length > 1 && <span className="mini" aria-hidden="true">{parts.map((b) => <span key={b} style={{ flex: a.buckets[b], background: `var(--${b})` }} />)}</span>}
                {a.children.length > 0 && (
                  <details><summary>{a.children.length} jobs</summary>
                    <ul>{a.children.map((k) => <li key={k.key}><span>{k.label}</span><b>{n(k.credits)}</b><span className="small">{k.result}</span></li>)}</ul>
                  </details>)}
              </td>
              <td className="num">{n(a.credits)}</td>
              <td>{a.result ? <span><i className="dot" style={{ background: `var(--${parts[0]})` }} /> {a.result}</span>
                : <ul className="split">{parts.map((b) => <li key={b}><i className="dot" style={{ background: `var(--${b})` }} />{n(a.buckets[b])} {SHORT[b]}</li>)}</ul>}
                <span className="sr-only">{parts.map((b) => `${BUCKET_LABEL[b]} ${n(a.buckets[b])}`).join("; ")}</span></td>
              <td>{a.how}</td>
            </tr>
          </tbody>);
      })}
    </table></div>
  );
}
```

- [ ] **Step 6: Rewrite the Charges page**

`src/app/(dash)/charges/page.tsx`:

```tsx
import Link from "next/link";
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { groupActivities } from "@/lib/domain/activities";
import { bucketTotals } from "@/lib/domain/buckets";
import { serviceName } from "@/lib/domain/names";
import { applyChargeFilter, filterHref, parseChargeFilter } from "@/lib/dashboard/filters";
import { chargesHeadline } from "@/lib/dashboard/story";
import { Headline } from "@/components/Headline";
import { OutcomeChips } from "@/components/OutcomeChips";
import { ActivityTable } from "@/components/ActivityTable";

type SP = Record<string, string | string[] | undefined>;
export default async function ChargesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period), pq = period === "30d" ? "period=30d" : "";
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const f = parseChargeFilter(sp);
  const scoped = applyChargeFilter(v.charges, { ...f, outcome: null }, v.bucketOf);
  const shown = applyChargeFilter(v.charges, f, v.bucketOf);
  const lists = [...new Set(v.charges.map((c) => c.listId).filter((x): x is number => x !== null))];
  const label = [f.list ? (f.list === "none" ? "Not tied to a list" : f.list === "other" ? "Other lists" : d.listNames.get(f.list) ?? `List ${f.list}`) : null,
    f.service ? serviceName(f.service) : null].filter(Boolean).join(", ");
  return (
    <>
      <Headline text={chargesHeadline({ traced: v.coverage.exact, total: v.coverage.total, periodLabel: PERIOD_LABEL[period] })}
        lede="graph8's ledger records only a service, an amount and a time. Each line here is matched to the work it paid for and to what that work led to." />
      <div className="filters">
        <OutcomeChips f={f} totals={bucketTotals(scoped, v.bucketCtx)} all={scoped.reduce((s, c) => s + c.credits, 0)} periodQuery={pq} />
        <nav className="list-filter" aria-label="Filter by list">
          <Link href={filterHref(f, { list: null }, pq)} aria-current={!f.list ? "true" : undefined}>All lists</Link>
          {lists.map((id) => <Link key={id} href={filterHref(f, { list: String(id) }, pq)} aria-current={f.list === String(id) ? "true" : undefined}>{d.listNames.get(String(id)) ?? `List ${id}`}</Link>)}
        </nav>
        {label && <p className="small">Showing {label}. <Link href={filterHref({ outcome: f.outcome, list: null, service: null }, {}, pq)}>Clear</Link></p>}
      </div>
      <section className="panel"><ActivityTable rows={groupActivities(shown, d.runs, v.bucketOf, d.listNames)} /></section>
    </>
  );
}
```

Delete `src/components/ChargesTable.tsx` and `src/components/CoverageBar.tsx`.

- [ ] **Step 7: Styles**

Append to `src/app/globals.css`:

```css
/* charges */
.filters{display:grid;gap:10px;margin-top:18px}
.chips,.list-filter{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chip{font:500 13px var(--f-body);border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:4px 12px;color:var(--ink);text-decoration:none;display:inline-flex;gap:6px;align-items:center}
.chip[aria-current="true"]{box-shadow:inset 0 0 0 1.5px var(--ink);border-color:var(--ink)}
.list-filter a{font-size:13px;color:var(--ink-2);text-decoration:none;padding:2px 8px;border-radius:6px}
.list-filter a[aria-current="true"]{background:var(--panel);box-shadow:inset 0 0 0 1px var(--line);color:var(--ink)}
.acts-table td{padding:12px 10px}
.acts-table .what b{font-weight:600}
.mini{display:flex;height:6px;width:200px;max-width:100%;border-radius:3px;overflow:hidden;margin-top:6px}
.split{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.acts-table details{margin-top:6px}.acts-table summary{cursor:pointer;font-size:12.5px;color:var(--ink-2)}
.acts-table details ul{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}
.acts-table details li{display:grid;grid-template-columns:1fr 50px 140px;gap:8px;font-size:13px;background:var(--panel-2);padding:4px 8px;border-radius:5px}
.acts-table details li b{text-align:right;font-variant-numeric:tabular-nums}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
```

- [ ] **Step 8: Verify, screenshot, compare**

Run: `npx vitest run && npm run typecheck && npm run build` → PASS.
Screenshots: `npm run shots -- /charges "/charges?outcome=waste" "/charges?list=none" "/charges?period=30d"`. Compare with the Charges screen of the prototype: headline with the traced percentage, chips with totals, list filter, grouped rows (the three email-finding lists as single rows with mini bars; AI enrichment with "3 jobs" expandable; onboarding research "Never used"), no all-caps headers. On Overview, click a flow band: it opens this page with the matching filter.

- [ ] **Step 9: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests/dashboard
git commit -m "feat(advisor): Charges grouped into activities with outcome chips and flow filters"
```

---
### Task 6: Recovery (weekly chart, owner columns, timeline, refund claim) and the `roi_action` store

Spec §5.4, §4.6 (owners). Recovery items are derived from waste charges directly (each has an owner); the Overview keeps using findings.

**Files:**
- Modify: `src/lib/domain/types.ts`, `src/lib/store/schema.ts`, `src/lib/store/mappers.ts`, `src/lib/dashboard/data.ts`, `src/lib/dashboard/story.ts`, `src/app/(dash)/recovery/page.tsx` (rewrite), `src/app/(dash)/recovery/actions.ts`, `src/app/globals.css`
- Create: `src/lib/dashboard/recovery.ts`, `src/components/WeeklyBars.tsx`, `src/components/OwnerColumns.tsx`, `src/components/Timeline.tsx`, `src/components/ClaimTracker.tsx`, `src/app/(dash)/recovery/RefundForm.tsx`
- Delete: `src/app/(dash)/recovery/SendRefund.tsx`, `src/lib/recovery/refund.ts` and `tests/recovery/refund.test.ts` (replaced by `refundDraftFor`)
- Test: `tests/dashboard/recovery.test.ts`, `tests/store/mappers.test.ts` (add), `tests/dashboard/story.test.ts` (add)

**Interfaces:**
- Consumes: `serviceName`, `isOnboardingResearch` (Task 1), `n`, `plural` (Task 4), `RecordStore`.
- Produces:
  - `type ActionKind = "repeat_skip" | "lookalike" | "pause_list" | "guardrail" | "refund_request"`; `interface ActionRecord { extId; kind; listId: number | null; pipelineId: string | null; appliedAt: string; status: "applied" | "undone" | "requested" | "refunded"; previous: unknown; detail: Record<string, unknown>; simulated: boolean }` (Task 9 uses it)
  - `actionToValues`, `valuesToAction`; object `roi_action`; `DashboardData.actions: ActionRecord[]`
  - `weeklySpend(charges, now, weeks = 8): WeekBar[]` (`{ start; label; credits; waste }`), `recoveryItems(charges, runs, ctx): RecoveryItem[]` (`{ id; owner: "refund" | "stopped" | "stoppable" | "usable"; title; detail; credits; at; ledgerIds; runIds }`), `refundDraftFor(items, orgId): string`, `claimState(actions, found): { found; requested; refunded; open: ActionRecord | null }`, `recoveryHeadline`, `recoveryLede`

- [ ] **Step 1: Add the action type, object and mappers (test first)**

Add to `tests/store/mappers.test.ts`:

```ts
import { actionToValues, valuesToAction } from "@/lib/store/mappers";
import type { ActionRecord } from "@/lib/domain/types";
describe("action mappers", () => {
  it("round-trips an action record", () => {
    const a: ActionRecord = { extId: "repeat_skip:15", kind: "repeat_skip", listId: 15, pipelineId: "p1", appliedAt: "2026-09-27T10:00:00Z", status: "applied",
      previous: { enabled: true, steps: [] }, detail: { credits: 300 }, simulated: false };
    expect(valuesToAction(actionToValues(a))).toEqual(a);
  });
});
```

Run: `npx vitest run tests/store/mappers.test.ts` → FAIL (missing exports).

Append to `src/lib/domain/types.ts`:

```ts
export type ActionKind = "repeat_skip" | "lookalike" | "pause_list" | "guardrail" | "refund_request";
export interface ActionRecord {
  extId: string; kind: ActionKind; listId: number | null; pipelineId: string | null; appliedAt: string;
  status: "applied" | "undone" | "requested" | "refunded"; previous: unknown; detail: Record<string, unknown>; simulated: boolean;
}
```

Append to `OBJECTS` in `src/lib/store/schema.ts`:

```ts
  { slug: "roi_action", singular: "ROI action", plural: "ROI actions", attributes: [...common,
    t("kind", "select"), t("list_id", "number"), t("pipeline_id"), t("applied_at", "timestamp"), t("status", "select"), t("previous"), t("detail")] },
```

Append to `src/lib/store/mappers.ts` (and add `ActionRecord` to the type import):

```ts
export function actionToValues(a: ActionRecord): V {
  return { ext_id: a.extId, simulated: a.simulated, kind: a.kind, list_id: a.listId, pipeline_id: a.pipelineId, applied_at: a.appliedAt, status: a.status,
    previous: JSON.stringify(a.previous ?? null), detail: JSON.stringify(a.detail ?? {}) };
}
export function valuesToAction(v: V): ActionRecord {
  return { extId: String(v.ext_id), kind: v.kind as ActionRecord["kind"], listId: num(v.list_id), pipelineId: s(v.pipeline_id), appliedAt: String(v.applied_at),
    status: v.status as ActionRecord["status"], previous: json<unknown>(v.previous, null), detail: json<Record<string, unknown>>(v.detail, {}), simulated: bool(v.simulated) };
}
```

In `src/lib/dashboard/data.ts`: add `"roi_action"` to the loaded slugs, `actions: ActionRecord[]` to `DashboardData`, and `actions: ac.map((r) => valuesToAction(r.values))` to the result (destructure `const [ch, oc, st, fi, ru, ac] = …`).

Add `actions: [],` to the `DashboardData` literal in `tests/mcp/tools.test.ts`.

Run: `npx vitest run tests/store/mappers.test.ts && npm run typecheck` → PASS, clean.

- [ ] **Step 2: Create the `roi_action` object in the org**

This is a planned schema change (0 credits):

```bash
cd advisor && npm run script -- scripts/bootstrap.ts
```

Expected: JSON with `"createdObjects":["roi_action"]` and its attributes (no other objects created). The FakeG8 in `tests/dashboard/data.test.ts` creates it through `ensureSchema`, so that test keeps passing.

- [ ] **Step 3: Write the failing tests for recovery**

`tests/dashboard/recovery.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { weeklySpend, recoveryItems, refundDraftFor, claimState } from "@/lib/dashboard/recovery";
import { recoveryHeadline, recoveryLede } from "@/lib/dashboard/story";
import type { ActionRecord, AttributedCharge, Run } from "@/lib/domain/types";

const c = (id: string, at: string, p: Partial<AttributedCharge> = {}): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits: 10, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: null, contactId: null,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const charges = [
  c("w1", "2026-08-05T10:00:00Z", { credits: 500 }),
  c("f1", "2026-09-26T14:34:00Z", { service: "ai_enrichment", credits: 50, isWaste: true, wasteReason: "failed_job", runExtId: "fd26115a-1", result: "failed" }),
  c("f2", "2026-09-26T14:36:00Z", { service: "ai_enrichment", credits: 27, isWaste: true, wasteReason: "failed_job", runExtId: "4a3c811e-2", result: "failed" }),
  c("u1", "2026-09-26T14:09:00Z", { credits: 14, isWaste: true, wasteReason: "no_change", runExtId: "lm-1", result: "unreadable" }),
  c("s1", "2026-09-26T15:40:00Z", { service: "studio_copilot", credits: 24, isWaste: true, wasteReason: "agent_side_effect", method: "time_window", result: "side_effect" }),
  c("o1", "2026-09-26T09:11:00Z", { service: "studio_global", credits: 860, method: "time_window", result: "unknown" }),
];
const runs: Run[] = [
  { extId: "fd26115a-1", kind: "ai_enrichment_job", actionName: "AI enrichment", startedAt: null, completedAt: null, status: "failed", source: "poll", recordsOk: 0, recordsFailed: 10 },
  { extId: "4a3c811e-2", kind: "ai_enrichment_job", actionName: "AI enrichment", startedAt: null, completedAt: null, status: "failed", source: "poll", recordsOk: 0, recordsFailed: 1 },
];
const ctx = { onboardingUnused: true, unusedDocs: 23, advisorPosts: ["2026-09-26T20:57:37Z"] };

describe("weeklySpend", () => {
  it("returns 8 weeks oldest first with waste split out", () => {
    const w = weeklySpend(charges, "2026-09-27T12:00:00Z");
    expect(w).toHaveLength(8);
    expect(w[7]).toMatchObject({ credits: 975, waste: 115 });
    expect(w[0].credits + w[1].credits).toBe(500);
    expect(w.slice(0, 7).every((x) => x.waste === 0)).toBe(true);
  });
});

describe("recoveryItems", () => {
  const items = recoveryItems(charges, runs, ctx);
  it("gives every wasted or unused credit an owner", () => {
    expect(items.map((x) => [x.owner, x.credits])).toEqual([["usable", 860], ["refund", 14], ["refund", 77], ["stopped", 24]]);
    expect(items.find((x) => x.credits === 77)!.title).toBe("AI enrichment failed on 11 of 11 records and was still charged");
  });
  it("calls a side effect stopped only when a later automated post cost nothing", () => {
    expect(recoveryItems(charges, runs, { ...ctx, advisorPosts: [] }).find((x) => x.credits === 24)!.owner).toBe("stoppable");
  });
  it("writes a refund request from the refundable items", () => {
    const text = refundDraftFor(items.filter((x) => x.owner === "refund"), "org_x");
    expect(text).toContain("We were charged 91 credits for work that produced nothing usable:");
    expect(text).toContain("- AI enrichment failed on 11 of 11 records and was still charged: 77 credits (jobs fd26115a, 4a3c811e; Sep 26).");
    expect(text).toContain("Please refund the 91 credits. Org: org_x.");
  });
});

describe("claimState", () => {
  const a = (status: ActionRecord["status"], credits: number): ActionRecord => ({ extId: `refund:${status}`, kind: "refund_request", listId: null, pipelineId: null,
    appliedAt: "2026-09-27T00:00:00Z", status, previous: null, detail: { credits }, simulated: false });
  it("moves from found to requested to refunded", () => {
    expect(claimState([], 91)).toMatchObject({ found: 91, requested: 0, refunded: 0 });
    expect(claimState([a("requested", 91)], 91)).toMatchObject({ requested: 91, refunded: 0 });
    expect(claimState([a("refunded", 91)], 91)).toMatchObject({ requested: 91, refunded: 91 });
  });
});

describe("Recovery sentences", () => {
  it("states waste and what graph8 owes", () => expect(recoveryHeadline({ waste: 115, refundable: 91, periodLabel: "the last 8 weeks" })).toBe("115 credits bought nothing. graph8 owes you 91 of them."));
  it("handles no waste", () => expect(recoveryHeadline({ waste: 0, refundable: 0, periodLabel: "the last 30 days" })).toBe("Nothing was wasted in the last 30 days."));
  it("says when it happened", () => {
    expect(recoveryLede(["2026-09-26T14:34:00Z", "2026-09-26T15:40:00Z"])).toBe("All of it on Sep 26. Click a week to see what happened in it.");
    expect(recoveryLede(["2026-09-20T00:00:00Z", "2026-09-26T00:00:00Z"])).toBe("Spread over 2 days, Sep 20 to Sep 26. Click a week to see what happened in it.");
    expect(recoveryLede([])).toBeNull();
  });
});
```

Run: `npx vitest run tests/dashboard/recovery.test.ts` → FAIL (missing module).

- [ ] **Step 4: Implement `src/lib/dashboard/recovery.ts` and the sentences**

```ts
import type { ActionRecord, AttributedCharge, Run } from "../domain/types";
import { isOnboardingResearch } from "../domain/buckets";
import { serviceName } from "../domain/names";
import { toMs } from "../domain/time";
import { n, plural } from "./story";

const DAY = 86_400_000, WEEK = 7 * DAY;
export const shortDate = (t: number | string) => new Date(typeof t === "string" ? toMs(t) : t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export interface WeekBar { start: string; label: string; credits: number; waste: number }
export function weeklySpend(charges: AttributedCharge[], now: string, weeks = 8): WeekBar[] {
  const end = toMs(now), start = end - weeks * WEEK;
  const bars = Array.from({ length: weeks }, (_, i) => ({ start: new Date(start + i * WEEK).toISOString(), label: shortDate(start + i * WEEK), credits: 0, waste: 0 }));
  for (const c of charges) {
    const i = Math.floor((toMs(c.chargedAt) - start) / WEEK);
    if (i < 0 || i >= weeks) continue;
    bars[i].credits += c.credits;
    if (c.isWaste) bars[i].waste += c.credits;
  }
  return bars;
}

export interface RecoveryItem { id: string; owner: "refund" | "stopped" | "stoppable" | "usable"; title: string; detail: string; credits: number; at: string; ledgerIds: string[]; runIds: string[] }

export function recoveryItems(charges: AttributedCharge[], runs: Run[], ctx: { onboardingUnused: boolean; unusedDocs: number; advisorPosts: string[] }): RecoveryItem[] {
  const runMap = new Map(runs.map((r) => [r.extId, r]));
  const sum = (xs: AttributedCharge[]) => xs.reduce((s, c) => s + c.credits, 0);
  const first = (xs: AttributedCharge[]) => [...xs].sort((a, b) => toMs(a.chargedAt) - toMs(b.chargedAt))[0].chargedAt;
  const ids = (xs: AttributedCharge[]) => [...new Set(xs.map((c) => c.runExtId).filter((x): x is string => !!x))];
  const items: RecoveryItem[] = [];
  const bySvc = (reason: string) => { const m = new Map<string, AttributedCharge[]>(); for (const c of charges.filter((x) => x.wasteReason === reason)) m.set(c.service, [...(m.get(c.service) ?? []), c]); return m; };
  for (const [svc, xs] of bySvc("failed_job")) {
    const rs = ids(xs).map((id) => runMap.get(id)).filter((r): r is Run => !!r);
    const failed = rs.reduce((s, r) => s + (r.recordsFailed ?? 0), 0), total = rs.reduce((s, r) => s + (r.recordsFailed ?? 0) + (r.recordsOk ?? 0), 0);
    items.push({ id: `failed:${svc}`, owner: "refund", credits: sum(xs), at: first(xs), ledgerIds: xs.map((c) => c.ledgerId), runIds: ids(xs),
      title: total ? `${serviceName(svc)} failed on ${failed} of ${total} records and was still charged` : `${serviceName(svc)} jobs failed and were still charged`,
      detail: `${plural(ids(xs).length, "job")}, ${plural(xs.length, "ledger line")}` });
  }
  for (const [svc, xs] of bySvc("no_change")) items.push({ id: `unreadable:${svc}`, owner: "refund", credits: sum(xs), at: first(xs), ledgerIds: xs.map((c) => c.ledgerId),
    runIds: ids(xs), title: `${serviceName(svc)} returned a result graph8 can't read back`, detail: `${plural(xs.length, "ledger line")}` });
  const side = charges.filter((c) => c.wasteReason === "agent_side_effect");
  if (side.length) {
    const last = Math.max(...side.map((c) => toMs(c.chargedAt)));
    const stopped = ctx.advisorPosts.some((p) => toMs(p) > last + 60_000);
    items.push({ id: "side_effect", owner: stopped ? "stopped" : "stoppable", credits: sum(side), at: first(side), ledgerIds: side.map((c) => c.ledgerId), runIds: [],
      title: "Automated posts woke graph8's agent", detail: stopped ? "Recaps now post to #roi-advisor, which has no agent. No charges since." : "Post recaps only to #roi-advisor to stop this." });
  }
  const onboarding = charges.filter(isOnboardingResearch);
  if (ctx.onboardingUnused && onboarding.length) items.push({ id: "unused", owner: "usable", credits: sum(onboarding), at: first(onboarding), ledgerIds: onboarding.map((c) => c.ledgerId),
    runIds: [], title: `${plural(ctx.unusedDocs, "onboarding document")} nobody has used`, detail: "Not refundable. Paid for and still available in graph8." });
  return items.sort((a, b) => toMs(a.at) - toMs(b.at));
}

export function refundDraftFor(items: RecoveryItem[], orgId: string): string {
  const total = items.reduce((s, x) => s + x.credits, 0);
  const lines = items.map((x) => `- ${x.title}: ${n(x.credits)} credits (${x.runIds.length ? `${x.runIds.length === 1 ? "job" : "jobs"} ${x.runIds.map((id) => id.slice(0, 8)).join(", ")}; ` : ""}${shortDate(x.at)}).`);
  return ["Hello graph8 support,", "", `We were charged ${n(total)} credits for work that produced nothing usable:`, ...lines, "", `Please refund the ${n(total)} credits. Org: ${orgId}.`].join("\n");
}

export function claimState(actions: ActionRecord[], found: number) {
  const open = actions.filter((a) => a.kind === "refund_request" && a.status !== "undone").sort((a, b) => toMs(b.appliedAt) - toMs(a.appliedAt))[0] ?? null;
  const credits = open ? Number(open.detail.credits ?? 0) : 0;
  return { found, requested: open ? credits : 0, refunded: open?.status === "refunded" ? credits : 0, open };
}
```

Append to `src/lib/dashboard/story.ts`:

```ts
export function recoveryHeadline(p: { waste: number; refundable: number; periodLabel: string }): string {
  if (p.waste <= 0) return `Nothing was wasted in ${p.periodLabel}.`;
  return p.refundable > 0 ? `${n(p.waste)} credits bought nothing. graph8 owes you ${n(p.refundable)} of them.` : `${n(p.waste)} credits bought nothing.`;
}

export function recoveryLede(wasteTimes: string[]): string | null {
  if (!wasteTimes.length) return null;
  const day = (iso: string) => iso.slice(0, 10);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const days = [...new Set(wasteTimes.map(day))].sort();
  const when = days.length === 1 ? `All of it on ${fmt(days[0])}.` : `Spread over ${days.length} days, ${fmt(days[0])} to ${fmt(days.at(-1)!)}.`;
  return `${when} Click a week to see what happened in it.`;
}
```

Run: `npx vitest run tests/dashboard/recovery.test.ts` → PASS. (The order `usable 860, refund 14, refund 77, stopped 24` follows time: 09:11, 14:09, 14:34, 15:40.)

- [ ] **Step 5: Record refund requests and "Mark as refunded"**

Replace `src/app/(dash)/recovery/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";
import { currentCaller } from "@/lib/workspace/current";
import { RecordStore } from "@/lib/store/records";
import { actionToValues } from "@/lib/store/mappers";

export async function sendRefund(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm you've read the message." };
  const message = String(form.get("message") ?? ""), credits = Number(form.get("credits") ?? 0);
  if (message.length < 40) return { ok: false, message: "The message is empty. Tick at least one item." };
  const c = await currentCaller();
  await c.call(OPS.contactSupport, { body: { message, urgency: "normal" } });
  const at = new Date().toISOString();
  await new RecordStore(c, "roi_action").upsert(actionToValues({ extId: `refund:${at}`, kind: "refund_request", listId: null, pipelineId: null, appliedAt: at,
    status: "requested", previous: null, detail: { credits, message }, simulated: false }));
  revalidatePath("/recovery");
  return { ok: true, message: "Sent to graph8 support." };
}

export async function markRefunded(form: FormData): Promise<void> {
  if (!(await isAuthed())) throw new Error("Sign in first.");
  const c = await currentCaller(), ext = String(form.get("extId") ?? "");
  const store = new RecordStore(c, "roi_action");
  const rec = (await store.list()).find((r) => r.values.ext_id === ext);
  if (!rec) throw new Error("That refund request no longer exists.");
  await store.upsert({ ...rec.values, status: "refunded" });
  revalidatePath("/recovery");
}
```

**Do not send a refund request while testing.** The send path is covered by review only (Global Constraints).

- [ ] **Step 6: Add the components**

`src/components/WeeklyBars.tsx` (links, no client JS):

```tsx
import Link from "next/link";
import type { WeekBar } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";

export function WeeklyBars({ bars, selected, hrefFor }: { bars: WeekBar[]; selected: string | null; hrefFor: (start: string | null) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.credits));
  return (
    <div>
      <div className="bars" role="list">
        {bars.map((b) => {
          const on = selected === b.start.slice(0, 10);
          return (
            <Link role="listitem" key={b.start} href={hrefFor(on ? null : b.start.slice(0, 10))} aria-current={on ? "true" : undefined}
              className={`bar${selected && !on ? " dim" : ""}`} aria-label={`Week of ${b.label}: ${n(b.credits)} credits, ${n(b.waste)} wasted`}>
              {b.waste > 0 && <span className="wl">{n(b.waste)} wasted</span>}
              <span className="b waste" style={{ height: b.waste > 0 ? `${Math.max(8, (b.waste / max) * 140)}px` : 0 }} />
              <span className="b" style={{ height: `${((b.credits - b.waste) / max) * 140}px` }} />
            </Link>);
        })}
      </div>
      <div className="xl">{bars.map((b) => <span key={b.start}>{b.label}</span>)}</div>
    </div>
  );
}
```

`src/components/OwnerColumns.tsx`:

```tsx
import Link from "next/link";
import type { RecoveryItem } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";

const COLS = [
  { key: "refund", title: "graph8 should refund", tone: "var(--waste)" },
  { key: "stopped", title: "Already stopped", tone: "var(--booked)", also: "stoppable" },
  { key: "usable", title: "Paid for, still usable", tone: "var(--unused)" },
] as const;

export function OwnerColumns({ items, dimmed }: { items: RecoveryItem[]; dimmed: Set<string> }) {
  return (
    <div className="owners">
      {COLS.map((col) => {
        const xs = items.filter((x) => x.owner === col.key || ("also" in col && x.owner === col.also));
        const total = xs.reduce((s, x) => s + x.credits, 0);
        const title = col.key === "stopped" && xs.some((x) => x.owner === "stoppable") ? "You can stop" : col.title;
        return (
          <section className="owner" key={col.key} style={{ borderTopColor: col.tone }}>
            <span className="small">{title}</span><div className="big">{n(total)}</div>
            {xs.length === 0 && <p className="small">Nothing here.</p>}
            {xs.map((x) => (<div key={x.id} className={`item${dimmed.has(x.id) ? " dim" : ""}`}><span>{x.title}<small>{x.detail}</small></span><b>{n(x.credits)}</b></div>))}
            {col.key === "refund" && total > 0 && <Link className="btn primary" href="#claim">Request a refund of {n(total)}</Link>}
          </section>);
      })}
    </div>
  );
}
```

`src/components/Timeline.tsx`:

```tsx
import type { RecoveryItem } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";
export function Timeline({ title, items }: { title: string; items: RecoveryItem[] }) {
  return (
    <section className="panel"><div className="ph"><h2>{title}</h2></div>
      {items.length === 0 ? <p className="small">No waste, nothing to recover.</p> :
        items.map((x) => (<div className="tl" key={x.id}><span className="small">{new Date(x.at).toISOString().slice(11, 16)}</span><span>{x.title}</span>
          <b className={x.owner === "usable" ? undefined : "bad"}>{n(x.credits)}</b></div>))}
    </section>
  );
}
```

`src/components/ClaimTracker.tsx`:

```tsx
import { n } from "@/lib/dashboard/story";
export function ClaimTracker({ found, requested, refunded }: { found: number; requested: number; refunded: number }) {
  const step = refunded > 0 ? 2 : requested > 0 ? 1 : 0;
  return (
    <ol className="tracker" aria-label="Refund claim progress">
      {[["Found", found], ["Requested", requested], ["Refunded", refunded]].map(([label, v], i) => (
        <li key={label as string} aria-current={i === step ? "step" : undefined}><span className="small">{label}</span><b>{n(v as number)}</b></li>))}
    </ol>
  );
}
```

`src/app/(dash)/recovery/RefundForm.tsx`:

```tsx
"use client";
import { useActionState, useMemo, useState } from "react";
import { sendRefund } from "./actions";

export function RefundForm({ items, orgId, draftFor }: { items: { id: string; title: string; credits: number; line: string }[]; orgId: string; draftFor: string }) {
  const [picked, setPicked] = useState(() => new Set(items.map((x) => x.id)));
  const chosen = items.filter((x) => picked.has(x.id));
  const total = chosen.reduce((s, x) => s + x.credits, 0);
  const draft = useMemo(() => ["Hello graph8 support,", "", `We were charged ${Math.round(total).toLocaleString("en-US")} credits for work that produced nothing usable:`,
    ...chosen.map((x) => x.line), "", `Please refund the ${Math.round(total).toLocaleString("en-US")} credits. Org: ${orgId}.`].join("\n"), [chosen, total, orgId]);
  const [state, action, pending] = useActionState(sendRefund, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="refund">
      <fieldset><legend className="small">Include</legend>
        {items.map((x) => (<label key={x.id}><input type="checkbox" checked={picked.has(x.id)} onChange={() => setPicked((s) => { const t = new Set(s); if (t.has(x.id)) t.delete(x.id); else t.add(x.id); return t; })} /> {x.title} ({x.credits})</label>))}
      </fieldset>
      <label htmlFor="refund-text" className="small">Message to graph8 support</label>
      <textarea id="refund-text" name="message" key={draft} defaultValue={draft} data-draft-for={draftFor} />
      <input type="hidden" name="credits" value={total} />
      <div className="foot">
        <button type="button" className="btn ghost" onClick={async () => { await navigator.clipboard.writeText((document.getElementById("refund-text") as HTMLTextAreaElement).value); setCopied(true); }}>{copied ? "Copied" : "Copy text"}</button>
        <label><input type="checkbox" name="confirm" value="yes" /> I've read this and want to send it</label>
        <button className="btn primary" type="submit" disabled={pending || total === 0}>{pending ? "Sending…" : "Send to graph8 support"}</button>
        {state && <span className="toast" role="status">{state.message}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Rewrite the Recovery page**

`src/app/(dash)/recovery/page.tsx`:

```tsx
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { toMs } from "@/lib/domain/time";
import { weeklySpend, recoveryItems, claimState, refundDraftFor, shortDate } from "@/lib/dashboard/recovery";
import { recoveryHeadline, recoveryLede } from "@/lib/dashboard/story";
import { Headline } from "@/components/Headline";
import { WeeklyBars } from "@/components/WeeklyBars";
import { OwnerColumns } from "@/components/OwnerColumns";
import { Timeline } from "@/components/Timeline";
import { ClaimTracker } from "@/components/ClaimTracker";
import { RefundForm } from "./RefundForm";
import { markRefunded } from "./actions";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ period?: string; week?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period), pq = period === "30d" ? "period=30d" : "";
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const unused = d.findings.find((f) => f.kind === "unused" && f.status !== "applied");
  const items = recoveryItems(v.charges, d.runs, { onboardingUnused: v.bucketCtx.onboardingUnused, unusedDocs: Number(unused?.evidence.documents ?? 0),
    advisorPosts: d.runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!) });
  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : null;
  const inWeek = (iso: string) => !week || (toMs(iso) >= toMs(`${week}T00:00:00Z`) && toMs(iso) < toMs(`${week}T00:00:00Z`) + 7 * 86_400_000);
  const shown = items.filter((x) => inWeek(x.at));
  const refundable = items.filter((x) => x.owner === "refund");
  const claim = claimState(d.actions, refundable.reduce((s, x) => s + x.credits, 0));
  const wasteTimes = v.charges.filter((c) => c.isWaste).map((c) => c.chargedAt);
  const hrefFor = (w: string | null) => `/recovery${[w ? `week=${w}` : "", pq].filter(Boolean).length ? `?${[w ? `week=${w}` : "", pq].filter(Boolean).join("&")}` : ""}`;
  return (
    <>
      <Headline text={recoveryHeadline({ waste: v.waste, refundable: claim.found, periodLabel: PERIOD_LABEL[period] })} lede={recoveryLede(wasteTimes)} />
      <section className="panel">
        <div className="ph"><h2>Credits by week, wasted in red</h2>{week && <a className="chip" href={hrefFor(null)}>Show all weeks</a>}</div>
        <WeeklyBars bars={weeklySpend(v.charges, d.now, period === "30d" ? 5 : 8)} selected={week} hrefFor={hrefFor} />
      </section>
      <OwnerColumns items={items} dimmed={new Set(items.filter((x) => !inWeek(x.at)).map((x) => x.id))} />
      <div className="grid2">
        <Timeline title={week ? `What happened in the week of ${shortDate(`${week}T00:00:00Z`)}` : "What happened"} items={shown} />
        <section className="panel" id="claim">
          <div className="ph"><h2>Your refund claim</h2></div>
          <ClaimTracker found={claim.found} requested={claim.requested} refunded={claim.refunded} />
          {claim.open && claim.open.status === "requested" && (
            <form action={markRefunded}><input type="hidden" name="extId" value={claim.open.extId} /><button className="btn ghost" type="submit">Mark as refunded</button></form>)}
          {refundable.length > 0 && !claim.open && (
            <RefundForm orgId={process.env.G8_ORG_ID ?? ""} draftFor={refundable.map((x) => x.id).join(",")}
              items={refundable.map((x) => ({ id: x.id, title: x.title, credits: Math.round(x.credits), line: refundDraftFor([x], "").split("\n")[3] }))} />)}
        </section>
      </div>
    </>
  );
}
```

Delete `src/app/(dash)/recovery/SendRefund.tsx`, `src/lib/recovery/refund.ts` and `tests/recovery/refund.test.ts` (`grep -rn "buildRefundDraft\|SendRefund" src tests` → nothing).

- [ ] **Step 8: Styles**

Append to `src/app/globals.css`:

```css
/* recovery */
.bars{display:flex;align-items:flex-end;gap:10px;height:170px;padding:24px 4px 0}
.bars .bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;position:relative;text-decoration:none;border-radius:4px 4px 0 0}
.bars .b{display:block;background:var(--flow);border-radius:3px 3px 0 0}.bars .b.waste{background:var(--waste);border-radius:3px 3px 0 0}
.bars .bar[aria-current="true"]{outline:2px solid var(--ink);outline-offset:3px}
.bars .bar.dim{opacity:.4}
.bars .wl{position:absolute;top:-20px;left:-10px;right:-10px;text-align:center;font-size:12px;font-weight:600;color:var(--waste)}
.xl{display:flex;gap:10px;padding:6px 4px 0;font-size:12px;color:var(--muted)}.xl span{flex:1;text-align:center}
.owners{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media (max-width:760px){.owners{grid-template-columns:1fr}}
.owner{background:var(--panel);border:1px solid var(--line);border-top:4px solid;border-radius:10px;padding:16px 18px;display:grid;gap:6px;align-content:start}
.owner .big{font:700 30px var(--f-display);font-variant-numeric:tabular-nums}
.owner .item{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line-2);padding:8px 0;font-size:14px}
.owner .item small{display:block;color:var(--muted);font-size:12.5px}
.owner .item.dim{opacity:.35}
.tl{display:grid;grid-template-columns:52px 1fr 56px;gap:12px;border-top:1px solid var(--line-2);padding:10px 0;font-size:14px}
.tl:first-of-type{border-top:0}.tl b{text-align:right;font-variant-numeric:tabular-nums}.tl b.bad{color:var(--waste)}
.tracker{list-style:none;margin:0 0 12px;padding:0;display:flex;gap:10px}
.tracker li{flex:1;border:1px solid var(--line);border-radius:8px;padding:8px 12px}
.tracker li[aria-current="step"]{box-shadow:inset 0 0 0 1.5px var(--ink);border-color:var(--ink)}
.tracker b{display:block;font:700 20px var(--f-display)}
.refund{display:grid;gap:10px}.refund fieldset{border:0;padding:0;margin:0;display:grid;gap:4px;font-size:14px}
.refund textarea{width:100%;min-height:150px;border:1px solid var(--line);border-radius:8px;padding:12px;font:13.5px/1.55 var(--f-body);background:var(--panel);color:var(--ink);resize:vertical}
.refund .foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
```

Delete the old `.rcard`, `.draft*`, `.cards` rules from `globals.css`.

- [ ] **Step 9: Verify, screenshot, compare**

Run: `npx vitest run && npm run typecheck && npm run build` → PASS.
Screenshots: `npm run shots -- /recovery "/recovery?week=<the start date of the last bar>" "/recovery?period=30d"`. Compare with the prototype's Recovery screen: headline "115 credits bought nothing. graph8 owes you 91 of them." (numbers from the live store), lede "All of it on Sep 26.…", weekly bars with a red top and "115 wasted" label on the last week, three owner columns, the timeline, the tracker at "Found", the refund form with ticked items and Copy text. Selecting an earlier week dims the columns' items and shows "No waste, nothing to recover." **Do not press Send.**

- [ ] **Step 10: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests
git commit -m "feat(advisor): Recovery with weekly waste chart, owner columns, timeline and refund claim"
```

---
### Task 7: Fit fix and the contact cache

Spec §4.8. Use superpowers:systematic-debugging for Step 1: prove the cause before changing behaviour.

**Files:**
- Create: `src/lib/util/concurrency.ts`, `src/lib/domain/fit.ts`, `scripts/fit-diagnosis.ts`
- Modify: `src/lib/domain/types.ts`, `src/lib/store/schema.ts`, `src/lib/store/mappers.ts`, `src/lib/sync/contacts.ts`, `src/lib/sync/run-sync.ts`
- Test: `tests/util/concurrency.test.ts`, `tests/domain/fit.test.ts`, `tests/store/mappers.test.ts` (add), `tests/sync/run-sync.test.ts` (add)

**Interfaces:**
- Consumes: `ContactInfo`, `smoothedRate`, `classifyFit` (`prespend.ts`), `RecordStore`.
- Produces:
  - `mapLimit<T, R>(xs: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]>`
  - `type Fit = "high" | "medium" | "low" | "unknown"`, `type FitLevel = "segment" | "role" | "seniority" | "list" | "org"`, `rateTables(charges, outcomes, contacts): RateTables`, `classifyWithBackoff(info, tables, minN = 3): { fit: Fit; level: FitLevel | null }`
  - `interface ContactCacheRow { contactId; listIds: number[]; hasEmail: boolean; consistency: "ok" | "flagged" | "unknown"; segmentKey: string; fit: Fit; fitLevel: FitLevel | null; syncedAt: string }`, `contactToValues`, `valuesToContact`, object `roi_contact` (ext_id = `String(contactId)`)

- [ ] **Step 1: Prove the cause**

Add `mapLimit` first (the diagnosis loads 250 contacts):

`tests/util/concurrency.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapLimit } from "@/lib/util/concurrency";
describe("mapLimit", () => {
  it("keeps order and never runs more than the limit at once", async () => {
    let running = 0, peak = 0;
    const out = await mapLimit([5, 1, 3, 2, 4], 2, async (x) => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, x)); running--; return x * 10; });
    expect(out).toEqual([50, 10, 30, 20, 40]);
    expect(peak).toBe(2);
  });
});
```

`src/lib/util/concurrency.ts`:

```ts
export async function mapLimit<T, R>(xs: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let next = 0;
  const worker = async () => { while (next < xs.length) { const i = next++; out[i] = await fn(xs[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, xs.length) }, worker));
  return out;
}
```

Run: `npx vitest run tests/util/concurrency.test.ts` → PASS. Then in `src/lib/sync/contacts.ts` replace the sequential loop in `loadContactIndex`:

```ts
import { mapLimit } from "../util/concurrency";
// …
  const infos = await mapLimit(rows, 10, (row) => loadContactInfo(c, row));
  return new Map(infos.map((info) => [info.contactId, info]));
```

Now the diagnosis script `scripts/fit-diagnosis.ts` (read-only):

```ts
import { g8Caller as c } from "../src/lib/g8/client";
import { loadContactIndex } from "../src/lib/sync/contacts";
import { RecordStore } from "../src/lib/store/records";
import { valuesToStat } from "../src/lib/store/mappers";

const contacts = await loadContactIndex(c);
const seg = new Map<string, number>();
for (const info of contacts.values()) seg.set(info.segmentKey, (seg.get(info.segmentKey) ?? 0) + 1);
const sizes = [...seg.values()];
const stats = (await new RecordStore(c, "roi_stat").list()).map((r) => valuesToStat(r.values)).filter((s) => s.dimension === "segment" && s.period === "8w");
console.log(JSON.stringify({ contacts: contacts.size, segments: seg.size, contactsInSegmentsOf3Plus: sizes.filter((x) => x >= 3).reduce((a, b) => a + b, 0),
  segmentStatsWithReach3Plus: stats.filter((s) => s.contactsReached >= 3).length, segmentStats: stats.length }));
```

Run: `cd advisor && npm run script -- scripts/fit-diagnosis.ts`
Expected (the hypothesis): `segments` is large relative to 250 and `segmentStatsWithReach3Plus` is 0 or near 0. **If instead many segments reach 3+, stop and re-investigate** (the cause is elsewhere; report back before changing code). Record the printed JSON in the task report.

- [ ] **Step 2: Write the failing fit tests**

`tests/domain/fit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rateTables, classifyWithBackoff } from "@/lib/domain/fit";
import { classifyFit } from "@/lib/domain/prespend";
import type { AttributedCharge, ContactInfo, Outcome } from "@/lib/domain/types";

const info = (id: number, seg: string, consistency: ContactInfo["consistency"] = "ok", lists = [2]): ContactInfo => ({ contactId: id, name: `c${id}`,
  email: `c${id}@x.com`, companyName: null, companyDomain: null, listIds: lists, sequenceIds: [], segmentKey: seg, consistency });
const charge = (contactId: number): AttributedCharge => ({ ledgerId: `l${contactId}`, ledgerType: "usage", service: "waterfall_enrichment", credits: 3,
  chargedAt: "2026-09-01T00:00:00Z", llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: 2, contactId,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: true });
const meeting = (contactId: number): Outcome => ({ extId: `m${contactId}`, type: "meeting_booked", occurredAt: "2026-09-10T00:00:00Z", contactId, companyId: null,
  dealId: null, amount: null, listId: 2, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });

// 12 contacts, every 4-part segment unique (the real org's shape): VPs in Sales book often, Individual Contributors never.
const contacts = new Map<number, ContactInfo>();
for (let i = 1; i <= 6; i++) contacts.set(i, info(i, `Vice President|Sales|Industry${i}|51-200`));
for (let i = 7; i <= 12; i++) contacts.set(i, info(i, `Individual Contributor|Engineering|Industry${i}|1-10`));
contacts.set(13, info(13, "Director|Sales|Other|51-200", "flagged"));
const charges = [...contacts.keys()].map(charge);
const outcomes = [1, 2, 3, 4].map(meeting);
const t = rateTables(charges, outcomes, contacts);

describe("fit", () => {
  it("reproduces the bug: with one contact per segment the old classifier says unknown for everyone not flagged", () => {
    const orgRate = 4 / 13;
    expect([...contacts.values()].filter((c) => c.consistency !== "flagged").map((c) => classifyFit({ rate: 0, orgRate, n: 1, consistency: c.consistency })))
      .toEqual(Array(12).fill("unknown"));
  });
  it("backs off to role when the segment is too small", () => {
    expect(classifyWithBackoff(contacts.get(1)!, t)).toEqual({ fit: "high", level: "role" });
    expect(classifyWithBackoff(contacts.get(7)!, t)).toEqual({ fit: "low", level: "role" });
  });
  it("keeps flagged records low whatever their group does", () => expect(classifyWithBackoff(contacts.get(13)!, t)).toEqual({ fit: "low", level: null }));
  it("falls back to the list, then says medium at org level, and unknown with no meetings anywhere", () => {
    const lone = info(99, "Director|Finance|X|1-10", "ok", [2]);
    expect(classifyWithBackoff(lone, t).level).toBe("list");
    const empty = rateTables(charges, [], contacts);
    expect(classifyWithBackoff(contacts.get(1)!, empty)).toEqual({ fit: "unknown", level: null });
  });
});
```

Run: `npx vitest run tests/domain/fit.test.ts` → FAIL (missing module). The first test passes against today's `classifyFit`, which documents the cause.

- [ ] **Step 3: Implement `src/lib/domain/fit.ts`**

```ts
import type { AttributedCharge, ContactInfo, Outcome } from "./types";
import { smoothedRate } from "./prespend";

export type Fit = "high" | "medium" | "low" | "unknown";
export type FitLevel = "segment" | "role" | "seniority" | "list" | "org";
export interface RateCell { reached: number; meetings: number }
export interface RateTables { segment: Map<string, RateCell>; role: Map<string, RateCell>; seniority: Map<string, RateCell>; list: Map<string, RateCell>; org: RateCell }

const role = (seg: string) => seg.split("|").slice(0, 2).join("|");
const seniority = (seg: string) => seg.split("|")[0];

export function rateTables(charges: AttributedCharge[], outcomes: Outcome[], contacts: Map<number, ContactInfo>): RateTables {
  const t: RateTables = { segment: new Map(), role: new Map(), seniority: new Map(), list: new Map(), org: { reached: 0, meetings: 0 } };
  const bump = (m: Map<string, RateCell>, k: string, f: keyof RateCell) => { const c = m.get(k) ?? { reached: 0, meetings: 0 }; c[f]++; m.set(k, c); };
  const reached = new Set(charges.map((c) => c.contactId).filter((x): x is number => x !== null && contacts.has(x)));
  const booked = new Map<number, number>();
  for (const o of outcomes) if (o.type === "meeting_booked" && o.contactId !== null && contacts.has(o.contactId)) booked.set(o.contactId, (booked.get(o.contactId) ?? 0) + 1);
  for (const id of reached) {
    const i = contacts.get(id)!;
    bump(t.segment, i.segmentKey, "reached"); bump(t.role, role(i.segmentKey), "reached"); bump(t.seniority, seniority(i.segmentKey), "reached");
    for (const l of i.listIds) bump(t.list, String(l), "reached");
    t.org.reached++;
  }
  for (const [id, k] of booked) {
    const i = contacts.get(id)!;
    for (let j = 0; j < k; j++) {
      bump(t.segment, i.segmentKey, "meetings"); bump(t.role, role(i.segmentKey), "meetings"); bump(t.seniority, seniority(i.segmentKey), "meetings");
      for (const l of i.listIds) bump(t.list, String(l), "meetings");
      t.org.meetings++;
    }
  }
  return t;
}

export function classifyWithBackoff(info: ContactInfo, t: RateTables, minN = 3): { fit: Fit; level: FitLevel | null } {
  if (info.consistency === "flagged") return { fit: "low", level: null };
  const orgRate = t.org.reached > 0 ? t.org.meetings / t.org.reached : 0;
  if (orgRate <= 0) return { fit: "unknown", level: null };
  const bestList = info.listIds.map((l) => t.list.get(String(l))).filter((c): c is RateCell => !!c).sort((a, b) => b.reached - a.reached)[0];
  const levels: [FitLevel, RateCell | undefined][] = [["segment", t.segment.get(info.segmentKey)], ["role", t.role.get(role(info.segmentKey))],
    ["seniority", t.seniority.get(seniority(info.segmentKey))], ["list", bestList]];
  for (const [level, cell] of levels) {
    if (!cell || cell.reached < minN) continue;
    const rate = smoothedRate(cell.meetings, cell.reached, orgRate);
    return { fit: rate >= 1.5 * orgRate ? "high" : rate <= 0.5 * orgRate ? "low" : "medium", level };
  }
  return { fit: "medium", level: "org" };
}
```

Run: `npx vitest run tests/domain/fit.test.ts` → PASS. (Role VP|Sales: 6 reached, 4 meetings; org rate 4/13; smoothed (4 + 5·0.31)/(6 + 5) ≈ 0.50 ≥ 1.5 × 0.31 → high. IC|Engineering: 0 meetings → (0 + 1.54)/11 ≈ 0.14 ≤ 0.15 → low.)

- [ ] **Step 4: The `roi_contact` object and mappers (test first)**

Add to `tests/store/mappers.test.ts`:

```ts
import { contactToValues, valuesToContact } from "@/lib/store/mappers";
import type { ContactCacheRow } from "@/lib/domain/types";
describe("contact cache mappers", () => {
  it("round-trips a cached contact", () => {
    const r: ContactCacheRow = { contactId: 66, listIds: [2, 13], hasEmail: true, consistency: "flagged", segmentKey: "a|b|c|d", fit: "low", fitLevel: null, syncedAt: "2026-09-27T00:00:00Z" };
    expect(valuesToContact(contactToValues(r))).toEqual(r);
    expect(contactToValues(r).ext_id).toBe("66");
  });
});
```

Append to `src/lib/domain/types.ts`:

```ts
export interface ContactCacheRow {
  contactId: number; listIds: number[]; hasEmail: boolean; consistency: "ok" | "flagged" | "unknown"; segmentKey: string;
  fit: "high" | "medium" | "low" | "unknown"; fitLevel: "segment" | "role" | "seniority" | "list" | "org" | null; syncedAt: string;
}
```

Append to `OBJECTS` in `schema.ts`:

```ts
  { slug: "roi_contact", singular: "ROI contact", plural: "ROI contacts", attributes: [...common,
    t("contact_id", "number"), t("list_ids"), t("has_email", "checkbox"), t("consistency", "select"), t("segment_key"), t("fit", "select"), t("fit_level", "select"), t("synced_at", "timestamp")] },
```

Append to `mappers.ts` (import `ContactCacheRow`):

```ts
export function contactToValues(r: ContactCacheRow): V {
  return { ext_id: String(r.contactId), simulated: false, contact_id: r.contactId, list_ids: JSON.stringify(r.listIds), has_email: r.hasEmail, consistency: r.consistency,
    segment_key: r.segmentKey, fit: r.fit, fit_level: r.fitLevel, synced_at: r.syncedAt };
}
export function valuesToContact(v: V): ContactCacheRow {
  return { contactId: Number(v.contact_id), listIds: json<number[]>(v.list_ids, []), hasEmail: bool(v.has_email), consistency: v.consistency as ContactCacheRow["consistency"],
    segmentKey: String(v.segment_key ?? ""), fit: v.fit as ContactCacheRow["fit"], fitLevel: (s(v.fit_level) as ContactCacheRow["fitLevel"]), syncedAt: String(v.synced_at) };
}
```

Run: `npx vitest run tests/store/mappers.test.ts` → PASS.

Create the object in the org (planned, 0 credits): `npm run script -- scripts/bootstrap.ts` → expect `"createdObjects":["roi_contact"]`.

- [ ] **Step 5: Write fits into the cache during sync (test first)**

Add to `tests/sync/run-sync.test.ts` (it reuses the file's `designDayClient()` helper):

```ts
  it("caches each contact's fit and only rewrites contacts that changed", async () => {
    const g = await designDayClient();
    const mk = (id: number, consistency: "ok" | "flagged" | "unknown") => ({ contactId: id, name: `c${id}`, email: consistency === "unknown" ? null : `c${id}@x.com`,
      companyName: null, companyDomain: null, listIds: [13], sequenceIds: [], segmentKey: "Vice President|Sales|Software|51-200", consistency });
    const contacts = new Map([[66, mk(66, "flagged")], [81, mk(81, "ok")], [249, mk(249, "unknown")]]);
    await runSync({ c: g, now: "2026-09-27T00:00:00Z", contacts });
    const rows = g.objects.get("roi_contact")!.records;
    expect(rows.length).toBe(contacts.size);
    expect(rows.every((r) => ["high", "medium", "low", "unknown"].includes(String(r.values.fit)))).toBe(true);
    const writes = () => g.calls.filter((x) => x.input.path?.object_slug === "roi_contact" && x.op !== "list_object_records_objects__object_slug__records_get").length;
    const before = writes();
    await runSync({ c: g, now: "2026-09-27T00:10:00Z", contacts });
    expect(writes()).toBe(before);
  });
```

Run it → FAIL (no `roi_contact` records).

In `src/lib/sync/run-sync.ts`, after the stats block, add:

```ts
    const tables = rateTables(charges, outcomes, contacts);
    const cache = new RecordStore(deps.c, "roi_contact");
    const cached = new Map((await cache.list()).map((r) => [String(r.values.ext_id), valuesToContact(r.values)]));
    for (const info of contacts.values()) {
      const { fit, level } = classifyWithBackoff(info, tables);
      const row = { contactId: info.contactId, listIds: info.listIds, hasEmail: !!info.email, consistency: info.consistency, segmentKey: info.segmentKey, fit, fitLevel: level, syncedAt: now };
      const prev = cached.get(String(info.contactId));
      const same = prev && JSON.stringify({ ...prev, syncedAt: "" }) === JSON.stringify({ ...row, syncedAt: "" });
      if (!same) await cache.upsert(contactToValues(row));
    }
```

(imports: `rateTables`, `classifyWithBackoff` from `../domain/fit`; `contactToValues`, `valuesToContact` from `../store/mappers`). `designDayClient()` calls `ensureSchema`, so `roi_contact` exists in the fake once it is in `OBJECTS`. Contact 66 must come out `low` (flagged); with no meetings in the design-day data, 81 and 249 come out `unknown`.

Run: `npx vitest run tests/sync` → PASS.

- [ ] **Step 6: Run a live sync and check the fit spread**

```bash
cd advisor && npm run script -- scripts/sync-once.ts
```

Then count the cache (read-only). Append to `scripts/fit-diagnosis.ts`:

```ts
const cached = await new RecordStore(c, "roi_contact").list().catch(() => []);
const byFit: Record<string, number> = {};
for (const r of cached) byFit[String(r.values.fit)] = (byFit[String(r.values.fit)] ?? 0) + 1;
console.log(JSON.stringify({ cachedContacts: cached.length, byFit }));
```

and run `npm run script -- scripts/fit-diagnosis.ts` again.

Expected: about 250 rows and **some `high` and `medium`**, plus `low` (the flagged records) and few `unknown`. Record the counts in the task report. Sync duration should drop well below the previous run (bounded concurrency).

- [ ] **Step 7: Full check and commit**

Run: `npx vitest run && npm run typecheck` → PASS, clean.

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests advisor/scripts/fit-diagnosis.ts
git commit -m "fix(advisor): fit backs off from sparse segments; cache fit per contact in roi_contact"
```

---
### Task 8: Optimize spend, part 1: the enrichment planner (read-only)

Spec §4.9, §5.5 ("Plan your next enrichment"). No credits are spent in this task; the run button exists but is not pressed.

**Cost-walk units (a deliberate refinement of the prototype):** graph8's quote is priced per contact at its own rate (2 per contact for "Verified emails") while the real price is the provider's (3 for LeadMagic email finding), so subtracting contact counts from graph8's quote can go negative. The walk therefore uses one unit throughout: *every contact × price*, minus *already done × price*, minus *skipped × price*, equals the *Advisor estimate*. graph8's own quote appears in the headline ("graph8 quotes 498 credits. It should cost about 36."). On today's Starter list: Verify emails 250 → −12 (no email) → −112 (unlikely) → 126; Find emails 750 → −714 (already have an email) → −0 → 36.

**Files:**
- Create: `src/lib/domain/planner.ts`, `src/lib/dashboard/planner-data.ts`, `src/components/Planner.tsx`, `src/components/CostWalk.tsx`, `src/components/ForecastBar.tsx`, `scripts/list-templates.ts`
- Modify: `src/lib/g8/ops.ts` (add `listPipelineTemplates`), `src/lib/dashboard/story.ts`, `src/app/(dash)/optimize/page.tsx` (rewrite), `src/app/(dash)/optimize/actions.ts` (rewrite), `src/app/(dash)/optimize/ApplyGuardrail.tsx` → `RunPlan.tsx`, `src/app/globals.css`
- Test: `tests/domain/planner.test.ts`, `tests/dashboard/story.test.ts` (add), `tests/g8/contract.test.ts` (unchanged; covers the new op)

**Interfaces:**
- Consumes: `ContactCacheRow`, `valuesToContact` (Task 7), `loadContactInfo`, `mapLimit` (Task 7), `recordConsistency`, `smoothedRate`, `calibrationFactor`, `priceFor`, `findEnrichmentPipeline` (Task 2), guardrail functions (`writeFit`, `validateCondition`, `assertConditionFilters`, `setRunCondition`, `ensurePipeline`, `runGuardedPipeline`, `readPipelineRun`).
- Produces:
  - `type EnrichmentType = "find" | "verify" | "phones"`, `interface TypeDef { key; label; verb; noun; target(r): boolean; notTargetLabel: string; pricePerRecord: number }`, `ENRICHMENT_TYPES`, `interface Template { key: string; name: string }`, `availableTypes(templates): { def: TypeDef; runnable: boolean; reason: string | null }[]`
  - `listChoices(lists: ListInfo[], listNames): { id: number; label: string; total: number }[]`
  - `costWalk({ rows, def, price, calibration, guardrail }): CostWalk` (`{ every; done: { count; credits }; skipped: { count; credits }; records; estimate; perRecord }`)
  - `poissonQuantile(mean, q)`, `forecastMeetings({ records, meetings, reached, orgRate }): { expected; lo; hi; lowConfidence }`
  - `plannerHeadline({ graph8Quote: number | null; estimate; listLabel; def })`
  - `loadPlan(c, d, listId, type): Promise<Plan>` in `planner-data.ts`; `Plan` holds everything the planner renders.

- [ ] **Step 1: Read graph8's pipeline templates (read-only)**

Add to `OPS` in `src/lib/g8/ops.ts`:

```ts
  listPipelineTemplates: "list_pipeline_templates_enrichment_lists_pipeline_templates_get",
```

`scripts/list-templates.ts`:

```ts
import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
const r = await c.call<unknown>(OPS.listPipelineTemplates);
console.log(JSON.stringify(r, null, 1).slice(0, 4000));
```

Run: `npx vitest run tests/g8/contract.test.ts && npm run script -- scripts/list-templates.ts`
Expected: the contract test passes (the op exists in the SDK) and the script prints the templates. Note each template's `key`/`template_key` and `name`. **Record in the task report whether a verification-only template and a phone template exist.** The code below reads templates at runtime, so no code change depends on the answer; it decides whether "Verify emails" and "Find phones" are runnable or estimate-only. If the response wraps the list (for example `{ items: [...] }` or `{ templates: [...] }`), adjust `readTemplates` in Step 7 to unwrap it.

- [ ] **Step 2: Write the failing planner tests**

`tests/domain/planner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ENRICHMENT_TYPES, availableTypes, listChoices, costWalk, poissonQuantile, forecastMeetings } from "@/lib/domain/planner";
import type { ContactCacheRow } from "@/lib/domain/types";

const row = (id: number, hasEmail: boolean, fit: ContactCacheRow["fit"]): ContactCacheRow => ({ contactId: id, listIds: [2], hasEmail, consistency: fit === "low" ? "flagged" : "ok",
  segmentKey: "x", fit, fitLevel: null, syncedAt: "2026-09-27T00:00:00Z" });
// Starter-list shape: 250 contacts, 238 with an email of which 112 are flagged low, 12 without an email.
const rows = [...Array.from({ length: 112 }, (_, i) => row(i, true, "low")), ...Array.from({ length: 126 }, (_, i) => row(200 + i, true, "medium")),
  ...Array.from({ length: 12 }, (_, i) => row(500 + i, false, "unknown"))];
const def = (k: string) => ENRICHMENT_TYPES.find((t) => t.key === k)!;

describe("listChoices", () => {
  it("drops empty lists and names duplicates by id", () => {
    const lists = [{ id: 2, title: "Starter list (proactive setup)", total: 250 }, { id: 3, title: "Revenue-Suspects", total: 0 }, { id: 4, title: "Revenue-Suspects", total: 254 },
      { id: 16, title: "[sim] Founders", total: 20 }];
    const names = new Map([["2", "Starter list"], ["3", "Revenue-Suspects (3)"], ["4", "Revenue-Suspects (4)"], ["16", "Founders"]]);
    expect(listChoices(lists, names)).toEqual([{ id: 4, label: "Revenue-Suspects (4)", total: 254 }, { id: 2, label: "Starter list", total: 250 }, { id: 16, label: "Founders", total: 20 }]);
  });
});

describe("availableTypes", () => {
  it("runs Find emails when the template exists, keeps Verify as an estimate without its template and Phones off", () => {
    const a = availableTypes([{ key: "verified_emails", name: "Verified emails" }]);
    expect(a.map((x) => [x.def.key, x.runnable])).toEqual([["find", true], ["verify", false], ["phones", false]]);
    expect(a[1].reason).toBe("graph8 has no list template for email verification, so this is an estimate only.");
    expect(a[2].reason).toBe("Available once graph8's phone template is checked.");
  });
});

describe("costWalk", () => {
  it("verify: every contact, minus those without an email, minus the unlikely", () =>
    expect(costWalk({ rows, def: def("verify"), price: 1, calibration: 1, guardrail: true })).toEqual({ every: 250, perRecord: 1, done: { count: 12, credits: 12 },
      skipped: { count: 112, credits: 112 }, records: 126, estimate: 126 }));
  it("find: most already have an email and nobody is left to skip", () =>
    expect(costWalk({ rows, def: def("find"), price: 3, calibration: 1, guardrail: true })).toMatchObject({ every: 750, done: { count: 238, credits: 714 },
      skipped: { count: 0, credits: 0 }, records: 12, estimate: 36 }));
  it("without the guardrail nobody is skipped", () => expect(costWalk({ rows, def: def("verify"), price: 1, calibration: 1, guardrail: false }).records).toBe(238));
  it("applies calibration to the estimate only", () => expect(costWalk({ rows, def: def("find"), price: 3, calibration: 1.35, guardrail: true }).estimate).toBe(49));
});

describe("forecast", () => {
  it("computes Poisson quantiles", () => { expect(poissonQuantile(2, 0.1)).toBe(0); expect(poissonQuantile(2, 0.9)).toBe(4); expect(poissonQuantile(0, 0.9)).toBe(0); });
  it("forecasts meetings from the list's rate, with an 80% range and a confidence flag", () => {
    // rate = (4 + 5 × 0.1) / (250 + 5) ≈ 0.0176; expected ≈ 2.22; Poisson(2.22): P(X≤0) ≈ 0.108, P(X≤3) ≈ 0.814, P(X≤4) ≈ 0.924
    expect(forecastMeetings({ records: 126, meetings: 4, reached: 250, orgRate: 0.1 })).toMatchObject({ expected: 2.2, lo: 0, hi: 4, lowConfidence: true });
    expect(forecastMeetings({ records: 0, meetings: 4, reached: 250, orgRate: 0.1 })).toEqual({ expected: 0, lo: 0, hi: 0, lowConfidence: true });
  });
});
```

Run: `npx vitest run tests/domain/planner.test.ts` → FAIL (missing module).

- [ ] **Step 3: Implement `src/lib/domain/planner.ts`**

```ts
import type { ContactCacheRow } from "./types";
import { smoothedRate } from "./prespend";

export type EnrichmentType = "find" | "verify" | "phones";
export interface Template { key: string; name: string }
export interface TypeDef { key: EnrichmentType; label: string; verb: string; noun: string; notTargetLabel: string; pricePerRecord: number;
  target: (r: ContactCacheRow) => boolean; template: (t: Template) => boolean; missingReason: string }

export const ENRICHMENT_TYPES: TypeDef[] = [
  { key: "find", label: "Find emails", verb: "Find emails for", noun: "email finding", notTargetLabel: "already have an email, graph8 will skip", pricePerRecord: 3,
    target: (r) => !r.hasEmail, template: (t) => t.key === "verified_emails", missingReason: "graph8 has no email-finding list template here." },
  { key: "verify", label: "Verify emails", verb: "Verify", noun: "email verification", notTargetLabel: "have no email to verify", pricePerRecord: 1,
    target: (r) => r.hasEmail, template: (t) => /verif/i.test(`${t.key} ${t.name}`) && t.key !== "verified_emails",
    missingReason: "graph8 has no list template for email verification, so this is an estimate only." },
  { key: "phones", label: "Find phones", verb: "Find phones for", noun: "phone finding", notTargetLabel: "already have a phone", pricePerRecord: 0,
    target: () => true, template: () => false, missingReason: "Available once graph8's phone template is checked." },
];

export function availableTypes(templates: Template[]): { def: TypeDef; runnable: boolean; reason: string | null }[] {
  return ENRICHMENT_TYPES.map((def) => { const ok = templates.some(def.template); return { def, runnable: ok, reason: ok ? null : def.missingReason }; });
}

export function listChoices(lists: { id: number; title: string; total: number }[], listNames: Map<string, string>) {
  return lists.filter((l) => l.total > 0).map((l) => ({ id: l.id, label: listNames.get(String(l.id)) ?? l.title, total: l.total })).sort((a, b) => b.total - a.total);
}

export interface CostWalk { every: number; perRecord: number; done: { count: number; credits: number }; skipped: { count: number; credits: number }; records: number; estimate: number }

export function costWalk(p: { rows: ContactCacheRow[]; def: TypeDef; price: number; calibration: number; guardrail: boolean }): CostWalk {
  const target = p.rows.filter(p.def.target);
  const skipped = p.guardrail ? target.filter((r) => r.fit === "low") : [];
  const records = target.length - skipped.length;
  const done = p.rows.length - target.length;
  return { every: p.rows.length * p.price, perRecord: p.price, done: { count: done, credits: done * p.price }, skipped: { count: skipped.length, credits: skipped.length * p.price },
    records, estimate: Math.round(records * p.price * p.calibration) };
}

export function poissonQuantile(mean: number, q: number): number {
  if (mean <= 0) return 0;
  let k = 0, pk = Math.exp(-mean), cdf = pk;
  while (cdf < q && k < 10_000) { k++; pk = (pk * mean) / k; cdf += pk; }
  return k;
}

export function forecastMeetings(p: { records: number; meetings: number; reached: number; orgRate: number }) {
  const rate = smoothedRate(p.meetings, p.reached, p.orgRate);
  const expected = p.records * rate;
  return { expected: Math.round(expected * 10) / 10, lo: poissonQuantile(expected, 0.1), hi: poissonQuantile(expected, 0.9), lowConfidence: p.meetings < 5 };
}
```

Run: `npx vitest run tests/domain/planner.test.ts` → PASS.

- [ ] **Step 4: The planner sentence (test first)**

Add to `tests/dashboard/story.test.ts`:

```ts
import { plannerHeadline } from "@/lib/dashboard/story";
import { ENRICHMENT_TYPES } from "@/lib/domain/planner";
describe("Planner sentence", () => {
  const find = ENRICHMENT_TYPES[0], verify = ENRICHMENT_TYPES[1];
  it("contrasts graph8's quote with the estimate", () => expect(plannerHeadline({ graph8Quote: 498, estimate: 36, listLabel: "Starter list", def: find })).toBe("graph8 quotes 498 credits. It should cost about 36."));
  it("states the estimate when graph8 has no quote", () => expect(plannerHeadline({ graph8Quote: null, estimate: 126, listLabel: "Starter list", def: verify })).toBe("Email verification on the Starter list should cost about 126 credits."));
  it("says when there is nothing to do", () => expect(plannerHeadline({ graph8Quote: null, estimate: 0, listLabel: "Founders", def: find })).toBe("Nothing to do: every contact on Founders is already done or skipped."));
});
```

Append to `src/lib/dashboard/story.ts`:

```ts
import type { TypeDef } from "../domain/planner";
export function plannerHeadline(p: { graph8Quote: number | null; estimate: number; listLabel: string; def: TypeDef }): string {
  if (p.estimate <= 0) return `Nothing to do: every contact on ${p.listLabel} is already done or skipped.`;
  if (p.graph8Quote !== null && p.graph8Quote > p.estimate) return `graph8 quotes ${n(p.graph8Quote)} credits. It should cost about ${n(p.estimate)}.`;
  const noun = p.def.noun[0].toUpperCase() + p.def.noun.slice(1);
  return `${noun} on the ${p.listLabel} should cost about ${n(p.estimate)} credits.`;
}
```

(Move the `import type` to the top of the file with the other imports.) Run: `npx vitest run tests/dashboard/story.test.ts` → PASS.

- [ ] **Step 5: Plan data loader**

`src/lib/dashboard/planner-data.ts`:

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { RecordStore } from "../store/records";
import { valuesToContact } from "../store/mappers";
import { loadContactInfo, type ContactRow } from "../sync/contacts";
import { mapLimit } from "../util/concurrency";
import { findEnrichmentPipeline } from "../guardrail/pipeline";
import { calibrationFactor, priceFor, type ProviderRow } from "../domain/prespend";
import { availableTypes, costWalk, forecastMeetings, type CostWalk, type EnrichmentType, type Template, type TypeDef } from "../domain/planner";
import type { ContactCacheRow } from "../domain/types";
import type { DashboardData } from "./data";

export interface Plan {
  listId: number; listLabel: string; rows: ContactCacheRow[]; types: ReturnType<typeof availableTypes>; def: TypeDef; runnable: boolean; reason: string | null;
  walk: CostWalk; graph8Quote: number | null; forecast: ReturnType<typeof forecastMeetings>; fits: Record<ContactCacheRow["fit"], number>; pipelineId: string | null; syncedAt: string | null;
}

async function readTemplates(c: G8Caller): Promise<Template[]> {
  const r = await c.call<unknown>(OPS.listPipelineTemplates);
  const arr = (Array.isArray(r) ? r : ((r as { items?: unknown[]; templates?: unknown[] }).items ?? (r as { templates?: unknown[] }).templates ?? [])) as Record<string, unknown>[];
  return arr.map((t) => ({ key: String(t.template_key ?? t.key ?? t.id ?? ""), name: String(t.name ?? t.title ?? "") }));
}

export async function loadPlan(c: G8Caller, d: DashboardData, listId: number, type: EnrichmentType): Promise<Plan> {
  const ids: number[] = [];
  const listRows: ContactRow[] = [];
  for (let page = 1; ; page++) {
    const r = await c.call<ContactRow[]>(OPS.getListContacts, { path: { list_id: listId }, query: { page, limit: 200 } });
    listRows.push(...r); ids.push(...r.map((x) => x.id));
    if (r.length < 200) break;
  }
  const cache = new Map((await new RecordStore(c, "roi_contact").list()).map((r) => { const v = valuesToContact(r.values); return [v.contactId, v] as const; }));
  const missing = listRows.filter((r) => !cache.has(r.id));
  const fresh = await mapLimit(missing, 10, async (r) => { const i = await loadContactInfo(c, r); return { contactId: i.contactId, listIds: i.listIds, hasEmail: !!i.email,
    consistency: i.consistency, segmentKey: i.segmentKey, fit: i.consistency === "flagged" ? "low" : "unknown", fitLevel: null, syncedAt: d.now } as ContactCacheRow; });
  const rows = [...ids.map((id) => cache.get(id)).filter((x): x is ContactCacheRow => !!x), ...fresh];
  const types = availableTypes(await readTemplates(c));
  const t = types.find((x) => x.def.key === type) ?? types[0];
  const providers = (await c.call<{ providers: ProviderRow[] }>(OPS.listProviders)).providers;
  const price = t.def.key === "find" ? priceFor(providers, "leadmagic", "email_finder") ?? t.def.pricePerRecord : t.def.pricePerRecord;
  const wfRuns = d.runs.filter((r) => r.service === "waterfall_enrichment" && r.quotedCredits);
  const calibration = t.def.key === "find" ? calibrationFactor(wfRuns.map((r) => ({ quoted: r.quotedCredits!, actual: d.charges.filter((x) => x.runExtId === r.extId).reduce((s, x) => s + x.credits, 0) }))) : 1;
  const walk = costWalk({ rows, def: t.def, price, calibration, guardrail: true });
  const pipe = t.def.key === "find" ? await findEnrichmentPipeline(c, listId) : null;
  const graph8Quote = pipe ? (await c.call<{ required_credits: number }>(OPS.estimateListPipeline, { path: { list_id: listId, pipeline_id: pipe.id } })).required_credits : null;
  const stat = d.stats.find((s) => s.period === "8w" && s.dimension === "list" && s.value === String(listId));
  const org = d.stats.find((s) => s.period === "8w" && s.dimension === "org");
  const orgRate = org && org.contactsReached > 0 ? org.meetings / org.contactsReached : 0;
  const fits = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const r of rows) fits[r.fit]++;
  // Only email finding runs from here (through the proven guardrail path); other types are estimates.
  const runnable = t.def.key === "find" && t.runnable && !!pipe;
  const reason = runnable ? null : t.def.key === "find" ? (pipe ? t.reason : "This list has no email-finding pipeline in graph8 yet.")
    : (t.reason ?? "Estimate only. Run verification from graph8.");
  return { listId, listLabel: d.listNames.get(String(listId)) ?? `List ${listId}`, rows, types, def: t.def, runnable,
    reason, walk, graph8Quote, forecast: forecastMeetings({ records: walk.records, meetings: stat?.meetings ?? 0, reached: stat?.contactsReached ?? 0, orgRate }),
    fits, pipelineId: pipe?.id ?? null, syncedAt: rows.map((r) => r.syncedAt).sort().at(-1) ?? null };
}
```

- [ ] **Step 6: Planner components**

`src/components/CostWalk.tsx`:

```tsx
import type { CostWalk as Walk, TypeDef } from "@/lib/domain/planner";
import { n, plural } from "@/lib/dashboard/story";
export function CostWalk({ walk, def }: { walk: Walk; def: TypeDef }) {
  const w = (v: number) => `${walk.every ? (v / walk.every) * 100 : 0}%`;
  const after1 = walk.every - walk.done.credits;
  return (
    <div className="walk" role="table" aria-label="How the estimate is built">
      <div role="row"><span role="cell">Every contact, at {n(walk.perRecord)} {walk.perRecord === 1 ? "credit" : "credits"}</span><div className="track"><span className="b every" style={{ width: "100%" }} /></div><b role="cell">{n(walk.every)}</b></div>
      <div role="row"><span role="cell">{plural(walk.done.count, "contact")} {def.notTargetLabel}</span><div className="track"><span style={{ width: w(after1) }} /><span className="b cut" style={{ width: w(walk.done.credits) }} /></div><b role="cell" className="muted">{walk.done.credits ? `−${n(walk.done.credits)}` : "0"}</b></div>
      <div role="row"><span role="cell">{walk.skipped.count ? `${plural(walk.skipped.count, "contact")} unlikely to book, skipped by the rule` : "Nobody unlikely to skip for this enrichment"}</span><div className="track"><span style={{ width: w(after1 - walk.skipped.credits) }} /><span className="b skip" style={{ width: w(walk.skipped.credits) }} /></div><b role="cell" className="muted">{walk.skipped.credits ? `−${n(walk.skipped.credits)}` : "0"}</b></div>
      <div role="row"><span role="cell"><b>Advisor estimate</b><small>{plural(walk.records, "contact")}{walk.estimate !== walk.records * walk.perRecord ? ", adjusted for graph8's usual gap" : ""}</small></span><div className="track"><span className="b est" style={{ width: w(walk.records * walk.perRecord) }} /></div><b role="cell">~{n(walk.estimate)}</b></div>
    </div>
  );
}
```

`src/components/ForecastBar.tsx`:

```tsx
export function ForecastBar({ expected, lo, hi, lowConfidence, basis }: { expected: number; lo: number; hi: number; lowConfidence: boolean; basis: string }) {
  const max = Math.max(10, hi + 2), pct = (v: number) => `${(v / max) * 100}%`;
  const text = expected < 1 ? `Less than 1 meeting, likely ${lo} to ${hi}` : `About ${Math.round(expected)} meetings, likely ${lo} to ${hi}`;
  return (
    <div className="forecast">
      <div className="ph"><h3>What it should book</h3><span className="small">{basis}{lowConfidence ? " Low confidence: fewer than 5 meetings of history." : ""}</span></div>
      <div className="fc" aria-hidden="true"><span className="rg" style={{ left: pct(lo), width: pct(hi - lo) }} /><span className="pt" style={{ left: pct(expected) }} /></div>
      <p className="fcx"><span>0</span><b>{text}</b><span>{max}</span></p>
    </div>
  );
}
```

`src/components/Planner.tsx`:

```tsx
import Link from "next/link";
import type { Plan } from "@/lib/dashboard/planner-data";
import { RUN_CONDITION } from "@/lib/guardrail/guardrail";
import { CostWalk } from "./CostWalk";
import { ForecastBar } from "./ForecastBar";
import { RunPlan } from "@/app/(dash)/optimize/RunPlan";

export function Planner({ plan, choices, hrefFor }: { plan: Plan; choices: { id: number; label: string; total: number }[]; hrefFor: (p: { list?: number; type?: string }) => string }) {
  const f = plan.fits;
  return (
    <section className="panel" id="plan" aria-labelledby="plan-h">
      <div className="ph"><h2 id="plan-h">Plan your next enrichment</h2><span className="small">{plan.syncedAt ? `Fit from the last sync, ${new Date(plan.syncedAt).toUTCString().slice(5, 22)} UTC` : "Run Sync now to score contacts"}</span></div>
      <form method="get" action="/optimize#plan" className="planner-sel">
        <label htmlFor="list" className="sr-only">List</label>
        <select id="list" name="list" defaultValue={plan.listId}>{choices.map((l) => <option key={l.id} value={l.id}>{l.label}, {l.total} contacts</option>)}</select>
        <input type="hidden" name="type" value={plan.def.key} />
        <button className="btn ghost" type="submit">Check this list</button>
        <span className="seg" role="group" aria-label="Enrichment">
          {plan.types.map((t) => t.def.key === "phones" && !t.runnable
            ? <button key={t.def.key} type="button" disabled title={t.reason ?? undefined}>{t.def.label}</button>
            : <Link key={t.def.key} href={hrefFor({ list: plan.listId, type: t.def.key })} className={t.def.key === plan.def.key ? "on" : undefined} aria-current={t.def.key === plan.def.key ? "true" : undefined}>{t.def.label}</Link>)}
        </span>
      </form>
      <CostWalk walk={plan.walk} def={plan.def} />
      <ForecastBar {...plan.forecast} basis={`If these contacts do as well as ${plan.listLabel} has so far.`} />
      <h3 className="sub">Who gets skipped</h3>
      <div className="fitbar" aria-hidden="true"><span style={{ flex: f.high, background: "var(--booked)" }} /><span style={{ flex: f.medium, background: "var(--maybe)" }} /><span style={{ flex: f.low, background: "var(--waste)" }} /><span style={{ flex: f.unknown, background: "var(--unknown)" }} /></div>
      <p className="small">Likely to book {f.high}, maybe {f.medium}, unlikely {f.low}, unknown {f.unknown}. Unlikely means the email doesn&apos;t match their company (those bounced about twice as often when we checked) or people like them rarely book.</p>
      <details><summary>The rule graph8 will run</summary><p className="small">Written to the list pipeline&apos;s run condition, so graph8 enforces it on every run: <code>{RUN_CONDITION}</code></p></details>
      {plan.runnable ? <RunPlan listId={plan.listId} estimate={plan.walk.estimate} records={plan.walk.records} verb={plan.def.verb} /> : <p className="small">{plan.reason ?? "graph8 has no pipeline for this list yet."}</p>}
    </section>
  );
}
```

- [ ] **Step 7: Server action and run button (reuses the proven guardrail path)**

Replace `src/app/(dash)/optimize/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { OPS } from "@/lib/g8/ops";
import { isAuthed } from "@/lib/auth";
import { currentCaller } from "@/lib/workspace/current";
import { loadDashboardData } from "@/lib/dashboard/data";
import { loadPlan } from "@/lib/dashboard/planner-data";
import { RecordStore } from "@/lib/store/records";
import { runToValues } from "@/lib/store/mappers";
import { ROI_FIT_FIELD_NAME, RUN_CONDITION, assertConditionFilters, ensurePipeline, readPipelineRun, runGuardedPipeline, setRunCondition, validateCondition, writeFit } from "@/lib/guardrail/guardrail";

export async function runPlan(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm the run and its cost." };
  const c = await currentCaller(), listId = Number(form.get("listId"));
  try {
    const plan = await loadPlan(c, await loadDashboardData(c), listId, "find");
    if (!plan.runnable) return { ok: false, message: plan.reason ?? "This enrichment can't run on this list yet." };
    await writeFit(c, { columnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fits: new Map(plan.rows.map((r) => [r.contactId, r.fit])) });
    await validateCondition(c, RUN_CONDITION);
    await assertConditionFilters(c, { listId, listSize: plan.rows.length, fieldName: ROI_FIT_FIELD_NAME, value: "low" });
    const pipeline = await ensurePipeline(c, listId);
    await setRunCondition(c, { listId, pipeline, condition: RUN_CONDITION });
    const before = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    const startedAt = new Date().toISOString(), cap = Number(process.env.ACTION_CREDIT_CAP ?? 50);
    const { runId } = await runGuardedPipeline(c, { listId, pipelineId: pipeline.id, estimatedCredits: plan.walk.estimate, cap: Number.isFinite(cap) ? cap : 50 });
    const runs = new RecordStore(c, "roi_run");
    const base = { extId: runId, kind: "pipeline_run" as const, service: "waterfall_enrichment", actionName: `List pipeline · ${pipeline.name}`, startedAt, source: "advisor" as const, listId, quotedCredits: plan.walk.estimate };
    await runs.upsert(runToValues({ ...base, completedAt: null, status: "running" }));
    let r = await readPipelineRun(c, runId);
    for (let i = 0; i < 36 && r.status !== "completed" && r.status !== "failed"; i++) { await new Promise((x) => setTimeout(x, 5000)); r = await readPipelineRun(c, runId); }
    const after = (await c.call<{ available_credits: number }>(OPS.getUsage)).available_credits;
    await runs.upsert(runToValues({ ...base, completedAt: new Date().toISOString(), status: r.status, recordsOk: r.successful, recordsFailed: r.failed, recordsSkipped: r.skipped }));
    revalidatePath("/optimize");
    return { ok: true, message: `Enriched ${r.successful}, skipped ${r.skipped}, spent ${Math.round(before - after)} credits.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
```

`git mv "src/app/(dash)/optimize/ApplyGuardrail.tsx" "src/app/(dash)/optimize/RunPlan.tsx"` and replace its content:

```tsx
"use client";
import { useActionState } from "react";
import { runPlan } from "./actions";
export function RunPlan({ listId, estimate, records, verb }: { listId: number; estimate: number; records: number; verb: string }) {
  const [state, action, pending] = useActionState(runPlan, undefined);
  return (
    <form action={action} className="foot">
      <input type="hidden" name="listId" value={listId} />
      <label><input type="checkbox" name="confirm" value="yes" /> Spend about {estimate} credits</label>
      <button className="btn primary" type="submit" disabled={pending || records === 0}>{pending ? "Running…" : `${verb} ${records} ${records === 1 ? "contact" : "contacts"}`}</button>
      {state && <span className="toast" role="status">{state.ok ? state.message : `Not run: ${state.message}`}</span>}
    </form>
  );
}
```

Delete the old `adviseList` (it is replaced by `loadPlan`) and check `grep -rn adviseList src tests` → nothing. **Never press the run button while testing** (it spends credits).

- [ ] **Step 8: The Optimize page (planner only for now)**

`src/app/(dash)/optimize/page.tsx`:

```tsx
import { loadDashboardData } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { listChoices, type EnrichmentType } from "@/lib/domain/planner";
import { loadPlan } from "@/lib/dashboard/planner-data";
import { plannerHeadline } from "@/lib/dashboard/story";
import { Headline } from "@/components/Headline";
import { Planner } from "@/components/Planner";

type SP = { list?: string; type?: string; period?: string };
export default async function OptimizePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const c = await currentCaller();
  const d = await loadDashboardData(c);
  const choices = listChoices(d.lists, d.listNames);
  const listId = choices.some((l) => String(l.id) === sp.list) ? Number(sp.list) : (choices.find((l) => d.listNames.get(String(l.id)) === "Starter list") ?? choices[0])?.id;
  const type: EnrichmentType = sp.type === "find" || sp.type === "phones" ? sp.type : "verify";
  if (listId === undefined) return <Headline text="No lists with contacts yet." lede="Create a list in graph8, then run Sync now." />;
  const plan = await loadPlan(c, d, listId, type);
  const hrefFor = (p: { list?: number; type?: string }) => `/optimize?${new URLSearchParams({ list: String(p.list ?? listId), type: p.type ?? type, ...(sp.period === "30d" ? { period: "30d" } : {}) })}#plan`;
  return (
    <>
      <Headline text={plannerHeadline({ graph8Quote: plan.graph8Quote, estimate: plan.walk.estimate, listLabel: plan.listLabel, def: plan.def })}
        lede="Pick a list and an enrichment, see what it should really cost and book, then let graph8 skip the contacts least likely to book." />
      <Planner plan={plan} choices={choices} hrefFor={hrefFor} />
    </>
  );
}
```

Task 9 puts the action plan above the planner and replaces the headline.

- [ ] **Step 9: Styles**

Append to `src/app/globals.css` and delete the old `.dialog*`, `.est`, `.callout` rules:

```css
/* planner */
.planner-sel{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px}
.planner-sel select{font:14px var(--f-body);padding:6px 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink)}
.seg a{font:500 13px var(--f-body);padding:4px 11px;color:var(--ink-2);text-decoration:none}.seg a.on{background:var(--ink);color:var(--bg)}
.walk{display:grid;gap:8px;margin:8px 0}
.walk [role=row]{display:grid;grid-template-columns:minmax(0,260px) 1fr 64px;gap:12px;align-items:center;font-size:14px}
.walk small{display:block;color:var(--muted);font-size:12.5px}
.walk b{text-align:right;font-variant-numeric:tabular-nums}
.track{display:flex;height:22px}.track .b{display:block;border-radius:4px}
.b.every{background:var(--nomeet)}.b.cut{border:1px dashed var(--nomeet);background:repeating-linear-gradient(135deg,var(--line-2) 0 5px,transparent 5px 10px)}
.b.skip{border:1px dashed var(--waste);background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--waste) 18%,transparent) 0 5px,transparent 5px 10px)}
.b.est{background:var(--accent)}
@media (max-width:760px){.walk [role=row]{grid-template-columns:1fr 64px}.walk .track{grid-column:1/-1}}
.forecast{border-top:1px solid var(--line-2);margin-top:14px;padding-top:12px}
.forecast h3,.sub{font:600 14px var(--f-display);margin:0}
.fc{position:relative;height:26px;background:var(--line-2);border-radius:6px;margin:10px 0 6px}
.fc .rg{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--booked) 30%,transparent);border-radius:6px}
.fc .pt{position:absolute;top:-4px;bottom:-4px;width:3px;background:var(--booked);border-radius:2px}
.fcx{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin:0}.fcx b{color:var(--ink)}
.fitbar{display:flex;height:16px;border-radius:4px;overflow:hidden;margin:8px 0}
#plan .foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}
```

- [ ] **Step 10: Verify, time, screenshot**

Run: `npx vitest run && npm run typecheck && npm run build` → PASS.
Screenshots and timing: `npm run shots -- "/optimize" "/optimize?list=2&type=find" "/optimize?list=16&type=verify"`. The printed time for `/optimize` (Starter list) must be **under 3,000 ms** locally after warm-up (the cache replaces 750 sequential calls with one paged list). Compare with the prototype's planner: list picker, Find/Verify/Phones switch (Phones disabled), the walk (verify: 250 → −12 → −112 → ~126), the forecast bar, the fit bar with real high/medium counts, the collapsed rule, and the run form. **Do not tick the box or press the run button.**

- [ ] **Step 11: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests advisor/scripts/list-templates.ts
git commit -m "feat(advisor): Optimize spend planner with enrichment types, cost walk and forecast"
```

---
### Task 9: Optimize spend, part 2: action plan, apply and undo, changes you've made

Spec §4.7, §5.5. Applying an action changes a setting in graph8 and costs 0 credits. ⏸ Live tests on simulated lists only; the real Starter list (list 2) and the lookalike save (it adds contacts to the CRM) need the user's OK first.

**Monthly savings without double counting:** only "stop repeat enrichment" contributes credits a month (repeat credits × 30/56). "Move spend" reallocates (it reports meetings a week, not savings) and "skip unlikely" reports credits per run, so no credit is counted twice by construction. The headline sums the monthly figures only.

**Files:**
- Create: `src/lib/domain/actions.ts`, `src/lib/actions/apply.ts`, `src/app/(dash)/optimize/apply.ts`, `src/components/ActionCard.tsx`, `src/components/AppliedChanges.tsx`
- Modify: `src/lib/dashboard/story.ts`, `src/app/(dash)/optimize/page.tsx`, `src/app/globals.css`
- Test: `tests/domain/actions.test.ts`, `tests/actions/apply-actions.test.ts`, `tests/dashboard/story.test.ts` (add)

**Interfaces:**
- Consumes: `repeatEnrichment` (Task 1), `ContactCacheRow` (Task 7), `ActionRecord`, `actionToValues`, `valuesToAction` (Task 6), `findEnrichmentPipeline`, `patchPipeline`, `restorePipeline`, `settingsOf`, `PipelineSettings` (Task 2), `writeFit`, `validateCondition`, `assertConditionFilters`, `RUN_CONDITION`, `ROI_FIT_FIELD_NAME` (guardrail), `OPS.saveContactSearch`.
- Produces:
  - `buildActions(input: ActionInput): PlannedAction[]` with `PlannedAction { id: "repeat" | "move-spend" | "skip-unlikely"; title; impact; evidence; confidence; inGraph8; chart; steps; button: { action: "repeat" | "lookalike" | "pause" | "guardrail"; label; listIds: number[] } | null; applied: boolean; monthlyCredits: number }`
  - `lookalikeFilters(rows: ContactCacheRow[]): { field: string; operator: "any_of"; value: string[] }[]`
  - `applyRepeatSkip`, `applyPause`, `applyLookalike`, `applyGuardrailRule`, `undoAction` in `src/lib/actions/apply.ts`
  - `optimizeHeadline({ count, monthly, hasMove })`, `appliedSummary(rec, runs)`

- [ ] **Step 1: Write the failing tests for the action plan**

`tests/domain/actions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildActions, lookalikeFilters } from "@/lib/domain/actions";
import type { ActionRecord, AttributedCharge, ContactCacheRow, Stat } from "@/lib/domain/types";

const ch = (id: string, contactId: number, listId: number, at: string, credits = 90): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits, chargedAt: at, llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: `sim-run-${listId}`, listId, contactId,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: true });
const stat = (value: string, credits: number, meetings: number, cpm: number | null, confidence: Stat["confidence"]): Stat => ({ period: "8w", dimension: value === "all" ? "org" : "list",
  value, credits, creditsExact: credits, meetings, deals: 0, wonValue: 0, contactsReached: 20, costPerMeeting: cpm, costPerDeal: null, vsAvgPct: null, evidenceN: meetings,
  confidence, simulated: true, computedAt: "2026-09-27T00:00:00Z" });
const row = (id: number, listId: number, fit: ContactCacheRow["fit"], seg = "Vice President|Sales|Software|51-200"): ContactCacheRow =>
  ({ contactId: id, listIds: [listId], hasEmail: true, consistency: fit === "low" ? "flagged" : "ok", segmentKey: seg, fit, fitLevel: "role", syncedAt: "2026-09-27T00:00:00Z" });

const charges = [ch("a", 1, 2, "2026-09-01T00:00:00Z"), ch("b", 1, 2, "2026-09-10T00:00:00Z"), ch("c", 2, 15, "2026-09-02T00:00:00Z")];
const stats = [stat("all", 10000, 27, 370, "high"), stat("15", 2108, 17, 124, "high"), stat("16", 2598, 6, 433, "medium"), stat("2", 4931, 4, 1233, "low")];
const contacts = [...Array.from({ length: 12 }, (_, i) => row(100 + i, 2, "low", "Owner|Founders|X|1-10")), ...Array.from({ length: 20 }, (_, i) => row(200 + i, 15, "high"))];
const names = new Map([["2", "Starter list"], ["15", "Sales VPs"], ["16", "Founders"]]);
const input = { charges, stats, listNames: names, contacts, actions: [] as ActionRecord[] };

describe("buildActions", () => {
  const acts = buildActions(input);
  it("finds repeat enrichment with a monthly saving and the lists to change", () => {
    const r = acts.find((a) => a.id === "repeat")!;
    expect(r.monthlyCredits).toBe(Math.round((90 * 30) / 56));
    expect(r.button).toMatchObject({ action: "repeat", label: "Turn on for 1 pipeline", listIds: [2] });
    expect(r.inGraph8).toBe("Turns on Skip recently enriched and Skip existing values for the Starter list pipeline.");
  });
  it("moves spend from the costliest list to the cheapest, in two steps", () => {
    const m = acts.find((a) => a.id === "move-spend")!;
    expect(m.title).toBe("Move spend from the Starter list to people like your Sales VPs");
    expect(m.impact).toBe("~2 more meetings a week");
    expect(m.steps.map((s) => [s.label, s.done])).toEqual([["Build a lookalike list of your Sales VPs", false], ["Pause enrichment on the Starter list", false]]);
    expect(m.button).toMatchObject({ action: "lookalike", label: "Build lookalike list", listIds: [15] });
  });
  it("skips unlikely contacts on the list with the most of them", () => {
    const s = acts.find((a) => a.id === "skip-unlikely")!;
    expect(s.title).toBe("Skip contacts unlikely to book");
    expect(s.impact).toBe("saves 12 per run");
    expect(s.button).toMatchObject({ action: "guardrail", listIds: [2] });
  });
  it("orders by impact: monthly savings first, then meetings, then per-run", () => expect(acts.map((a) => a.id)).toEqual(["repeat", "move-spend", "skip-unlikely"]));
  it("marks steps and actions done from roi_action records", () => {
    const applied = (kind: ActionRecord["kind"], listId: number): ActionRecord => ({ extId: `${kind}:${listId}`, kind, listId, pipelineId: "p", appliedAt: "2026-09-27T00:00:00Z",
      status: "applied", previous: null, detail: {}, simulated: false });
    const a2 = buildActions({ ...input, actions: [applied("lookalike", 15), applied("repeat_skip", 2)] });
    expect(a2.find((a) => a.id === "repeat")!.applied).toBe(true);
    const m = a2.find((a) => a.id === "move-spend")!;
    expect(m.steps[0].done).toBe(true);
    expect(m.button).toMatchObject({ action: "pause", label: "Pause the Starter list", listIds: [2] });
  });
  it("offers nothing when the data doesn't support it", () => expect(buildActions({ charges: [], stats: [], listNames: names, contacts: [], actions: [] })).toEqual([]));
});

describe("lookalikeFilters", () => {
  it("uses the most common known seniority and department", () =>
    expect(lookalikeFilters([row(1, 15, "high"), row(2, 15, "high"), row(3, 15, "high", "Director|Marketing|X|1-10"), row(4, 15, "high", "Unknown|Unknown|X|1-10")]))
      .toEqual([{ field: "seniority_level", operator: "any_of", value: ["Vice President"] }, { field: "job_department", operator: "any_of", value: ["Sales"] }]));
});
```

Add to `tests/dashboard/story.test.ts`:

```ts
import { optimizeHeadline } from "@/lib/dashboard/story";
describe("Optimize sentence", () => {
  it("sums monthly savings and mentions moving spend", () => expect(optimizeHeadline({ count: 3, monthly: 4400, hasMove: true })).toBe("3 changes would save about 4,400 credits a month and move spend to the lists that book."));
  it("handles one change without savings", () => expect(optimizeHeadline({ count: 1, monthly: 0, hasMove: true })).toBe("1 change would move spend to the lists that book."));
  it("handles nothing to do", () => expect(optimizeHeadline({ count: 0, monthly: 0, hasMove: false })).toBe("Your spend looks efficient right now."));
});
```

Run: `npx vitest run tests/domain/actions.test.ts tests/dashboard/story.test.ts` → FAIL (missing module/export).

- [ ] **Step 2: Implement `src/lib/domain/actions.ts` and the sentence**

```ts
import type { ActionRecord, AttributedCharge, ContactCacheRow, Stat } from "./types";
import { repeatEnrichment } from "./repeat";

export interface ActionInput { charges: AttributedCharge[]; stats: Stat[]; listNames: Map<string, string>; contacts: ContactCacheRow[]; actions: ActionRecord[] }
export interface PlannedAction {
  id: "repeat" | "move-spend" | "skip-unlikely"; title: string; impact: string; evidence: string; confidence: "High confidence" | "Medium confidence";
  inGraph8: string; chart: { label: string; value: number; tone: string }[]; steps: { label: string; sub: string; done: boolean }[];
  button: { action: "repeat" | "lookalike" | "pause" | "guardrail"; label: string; listIds: number[] } | null; applied: boolean; monthlyCredits: number;
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const the = (name: string) => (/\blist$/i.test(name) ? `the ${name}` : name); // "the Starter list", but "Sales VPs", "Founders"
const isApplied = (acts: ActionRecord[], kind: ActionRecord["kind"], listId: number) => acts.some((a) => a.kind === kind && a.listId === listId && a.status === "applied");

export function lookalikeFilters(rows: ContactCacheRow[]) {
  const top = (i: number) => {
    const m = new Map<string, number>();
    for (const r of rows) { const v = r.segmentKey.split("|")[i]; if (v && v !== "Unknown") m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const out: { field: string; operator: "any_of"; value: string[] }[] = [];
  const s = top(0), d = top(1);
  if (s) out.push({ field: "seniority_level", operator: "any_of", value: [s] });
  if (d) out.push({ field: "job_department", operator: "any_of", value: [d] });
  return out;
}

export function buildActions(x: ActionInput): PlannedAction[] {
  const out: PlannedAction[] = [];
  const name = (id: number | string) => x.listNames.get(String(id)) ?? `list ${id}`;
  const total = x.charges.reduce((s, c) => s + c.credits, 0);

  const rep = repeatEnrichment(x.charges);
  const repLists = [...rep.byList.keys()].filter((k): k is number => k !== null);
  if (rep.credits >= 50 && repLists.length) {
    const firstTime = x.charges.filter((c) => c.contactId !== null).reduce((s, c) => s + c.credits, 0) - rep.credits;
    const applied = repLists.every((l) => isApplied(x.actions, "repeat_skip", l));
    const listText = repLists.map((l) => the(name(l))).join(", ").replace(/, ([^,]*)$/, " and $1");
    out.push({ id: "repeat", title: "Stop paying to enrich the same contacts again", impact: `saves ~${n((rep.credits * 30) / 56)} a month`, monthlyCredits: Math.round((rep.credits * 30) / 56),
      evidence: `${n(rep.credits)} credits in the last 8 weeks${total ? `, ${Math.round((rep.credits / total) * 100)}% of all spend,` : ""} went to contacts you had already enriched within 30 days.`,
      confidence: "High confidence", chart: [{ label: "First time", value: Math.max(0, firstTime), tone: "var(--flow)" }, { label: "Again", value: rep.credits, tone: "var(--waste)" }],
      inGraph8: `Turns on Skip recently enriched and Skip existing values for ${listText} ${repLists.length === 1 ? "pipeline" : "pipelines"}.`, steps: [],
      button: applied ? null : { action: "repeat", label: `Turn on for ${repLists.length} ${repLists.length === 1 ? "pipeline" : "pipelines"}`, listIds: repLists }, applied });
  }

  const lists = x.stats.filter((s) => s.period === "8w" && s.dimension === "list" && s.costPerMeeting !== null);
  const best = lists.filter((s) => s.meetings >= 5 && s.confidence !== "low").sort((a, b) => a.costPerMeeting! - b.costPerMeeting!)[0];
  const worst = lists.filter((s) => s.credits >= 1000).sort((a, b) => b.costPerMeeting! - a.costPerMeeting!)[0];
  if (best && worst && best.value !== worst.value && worst.costPerMeeting! >= 2 * best.costPerMeeting!) {
    const perK = (s: Stat) => 1000 / s.costPerMeeting!, weekly = worst.credits / 8;
    const gain = (weekly * (0.5 / best.costPerMeeting! - 1 / worst.costPerMeeting!));
    const bId = Number(best.value), wId = Number(worst.value);
    const lookDone = isApplied(x.actions, "lookalike", bId), pauseDone = isApplied(x.actions, "pause_list", wId);
    out.push({ id: "move-spend", title: `Move spend from ${the(name(wId))} to people like your ${name(bId)}`, impact: `~${n(gain)} more meetings a week`, monthlyCredits: 0,
      evidence: `${the(name(wId)).replace(/^t/, "T")} books ${perK(worst).toFixed(1)} meetings per 1,000 credits and costs about ${n(weekly)} credits a week. ${name(bId)} book ${perK(best).toFixed(1)}. Even at half that rate, the same credits book about ${n(gain)} more meetings a week.`,
      confidence: best.confidence === "high" ? "High confidence" : "Medium confidence",
      chart: [{ label: name(wId), value: perK(worst), tone: "var(--nomeet)" }, { label: name(bId), value: perK(best), tone: "var(--booked)" }],
      inGraph8: "Builds a lookalike list from graph8's free prospect search, then switches the costly list's pipeline off so it stops running on its own. Existing data stays.",
      steps: [{ label: `Build a lookalike list of your ${name(bId)}`, sub: "Free. Saves up to 50 new contacts with the same seniority and department.", done: lookDone },
        { label: `Pause enrichment on ${the(name(wId))}`, sub: "Switches its list pipeline off. Existing data stays.", done: pauseDone }],
      button: !lookDone ? { action: "lookalike", label: "Build lookalike list", listIds: [bId] } : !pauseDone ? { action: "pause", label: `Pause ${the(name(wId))}`, listIds: [wId] } : null,
      applied: lookDone && pauseDone });
  }

  const lowBy = new Map<number, { low: number; all: number }>();
  for (const r of x.contacts) for (const l of r.listIds) { const e = lowBy.get(l) ?? { low: 0, all: 0 }; e.all++; if (r.fit === "low" && r.hasEmail) e.low++; lowBy.set(l, e); }
  const [gl, g] = [...lowBy].sort((a, b) => b[1].low - a[1].low)[0] ?? [];
  if (gl !== undefined && g && g.low >= 10) {
    const applied = isApplied(x.actions, "guardrail", gl);
    out.push({ id: "skip-unlikely", title: "Skip contacts unlikely to book", impact: `saves ${n(g.low)} per run`, monthlyCredits: 0,
      evidence: `${n(g.low)} of ${n(g.all)} contacts on ${the(name(gl))} have an email that doesn't match their company or belong to groups that rarely book. When we checked, mismatched emails bounced 45% of the time against 20% for the rest.`,
      confidence: "High confidence", chart: [], steps: [],
      inGraph8: "Writes a fit score to each contact and adds a run condition to the list pipeline, so graph8 skips anyone unlikely on every run.",
      button: applied ? null : { action: "guardrail", label: `Apply to ${the(name(gl))}`, listIds: [gl] }, applied });
  }
  return out;
}
```

Append to `story.ts`:

```ts
export function optimizeHeadline(p: { count: number; monthly: number; hasMove: boolean }): string {
  if (p.count <= 0) return "Your spend looks efficient right now.";
  const parts = [p.monthly > 0 ? `save about ${n(p.monthly)} credits a month` : null, p.hasMove ? "move spend to the lists that book" : null].filter(Boolean);
  return `${plural(p.count, "change")} would ${parts.length ? parts.join(" and ") : "make your spend go further"}.`;
}
```

Run: `npx vitest run tests/domain/actions.test.ts tests/dashboard/story.test.ts` → PASS. (Gain check: weekly 4,931/8 ≈ 616; 616 × (0.5/124 − 1/1,233) ≈ 616 × (0.00403 − 0.00081) ≈ 1.99 → "~2".)

- [ ] **Step 3: Write the failing tests for apply and undo**

`tests/actions/apply-actions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { valuesToAction } from "@/lib/store/mappers";
import { applyRepeatSkip, applyPause, applyLookalike, undoAction } from "@/lib/actions/apply";
import type { ListPipeline } from "@/lib/guardrail/pipeline";

async function setup() {
  const g = new FakeG8(); await ensureSchema(g);
  let pipes: Record<number, ListPipeline[]> = { 15: [{ id: "p15", name: "Verified emails", enabled: true, steps: [{ id: "s1", name: "Email finder", type: "waterfall", config_ref: "CFG",
    run_condition: null, skip_existing_values: false, skip_recently_enriched: false, enabled: true }] }] };
  g.handlers.set(OPS.listListPipelines, (i) => ({ items: structuredClone(pipes[Number(i.path?.list_id)] ?? []) }));
  g.handlers.set(OPS.updateListPipeline, (i) => { const l = Number(i.path?.list_id); pipes[l] = pipes[l].map((p) => (p.id === i.path?.pipeline_id ? { ...p, ...(i.body as ListPipeline) } : p)); return i.body; });
  g.handlers.set(OPS.saveContactSearch, () => ({ list_id: 99, saved: 50 }));
  const actions = () => new RecordStore(g, "roi_action").list().then((rs) => rs.map((r) => valuesToAction(r.values)));
  return { g, pipes: () => pipes, setPipes: (p: typeof pipes) => { pipes = p; }, actions };
}
const NOW = "2026-09-27T10:00:00Z";

describe("apply and undo", () => {
  it("turns on the skip flags and records the settings from before", async () => {
    const t = await setup();
    await applyRepeatSkip(t.g, [15], NOW);
    expect(t.pipes()[15][0].steps![0]).toMatchObject({ skip_recently_enriched: true, skip_existing_values: true });
    const [a] = await t.actions();
    expect(a).toMatchObject({ extId: "repeat_skip:15", kind: "repeat_skip", listId: 15, pipelineId: "p15", status: "applied" });
    expect((a.previous as { steps: { skip_recently_enriched: boolean }[] }).steps[0].skip_recently_enriched).toBe(false);
  });
  it("is idempotent: applying twice keeps one record and the original previous settings", async () => {
    const t = await setup();
    await applyRepeatSkip(t.g, [15], NOW);
    await applyRepeatSkip(t.g, [15], "2026-09-27T11:00:00Z");
    const all = await t.actions();
    expect(all).toHaveLength(1);
    expect(all[0].appliedAt).toBe(NOW);
    expect((all[0].previous as { steps: { skip_recently_enriched: boolean }[] }).steps[0].skip_recently_enriched).toBe(false);
  });
  it("undo restores the settings captured at the first apply, even if someone changed the pipeline since", async () => {
    const t = await setup();
    await applyPause(t.g, 15, NOW);
    const p = t.pipes(); p[15][0].steps![0].run_condition = "EDITED ELSEWHERE"; t.setPipes(p);
    const [a] = await t.actions();
    await undoAction(t.g, a);
    expect(t.pipes()[15][0].enabled).toBe(true);
    expect(t.pipes()[15][0].steps![0].run_condition).toBeNull();
    expect((await t.actions())[0].status).toBe("undone");
  });
  it("saves a lookalike search with the filters and 50 contacts, and refuses to undo it", async () => {
    const t = await setup();
    await applyLookalike(t.g, { listId: 15, title: "Lookalike of Sales VPs", filters: [{ field: "seniority_level", operator: "any_of", value: ["Vice President"] }] }, NOW);
    const call = t.g.calls.find((c) => c.op === OPS.saveContactSearch)!;
    expect(call.input.body).toEqual({ filters: [{ field: "seniority_level", operator: "any_of", value: ["Vice President"] }], list_title: "Lookalike of Sales VPs", max_results: 50 });
    const [a] = await t.actions();
    expect(a).toMatchObject({ kind: "lookalike", detail: { title: "Lookalike of Sales VPs", listId: 99 } });
    await expect(undoAction(t.g, a)).rejects.toThrow("Lookalike lists are never deleted");
  });
  it("skips a list with no enrichment pipeline and says so", async () => {
    const t = await setup();
    await expect(applyRepeatSkip(t.g, [42], NOW)).resolves.toEqual({ changed: [], skipped: [42] });
  });
});
```

Run: `npx vitest run tests/actions/apply-actions.test.ts` → FAIL (missing module).

- [ ] **Step 4: Implement `src/lib/actions/apply.ts`**

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { RecordStore } from "../store/records";
import { actionToValues, valuesToAction } from "../store/mappers";
import type { ActionRecord, ContactCacheRow } from "../domain/types";
import { findEnrichmentPipeline, listPipelines, patchPipeline, restorePipeline, type PipelinePatch, type PipelineSettings } from "../guardrail/pipeline";
import { ROI_FIT_FIELD_NAME, RUN_CONDITION, assertConditionFilters, validateCondition, writeFit } from "../guardrail/guardrail";

async function existing(c: G8Caller, extId: string): Promise<ActionRecord | null> {
  const r = (await new RecordStore(c, "roi_action").list()).find((x) => x.values.ext_id === extId);
  return r ? valuesToAction(r.values) : null;
}
async function save(c: G8Caller, a: ActionRecord): Promise<void> { await new RecordStore(c, "roi_action").upsert(actionToValues(a)); }

async function patchList(c: G8Caller, kind: "repeat_skip" | "pause_list" | "guardrail", listId: number, patch: PipelinePatch, now: string, detail: Record<string, unknown> = {}): Promise<boolean> {
  const extId = `${kind}:${listId}`;
  const prev = await existing(c, extId);
  if (prev?.status === "applied") return true; // idempotent: keep the first previous settings
  const p = await findEnrichmentPipeline(c, listId);
  if (!p) return false;
  const before = await patchPipeline(c, listId, p, patch);
  await save(c, { extId, kind, listId, pipelineId: p.id, appliedAt: now, status: "applied", previous: before, detail, simulated: false });
  return true;
}

export async function applyRepeatSkip(c: G8Caller, listIds: number[], now: string) {
  const changed: number[] = [], skipped: number[] = [];
  for (const l of listIds) (await patchList(c, "repeat_skip", l, { step: { skip_recently_enriched: true, skip_existing_values: true } }, now)) ? changed.push(l) : skipped.push(l);
  return { changed, skipped };
}

export async function applyPause(c: G8Caller, listId: number, now: string) {
  return patchList(c, "pause_list", listId, { enabled: false }, now);
}

export async function applyGuardrailRule(c: G8Caller, listId: number, rows: ContactCacheRow[], now: string) {
  await writeFit(c, { columnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fits: new Map(rows.map((r) => [r.contactId, r.fit])) });
  await validateCondition(c, RUN_CONDITION);
  await assertConditionFilters(c, { listId, listSize: rows.length, fieldName: ROI_FIT_FIELD_NAME, value: "low" });
  return patchList(c, "guardrail", listId, { step: { run_condition: RUN_CONDITION } }, now, { contacts: rows.length });
}

export async function applyLookalike(c: G8Caller, p: { listId: number; title: string; filters: { field: string; operator: string; value: string[] }[] }, now: string) {
  const extId = `lookalike:${p.listId}`;
  const prev = await existing(c, extId);
  if (prev?.status === "applied") return prev;
  const r = await c.call<{ list_id?: number; id?: number }>(OPS.saveContactSearch, { body: { filters: p.filters, list_title: p.title, max_results: 50 } });
  const rec: ActionRecord = { extId, kind: "lookalike", listId: p.listId, pipelineId: null, appliedAt: now, status: "applied", previous: null,
    detail: { title: p.title, listId: r.list_id ?? r.id ?? null, filters: p.filters }, simulated: false };
  await save(c, rec);
  return rec;
}

export async function undoAction(c: G8Caller, a: ActionRecord): Promise<void> {
  if (a.kind === "lookalike") throw new Error("Lookalike lists are never deleted from here. Remove the list in graph8 if you don't want it.");
  if (a.kind === "refund_request") throw new Error("A sent refund request can't be undone.");
  if (a.status !== "applied" || a.listId === null) return;
  const p = (await listPipelines(c, a.listId)).find((x) => x.id === a.pipelineId);
  if (!p) throw new Error("That pipeline no longer exists in graph8, so there is nothing to undo.");
  await restorePipeline(c, a.listId, p, a.previous as PipelineSettings);
  await save(c, { ...a, status: "undone" });
}
```

Run: `npx vitest run tests/actions/apply-actions.test.ts` → PASS.

- [ ] **Step 5: Server actions**

`src/app/(dash)/optimize/apply.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { currentCaller } from "@/lib/workspace/current";
import { loadDashboardData } from "@/lib/dashboard/data";
import { RecordStore } from "@/lib/store/records";
import { valuesToContact } from "@/lib/store/mappers";
import { lookalikeFilters } from "@/lib/domain/actions";
import { applyGuardrailRule, applyLookalike, applyPause, applyRepeatSkip, undoAction } from "@/lib/actions/apply";

type Result = { ok: boolean; message: string };
const DONE: Record<string, string> = { repeat: "Turned on", lookalike: "Built the lookalike list", pause: "Paused", guardrail: "Applied the rule" };

export async function applyAction(_: unknown, form: FormData): Promise<Result> {
  if (!(await isAuthed())) return { ok: false, message: "Sign in first." };
  if (form.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm the change in graph8." };
  const c = await currentCaller(), now = new Date().toISOString();
  const action = String(form.get("action")), listIds = String(form.get("listIds") ?? "").split(",").filter(Boolean).map(Number);
  try {
    const d = await loadDashboardData(c);
    const rows = (await new RecordStore(c, "roi_contact").list()).map((r) => valuesToContact(r.values));
    if (action === "repeat") {
      const r = await applyRepeatSkip(c, listIds, now);
      revalidatePath("/optimize");
      return { ok: true, message: `${DONE.repeat} for ${r.changed.length} ${r.changed.length === 1 ? "pipeline" : "pipelines"}${r.skipped.length ? `; ${r.skipped.length} list(s) have no pipeline` : ""}.` };
    }
    const listId = listIds[0];
    if (action === "lookalike") {
      const name = d.listNames.get(String(listId)) ?? `list ${listId}`;
      await applyLookalike(c, { listId, title: `Lookalike of ${name}`, filters: lookalikeFilters(rows.filter((r) => r.listIds.includes(listId))) }, now);
    } else if (action === "pause") {
      if (!(await applyPause(c, listId, now))) return { ok: false, message: "That list has no enrichment pipeline to pause." };
    } else if (action === "guardrail") {
      if (!(await applyGuardrailRule(c, listId, rows.filter((r) => r.listIds.includes(listId)), now))) return { ok: false, message: "That list has no enrichment pipeline." };
    } else return { ok: false, message: "Unknown action." };
    revalidatePath("/optimize");
    return { ok: true, message: `${DONE[action]}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function undo(form: FormData): Promise<void> {
  if (!(await isAuthed())) throw new Error("Sign in first.");
  const c = await currentCaller();
  const d = await loadDashboardData(c);
  const a = d.actions.find((x) => x.extId === String(form.get("extId")));
  if (a) await undoAction(c, a);
  revalidatePath("/optimize");
}
```

- [ ] **Step 6: Components**

`src/components/ActionCard.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import type { PlannedAction } from "@/lib/domain/actions";
import { applyAction } from "@/app/(dash)/optimize/apply";

export function ActionCard({ a }: { a: PlannedAction }) {
  const [state, act, pending] = useActionState(applyAction, undefined);
  const max = Math.max(1, ...a.chart.map((x) => x.value));
  return (
    <article className="act" id={a.id}>
      <div className="act-main">
        <div className="act-head"><h2>{a.title}</h2><span className="impact">{a.impact}</span></div>
        <p>{a.evidence}</p>
        {a.chart.length > 0 && (a.id === "repeat"
          ? <div className="evbar">{a.chart.map((x) => <span key={x.label} style={{ flex: x.value, background: x.tone }}>{x.label} {Math.round(x.value).toLocaleString("en-US")}</span>)}</div>
          : <div className="cmp">{a.chart.map((x) => <div key={x.label}><span>{x.label}</span><i style={{ width: `${(x.value / max) * 100}%`, background: x.tone }} /><b>{x.value.toFixed(1)}</b></div>)}</div>)}
        {a.steps.length > 0 && <ol className="steps2">{a.steps.map((s) => <li key={s.label} className={s.done ? "done" : undefined}><span>{s.label}</span><small>{s.sub}</small></li>)}</ol>}
        <p className="what">In graph8: {a.inGraph8}</p>
      </div>
      <div className="act-side">
        <span className="small">{a.confidence}</span>
        {a.button ? (
          <form action={act}>
            <input type="hidden" name="action" value={a.button.action} /><input type="hidden" name="listIds" value={a.button.listIds.join(",")} />
            <label className="small"><input type="checkbox" name="confirm" value="yes" /> Change this in graph8</label>
            <button className="btn primary" type="submit" disabled={pending}>{pending ? "Working…" : a.button.label}</button>
            <span className="small">0 credits</span>
          </form>) : <span className="done-tag">Done</span>}
        {state && <span className="toast" role="status">{state.ok ? state.message : `Not changed: ${state.message}`}</span>}
      </div>
    </article>
  );
}
```

`src/components/AppliedChanges.tsx`:

```tsx
import type { ActionRecord, Run } from "@/lib/domain/types";
import { toMs } from "@/lib/domain/time";
import { undo } from "@/app/(dash)/optimize/apply";

const LABEL: Record<string, string> = { repeat_skip: "Skip recently enriched", pause_list: "Paused enrichment", guardrail: "Skip unlikely contacts", lookalike: "Lookalike list" };

export function appliedSummary(a: ActionRecord, runs: Run[], listName: string): string {
  const when = new Date(a.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (a.kind === "lookalike") return `${when}. Saved as "${String(a.detail.title ?? "")}", 0 credits.`;
  const after = runs.filter((r) => r.kind === "pipeline_run" && r.listId === a.listId && r.startedAt && toMs(r.startedAt) > toMs(a.appliedAt));
  const skipped = after.reduce((s, r) => s + (r.recordsSkipped ?? 0), 0);
  const base = `${a.status === "undone" ? "Undone" : "Applied"} ${when} on ${listName}.`;
  if (a.kind === "pause_list") return `${base} ${after.length === 0 ? "No runs since." : `${after.length} manual runs since.`}`;
  return `${base} ${after.length === 0 ? "No runs since." : `${skipped} contacts skipped since, about ${skipped * 3} credits saved.`}`;
}

export function AppliedChanges({ actions, runs, listNames }: { actions: ActionRecord[]; runs: Run[]; listNames: Map<string, string> }) {
  const xs = actions.filter((a) => a.kind !== "refund_request").sort((a, b) => toMs(b.appliedAt) - toMs(a.appliedAt));
  return (
    <section className="panel" aria-labelledby="applied-h">
      <div className="ph"><h2 id="applied-h">Changes you&apos;ve made</h2><span className="small">What each one has done since</span></div>
      {xs.length === 0 && <p className="small">None yet. Changes you apply above show up here with what they did.</p>}
      {xs.map((a) => (
        <div className="applied" key={a.extId}>
          <i className="dot" style={{ background: a.status === "applied" ? "var(--booked)" : "var(--unknown)" }} />
          <div><b>{LABEL[a.kind]}</b><br /><span className="small">{appliedSummary(a, runs, listNamesGet(listNames, a.listId))}</span></div>
          {a.status === "applied" && a.kind !== "lookalike" && <form action={undo}><input type="hidden" name="extId" value={a.extId} /><button className="btn ghost" type="submit">Undo</button></form>}
        </div>))}
    </section>
  );
}
const listNamesGet = (m: Map<string, string>, id: number | null) => (id === null ? "the org" : m.get(String(id)) ?? `list ${id}`);
```

- [ ] **Step 7: Put the action plan on the Optimize page**

In `src/app/(dash)/optimize/page.tsx`, after `const plan = …`, build the actions and replace the returned JSX:

```tsx
import { periodView } from "@/lib/dashboard/data";
import { RecordStore } from "@/lib/store/records";
import { valuesToContact } from "@/lib/store/mappers";
import { buildActions } from "@/lib/domain/actions";
import { optimizeHeadline } from "@/lib/dashboard/story";
import { ActionCard } from "@/components/ActionCard";
import { AppliedChanges } from "@/components/AppliedChanges";
// …
  const v = periodView(d, "8w");
  const contacts = (await new RecordStore(c, "roi_contact").list()).map((r) => valuesToContact(r.values));
  const actions = buildActions({ charges: v.charges, stats: v.stats, listNames: d.listNames, contacts, actions: d.actions });
  const open = actions.filter((a) => !a.applied);
  return (
    <>
      <Headline text={optimizeHeadline({ count: open.length, monthly: open.reduce((s, a) => s + a.monthlyCredits, 0), hasMove: open.some((a) => a.id === "move-spend") })}
        lede="Each change comes from your own charges and meetings. Applying one changes a setting in graph8 and costs no credits; you can undo it here." />
      <div className="acts">{actions.map((a) => <ActionCard key={a.id} a={a} />)}</div>
      <AppliedChanges actions={d.actions} runs={d.runs} listNames={d.listNames} />
      <Planner plan={plan} choices={choices} hrefFor={hrefFor} />
    </>
  );
```

(Remove `plannerHeadline` from this page's imports; the planner keeps its own section heading.)

- [ ] **Step 8: Styles**

Append to `src/app/globals.css`:

```css
/* actions */
.acts{display:grid;gap:14px}
.act{display:grid;grid-template-columns:1fr 200px;gap:20px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 20px;scroll-margin-top:80px}
.act p{margin:6px 0;color:var(--ink-2);max-width:70ch}
.act-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}.act-head h2{font:600 17px var(--f-display)}
.impact{font:600 14px var(--f-display);color:var(--booked);white-space:nowrap}
.act-side{display:flex;flex-direction:column;gap:8px;justify-content:center;border-left:1px solid var(--line-2);padding-left:18px}
.act-side form{display:grid;gap:8px}
.what{font-size:13.5px;background:var(--panel-2);border-radius:6px;padding:8px 10px}
.evbar{display:flex;height:24px;border-radius:5px;overflow:hidden;font-size:12px;font-weight:600;margin:10px 0 4px}
.evbar span{display:flex;align-items:center;padding-left:8px;white-space:nowrap;overflow:hidden;color:var(--ink)}
.cmp div{display:grid;grid-template-columns:100px 1fr 40px;gap:10px;align-items:center;margin:5px 0;font-size:14px}
.cmp span{text-align:right;color:var(--ink-2)}.cmp i{display:block;height:13px;border-radius:2px}.cmp b{font-variant-numeric:tabular-nums}
.steps2{margin:10px 0 0;padding:0;list-style:none;counter-reset:s}
.steps2 li{counter-increment:s;display:grid;grid-template-columns:24px 1fr;column-gap:10px;padding:6px 0}
.steps2 li::before{content:counter(s);grid-row:span 2;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--ink-2);display:grid;place-items:center;font:600 12px var(--f-display);color:var(--ink-2)}
.steps2 li.done::before{content:"✓";background:var(--booked);border-color:var(--booked);color:#fff}
.steps2 li.done span{color:var(--muted);text-decoration:line-through}
.done-tag{font:600 13px var(--f-display);color:var(--booked)}
.applied{display:grid;grid-template-columns:14px 1fr auto;gap:10px;align-items:center;border-top:1px solid var(--line-2);padding:10px 0}
.applied:first-of-type{border-top:0}
@media (max-width:760px){.act{grid-template-columns:1fr}.act-side{border-left:0;padding-left:0;border-top:1px solid var(--line-2);padding-top:12px}}
```

- [ ] **Step 9: Verify, screenshot**

Run: `npx vitest run && npm run typecheck && npm run build` → PASS.
Screenshots: `npm run shots -- /optimize`. Compare with the prototype's Optimize screen: headline, three action cards (repeat enrichment with a believable few-hundred-credit figure after the re-seed, move spend with two steps, skip unlikely with the fit bar in the planner), "Changes you've made" (empty or listing earlier changes), and the planner below. The Overview "Do next" buttons jump to `#move-spend`, `#repeat` and `#plan`.

- [ ] **Step 10: Live test on a simulated list, then stop** ⏸

With the user's go-ahead for the simulated lists only:
1. Open `/optimize`, apply **Stop paying twice** only if its targets are simulated lists (15/16); otherwise use the planner's list picker to confirm which lists it targets and ask first.
2. In graph8 (or via `listListPipelines` for list 15), confirm the step now has `skip_recently_enriched: true` and `skip_existing_values: true`.
3. Press **Undo** in "Changes you've made" and confirm the flags are back to their previous values.

**Stop** before: pausing or guarding the Starter list (list 2), or building the lookalike list (it saves up to 50 new contacts into the CRM, 0 credits). Ask: "Apply X to the real Starter list / build a 50-contact lookalike list now? I'll undo the pipeline change right after." Record every live change and its undo in the task report.

- [ ] **Step 11: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests
git commit -m "feat(advisor): Optimize spend actions with apply, undo and a record of changes"
```

---
## Phase 2: depth

### Task 10: Trend and first-touch cohorts

Spec §4.10. Computed on the fly from charges and outcomes by pure functions (the recap and MCP can call the same functions), so nothing new is stored. This supersedes the spec's line about storing weekly `roi_stat` rows (YAGNI; same numbers, one less write path).

**Files:**
- Create: `src/lib/domain/trend.ts`, `src/components/TrendChart.tsx`
- Modify: `src/app/(dash)/page.tsx`, `src/app/globals.css`
- Test: `tests/domain/trend.test.ts`

**Interfaces:**
- Consumes: `AttributedCharge`, `Outcome`, `toMs`, `LineChart`.
- Produces: `rollingCostPerMeeting(charges, outcomes, now, weeks = 8, window = 4): TrendPoint[]` (`{ label: string; value: number | null }`), `trendSentence(points): string | null`, `firstTouchCohorts(charges, outcomes, now, weeks = 8, maturingWeeks = 3): Cohort[]` (`{ label; contacts; credits; meetings; costPerMeeting: number | null; maturing: boolean }`), `<TrendChart mode points cohorts hrefFor />`.

- [ ] **Step 1: Write the failing tests**

`tests/domain/trend.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rollingCostPerMeeting, trendSentence, firstTouchCohorts } from "@/lib/domain/trend";
import type { AttributedCharge, Outcome } from "@/lib/domain/types";

const NOW = "2026-09-27T00:00:00Z", DAY = 86_400_000, W = 7 * DAY, START = Date.parse(NOW) - 8 * W;
const at = (week: number, day = 1) => new Date(START + week * W + day * DAY).toISOString();
const ch = (id: string, week: number, credits: number, contactId: number | null = null): AttributedCharge => ({ ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment",
  credits, chargedAt: at(week), llmTier: null, tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: 2, contactId,
  segmentKey: null, explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: true });
const mt = (week: number, contactId: number | null = null, day = 2): Outcome => ({ extId: `m${week}${contactId}${day}`, type: "meeting_booked", occurredAt: at(week, day), contactId,
  companyId: null, dealId: null, amount: null, listId: 2, sequenceId: null, step: null, channel: null, segmentKey: null, source: "sim", simulated: true });

describe("rollingCostPerMeeting", () => {
  const credits = [800, 400, 400, 400, 400, 400, 400, 400], meetings = [0, 0, 1, 1, 2, 2, 2, 2];
  const charges = credits.map((c, i) => ch(`c${i}`, i, c));
  const outcomes = meetings.flatMap((m, i) => Array.from({ length: m }, (_, j) => mt(i, null, 2 + j)));
  const points = rollingCostPerMeeting(charges, outcomes, NOW);
  it("returns one point per week once four weeks of history exist", () => {
    expect(points.map((p) => p.value === null ? null : Math.round(p.value))).toEqual([1000, 400, 267, 229, 200]);
    expect(points[0].label).toBe("Aug 30");
    expect(points.at(-1)!.label).toBe("Sep 27");
  });
  it("describes the direction in plain words", () => expect(trendSentence(points)).toBe("Credits per meeting fell from 1,000 to 200 over the last 5 weeks."));
  it("has no sentence without two points", () => expect(trendSentence([{ label: "x", value: null }])).toBeNull());
});

describe("firstTouchCohorts", () => {
  const charges = [ch("a", 0, 100, 1), ch("b", 1, 100, 1), ch("c", 0, 100, 2), ch("d", 1, 200, 3), ch("e", 6, 300, 4)];
  const outcomes = [mt(2, 1), mt(3, 3), mt(7, 4)];
  const cohorts = firstTouchCohorts(charges, outcomes, NOW);
  it("puts each contact in the week of its first charge and counts each meeting once", () => {
    expect(cohorts[0]).toMatchObject({ contacts: 2, credits: 300, meetings: 1, costPerMeeting: 300, maturing: false });
    expect(cohorts[1]).toMatchObject({ contacts: 1, credits: 200, meetings: 1, costPerMeeting: 200 });
    expect(cohorts[6]).toMatchObject({ contacts: 1, credits: 300, meetings: 1, maturing: true });
    expect(cohorts[2]).toMatchObject({ contacts: 0, costPerMeeting: null });
    expect(cohorts.reduce((s, c) => s + c.meetings, 0)).toBe(3);
  });
});
```

Run: `npx vitest run tests/domain/trend.test.ts` → FAIL (missing module).

- [ ] **Step 2: Implement `src/lib/domain/trend.ts`**

```ts
import type { AttributedCharge, Outcome } from "./types";
import { toMs } from "./time";

const W = 7 * 86_400_000;
const label = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const n = (x: number) => Math.round(x).toLocaleString("en-US");

export interface TrendPoint { label: string; value: number | null }
export interface Cohort { label: string; contacts: number; credits: number; meetings: number; costPerMeeting: number | null; maturing: boolean }

export function rollingCostPerMeeting(charges: AttributedCharge[], outcomes: Outcome[], now: string, weeks = 8, window = 4): TrendPoint[] {
  const start = toMs(now) - weeks * W, idx = (t: number) => Math.floor((t - start) / W);
  const cr = Array<number>(weeks).fill(0), mt = Array<number>(weeks).fill(0);
  for (const c of charges) { const i = idx(toMs(c.chargedAt)); if (i >= 0 && i < weeks) cr[i] += c.credits; }
  for (const o of outcomes) if (o.type === "meeting_booked") { const i = idx(toMs(o.occurredAt)); if (i >= 0 && i < weeks) mt[i]++; }
  const out: TrendPoint[] = [];
  for (let k = window - 1; k < weeks; k++) {
    const c = cr.slice(k - window + 1, k + 1).reduce((a, b) => a + b, 0), m = mt.slice(k - window + 1, k + 1).reduce((a, b) => a + b, 0);
    out.push({ label: label(start + (k + 1) * W), value: m > 0 ? c / m : null });
  }
  return out;
}

export function trendSentence(points: TrendPoint[]): string | null {
  const v = points.filter((p): p is { label: string; value: number } => p.value !== null);
  if (v.length < 2) return null;
  const a = Math.round(v[0].value), b = Math.round(v.at(-1)!.value);
  if (a === b) return `Credits per meeting held at ${n(b)} over the last ${v.length} weeks.`;
  return `Credits per meeting ${b < a ? "fell" : "rose"} from ${n(a)} to ${n(b)} over the last ${v.length} weeks.`;
}

export function firstTouchCohorts(charges: AttributedCharge[], outcomes: Outcome[], now: string, weeks = 8, maturingWeeks = 3): Cohort[] {
  const start = toMs(now) - weeks * W, idx = (t: number) => Math.floor((t - start) / W);
  const inWin = charges.filter((c) => c.contactId !== null && idx(toMs(c.chargedAt)) >= 0 && idx(toMs(c.chargedAt)) < weeks);
  const first = new Map<number, number>();
  for (const c of inWin) first.set(c.contactId!, Math.min(first.get(c.contactId!) ?? Infinity, toMs(c.chargedAt)));
  const cohorts: Cohort[] = Array.from({ length: weeks }, (_, i) => ({ label: label(start + i * W), contacts: 0, credits: 0, meetings: 0, costPerMeeting: null, maturing: i >= weeks - maturingWeeks }));
  for (const [, t] of first) cohorts[idx(t)].contacts++;
  for (const c of inWin) cohorts[idx(first.get(c.contactId!)!)].credits += c.credits;
  for (const o of outcomes) if (o.type === "meeting_booked" && o.contactId !== null && first.has(o.contactId)) cohorts[idx(first.get(o.contactId)!)].meetings++;
  for (const c of cohorts) c.costPerMeeting = c.meetings > 0 ? c.credits / c.meetings : null;
  return cohorts;
}
```

Run: `npx vitest run tests/domain/trend.test.ts` → PASS.

- [ ] **Step 3: The chart component**

`src/components/TrendChart.tsx`:

```tsx
import Link from "next/link";
import type { Cohort, TrendPoint } from "@/lib/domain/trend";
import { trendSentence } from "@/lib/domain/trend";
import { LineChart } from "./LineChart";

export function TrendChart({ mode, points, cohorts, hrefFor }: { mode: "rolling" | "cohort"; points: TrendPoint[]; cohorts: Cohort[]; hrefFor: (m: "rolling" | "cohort") => string }) {
  const line = points.filter((p): p is { label: string; value: number } => p.value !== null);
  const max = Math.max(1, ...cohorts.map((c) => c.costPerMeeting ?? 0));
  return (
    <div className="trend">
      <div className="ph"><h2>{mode === "rolling" ? "Getting cheaper?" : "By week first enriched"}</h2>
        <span className="seg" role="group" aria-label="Trend view">
          <Link href={hrefFor("rolling")} className={mode === "rolling" ? "on" : undefined}>Rolling 4 weeks</Link>
          <Link href={hrefFor("cohort")} className={mode === "cohort" ? "on" : undefined}>By week spent</Link>
        </span></div>
      {mode === "rolling" ? (<>
        <p className="small">{trendSentence(points) ?? "Not enough weeks with meetings to show a trend yet."}</p>
        {line.length >= 2 && <LineChart points={line} unit="credits per meeting" ariaLabel={trendSentence(points) ?? "Credits per meeting over time"} />}
      </>) : (<>
        <p className="small">Credits per meeting for the contacts first enriched each week. Hatched weeks are still maturing: their meetings are still coming in.</p>
        <div className="cohorts" role="list">{cohorts.map((c) => (
          <div role="listitem" key={c.label} className={c.maturing ? "maturing" : undefined} title={`${c.label}: ${c.contacts} contacts, ${Math.round(c.credits)} credits, ${c.meetings} meetings`}>
            <span className="v">{c.costPerMeeting === null ? "—" : Math.round(c.costPerMeeting)}</span>
            <i style={{ height: `${((c.costPerMeeting ?? 0) / max) * 110}px` }} /><span className="small">{c.label}</span></div>))}</div>
      </>)}
    </div>
  );
}
```

- [ ] **Step 4: Show it on the Overview**

In `src/app/(dash)/page.tsx`: accept `trend` in `searchParams` (`Promise<{ period?: string; trend?: string }>`), import `rollingCostPerMeeting`, `firstTouchCohorts` and `TrendChart`, and inside the right-hand panel after the list bars add:

```tsx
          <TrendChart mode={sp.trend === "cohort" ? "cohort" : "rolling"} points={rollingCostPerMeeting(d.charges, d.outcomes, d.now)}
            cohorts={firstTouchCohorts(d.charges, d.outcomes, d.now)}
            hrefFor={(m) => `/?${new URLSearchParams({ ...(m === "cohort" ? { trend: "cohort" } : {}), ...(period === "30d" ? { period: "30d" } : {}) })}`} />
```

(Read `searchParams` once into `sp` at the top: `const sp = await searchParams; const period = parsePeriod(sp.period);`.) The trend always spans 8 weeks; the period switch does not shorten it.

Append to `globals.css`:

```css
.trend{margin-top:22px}
.cohorts{display:flex;align-items:flex-end;gap:8px;height:160px}
.cohorts div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;font-size:12px}
.cohorts i{display:block;width:100%;background:var(--accent);border-radius:3px 3px 0 0;min-height:2px}
.cohorts .maturing i{background:repeating-linear-gradient(135deg,var(--accent) 0 4px,color-mix(in srgb,var(--accent) 35%,transparent) 4px 8px)}
.cohorts .v{font-variant-numeric:tabular-nums;font-weight:600}
```

- [ ] **Step 5: Verify, screenshot, commit**

Run: `npx vitest run && npm run typecheck && npm run build` → PASS. `npm run shots -- / "/?trend=cohort"`: the rolling line with a sentence ("Credits per meeting fell from … to …"), and after the re-seed, cohort bars in most weeks with the last three hatched.

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests/domain/trend.test.ts
git commit -m "feat(advisor): rolling cost-per-meeting trend and first-touch cohorts on the Overview"
```

---

### Task 11: MCP and recap wording, docs, production deploy

Spec §4.1 (demo-data note), §9 task 11.

**Files:**
- Modify: `src/lib/mcp/tools.ts`, `src/lib/recap/recap.ts`, `tests/mcp/tools.test.ts`, `tests/recap/recap.test.ts`, `docs/DEMO.md`, `docs/HANDOFF.md`, `README.md`

**Interfaces:**
- Consumes: `periodView` (Task 1), `DashboardData.hasDemoData`, `listNames`.
- Produces: MCP answers over the last 8 weeks with "Includes demo data." when applicable; `cost_per_outcome` accepts a list name ("Sales VPs") as well as an id.

- [ ] **Step 1: Update the tests**

In `tests/mcp/tools.test.ts`: change the expected `costPerOutcome` string's ending from `Includes simulated data.` to `Includes demo data.`; set `listNames: new Map([["15", "Sales VPs"]])` in `d`, add a list stat and a test:

```ts
  it("accepts a list name and answers with it", () => {
    const d2 = { ...d, stats: [...d.stats, { ...d.stats[0], dimension: "list" as const, value: "15" }] };
    expect(costPerOutcome(d2, { dimension: "list", value: "sales vps" })).toMatch(/^Sales VPs: 124 credits per meeting/);
  });
  it("summarises the last 8 weeks and flags demo data", () => expect(roiSummary(d)).toMatch(/^1,260 credits spent in the last 8 weeks; .* Includes demo data\.$/));
```

In `tests/recap/recap.test.ts` change the expected first block text to `"Last week: 2,900 credits → 11 meetings (264 each), includes demo data"`.

Run: `npx vitest run tests/mcp tests/recap` → FAIL on the new expectations.

- [ ] **Step 2: Implement**

In `src/lib/mcp/tools.ts`:

```ts
import { periodView } from "../dashboard/data";
const demo = (d: DashboardData) => (d.hasDemoData ? " Includes demo data." : "");

export function roiSummary(d: DashboardData): string {
  const v = periodView(d, "8w");
  const pct = v.coverage.total ? Math.round((v.coverage.exact / v.coverage.total) * 100) : 0;
  const cpm = v.meetings > 0 ? `${n(v.coverage.total / v.meetings)} credits per meeting` : "no meetings recorded yet";
  return `${n(v.coverage.total)} credits spent in the last 8 weeks; ${pct}% traced to a contact, list or run; ${n(v.waste)} wasted; ${cpm}.${demo(d)}`;
}

export function costPerOutcome(d: DashboardData, p: { dimension: "list" | "segment" | "service"; value: string }): string {
  const byName = p.dimension === "list" && !/^\d+$/.test(p.value)
    ? [...d.listNames].find(([, name]) => name.toLowerCase() === p.value.trim().toLowerCase())?.[0] : undefined;
  const key = byName ?? p.value;
  const s = d.stats.find((x) => x.period === "8w" && x.dimension === p.dimension && x.value === key);
  const label = p.dimension === "list" ? d.listNames.get(key) ?? p.value : p.value;
  if (!s) return `No data for ${p.dimension} "${p.value}".`;
  if (s.costPerMeeting === null) return `${label}: ${n(s.credits)} credits, no meetings yet.${demo(d)}`;
  const vs = s.vsAvgPct === null ? "" : `${Math.abs(Math.round(s.vsAvgPct))}% ${s.vsAvgPct < 0 ? "below" : "above"} average, `;
  return `${label}: ${n(s.costPerMeeting)} credits per meeting across ${n(s.meetings)} meetings (${vs}${s.confidence} confidence).${demo(d)}`;
}
```

In `src/lib/recap/recap.ts`, change the headline suffix from `${p.simulated ? " [sim]" : ""}` to `${p.simulated ? ", includes demo data" : ""}`.

Run: `npx vitest run` → PASS; `npm run typecheck` → clean.

- [ ] **Step 3: Update the docs**

- `docs/DEMO.md`: replace "Click steps" with the v2 path, and fix the stale MCP note (graph8 **can** call the server over SSE; HANDOFF §11):
  1. **Overview.** Read the headline aloud; say once that meetings, deals and the email-finding spend are simulated (the pill says so). Hover a flow band, then click "Booked a meeting".
  2. **Charges** opens filtered. Clear the filter; expand the AI enrichment row ("3 jobs").
  3. **Recovery.** Click the Sep 26 week; show the owner columns and the refund draft. **Do not send.**
  4. **Optimize spend.** Walk the three action cards; show "Changes you've made"; in the planner switch Find emails ↔ Verify emails to show the cost walk and forecast. **Do not run.**
  5. **Weekly recap in `#roi-advisor`** and **MCP** as before (`cost_per_outcome` now accepts "Sales VPs").
  Update "Known numbers to say out loud" from `npm run script -- scripts/check-sim.ts`.
- `docs/HANDOFF.md`: add a "v2 build status (2026-09-27)" section at the top: tasks done, the re-seed numbers, fit spread, live actions applied and undone, test count, anything deferred.
- `README.md`: rename the title line to "Credit Compass" (already) and point "Approved UI" at `docs/design/credit-compass-ui-v2.html`.

- [ ] **Step 4: Full check, deploy, verify production**

```bash
cd advisor && npx vitest run && npm run typecheck && npm run build
npx vercel deploy --prod --scope momin11
```

Expected: tests pass, build ok, deploy prints the production URL (`https://graph8-roi-advisor.vercel.app`).

Verify production:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://graph8-roi-advisor.vercel.app/api/cron/poll        # 401
BASE_URL=https://graph8-roi-advisor.vercel.app npm run shots -- / /charges /recovery /optimize "/?trend=cohort"
```

Expected: 401 for the unauthenticated cron; screenshots of all four screens with no console errors and no horizontal overflow at 390 px; the `/optimize` line prints **under 3,000 ms** (record the number). Then press **Sync now** once in production and confirm the numbers match `check-sim.ts`. Call the MCP `roi_summary` tool with the bearer token (as in HANDOFF §11) and confirm it ends with "Includes demo data."

- [ ] **Step 5: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests docs README.md
git commit -m "feat(advisor): demo-data wording in MCP and recap; v2 demo script and handoff"
```

---
## Phase 3: connect your own graph8 account

Spec §8. The demo workspace (this org, env key, shared password) keeps working exactly as before. A connected org is a **workspace**: its API key is encrypted in the existing Upstash Redis, its data stays in its own graph8 custom objects, and its sign-in is the API key itself.

New env vars (add to `advisor/.env.local`, `.env.example` and Vercel production; generate with `openssl rand -hex 32`): `WORKSPACE_KEY_SECRET` (encrypts keys and webhook secrets), `SESSION_SECRET` (signs the workspace session cookie). `REDIS_URL` already exists.

### Task 12: Spike: graph8 app install ⏸

Spec §8.1. Output is an answer, not code to keep (the script stays in `scripts/` as a record).

**Files:**
- Modify: `src/lib/g8/ops.ts` (add `listApps: "list_apps_apps_get"`, `createApp: "create_app_apps_post"`)
- Create: `scripts/app-spike.ts`

- [ ] **Step 1: Ask the user** ⏸ "The spike makes one `POST /apps` (name "Credit Compass", slug "credit-compass"). If we're allowlisted it creates an empty app record in this org (no install, no credits); if not, graph8 answers 403. OK to run it?" Continue only on yes.

- [ ] **Step 2: Run it**

`scripts/app-spike.ts`:

```ts
import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { G8Error } from "@graph8/sdk";
console.log("before:", JSON.stringify(await c.call(OPS.listApps)));
try {
  const app = await c.call<Record<string, unknown>>(OPS.createApp, { body: { name: "Credit Compass", slug: "credit-compass" } });
  console.log("created:", JSON.stringify(app));
} catch (e) {
  if (e instanceof G8Error) console.log("refused:", e.status, e.code ?? "", e.message); else throw e;
}
```

Run: `npx vitest run tests/g8/contract.test.ts && npm run script -- scripts/app-spike.ts`

- [ ] **Step 3: Record the answer and commit**

Add "App-install spike (2026-09-27)" to `docs/HANDOFF.md`: the exact response (403 `builder_not_allowlisted`, or the created app's id and status), and what it means: allowlisted → an `AppInstallConnector` (consent + tenant-bound credential via `createGraph8ServiceClient`) can replace the API-key connector later; not allowlisted → ask graph8 to enable the org as an app builder. Do not install the app anywhere.

```bash
cd /home/opc/graph8 && git add advisor/src/lib/g8/ops.ts advisor/scripts/app-spike.ts docs/HANDOFF.md && git commit -m "chore(advisor): graph8 app-install spike result"
```

---

### Task 13: Workspaces, key encryption, per-workspace caller and sign-in

**Files:**
- Create: `src/lib/workspace/crypto.ts`, `src/lib/workspace/store.ts`, `src/lib/workspace/session.ts`
- Modify: `src/lib/g8/client.ts` (add `callerFor`), `src/lib/workspace/current.ts`, `src/lib/auth.ts`, `src/lib/guardrail/guardrail.ts` (`runCondition(fieldName)`), call sites of `RUN_CONDITION` / `ROI_FIT_FIELD_NAME` / `ROI_FIT_COLUMN_ID`, `package.json` (`redis` direct dependency), `.env.example`
- Test: `tests/workspace/crypto.test.ts`, `tests/workspace/store.test.ts`, `tests/workspace/current.test.ts` (extend), `tests/guardrail/guardrail.test.ts` (add)

**Interfaces:**
- Produces:
  - `encrypt(plain, secret): string`, `decrypt(blob, secret): string`, `keyHash(apiKey): string`
  - `interface Workspace { id; orgId; orgName; demo: false; keyCipher; keyHash; webhookId: string | null; webhookSecretCipher: string | null; mcpTokenHash: string | null; fitColumnId: number | null; fitFieldName: string | null; createdAt }`
  - `interface WorkspaceStore { get(id); findByKeyHash(h); findByMcpTokenHash(h); put(w); remove(id); list() }`, `MemoryWorkspaceStore`, `RedisWorkspaceStore`, `workspaceStore(): WorkspaceStore` (Redis when `REDIS_URL` is set)
  - `callerFor(apiKey: string): G8Caller`
  - `signSession(id)`, `verifySession(value): string | null`, cookie `cc_ws`
  - `currentWorkspace(): Promise<{ id: string; demo: boolean; orgId: string; orgName: string; fitColumnId: number; fitFieldName: string }>`, `currentCaller()` (now per workspace)
  - `runCondition(fieldName: string): string`

- [ ] **Step 1: Crypto (test first)**

`tests/workspace/crypto.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt, keyHash } from "@/lib/workspace/crypto";
const S = "a".repeat(64);
describe("workspace crypto", () => {
  it("round-trips and never contains the plain text", () => {
    const blob = encrypt("g8_live_secret", S);
    expect(blob).not.toContain("g8_live_secret");
    expect(decrypt(blob, S)).toBe("g8_live_secret");
    expect(encrypt("g8_live_secret", S)).not.toBe(blob); // random IV
  });
  it("rejects a tampered blob or the wrong secret", () => {
    const blob = encrypt("x", S);
    expect(() => decrypt(blob.slice(0, -4) + "AAAA", S)).toThrow();
    expect(() => decrypt(blob, "b".repeat(64))).toThrow();
  });
  it("hashes keys stably without revealing them", () => { expect(keyHash("k")).toBe(keyHash("k")); expect(keyHash("k")).not.toContain("k"); expect(keyHash("k")).toHaveLength(64); });
});
```

`src/lib/workspace/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
const k = (secret: string) => createHash("sha256").update(secret).digest();
export function encrypt(plain: string, secret: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", k(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
export function decrypt(blob: string, secret: string): string {
  const b = Buffer.from(blob, "base64url"), d = createDecipheriv("aes-256-gcm", k(secret), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
export function keyHash(apiKey: string): string { return createHash("sha256").update(`credit-compass-key:${apiKey}`).digest("hex"); }
```

Run: `npx vitest run tests/workspace/crypto.test.ts` → PASS.

- [ ] **Step 2: Workspace store (test first)**

`tests/workspace/store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MemoryWorkspaceStore, type Workspace } from "@/lib/workspace/store";
const w: Workspace = { id: "w1", orgId: "org_a", orgName: "Acme", demo: false, keyCipher: "c", keyHash: "h1", webhookId: null, webhookSecretCipher: null,
  mcpTokenHash: null, fitColumnId: null, fitFieldName: null, createdAt: "2026-09-27T00:00:00Z" };
describe("MemoryWorkspaceStore", () => {
  it("stores, finds by key hash, lists and removes", async () => {
    const s = new MemoryWorkspaceStore();
    await s.put(w);
    expect(await s.get("w1")).toEqual(w);
    expect((await s.findByKeyHash("h1"))?.id).toBe("w1");
    expect(await s.list()).toHaveLength(1);
    await s.remove("w1");
    expect(await s.get("w1")).toBeNull();
    expect(await s.findByKeyHash("h1")).toBeNull();
  });
});
```

`src/lib/workspace/store.ts`:

```ts
import { createClient } from "redis";

export interface Workspace { id: string; orgId: string; orgName: string; demo: false; keyCipher: string; keyHash: string; webhookId: string | null;
  webhookSecretCipher: string | null; mcpTokenHash: string | null; fitColumnId: number | null; fitFieldName: string | null; createdAt: string }
export interface WorkspaceStore { get(id: string): Promise<Workspace | null>; findByKeyHash(h: string): Promise<Workspace | null>;
  findByMcpTokenHash(h: string): Promise<Workspace | null>; put(w: Workspace): Promise<void>; remove(id: string): Promise<void>; list(): Promise<Workspace[]> }

export class MemoryWorkspaceStore implements WorkspaceStore {
  private m = new Map<string, Workspace>();
  async get(id: string) { return this.m.get(id) ?? null; }
  async findByKeyHash(h: string) { return [...this.m.values()].find((w) => w.keyHash === h) ?? null; }
  async findByMcpTokenHash(h: string) { return [...this.m.values()].find((w) => w.mcpTokenHash === h) ?? null; }
  async put(w: Workspace) { this.m.set(w.id, w); }
  async remove(id: string) { this.m.delete(id); }
  async list() { return [...this.m.values()]; }
}

export class RedisWorkspaceStore implements WorkspaceStore {
  private client = createClient({ url: process.env.REDIS_URL });
  private ready: Promise<unknown> | null = null;
  private async r() { if (!this.ready) this.ready = this.client.connect(); await this.ready; return this.client; }
  async get(id: string) { const v = await (await this.r()).get(`cc:ws:${id}`); return v ? (JSON.parse(v) as Workspace) : null; }
  async findByKeyHash(h: string) { const id = await (await this.r()).get(`cc:wskey:${h}`); return id ? this.get(id) : null; }
  async findByMcpTokenHash(h: string) { const id = await (await this.r()).get(`cc:wsmcp:${h}`); return id ? this.get(id) : null; }
  async put(w: Workspace) {
    const r = await this.r();
    await r.set(`cc:ws:${w.id}`, JSON.stringify(w)); await r.set(`cc:wskey:${w.keyHash}`, w.id); await r.sAdd("cc:ws:all", w.id);
    if (w.mcpTokenHash) await r.set(`cc:wsmcp:${w.mcpTokenHash}`, w.id);
  }
  async remove(id: string) {
    const r = await this.r(), w = await this.get(id);
    if (!w) return;
    await r.del([`cc:ws:${id}`, `cc:wskey:${w.keyHash}`, ...(w.mcpTokenHash ? [`cc:wsmcp:${w.mcpTokenHash}`] : [])]); await r.sRem("cc:ws:all", id);
  }
  async list() { const ids = await (await this.r()).sMembers("cc:ws:all"); return (await Promise.all(ids.map((id) => this.get(id)))).filter((w): w is Workspace => !!w); }
}

let store: WorkspaceStore | null = null;
export function workspaceStore(): WorkspaceStore { return (store ??= process.env.REDIS_URL ? new RedisWorkspaceStore() : new MemoryWorkspaceStore()); }
export function setWorkspaceStoreForTests(s: WorkspaceStore) { store = s; }
```

Make `redis` a direct dependency at the version already installed: `npm install --save-exact redis@4.7.1`. Run: `npx vitest run tests/workspace/store.test.ts` → PASS.

- [ ] **Step 3: Per-key caller**

In `src/lib/g8/client.ts` add (keep `g8Caller` unchanged):

```ts
import { createApiClient } from "@graph8/sdk";
const perKey = new Map<string, G8Caller>();
export function callerFor(apiKey: string): G8Caller {
  const hit = perKey.get(apiKey);
  if (hit) return hit;
  const api = createApiClient(apiKey);
  const own = new RateLimiter({ perSecond: 40, perMinute: 900 });
  const c: G8Caller = {
    async callRaw<T>(op: string, input: CallInput = {}) { await own.take(); return (await (api.call as (id: string, i: CallInput) => Promise<unknown>)(op, input)) as T; },
    async call<T>(op: string, input: CallInput = {}) { return unwrap<T>(await this.callRaw(op, input)); },
  };
  perKey.set(apiKey, c);
  return c;
}
```

- [ ] **Step 4: Session cookie and current workspace (test first)**

Extend `tests/workspace/current.test.ts`:

```ts
import { signSession, verifySession } from "@/lib/workspace/session";
describe("workspace session", () => {
  it("signs and verifies a workspace id; rejects tampering", () => {
    process.env.SESSION_SECRET = "s".repeat(64);
    const v = signSession("w1");
    expect(verifySession(v)).toBe("w1");
    expect(verifySession(v.replace("w1", "w2"))).toBeNull();
    expect(verifySession("garbage")).toBeNull();
  });
});
```

`src/lib/workspace/session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
export const WORKSPACE_COOKIE = "cc_ws";
const sig = (id: string) => createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`ws:${id}`).digest("base64url");
export function signSession(id: string): string { return `${id}.${sig(id)}`; }
export function verifySession(value: string | undefined | null): string | null {
  if (!value || !process.env.SESSION_SECRET) return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const id = value.slice(0, i), a = Buffer.from(value.slice(i + 1)), b = Buffer.from(sig(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
```

Replace `src/lib/workspace/current.ts`:

```ts
import { cache } from "react";
import { cookies } from "next/headers";
import { g8Caller, callerFor, type G8Caller } from "../g8/client";
import { decrypt } from "./crypto";
import { workspaceStore } from "./store";
import { verifySession, WORKSPACE_COOKIE } from "./session";

export interface CurrentWorkspace { id: string; demo: boolean; orgId: string; orgName: string; fitColumnId: number; fitFieldName: string; caller: G8Caller }

const demo = (): CurrentWorkspace => ({ id: "demo", demo: true, orgId: process.env.G8_ORG_ID ?? "", orgName: "Demo workspace",
  fitColumnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fitFieldName: process.env.ROI_FIT_FORMULA_NAME ?? "udo_roi_fit_11e946f0", caller: g8Caller });

export const currentWorkspace = cache(async (): Promise<CurrentWorkspace> => {
  let id: string | null = null;
  try { id = verifySession((await cookies()).get(WORKSPACE_COOKIE)?.value); } catch { id = null; } // outside a request (scripts, tests)
  if (!id) return demo();
  const w = await workspaceStore().get(id);
  if (!w) return demo();
  return { id: w.id, demo: false, orgId: w.orgId, orgName: w.orgName, fitColumnId: w.fitColumnId ?? 0, fitFieldName: w.fitFieldName ?? "",
    caller: callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? "")) };
});

export const currentCaller = cache(async (): Promise<G8Caller> => (await currentWorkspace()).caller);
```

In `src/lib/auth.ts`, make `isAuthed()` also accept a valid workspace session:

```ts
import { verifySession, WORKSPACE_COOKIE } from "./workspace/session";
export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  if (verifySession(jar.get(WORKSPACE_COOKIE)?.value)) return true;
  const pw = process.env.DASHBOARD_PASSWORD;
  return !!pw && jar.get(SESSION_COOKIE)?.value === sessionValue(pw);
}
```

Run: `npx vitest run tests/workspace` → PASS (the first `currentCaller` test still gets `g8Caller`: no cookie scope in tests → demo).

- [ ] **Step 5: Fit field per workspace**

In `src/lib/guardrail/guardrail.ts` add `export const runCondition = (fieldName: string) => \`NOT(EQ({{${fieldName}}}, "low"))\`;` and keep `RUN_CONDITION = runCondition(ROI_FIT_FIELD_NAME)` for compatibility. Test:

```ts
it("builds the run condition for any fit field", () => expect(runCondition("udo_roi_fit_abc")).toBe('NOT(EQ({{udo_roi_fit_abc}}, "low"))'));
```

Then change every call site to use the workspace's field: in `src/lib/actions/apply.ts` give `applyGuardrailRule` a `field: { columnId: number; name: string }` parameter and use `field.columnId`, `runCondition(field.name)`, `fieldName: field.name`; in `optimize/apply.ts` and `optimize/actions.ts` pass `{ columnId: ws.fitColumnId, name: ws.fitFieldName }` from `await currentWorkspace()`; in `Planner.tsx` receive `rule: string` as a prop (the page passes `runCondition(ws.fitFieldName)`). Update `tests/actions/apply-actions.test.ts` calls accordingly. `grep -rn "ROI_FIT_COLUMN_ID\|RUN_CONDITION" src` → only `guardrail.ts` and `current.ts` remain. Also replace `process.env.G8_ORG_ID` in `src/app/(dash)/recovery/page.tsx` with `(await currentWorkspace()).orgId`, so a connected org's refund request names its own org.

Run: `npx vitest run && npm run typecheck` → PASS, clean.

- [ ] **Step 6: Commit**

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests advisor/package.json advisor/package-lock.json .env.example
git commit -m "feat(advisor): workspaces with encrypted keys, per-key graph8 caller and workspace sessions"
```

---

### Task 14: Connect flow and org bootstrap

**Files:**
- Create: `src/lib/workspace/connector.ts`, `src/lib/workspace/bootstrap.ts`, `src/app/connect/page.tsx`, `src/app/connect/actions.ts`, `src/app/connect/ConnectForm.tsx`, `scripts/me-shape.ts`
- Modify: `src/lib/g8/ops.ts` (add `deleteWebhook: "delete_webhook_webhooks__webhook_id__delete"`), `src/app/login/page.tsx` (link "Connect your graph8 account"), `scripts/bootstrap.ts` (use `bootstrapOrg`)
- Test: `tests/workspace/connect.test.ts`, `tests/workspace/bootstrap.test.ts`

**Interfaces:**
- Produces: `interface Connector { verify(): Promise<VerifyResult>; caller(): G8Caller }`, `ApiKeyConnector`, `parseMe(body): { orgId: string | null; orgName: string | null }`, `REQUIRED_READS`, `connectWorkspace(apiKey, deps): Promise<{ ok: true; workspace: Workspace; mcpToken: string } | { ok: false; error: string }>`, `bootstrapOrg(c, { webhookUrl }): Promise<{ webhookId; webhookSecret; fitColumnId; fitFieldName }>`.

- [ ] **Step 1: See the real `/me` shape (read-only)**

`scripts/me-shape.ts`:

```ts
const r = await fetch("https://be.graph8.com/api/v1/me", { headers: { Authorization: `Bearer ${process.env.G8_API_KEY}`, "User-Agent": "credit-compass" } });
const body = await r.json() as Record<string, unknown>;
const d = (body.data ?? body) as Record<string, unknown>;
console.log(r.status, "top-level keys:", Object.keys(d));
for (const k of Object.keys(d)) if (/org|organi[sz]ation|user|name/i.test(k)) console.log(k, "=>", JSON.stringify(d[k]).slice(0, 200));
```

Run: `npm run script -- scripts/me-shape.ts`. Note which key holds the org id (`org_…`) and name. If it differs from the paths in `parseMe` below, add that path first in `parseMe` and in the test.

- [ ] **Step 2: Write the failing connector tests** (Review Focus 5)

`tests/workspace/connect.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { G8Error } from "@graph8/sdk";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { parseMe, connectWorkspace, REQUIRED_READS } from "@/lib/workspace/connector";
import { MemoryWorkspaceStore } from "@/lib/workspace/store";
import { decrypt } from "@/lib/workspace/crypto";

const SECRET = "k".repeat(64);
function fakeFor(opts: { status?: number; deny?: string[] } = {}) {
  const g = new FakeG8();
  for (const [op] of REQUIRED_READS) g.handlers.set(op, () => {
    if (opts.deny?.includes(op)) throw new G8Error({ message: "forbidden", status: 403, type: "forbidden", code: "missing_scope" });
    return [];
  });
  return g;
}
const deps = (g: FakeG8, me: { status: number; body: unknown }) => ({ store: new MemoryWorkspaceStore(), secret: SECRET, now: "2026-09-27T00:00:00Z",
  makeCaller: () => g, fetchMe: async () => me, bootstrap: async () => ({ webhookId: "wh1", webhookSecret: "whs", fitColumnId: 900, fitFieldName: "udo_roi_fit_x" }) });

describe("parseMe", () => {
  it("finds the org in common shapes", () => {
    expect(parseMe({ data: { org_id: "org_1", org_name: "Acme" } })).toEqual({ orgId: "org_1", orgName: "Acme" });
    expect(parseMe({ data: { organization: { id: "org_2", name: "Beta" } } })).toEqual({ orgId: "org_2", orgName: "Beta" });
    expect(parseMe({})).toEqual({ orgId: null, orgName: null });
  });
});

describe("connectWorkspace", () => {
  it("trims the key, stores it encrypted and returns an MCP token", async () => {
    const d = deps(fakeFor(), { status: 200, body: { data: { org_id: "org_1", org_name: "Acme" } } });
    const r = await connectWorkspace("  g8_key_123 \n", d);
    expect(r.ok).toBe(true);
    const [w] = await d.store.list();
    expect(w).toMatchObject({ orgId: "org_1", orgName: "Acme", webhookId: "wh1", fitColumnId: 900, fitFieldName: "udo_roi_fit_x" });
    expect(w.keyCipher).not.toContain("g8_key_123");
    expect(decrypt(w.keyCipher, SECRET)).toBe("g8_key_123");
    if (r.ok) expect(r.mcpToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });
  it("explains a rejected key and stores nothing", async () => {
    const d = deps(fakeFor(), { status: 401, body: {} });
    expect(await connectWorkspace("bad", d)).toEqual({ ok: false, error: "graph8 didn't accept that key. Copy it again from graph8 → Settings → API." });
    expect(await d.store.list()).toEqual([]);
  });
  it("lists missing permissions in plain words and stores nothing", async () => {
    const d = deps(fakeFor({ deny: [OPS.listUsageTransactions] }), { status: 200, body: { data: { org_id: "org_1" } } });
    const r = await connectWorkspace("k", d);
    expect(r).toEqual({ ok: false, error: "This key can't see the credit ledger. Create a key with read access to usage, then try again." });
    expect(await d.store.list()).toEqual([]);
  });
  it("refuses an empty key", async () => expect((await connectWorkspace("   ", deps(fakeFor(), { status: 200, body: {} }))).ok).toBe(false));
  it("reuses the workspace when the same org connects again", async () => {
    const d = deps(fakeFor(), { status: 200, body: { data: { org_id: "org_1" } } });
    await connectWorkspace("k1", d); await connectWorkspace("k2", d);
    expect(await d.store.list()).toHaveLength(1);
  });
});
```

Run: `npx vitest run tests/workspace/connect.test.ts` → FAIL (missing module).

- [ ] **Step 3: Implement `src/lib/workspace/connector.ts`**

```ts
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { G8Error } from "@graph8/sdk";
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { encrypt, keyHash } from "./crypto";
import type { Workspace, WorkspaceStore } from "./store";

export const REQUIRED_READS: [string, string][] = [
  [OPS.listUsageTransactions, "can't see the credit ledger. Create a key with read access to usage"],
  [OPS.listLists, "can't read your lists. Create a key with read access to lists"],
  [OPS.listObjects, "can't read custom objects. Create a key with access to objects"],
  [OPS.listDeals, "can't read deals. Create a key with read access to deals"],
  [OPS.listWebhooks, "can't read webhooks. Create a key with access to webhooks"],
];

export function parseMe(body: unknown): { orgId: string | null; orgName: string | null } {
  const d = ((body as { data?: unknown })?.data ?? body ?? {}) as Record<string, any>;
  const orgId = d.org_id ?? d.organization_id ?? d.org?.id ?? d.organization?.id ?? d.user?.org_id ?? null;
  const orgName = d.org_name ?? d.organization_name ?? d.org?.name ?? d.organization?.name ?? null;
  return { orgId: orgId ? String(orgId) : null, orgName: orgName ? String(orgName) : null };
}

export interface ConnectDeps {
  store: WorkspaceStore; secret: string; now: string; makeCaller: (key: string) => G8Caller;
  fetchMe: (key: string) => Promise<{ status: number; body: unknown }>;
  bootstrap: (c: G8Caller, workspaceId: string) => Promise<{ webhookId: string; webhookSecret: string; fitColumnId: number; fitFieldName: string }>;
}

export async function connectWorkspace(raw: string, deps: ConnectDeps): Promise<{ ok: true; workspace: Workspace; mcpToken: string } | { ok: false; error: string }> {
  const key = raw.trim();
  if (!key) return { ok: false, error: "Paste an API key from graph8 → Settings → API." };
  const me = await deps.fetchMe(key);
  if (me.status === 401 || me.status === 403) return { ok: false, error: "graph8 didn't accept that key. Copy it again from graph8 → Settings → API." };
  if (me.status >= 400) return { ok: false, error: `graph8 answered ${me.status}. Try again in a minute.` };
  const { orgId, orgName } = parseMe(me.body);
  if (!orgId) return { ok: false, error: "graph8 didn't say which organization this key belongs to. Use an organization API key." };
  const c = deps.makeCaller(key);
  for (const [op, why] of REQUIRED_READS) {
    try { await c.call(op, op === OPS.listUsageTransactions || op === OPS.listDeals ? { query: { page: 1, limit: 1 } } : {}); }
    catch (e) { if (e instanceof G8Error && (e.status === 401 || e.status === 403)) return { ok: false, error: `This key ${why}, then try again.` }; throw e; }
  }
  const existing = (await deps.store.list()).find((w) => w.orgId === orgId);
  const id = existing?.id ?? randomUUID();
  const setup = await deps.bootstrap(c, id);
  const mcpToken = randomBytes(32).toString("base64url");
  if (existing) await deps.store.remove(existing.id);
  const workspace: Workspace = { id, orgId, orgName: orgName ?? orgId, demo: false, keyCipher: encrypt(key, deps.secret), keyHash: keyHash(key),
    webhookId: setup.webhookId,
    // graph8 returns a webhook's secret only when it is created; on a reconnect keep the stored one.
    webhookSecretCipher: setup.webhookSecret ? encrypt(setup.webhookSecret, deps.secret) : existing?.webhookSecretCipher ?? null, mcpTokenHash: createHash("sha256").update(mcpToken).digest("hex"),
    fitColumnId: setup.fitColumnId, fitFieldName: setup.fitFieldName, createdAt: existing?.createdAt ?? deps.now };
  await deps.store.put(workspace);
  return { ok: true, workspace, mcpToken };
}
```

Run: `npx vitest run tests/workspace/connect.test.ts` → PASS.

- [ ] **Step 4: Org bootstrap (test first)**

`tests/workspace/bootstrap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { bootstrapOrg } from "@/lib/workspace/bootstrap";

describe("bootstrapOrg", () => {
  it("creates the objects, the fit fields and a webhook, and is safe to repeat", async () => {
    const g = new FakeG8();
    const fields: { id: number; title: string; name: string }[] = [];
    g.handlers.set(OPS.listFields, () => fields);
    g.handlers.set(OPS.createField, (i) => { const b = i.body as { title: string }; const f = { id: 900 + fields.length, title: b.title, name: `udo_${b.title}_x` }; fields.push(f); return f; });
    const hooks: { id: string; url: string }[] = [];
    g.handlers.set(OPS.listWebhooks, () => hooks);
    g.handlers.set(OPS.createWebhook, (i) => { const h = { id: `wh${hooks.length + 1}`, url: String((i.body as { url: string }).url), secret: "s3cret" }; hooks.push(h); return h; });
    const a = await bootstrapOrg(g, { webhookUrl: "https://x/api/webhooks/graph8/w1" });
    expect(a).toMatchObject({ webhookId: "wh1", webhookSecret: "s3cret", fitColumnId: 900, fitFieldName: "udo_roi_fit_x" });
    expect(g.objects.has("roi_charge") && g.objects.has("roi_action") && g.objects.has("roi_contact")).toBe(true);
    const b = await bootstrapOrg(g, { webhookUrl: "https://x/api/webhooks/graph8/w1" });
    expect(hooks).toHaveLength(1);
    expect(b.fitColumnId).toBe(900);
  });
});
```

`src/lib/workspace/bootstrap.ts`:

```ts
import type { G8Caller } from "../g8/client";
import { OPS } from "../g8/ops";
import { ensureSchema } from "../store/schema";

const EVENTS = ["deal.created", "deal.stage_changed", "deal.updated", "workflow.execution_completed", "workflow.execution_failed"];

export async function bootstrapOrg(c: G8Caller, o: { webhookUrl: string }): Promise<{ webhookId: string; webhookSecret: string; fitColumnId: number; fitFieldName: string }> {
  await ensureSchema(c);
  const fields = await c.call<{ id: number; title: string; name: string }[]>(OPS.listFields);
  const field = async (title: string) => fields.find((f) => f.title === title) ?? await c.call<{ id: number; title: string; name: string }>(OPS.createField, { body: { title, entity: "contacts", data_type: "text" } });
  const fit = await field("roi_fit");
  await field("record_consistency");
  const hooks = await c.call<{ id: string; url: string; secret?: string }[]>(OPS.listWebhooks);
  const hook = hooks.find((h) => h.url === o.webhookUrl) ?? await c.call<{ id: string; secret: string }>(OPS.createWebhook, { body: { url: o.webhookUrl, events: EVENTS, name: "Credit Compass" } });
  return { webhookId: hook.id, webhookSecret: hook.secret ?? "", fitColumnId: fit.id, fitFieldName: fit.name };
}
```

(On a repeat connect the webhook already exists and graph8 does not return its secret again; `connectWorkspace` then keeps the stored secret.) Check the `createWebhook` body keys against `scripts/register-webhook.ts` (it created the live receiver in the thin slice) and use the same ones.

Run: `npx vitest run tests/workspace` → PASS.

- [ ] **Step 5: Connect page and action**

`src/app/connect/actions.ts`:

```ts
"use server";
import { cookies } from "next/headers";
import { connectWorkspace } from "@/lib/workspace/connector";
import { bootstrapOrg } from "@/lib/workspace/bootstrap";
import { callerFor } from "@/lib/g8/client";
import { workspaceStore } from "@/lib/workspace/store";
import { signSession, WORKSPACE_COOKIE } from "@/lib/workspace/session";
import { runSync } from "@/lib/sync/run-sync";

export async function connect(_: unknown, form: FormData): Promise<{ ok: boolean; message: string; mcpToken?: string }> {
  const secret = process.env.WORKSPACE_KEY_SECRET, base = process.env.ADVISOR_URL;
  if (!secret || !process.env.SESSION_SECRET || !base) return { ok: false, message: "Connecting is not set up on this server yet (WORKSPACE_KEY_SECRET, SESSION_SECRET, ADVISOR_URL)." };
  const r = await connectWorkspace(String(form.get("apiKey") ?? ""), {
    store: workspaceStore(), secret, now: new Date().toISOString(), makeCaller: callerFor,
    fetchMe: async (key) => { const res = await fetch("https://be.graph8.com/api/v1/me", { headers: { Authorization: `Bearer ${key}`, "User-Agent": "credit-compass" } });
      return { status: res.status, body: res.ok ? await res.json() : {} }; },
    bootstrap: (c, id) => bootstrapOrg(c, { webhookUrl: `${base}/api/webhooks/graph8/${id}` }),
  });
  if (!r.ok) return { ok: false, message: r.error };
  (await cookies()).set(WORKSPACE_COOKIE, signSession(r.workspace.id), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
  await runSync({ c: callerFor(String(form.get("apiKey")).trim()) });
  return { ok: true, message: `Connected ${r.workspace.orgName}. Your first sync is done.`, mcpToken: r.mcpToken };
}
```

`src/app/connect/ConnectForm.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import Link from "next/link";
import { connect } from "./actions";
export function ConnectForm() {
  const [state, action, pending] = useActionState(connect, undefined);
  if (state?.ok) return (
    <div className="panel"><p>{state.message}</p>
      <p className="small">Your MCP token (shown once; add it to Claude or Cursor as the bearer token for /api/mcp):</p><pre className="code">{state.mcpToken}</pre>
      <Link className="btn primary" href="/">Open your dashboard</Link></div>);
  return (
    <form action={action} className="panel" style={{ display: "grid", gap: 10 }}>
      <label htmlFor="apiKey">graph8 API key</label>
      <input id="apiKey" name="apiKey" type="password" autoComplete="off" required placeholder="Paste a key from graph8 → Settings → API" />
      <p className="small">Credit Compass reads your ledger, lists, deals and pipelines, and stores its results in custom objects inside your own graph8 org. The key is encrypted and never shown again.</p>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Connecting and running the first sync…" : "Connect"}</button>
      {state && !state.ok && <p role="alert">{state.message}</p>}
    </form>);
}
```

`src/app/connect/page.tsx`:

```tsx
import { ConnectForm } from "./ConnectForm";
export default function ConnectPage() {
  return (<main className="page" style={{ maxWidth: 560 }}><h1 className="headline">Connect your graph8 account</h1>
    <p className="lede">See which of your own credits turned into meetings. Setup takes about a minute and spends no credits.</p><ConnectForm /></main>);
}
```

In `src/app/login/page.tsx` add under the form: `<p className="small">Using your own graph8 org? <a href="/connect">Connect your graph8 account</a>.</p>`. A connected user signs in again later by pasting the same key on `/connect` (it finds the workspace by `keyHash`; add that branch to `connect`: if `workspaceStore().findByKeyHash(keyHash(key))` exists, set the cookie and return without bootstrapping).

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run build` → PASS. Locally with `REDIS_URL`, `WORKSPACE_KEY_SECRET`, `SESSION_SECRET` and `ADVISOR_URL` set, connect **the demo org's own key** once on `/connect` (the only org available): it must find or create the objects and fields without duplicates and show the dashboard. That creates one extra webhook pointing at `/api/webhooks/graph8/<id>`; note its id in the task report. Screenshot `/connect` at both sizes.

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests advisor/scripts/me-shape.ts
git commit -m "feat(advisor): connect your own graph8 account with an API key"
```

---

### Task 15: Fan-out (crons, webhooks, MCP per workspace) and disconnect

**Files:**
- Create: `src/app/api/webhooks/graph8/[workspace]/route.ts`, `src/lib/workspace/fanout.ts`, `src/lib/mcp/context.ts`, `src/app/(dash)/workspace-actions.ts`
- Modify: `src/app/api/cron/poll/route.ts`, `src/app/api/cron/recap/route.ts`, `src/app/api/[transport]/route.ts`, `src/lib/mcp/auth.ts`, `src/components/Header.tsx` (workspace name + Disconnect)
- Test: `tests/workspace/fanout.test.ts`, `tests/mcp/auth.test.ts` (add)

**Interfaces:**
- Produces: `forEachWorkspace<T>(fn: (ws: { id; caller; demo; orgName }) => Promise<T>, store): Promise<{ id: string; ok: boolean; result?: T; error?: string }[]>`, `mcpWorkspace: AsyncLocalStorage<G8Caller>`, `resolveMcpCaller(req, store): Promise<G8Caller | null>`, `disconnect()` server action.

- [ ] **Step 1: Fan-out (test first)**

`tests/workspace/fanout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { forEachWorkspace } from "@/lib/workspace/fanout";
import { MemoryWorkspaceStore } from "@/lib/workspace/store";
import { encrypt } from "@/lib/workspace/crypto";

describe("forEachWorkspace", () => {
  it("runs for the demo org and every workspace, isolating failures", async () => {
    process.env.WORKSPACE_KEY_SECRET = "k".repeat(64);
    const s = new MemoryWorkspaceStore();
    for (const id of ["a", "b"]) await s.put({ id, orgId: `org_${id}`, orgName: id, demo: false, keyCipher: encrypt(`key_${id}`, "k".repeat(64)), keyHash: id,
      webhookId: null, webhookSecretCipher: null, mcpTokenHash: null, fitColumnId: 1, fitFieldName: "f", createdAt: "2026-09-27T00:00:00Z" });
    const out = await forEachWorkspace(async (ws) => { if (ws.id === "a") throw new Error("boom"); return ws.id; }, s);
    expect(out).toEqual([{ id: "demo", ok: true, result: "demo" }, { id: "a", ok: false, error: "boom" }, { id: "b", ok: true, result: "b" }]);
  });
});
```

`src/lib/workspace/fanout.ts`:

```ts
import { g8Caller, callerFor, type G8Caller } from "../g8/client";
import { decrypt } from "./crypto";
import type { WorkspaceStore } from "./store";

export async function forEachWorkspace<T>(fn: (ws: { id: string; caller: G8Caller; demo: boolean; orgName: string }) => Promise<T>, store: WorkspaceStore) {
  const out: { id: string; ok: boolean; result?: T; error?: string }[] = [];
  const run = async (id: string, get: () => { caller: G8Caller; demo: boolean; orgName: string }) => {
    try { out.push({ id, ok: true, result: await fn({ id, ...get() }) }); } catch (e) { out.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) }); }
  };
  await run("demo", () => ({ caller: g8Caller, demo: true, orgName: "Demo workspace" }));
  for (const w of await store.list()) await run(w.id, () => ({ caller: callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? "")), demo: false, orgName: w.orgName }));
  return out;
}
```

Run: `npx vitest run tests/workspace/fanout.test.ts` → PASS. Then in `src/app/api/cron/poll/route.ts` replace the single `runSync` with `Response.json(await forEachWorkspace((ws) => runSync({ c: ws.caller }), workspaceStore()))`. In the recap route, wrap the existing body (from `loadDashboardData()` to the findings upsert) in a function `recapFor(c: G8Caller)` that uses `c` everywhere it used `g8Caller` (pass `c` to `loadDashboardData(c)`) and return `Response.json(await forEachWorkspace((ws) => recapFor(ws.caller), workspaceStore()))`. A workspace without a `roi-advisor` Work channel returns `{ ok: false, error: … }` for that workspace only.

- [ ] **Step 2: Per-workspace webhook receiver**

`src/app/api/webhooks/graph8/[workspace]/route.ts`:

```ts
import { after } from "next/server";
import { verifyDelivery } from "@/lib/webhooks/verify";
import { workspaceStore } from "@/lib/workspace/store";
import { decrypt } from "@/lib/workspace/crypto";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ workspace: string }> }): Promise<Response> {
  const { workspace } = await params;
  const w = /^[0-9a-f-]{36}$/.test(workspace) ? await workspaceStore().get(workspace) : null;
  if (!w || !w.webhookSecretCipher) return new Response("not found", { status: 404 });
  const secret = decrypt(w.webhookSecretCipher, process.env.WORKSPACE_KEY_SECRET ?? "");
  const raw = await req.text();
  const v = verifyDelivery(raw, req.headers, secret);
  if (!v.ok) return new Response(v.reason, { status: 401 });
  after(async () => {
    const { callerFor } = await import("@/lib/g8/client");
    const { RecordStore } = await import("@/lib/store/records");
    const { handleEvent } = await import("@/lib/sync/handle-event");
    const c = callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? ""));
    await handleEvent(v.event, { c, outcomes: new RecordStore(c, "roi_outcome"), runs: new RecordStore(c, "roi_run") });
  });
  return new Response("ok");
}
```

The existing `/api/webhooks/graph8` route stays for the demo org.

- [ ] **Step 3: MCP per workspace (test first)**

Add to `tests/mcp/auth.test.ts`:

```ts
import { resolveMcpCaller } from "@/lib/mcp/auth";
import { MemoryWorkspaceStore } from "@/lib/workspace/store";
import { encrypt } from "@/lib/workspace/crypto";
import { createHash } from "node:crypto";
import { g8Caller } from "@/lib/g8/client";
it("resolves the demo token to the demo org and a workspace token to that workspace", async () => {
  process.env.MCP_TOKEN = "demo-token"; process.env.WORKSPACE_KEY_SECRET = "k".repeat(64);
  const s = new MemoryWorkspaceStore();
  await s.put({ id: "w1", orgId: "org_1", orgName: "A", demo: false, keyCipher: encrypt("key1", "k".repeat(64)), keyHash: "h", webhookId: null, webhookSecretCipher: null,
    mcpTokenHash: createHash("sha256").update("ws-token").digest("hex"), fitColumnId: 1, fitFieldName: "f", createdAt: "2026-09-27T00:00:00Z" });
  const req = (t: string) => new Request("https://x/api/mcp", { headers: { authorization: `Bearer ${t}` } });
  expect(await resolveMcpCaller(req("demo-token"), s)).toBe(g8Caller);
  expect(await resolveMcpCaller(req("ws-token"), s)).not.toBeNull();
  expect(await resolveMcpCaller(req("nope"), s)).toBeNull();
});
```

Add to `src/lib/mcp/auth.ts`:

```ts
import { createHash } from "node:crypto";
import { g8Caller, callerFor, type G8Caller } from "../g8/client";
import { decrypt } from "../workspace/crypto";
import type { WorkspaceStore } from "../workspace/store";

export async function resolveMcpCaller(req: Request, store: WorkspaceStore): Promise<G8Caller | null> {
  const demo = process.env.MCP_TOKEN;
  if (demo && authorizeMcp(req, demo)) return g8Caller;
  const url = new URL(req.url), auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("key");
  if (!token) return null;
  const w = await store.findByMcpTokenHash(createHash("sha256").update(token).digest("hex"));
  return w ? callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? "")) : null;
}
```

`src/lib/mcp/context.ts`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";
import type { G8Caller } from "../g8/client";
export const mcpWorkspace = new AsyncLocalStorage<G8Caller>();
```

In `src/app/api/[transport]/route.ts`: register tools with `() => loadDashboardData(mcpWorkspace.getStore())`, and change `guarded` to:

```ts
async function guarded(req: Request): Promise<Response> {
  if (new URL(req.url).pathname.endsWith("/message")) return handler(req); // SSE message posts carry the session id, as before
  const c = await resolveMcpCaller(req, workspaceStore());
  if (!c) return new Response("unauthorized", { status: 401 });
  return mcpWorkspace.run(c, () => handler(req));
}
```

Note: SSE sessions keep the caller of the request that opened them only while that request's async context lives; that is the case for `mcp-handler`'s SSE stream. Verify with the demo token (Step 5) and a workspace token; if a workspace's SSE tool calls come back with demo data, record it and restrict SSE to the demo token (outside agents use streamable HTTP, which carries the header on every call).

Run: `npx vitest run tests/mcp` → PASS.

- [ ] **Step 4: Workspace name in the header and Disconnect**

`src/app/(dash)/workspace-actions.ts`:

```ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPS } from "@/lib/g8/ops";
import { currentWorkspace } from "@/lib/workspace/current";
import { workspaceStore } from "@/lib/workspace/store";
import { WORKSPACE_COOKIE } from "@/lib/workspace/session";

export async function disconnect(): Promise<void> {
  const ws = await currentWorkspace();
  if (ws.demo) redirect("/");
  const w = await workspaceStore().get(ws.id);
  if (w?.webhookId) await ws.caller.call(OPS.deleteWebhook, { path: { webhook_id: w.webhookId } }).catch(() => undefined);
  await workspaceStore().remove(ws.id);
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/connect");
}
```

In `Header.tsx`, accept `orgName` and `demo` props (the layout passes them from `currentWorkspace()`): show `orgName` next to the brand for connected workspaces, and a small `<form action={disconnect}><button className="btn ghost">Disconnect</button></form>` with the title "Removes your key and webhook from Credit Compass. Your data stays in your graph8 org." The demo-data pill logic is unchanged (it shows only when simulated records are loaded).

- [ ] **Step 5: Verify, deploy, commit**

Run: `npx vitest run && npm run typecheck && npm run build` → PASS.
Add `WORKSPACE_KEY_SECRET` and `SESSION_SECRET` to Vercel production (`npx vercel env add WORKSPACE_KEY_SECRET production`, same for `SESSION_SECRET`; values from `openssl rand -hex 32`, never printed in logs or the report), then `npx vercel deploy --prod --scope momin11`.
In production: the demo sign-in still works; `/connect` with a bad key shows the plain error and stores nothing; the unauthenticated cron returns 401; `GET /api/webhooks/graph8/00000000-0000-0000-0000-000000000000` with a POST returns 404; MCP `roi_summary` with the demo token still answers. Screenshot `/connect` and the header of a connected workspace (if you connected the demo org's key in Task 14, press Disconnect afterwards and confirm its extra webhook is gone).

```bash
cd /home/opc/graph8
git add -A advisor/src advisor/tests
git commit -m "feat(advisor): crons, webhooks and MCP per workspace; disconnect"
```

---

## Finish

- [ ] Run the whole suite, type check and build one last time; open every screen in production at 1440 and 390 px against `docs/design/credit-compass-ui-v2.html`.
- [ ] Update `docs/HANDOFF.md` with the Phase 3 status (connector live, spike answer, env vars added, anything deferred) and commit.
- [ ] Use superpowers:requesting-code-review for a whole-branch review, then superpowers:finishing-a-development-branch.
