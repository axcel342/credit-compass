# Credit Compass Value Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Credit Compass dashboard show what credits *earned*, not just what they wasted, by fixing naming and how numbers are shown on the four laptop screens (Overview, Charges, Recovery, Optimize spend), and restyle it in graph8's own dark palette so it looks like part of the graph8 app.

**Architecture:** All changes are in the Next.js app under `advisor/`. Numbers come from existing pure helpers in `src/lib/domain` and `src/lib/dashboard` (tested with vitest); pages in `src/app/(dash)` pass them to small presentational components in `src/components`; colours are CSS tokens in `src/app/globals.css`. One task (Task 8) posts extra demo events to the live advisor and is gated on the user's OK.

**Tech Stack:** Next.js 16.3.6 (App Router, server components + server actions), React 19.2, TypeScript, vitest 5, plain CSS tokens, graph8 custom objects as the store.

**Spec:** This plan is its own spec. It implements the 2026-09-27 design review (sections 1–3; mobile is out of scope because the demo is on a laptop). Design decisions are recorded in "Design decisions" below. Before/after mockups of every change, drawn with live demo numbers: https://claude.ai/artifact/FGof3UMKq2QwL4FiSPwHX2 (private to the owner; the "after" side is the target look).

## Design decisions

- **Show value first.** The Overview headline adds the dollar value of won deals ("…and 9 won deals worth $X."). The number strip gains "$X won per 1,000 credits" and a trend note under credits per meeting ("down 33% in 5 weeks"). `Stat.wonValue` is already computed in `src/lib/domain/metrics.ts:61` but never shown; won-deal outcomes already carry `amount` (demo deals are $6k–$18k).
- **Charts state their answer.** "Getting cheaper?" becomes "Cost per meeting fell 33% in 5 weeks".
- **Do next shows the payoff, not "credits at stake".** Each row's small line says what doing it gets you, reusing the numbers the Optimize page already computes ("Saves ~696 credits a month", "~2 more meetings a week if you move this spend").
- **Keep service nouns.** "Email finding" stays: Recovery builds titles from the service name ("Email finding returned a result graph8 can't read back"), and nouns for what was paid for vs verbs for buttons ("Find emails") is consistent. The fix for mixed vocabulary is the Optimize title "Stop paying twice for the same contacts", which now matches the Do next button "Stop paying twice".
- **"How we know" becomes "Match".** Values are Exact (run ID, job ID or token count), Likely (time of charge) or Not matched (service only); Mixed when a row combines levels. The old method names move to a tooltip. "Exact" uses the same method set as the "90% traced" headline (`EXACT_METHODS`).
- **Test lists stay out of the way.** Lists under 1% of spend collapse into an "Other lists" chip on Charges (the same rule the flow diagram already uses), and lists titled "… probe" display as "Test list".
- **Confirm before changing graph8.** The Optimize checkbox says exactly what will change ("Yes, change 3 pipelines in graph8") and the button stays disabled until it is ticked. The server check in `optimize/apply.ts:17` already exists and stays.
- **Use graph8's palette, dark only.** Sampled from the graph8 web app (Attribution and Marketing Intelligence screens, `images/image.png` and `images/image1.png` in the repo root): page `#0a0a0a`, cards `#101010`, raised or selected controls `#181818`, borders `#292929`, primary text `#fcfcfc`, secondary text `#a6abb2`, primary buttons purple `#7d2df3` with white text, live-status green `#6ee7b7`. graph8 is dark-only, so Credit Compass becomes dark-only too: one `:root` token block with `color-scheme: dark`, and the light and dark-override blocks are deleted. Fonts stay as they are.
- **Purple means clickable.** `--accent` (`#7d2df3`) fills primary buttons and the selected period. It is too dark for text on black (3.3:1), so links, ghost-button text, focus rings and accent-coloured labels use a new `--accent-fg` (`#b794f6`, 7:1 on the accent tint). Data marks never use purple: they use neutral greys (`--series*`, `--flow`) or the outcome colours. That includes the planner estimate bar and the cohort bars, which currently use the accent.
- **Outcome colours (validated with the dataviz palette checker against graph8's card `#101010`; adjacent pairs pass colour-blind separation, worst ΔE 15.0, and normal-vision separation, worst ΔE 19.0).**

  | Token | Value | Meaning |
  |---|---|---|
  | `--booked` | `#1faa76` | Booked a meeting |
  | `--emailed` (new, Task 7) | `#6ee7b7` (graph8's live-status green) | Emailed, no meeting yet |
  | `--nomeet` | `#80868f` | No meeting yet |
  | `--unused` | `#f0a431` | Never used |
  | `--unknown` | `#4b4f56` | Can't tell yet |
  | `--waste` | `#f25555` | Wasted |

  The grey slots fail the checker's chroma floor on purpose (grey = nothing happened yet), and `--unknown` is below 3:1 on the card; every mark using them carries a text label.
- **Recovery hierarchy.** The refund card is the only one with an action, so it gets a wider column and a light red tint. The refund claim reads as three connected steps (Found → Requested → Refunded) instead of three boxes where "Found" looks like an input.
- **Split "No meeting yet".** Charges on contacts who were emailed after the charge become "Emailed, no meeting yet" (light green: still being worked). The rest stay "No meeting yet". The demo data today only emails contacts who went on to book, so Task 8 adds demo outreach emails for ~60% of the other demo contacts; without it the new bucket is empty and the Overview looks unchanged.

## Global Constraints

- Work in `advisor/`. Read `advisor/AGENTS.md`: this Next.js version differs from training data; check `node_modules/next/dist/docs/` before touching any Next API.
- Branch: create `credit-compass-v3/value-pass` from `main`. Tasks 14–15 of `docs/superpowers/plans/2026-09-27-credit-compass-v2.md` (connect flow, fan-out) may be in flight on other branches; this plan touches dashboard UI files only. Rebase on `main` before merging.
- Baseline: `npm test` → 50 files, 220 tests passing; `npm run typecheck` clean. Keep both green after every task.
- Copy: sentence case, plain words, no em-dash asides, no colon-then-reveal phrasing. Numbers go through `n()` / `plural()` from `src/lib/dashboard/story.ts`; dollars through the new `usd()` (whole dollars, en-US).
- Colour tokens live at the top of `src/app/globals.css`. Before Task 5, a new token goes in all three theme blocks there (bare `:root`, the `prefers-color-scheme: dark` block, `:root[data-theme="dark"]`). Task 5 replaces them with a single dark `:root` block in graph8's palette; after that, add tokens to that block only.
- `--accent` (purple) is only for interactive elements; accent-coloured text uses `--accent-fg` (Task 5). Small coloured text uses `--good-ink` / `--bad-ink` (added in Task 1), not the outcome colours.
- Mobile layout is out of scope. Do not change responsive rules.
- No live graph8 or advisor writes except Task 8 Step 4, and only after the user says yes.
- Commit style: `feat(advisor): …` / `fix(advisor): …`, one commit per task.

## Review Focus

1. **Won deals with no amounts, or no won deals in the 30-day view.** The headline must never say "worth $0" and the strip must drop the "won per 1,000 credits" tile. Pinned in Task 1 Step 1 (`wonValue: 0` cases).
2. **A flat or one-point trend.** No "down 0%" note and a neutral chart title. Pinned in Task 1 Step 1 (`pct: 0`, single point).
3. **An Optimize change that was already applied.** Do next must not quote its payoff any more. Pinned in Task 2 Step 1 (`doNextImpact` with `applied: true`).
4. **A charge row that mixes token-count and service-only charges.** It must read "Mixed", not "Exact". Pinned in Task 3 Step 1.
5. **A contact emailed before a later re-enrichment.** The later charge stays "No meeting yet"; only charges followed by an email count as emailed. Pinned in Task 7 Step 1.

Also check by hand (no component test harness in this repo): on Optimize, tick the box on "Move spend", apply "Build lookalike list", and confirm the next step ("Pause the Starter list") comes up **unticked**. Task 4 Step 6.

## File map

| File | Change | Task |
|---|---|---|
| `src/lib/dashboard/data.ts` | `PeriodView.wonValue`; bucket context gains `emailedByContact` | 1, 7 |
| `src/lib/dashboard/story.ts` | `usd()`, headline worth, strip value tile + trend note, `cpmBarColor()` | 1, 5 |
| `src/lib/domain/trend.ts` | `trendChange()`, `trendTitle()`; `trendSentence()` reuses them | 1 |
| `src/components/StatStrip.tsx` | render the note | 1 |
| `src/components/TrendChart.tsx` | answer-first title | 1 |
| `src/app/(dash)/page.tsx` | wire value, trend, payoff, chart colours | 1, 2, 4, 5 |
| `src/lib/dashboard/donext.ts` | `DoNextImpact`, `doNextImpact()`, payoff line | 2 |
| `src/components/DoNext.tsx` | "Biggest first" | 2 |
| `src/lib/domain/activities.ts` | `match` / `matchNote` instead of `how`; side-effect wording | 3, 7 |
| `src/components/ActivityTable.tsx` | "Match" column | 3, 7 |
| `src/lib/dashboard/filters.ts` | `listChips()` | 3 |
| `src/app/(dash)/charges/page.tsx` | chips + lede | 3 |
| `src/lib/domain/names.ts` | probe lists → "Test list" | 3 |
| `src/lib/domain/actions.ts` | repeat title, `button.confirm` | 4 |
| `src/components/ActionCard.tsx` | confirm gate | 4 |
| `src/components/PeriodSwitch.tsx` | "Last 8 weeks" / "Last 30 days" | 4 |
| `src/components/HBarChart.tsx` | `width` prop | 5 |
| `src/app/globals.css` | tokens, note, match, seg, bars, tracker, owners | 1, 3, 5, 6, 7 |
| `src/components/OwnerColumns.tsx`, `src/components/ClaimTracker.tsx` | hierarchy | 6 |
| `src/lib/domain/types.ts`, `src/lib/domain/buckets.ts` | `emailed` bucket | 7 |
| `scripts/sim-outreach.ts` (new), `scripts/sim-events.ts`, `src/components/DemoDataPill.tsx` | demo outreach | 8 |

---

### Task 1: Overview shows won value, value per credit and the cost trend

**Files:**
- Modify: `advisor/src/lib/dashboard/data.ts:31-48`
- Modify: `advisor/src/lib/dashboard/story.ts:1-28`
- Modify: `advisor/src/lib/domain/trend.ts:24-30`
- Modify: `advisor/src/components/StatStrip.tsx`
- Modify: `advisor/src/components/TrendChart.tsx:12`
- Modify: `advisor/src/app/(dash)/page.tsx`
- Modify: `advisor/src/app/globals.css` (three token blocks, `.strip` rules near line 212)
- Test: `advisor/tests/dashboard/story.test.ts`, `advisor/tests/dashboard/data.test.ts`, `advisor/tests/domain/trend.test.ts`

**Interfaces:**
- Produces: `PeriodView.wonValue: number`; `usd(x: number): string`; `StatItem { value; label; tone?: "bad"; note?: string; noteTone?: "good" | "bad" }`; `overviewHeadline(p: { total; meetings; won; wonValue: number; periodLabel })`; `statStrip(p: { total; meetings; booked; waste; traced; wonValue: number; trend: TrendChange | null })`; `TrendChange { from: number; to: number; weeks: number; pct: number }`; `trendChange(points: TrendPoint[]): TrendChange | null`; `trendTitle(points: TrendPoint[]): string`; CSS tokens `--good-ink`, `--bad-ink`.

- [ ] **Step 1: Write the failing tests**

In `tests/domain/trend.test.ts`, change the import to `import { rollingCostPerMeeting, trendSentence, trendChange, trendTitle, firstTouchCohorts } from "@/lib/domain/trend";` and add inside `describe("rollingCostPerMeeting", …)` after the "describes the direction" test:

```ts
  it("measures the change from the first to the last point", () => expect(trendChange(points)).toEqual({ from: 1000, to: 200, weeks: 5, pct: -80 }));
  it("titles the chart with the answer", () => {
    expect(trendTitle(points)).toBe("Cost per meeting fell 80% in 5 weeks");
    expect(trendTitle([{ label: "a", value: 300 }, { label: "b", value: 360 }])).toBe("Cost per meeting rose 20% in 2 weeks");
    expect(trendTitle([{ label: "a", value: 300 }, { label: "b", value: 300 }])).toBe("Cost per meeting held steady for 2 weeks");
    expect(trendTitle([{ label: "a", value: 300 }])).toBe("Cost per meeting over time");
  });
```

In `tests/dashboard/story.test.ts`:
- Every existing `overviewHeadline({...})` call gains `wonValue: 0`.
- Replace the zero `statStrip` assertion (line 13) with:
  `expect(statStrip({ total: 0, meetings: 0, booked: 0, waste: 0, traced: 0, wonValue: 0, trend: null }).map((s) => s.value)).toEqual(["—", "0", "0", "0%"]);`
- Replace the "builds the number strip" test with:

```ts
  it("builds the number strip, with value per credit when deals have amounts", () => {
    expect(statStrip({ total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722, wonValue: 96000, trend: null })).toEqual([
      { value: "399", label: "credits per meeting" }, { value: "$8,917", label: "won per 1,000 credits" },
      { value: "5,131", label: "spent on contacts who booked" }, { value: "115", label: "wasted", tone: "bad" }, { value: "90%", label: "traced to a contact, list or run" }]);
    expect(statStrip({ total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722, wonValue: 0, trend: null }).map((s) => s.label))
      .not.toContain("won per 1,000 credits");
  });
  it("adds the trend under credits per meeting", () => {
    const base = { total: 10766, meetings: 27, booked: 5131, waste: 115, traced: 9722, wonValue: 0 };
    expect(statStrip({ ...base, trend: { from: 504, to: 337, weeks: 5, pct: -33 } })[0]).toEqual({ value: "399", label: "credits per meeting", note: "down 33% in 5 weeks", noteTone: "good" });
    expect(statStrip({ ...base, trend: { from: 300, to: 360, weeks: 4, pct: 20 } })[0]).toMatchObject({ note: "up 20% in 4 weeks", noteTone: "bad" });
    expect(statStrip({ ...base, trend: { from: 300, to: 300, weeks: 4, pct: 0 } })[0].note).toBeUndefined();
  });
  it("says what the won deals were worth, and only when they have amounts", () => {
    expect(overviewHeadline({ total: 10766, meetings: 27, won: 9, wonValue: 96000, periodLabel: "the last 8 weeks" })).toBe("10,766 credits bought 27 meetings and 9 won deals worth $96,000.");
    expect(overviewHeadline({ total: 10766, meetings: 27, won: 9, wonValue: 0, periodLabel: "the last 8 weeks" })).toBe("10,766 credits bought 27 meetings and 9 won deals.");
  });
```

In `tests/dashboard/data.test.ts`, add inside `describe("loadDashboardData + periodView", …)`:

```ts
  it("sums won deal value inside the period", async () => {
    const g = await seeded();
    const oc = new RecordStore(g, "roi_outcome");
    const won = (extId: string, at: string, amount: number | null) => outcomeToValues({ extId, type: "deal_won", occurredAt: at, contactId: 1, companyId: null,
      dealId: extId, amount, listId: null, sequenceId: null, step: null, channel: null, segmentKey: null, source: "poll", simulated: true });
    await oc.upsert(won("d1", "2026-09-22T00:00:00Z", 12000));
    await oc.upsert(won("d2", "2026-08-05T00:00:00Z", 6000));
    await oc.upsert(won("d3", "2026-09-23T00:00:00Z", null));
    const d = { ...(await loadDashboardData(g)), now: "2026-09-27T00:00:00Z" };
    expect(periodView(d, "8w").wonValue).toBe(18000);
    expect(periodView(d, "8w").won).toBe(3);
    expect(periodView(d, "30d").wonValue).toBe(12000);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd advisor && npx vitest run tests/domain/trend.test.ts tests/dashboard/story.test.ts tests/dashboard/data.test.ts`
Expected: FAIL (`trendChange is not a function`, headline missing "worth", `wonValue` undefined).

- [ ] **Step 3: Implement the trend helpers**

In `src/lib/domain/trend.ts`, replace `trendSentence` (lines 24–30) with:

```ts
export interface TrendChange { from: number; to: number; weeks: number; pct: number }

export function trendChange(points: TrendPoint[]): TrendChange | null {
  const v = points.filter((p): p is { label: string; value: number } => p.value !== null);
  if (v.length < 2) return null;
  const from = Math.round(v[0].value), to = Math.round(v.at(-1)!.value);
  return { from, to, weeks: v.length, pct: from > 0 ? Math.round(((to - from) / from) * 100) : 0 };
}

export function trendSentence(points: TrendPoint[]): string | null {
  const c = trendChange(points);
  if (!c) return null;
  if (c.from === c.to) return `Credits per meeting held at ${n(c.to)} over the last ${c.weeks} weeks.`;
  return `Credits per meeting ${c.to < c.from ? "fell" : "rose"} from ${n(c.from)} to ${n(c.to)} over the last ${c.weeks} weeks.`;
}

export function trendTitle(points: TrendPoint[]): string {
  const c = trendChange(points);
  if (!c) return "Cost per meeting over time";
  if (c.pct === 0) return `Cost per meeting held steady for ${c.weeks} weeks`;
  return `Cost per meeting ${c.pct < 0 ? "fell" : "rose"} ${Math.abs(c.pct)}% in ${c.weeks} weeks`;
}
```

- [ ] **Step 4: Implement won value in the period view**

In `src/lib/dashboard/data.ts`, add `wonValue: number;` to `PeriodView` after `won: number;`, and change the last line of `periodView`'s return to:

```ts
    meetings: outcomes.filter((o) => o.type === "meeting_booked").length, won: outcomes.filter((o) => o.type === "deal_won").length,
    wonValue: outcomes.filter((o) => o.type === "deal_won").reduce((s, o) => s + (o.amount ?? 0), 0) };
```

- [ ] **Step 5: Implement the sentences and strip**

In `src/lib/dashboard/story.ts`:

```ts
import type { TypeDef } from "../domain/planner";
import type { TrendChange } from "../domain/trend";
export const n = (x: number) => Math.round(x).toLocaleString("en-US");
export const usd = (x: number) => x.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${Math.round(k) === 1 ? one : many}`;
export interface StatItem { value: string; label: string; tone?: "bad"; note?: string; noteTone?: "good" | "bad" }

export function overviewHeadline(p: { total: number; meetings: number; won: number; wonValue: number; periodLabel: string }): string {
  if (p.total <= 0) return `No credits spent in ${p.periodLabel}.`;
  if (p.meetings <= 0) return `${n(p.total)} credits spent in ${p.periodLabel}, and no meetings booked yet.`;
  const worth = p.wonValue > 0 ? ` worth ${usd(p.wonValue)}` : "";
  const won = p.won > 0 ? ` and ${plural(p.won, "won deal")}${worth}` : "";
  return `${n(p.total)} credits bought ${plural(p.meetings, "meeting")}${won}.`;
}
```

Keep `overviewLede` as is. Replace `statStrip` with:

```ts
export function statStrip(p: { total: number; meetings: number; booked: number; waste: number; traced: number; wonValue: number; trend: TrendChange | null }): StatItem[] {
  const cpm: StatItem = { value: p.meetings > 0 ? n(p.total / p.meetings) : "—", label: "credits per meeting" };
  if (p.trend && p.trend.pct !== 0) {
    cpm.note = `${p.trend.pct < 0 ? "down" : "up"} ${Math.abs(p.trend.pct)}% in ${p.trend.weeks} weeks`;
    cpm.noteTone = p.trend.pct < 0 ? "good" : "bad";
  }
  return [
    cpm,
    ...(p.wonValue > 0 && p.total > 0 ? [{ value: usd((p.wonValue / p.total) * 1000), label: "won per 1,000 credits" }] : []),
    { value: n(p.booked), label: "spent on contacts who booked" },
    { value: n(p.waste), label: "wasted", ...(p.waste > 0 ? { tone: "bad" as const } : {}) },
    { value: `${p.total > 0 ? Math.round((p.traced / p.total) * 100) : 0}%`, label: "traced to a contact, list or run" },
  ];
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd advisor && npx vitest run tests/domain/trend.test.ts tests/dashboard/story.test.ts tests/dashboard/data.test.ts`
Expected: PASS.

- [ ] **Step 7: Render it**

`src/components/StatStrip.tsx`:

```tsx
import type { StatItem } from "@/lib/dashboard/story";
export function StatStrip({ items }: { items: StatItem[] }) {
  return (<dl className="strip">{items.map((s) => (<div key={s.label}>
    <dt>{s.label}{s.note && <span className={`note ${s.noteTone ?? ""}`}>{s.note}</span>}</dt>
    <dd className={s.tone === "bad" ? "bad" : undefined}>{s.value}</dd></div>))}</dl>);
}
```

`src/components/TrendChart.tsx`: import `trendTitle` alongside `trendSentence` and change line 12's heading to `<h2>{mode === "rolling" ? trendTitle(points) : "By week first enriched"}</h2>`.

`src/app/(dash)/page.tsx`: import `trendChange` from `@/lib/domain/trend`; compute `const trendPoints = rollingCostPerMeeting(d.charges, d.outcomes, d.now);` once; pass `wonValue: v.wonValue` to `overviewHeadline`; pass `wonValue: v.wonValue, trend: trendChange(trendPoints)` to `statStrip`; pass `points={trendPoints}` to `TrendChart`.

`src/app/globals.css`: add `--good-ink:#16704a; --bad-ink:#b3261e;` to the bare `:root` block and `--good-ink:#6fd3a3; --bad-ink:#f08a88;` to both dark blocks. After `.strip dd.bad{…}` add:

```css
.strip dt .note{display:block;font-size:12.5px;font-weight:600;margin-top:2px}
.strip dt .note.good{color:var(--good-ink)}.strip dt .note.bad{color:var(--bad-ink)}
```

- [ ] **Step 8: Typecheck and full suite**

Run: `cd advisor && npm run typecheck && npm test`
Expected: clean; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add advisor/src/lib/dashboard/data.ts advisor/src/lib/dashboard/story.ts advisor/src/lib/domain/trend.ts advisor/src/components/StatStrip.tsx advisor/src/components/TrendChart.tsx "advisor/src/app/(dash)/page.tsx" advisor/src/app/globals.css advisor/tests/dashboard/story.test.ts advisor/tests/dashboard/data.test.ts advisor/tests/domain/trend.test.ts
git commit -m "feat(advisor): show won value, value per credit and the cost trend on the Overview"
```

---

### Task 2: Do next shows the payoff

**Files:**
- Modify: `advisor/src/lib/dashboard/donext.ts`
- Modify: `advisor/src/components/DoNext.tsx:6`
- Modify: `advisor/src/app/(dash)/page.tsx`
- Test: `advisor/tests/dashboard/donext.test.ts`

**Interfaces:**
- Consumes: `PlannedAction` and `buildActions()` from `src/lib/domain/actions.ts` (unchanged here; Task 4 adds `button.confirm`, which this task does not read).
- Produces: `DoNextImpact { repeatMonthly: number | null; moveSpend: string | null }`; `doNextImpact(actions: PlannedAction[]): DoNextImpact`; `doNextItems(findings, max = 4, periodQuery = "", impact: DoNextImpact = NO_IMPACT)`.

- [ ] **Step 1: Write the failing tests**

In `tests/dashboard/donext.test.ts`: change the import to `import { doNextItems, doNextImpact } from "@/lib/dashboard/donext";`, add `import type { PlannedAction } from "@/lib/domain/actions";`, then:
- In the first test, change `expect(items[0].sub).toBe("4,931 credits at stake");` to `expect(items[0].sub).toBe("4,931 credits spent on this list");`.
- Change the last test to `…toBe("1 credit over graph8's quotes")`.
- Add:

```ts
  it("states the payoff, using the Optimize numbers when they exist", () => {
    const items = doNextItems([f("cut", 4931, "B"), f("repeat_enrichment", 1300, "R"), f("scale", 2108, "C"), f("waste", 91, "A")], 4, "",
      { repeatMonthly: 696, moveSpend: "~2 more meetings a week" });
    expect(items.map((x) => x.sub)).toEqual(["~2 more meetings a week if you move this spend", "Up to 50 more contacts like them, free",
      "Saves ~696 credits a month", "91 credits to claim back"]);
    expect(doNextItems([f("unused", 860, "D"), f("side_effect", 24, "S")]).map((x) => x.sub)).toEqual(["860 credits of research ready to use", "Stops 24 credits of agent charges"]);
  });
  const act = (id: PlannedAction["id"], p: Partial<PlannedAction> = {}): PlannedAction => ({ id, title: "", impact: "", evidence: "", confidence: "High confidence",
    inGraph8: "", chart: [], steps: [], button: null, applied: false, monthlyCredits: 0, ...p });
  it("takes payoffs only from changes not yet applied", () => {
    expect(doNextImpact([act("repeat", { monthlyCredits: 696 }), act("move-spend", { impact: "~2 more meetings a week" })])).toEqual({ repeatMonthly: 696, moveSpend: "~2 more meetings a week" });
    expect(doNextImpact([act("repeat", { monthlyCredits: 696, applied: true }), act("move-spend", { impact: "~2 more meetings a week", applied: true })])).toEqual({ repeatMonthly: null, moveSpend: null });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd advisor && npx vitest run tests/dashboard/donext.test.ts`
Expected: FAIL (`doNextImpact` not exported; subs still "… at stake").

- [ ] **Step 3: Implement**

Replace `src/lib/dashboard/donext.ts` with:

```ts
import type { Finding } from "../domain/types";
import type { PlannedAction } from "../domain/actions";
import { n, plural } from "./story";

export interface DoNextItem { id: string; text: string; sub: string; label: string; href: string }
export interface DoNextImpact { repeatMonthly: number | null; moveSpend: string | null }
const NO_IMPACT: DoNextImpact = { repeatMonthly: null, moveSpend: null };
const WEIGHT = { high: 1, medium: 0.6, low: 0.2 } as const;
const BUTTON: Partial<Record<Finding["kind"], [string, string]>> = {
  cut: ["See how to cut it", "/optimize#move-spend"], scale: ["Build a lookalike list", "/optimize#move-spend"],
  repeat_enrichment: ["Stop paying twice", "/optimize#repeat"], waste: ["Request a refund", "/recovery#claim"],
  unused: ["See it in Recovery", "/recovery"], side_effect: ["See it in Recovery", "/recovery"], fix: ["Plan the next enrichment", "/optimize#plan"],
};

export function doNextImpact(actions: PlannedAction[]): DoNextImpact {
  const open = (id: PlannedAction["id"]) => actions.find((a) => a.id === id && !a.applied);
  return { repeatMonthly: open("repeat")?.monthlyCredits ?? null, moveSpend: open("move-spend")?.impact ?? null };
}

function payoff(f: Finding, impact: DoNextImpact): string {
  const k = plural(f.creditsAtStake, "credit");
  switch (f.kind) {
    case "cut": return impact.moveSpend ? `${impact.moveSpend} if you move this spend` : `${k} spent on this list`;
    case "scale": return "Up to 50 more contacts like them, free";
    case "repeat_enrichment": return impact.repeatMonthly ? `Saves ~${n(impact.repeatMonthly)} credits a month` : `${k} paid twice`;
    case "waste": return `${k} to claim back`;
    case "unused": return `${k} of research ready to use`;
    case "side_effect": return `Stops ${k} of agent charges`;
    case "fix": return `${k} over graph8's quotes`;
    default: return `${k} at stake`;
  }
}

function withPeriod(href: string, periodQuery: string): string {
  if (!periodQuery) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}${periodQuery}${hash ? `#${hash}` : ""}`;
}

export function doNextItems(findings: Finding[], max = 4, periodQuery = "", impact: DoNextImpact = NO_IMPACT): DoNextItem[] {
  return findings.filter((f) => BUTTON[f.kind])
    .sort((a, b) => b.creditsAtStake * WEIGHT[b.confidence] - a.creditsAtStake * WEIGHT[a.confidence])
    .slice(0, max)
    .map((f) => ({ id: f.extId, text: f.body, sub: payoff(f, impact), label: BUTTON[f.kind]![0], href: withPeriod(BUTTON[f.kind]![1], periodQuery) }));
}
```

`src/components/DoNext.tsx` line 6: change `Most credits at stake first` to `Biggest first`.

`src/app/(dash)/page.tsx`: import `buildActions` from `@/lib/domain/actions` and `doNextImpact` from `@/lib/dashboard/donext`, then:

```tsx
  const v8 = period === "8w" ? v : periodView(d, "8w");
  const impact = doNextImpact(buildActions({ charges: v8.charges, stats: v8.stats, listNames: d.listNames, contacts: [], actions: d.actions }));
  …
  <DoNext items={doNextItems(dashboardBuckets(d.findings, d.now).open, 4, periodQuery, impact)} />
```

(Optimize also builds its actions from the 8-week view. `contacts: []` only drops the "skip unlikely" action, which Do next doesn't use.)

- [ ] **Step 4: Run to verify pass**

Run: `cd advisor && npx vitest run tests/dashboard/donext.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
git add advisor/src/lib/dashboard/donext.ts advisor/src/components/DoNext.tsx "advisor/src/app/(dash)/page.tsx" advisor/tests/dashboard/donext.test.ts
git commit -m "feat(advisor): Do next states what each change gets you"
```

---

### Task 3: Charges says how each line was matched and hides test lists

**Files:**
- Modify: `advisor/src/lib/domain/activities.ts:1-16,62-65`
- Modify: `advisor/src/components/ActivityTable.tsx:16,34`
- Modify: `advisor/src/lib/dashboard/filters.ts`
- Modify: `advisor/src/app/(dash)/charges/page.tsx:23-35`
- Modify: `advisor/src/lib/domain/names.ts:11-13`
- Modify: `advisor/src/app/globals.css` (after the `.acts-table` rules near line 254)
- Test: `advisor/tests/domain/activities.test.ts`, `advisor/tests/dashboard/filters.test.ts`, `advisor/tests/domain/names.test.ts`

**Interfaces:**
- Produces: `MatchLevel = "exact" | "likely" | "none"`; `MATCH_LABEL: Record<MatchLevel | "mixed", string>`; `Activity.match: MatchLevel | "mixed"`; `Activity.matchNote: string` (replaces `Activity.how`); `listChips(charges: AttributedCharge[]): { ids: number[]; hasOther: boolean }`.

- [ ] **Step 1: Write the failing tests**

`tests/domain/activities.test.ts`:
- Line 31: replace `how: "Run ID"` with `match: "exact", matchNote: "Run ID"`.
- Line 42: replace `how: "Token count, Service only"` with `match: "mixed", matchNote: "Token count, Service only"`.
- Add inside the `describe`:

```ts
  it("calls a time-window match Likely", () => {
    const [a] = groupActivities([c("t1", { service: "studio_global", method: "time_window", explanation: "Onboarding research" })], [], bucketOf, names);
    expect(a).toMatchObject({ match: "likely", matchNote: "Time of charge" });
  });
```

`tests/dashboard/filters.test.ts`: import `listChips` alongside the others and add:

```ts
  it("shows lists with at least 1% of spend, biggest first, and folds the rest into Other lists", () => {
    expect(listChips(xs)).toEqual({ ids: [2], hasOther: true });
    expect(listChips([c("a", "waterfall_enrichment", 100, 2, "booked"), c("b", "waterfall_enrichment", 300, 15, "booked")])).toEqual({ ids: [15, 2], hasOther: false });
  });
```

`tests/domain/names.test.ts`: add

```ts
  it("shows probe lists as test lists", () => {
    expect(listLabel("[sim] guardrail probe")).toBe("Test list");
    const m = listNamesFrom([{ id: 13, title: "[sim] guardrail probe" }, { id: 14, title: "[sim] lookalike probe" }]);
    expect([m.get("13"), m.get("14")]).toEqual(["Test list (13)", "Test list (14)"]);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd advisor && npx vitest run tests/domain/activities.test.ts tests/dashboard/filters.test.ts tests/domain/names.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the match level**

In `src/lib/domain/activities.ts`:
- Add `import { EXACT_METHODS } from "./attribution";`.
- In `Activity`, replace `how: string;` with `match: MatchLevel | "mixed"; matchNote: string;`.
- Replace the `HOW` constant with:

```ts
export type MatchLevel = "exact" | "likely" | "none";
export const MATCH_LABEL: Record<MatchLevel | "mixed", string> = { exact: "Exact", likely: "Likely", none: "Not matched", mixed: "Mixed" };
const levelOf = (m: Method): MatchLevel => (EXACT_METHODS.has(m) ? "exact" : m === "time_window" ? "likely" : "none");
const METHOD_NOTE: Record<Method, string> = { advisor: "Run ID", pipeline_run: "Run ID", job_window: "Job ID", exact_tokens: "Token count", time_window: "Time of charge", none: "Service only" };
```

- In `WASTE`, change `agent_side_effect: "Wasted: side effect"` to `agent_side_effect: "Wasted: graph8's agent replied to a post"`.
- In the `out.push({...})`, replace `how: [...new Set(xs.map((c) => HOW[c.method]))].join(", "),` with:

```ts
      match: ((ls) => (ls.length === 1 ? ls[0] : "mixed"))([...new Set(xs.map((c) => levelOf(c.method)))]),
      matchNote: [...new Set(xs.map((c) => METHOD_NOTE[c.method]))].join(", "),
```

Confirm there is no import cycle: `grep -n "activities" advisor/src/lib/domain/attribution.ts` must print nothing.

- [ ] **Step 4: Implement list chips and probe names**

`src/lib/dashboard/filters.ts`, add:

```ts
export function listChips(charges: AttributedCharge[]): { ids: number[]; hasOther: boolean } {
  const total = charges.reduce((s, c) => s + c.credits, 0) || 1;
  const perList = new Map<number, number>();
  for (const c of charges) if (c.listId !== null) perList.set(c.listId, (perList.get(c.listId) ?? 0) + c.credits);
  const ids = [...perList].filter(([, v]) => v / total >= SMALL_LIST_SHARE).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return { ids, hasOther: ids.length < perList.size };
}
```

`src/lib/domain/names.ts`, replace `listLabel`:

```ts
export function listLabel(title: string): string {
  const t = title.replace(/^\[sim\]\s*/, "").replace(/\s*\(proactive setup\)$/, "").trim();
  return /\bprobe$/i.test(t) ? "Test list" : t;
}
```

Check nothing keys on the old label: `grep -rn "probe" advisor/src` must show no list-title comparisons.

- [ ] **Step 5: Run to verify pass**

Run: `cd advisor && npx vitest run tests/domain/activities.test.ts tests/dashboard/filters.test.ts tests/domain/names.test.ts`
Expected: PASS.

- [ ] **Step 6: Render it**

`src/components/ActivityTable.tsx`: import `MATCH_LABEL` from `@/lib/domain/activities`; header `<th>How we know</th>` → `<th>Match</th>`; cell `<td>{a.how}</td>` → `<td><span className={`match ${a.match}`} title={a.matchNote}>{MATCH_LABEL[a.match]}</span></td>`.

`src/app/(dash)/charges/page.tsx`: import `listChips` from `@/lib/dashboard/filters`; delete the `lists` constant; `const chips = listChips(v.charges);`; replace the `lists.map(...)` in the list nav with:

```tsx
          {chips.ids.map((id) => <Link key={id} href={filterHref(f, { list: String(id) }, pq)} aria-current={f.list === String(id) ? "true" : undefined}>{d.listNames.get(String(id)) ?? `List ${id}`}</Link>)}
          {chips.hasOther && <Link href={filterHref(f, { list: "other" }, pq)} aria-current={f.list === "other" ? "true" : undefined}>Other lists</Link>}
```

and change the `lede` to: `"graph8's ledger records only a service, an amount and a time. We match each charge to the work it paid for. Exact means a run, job or token count matched. Likely means only the timing matched."`

`src/app/globals.css`, after the `.acts-table` rules:

```css
.match{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.match::before{content:"";width:9px;height:9px;border-radius:50%;border:1.5px solid var(--ink-2)}
.match.exact::before{background:var(--ink-2)}
.match.likely::before,.match.mixed::before{background:linear-gradient(90deg,var(--ink-2) 50%,transparent 50%)}
.match.none{color:var(--muted)}.match.none::before{border-style:dashed;border-color:var(--muted)}
```

- [ ] **Step 7: Typecheck and full suite**

Run: `cd advisor && npm run typecheck && npm test`
Expected: clean; all pass. (`grep -rn "\.how\b" advisor/src` must print nothing.)

- [ ] **Step 8: Commit**

```bash
git add advisor/src/lib/domain/activities.ts advisor/src/components/ActivityTable.tsx advisor/src/lib/dashboard/filters.ts "advisor/src/app/(dash)/charges/page.tsx" advisor/src/lib/domain/names.ts advisor/src/app/globals.css advisor/tests/domain/activities.test.ts advisor/tests/dashboard/filters.test.ts advisor/tests/domain/names.test.ts
git commit -m "feat(advisor): Charges shows match level and folds test lists into Other lists"
```

---

### Task 4: Optimize and period switch say exactly what happens

**Files:**
- Modify: `advisor/src/lib/domain/actions.ts:5-9,39-43,61,74`
- Modify: `advisor/src/components/ActionCard.tsx`
- Modify: `advisor/src/components/PeriodSwitch.tsx:4`
- Modify: `advisor/src/app/(dash)/page.tsx:32` (empty-state copy)
- Test: `advisor/tests/domain/actions.test.ts`

**Interfaces:**
- Produces: `PlannedAction.button: { action; label; listIds; confirm: string } | null`.

- [ ] **Step 1: Write the failing tests**

In `tests/domain/actions.test.ts`, extend the existing `toMatchObject` assertions:
- Line 25: `{ action: "repeat", label: "Turn on for 1 pipeline", listIds: [2], confirm: "Yes, change 1 pipeline in graph8" }`
- Line 33: `{ action: "lookalike", label: "Build lookalike list", listIds: [15], confirm: "Yes, create a new list in graph8" }`
- Line 39: `{ action: "guardrail", listIds: [2], confirm: "Yes, add the rule to the Starter list in graph8" }`
- Line 49: `{ action: "pause", label: "Pause the Starter list", listIds: [2], confirm: "Yes, pause the Starter list in graph8" }`
- Next to line 25, add `expect(r.title).toBe("Stop paying twice for the same contacts");` (use whatever variable holds the repeat action there).

- [ ] **Step 2: Run to verify failure**

Run: `cd advisor && npx vitest run tests/domain/actions.test.ts`
Expected: FAIL (no `confirm`, old title).

- [ ] **Step 3: Implement**

`src/lib/domain/actions.ts`:
- In `PlannedAction`, change `button` to `{ action: "repeat" | "lookalike" | "pause" | "guardrail"; label: string; listIds: number[]; confirm: string } | null`.
- Repeat: `title: "Stop paying twice for the same contacts"`, and the button becomes
  `{ action: "repeat", label: `Turn on for ${repLists.length} ${repLists.length === 1 ? "pipeline" : "pipelines"}`, listIds: repLists, confirm: `Yes, change ${repLists.length} ${repLists.length === 1 ? "pipeline" : "pipelines"} in graph8` }`.
- Move spend: lookalike button adds `confirm: "Yes, create a new list in graph8"`; pause button adds `confirm: `Yes, pause ${the(name(wId))} in graph8``.
- Skip unlikely: button adds `confirm: `Yes, add the rule to ${the(name(gl))} in graph8``.

`src/components/ActionCard.tsx`: replace the file with:

```tsx
"use client";
import { useActionState, useState } from "react";
import type { PlannedAction } from "@/lib/domain/actions";
import { applyAction } from "@/app/(dash)/optimize/apply";

type Button = NonNullable<PlannedAction["button"]>;
function ApplyForm({ button, act, pending }: { button: Button; act: (f: FormData) => void; pending: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <form action={act}>
      <input type="hidden" name="action" value={button.action} /><input type="hidden" name="listIds" value={button.listIds.join(",")} />
      <label className="small confirm"><input type="checkbox" name="confirm" value="yes" checked={ok} onChange={(e) => setOk(e.target.checked)} /> {button.confirm}</label>
      <button className="btn primary" type="submit" disabled={pending || !ok}>{pending ? "Working…" : button.label}</button>
      <span className="small">Costs 0 credits</span>
    </form>);
}

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
        {a.button ? <ApplyForm key={a.button.action} button={a.button} act={act} pending={pending} /> : <span className="done-tag">Done</span>}
        {state && <span className="toast" role="status">{state.ok ? state.message : `Not changed: ${state.message}`}</span>}
      </div>
    </article>
  );
}
```

The `key={a.button.action}` resets the tick when a card moves to its next step.

`src/components/PeriodSwitch.tsx` line 4: `const OPTIONS = [["8w", "Last 8 weeks"], ["30d", "Last 30 days"]] as const;`

`src/app/(dash)/page.tsx` empty state: `No charges in {PERIOD_LABEL[period]}. Switch to the last 8 weeks or run Sync now.`

- [ ] **Step 4: Run to verify pass**

Run: `cd advisor && npx vitest run tests/domain/actions.test.ts && npm run typecheck`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
git add advisor/src/lib/domain/actions.ts advisor/src/components/ActionCard.tsx advisor/src/components/PeriodSwitch.tsx "advisor/src/app/(dash)/page.tsx" advisor/tests/domain/actions.test.ts
git commit -m "feat(advisor): say exactly what each Optimize change does and confirm before it runs"
```

- [ ] **Step 6: Check the confirm gate by hand**

Run `cd advisor && npm run dev`, sign in, open `/optimize`. Check: every Apply button is disabled until its box is ticked; the label names the change. Do **not** apply anything against the live org without the user's OK; just confirm the disabled state and wording.

---

### Task 5: graph8's palette, purple only for actions, and the costly list flagged

**Files:**
- Modify: `advisor/src/app/globals.css` (token blocks at the top, lines 1–41; plus the rules listed in Step 6)
- Modify: `advisor/src/components/HBarChart.tsx:3-4`
- Modify: `advisor/src/lib/dashboard/story.ts`
- Modify: `advisor/src/app/(dash)/page.tsx:37-39`
- Test: `advisor/tests/dashboard/story.test.ts`

**Interfaces:**
- Consumes: `v.org?.costPerMeeting` (org `Stat`, already on `PeriodView.org`).
- Produces: `cpmBarColor(cpm: number, best: number, avg: number | null): string`; `HBarChart` prop `width?: number` (default 620); a single dark `:root` token block in graph8's palette, including the new `--accent-fg`.

- [ ] **Step 1: Write the failing test**

In `tests/dashboard/story.test.ts`, import `cpmBarColor` and add:

```ts
describe("cost per meeting bar colour", () => {
  it("greens the cheapest list, reds any list at twice the average or more, and leaves the rest neutral", () => {
    expect(cpmBarColor(124, 124, 399)).toBe("var(--booked)");
    expect(cpmBarColor(1233, 124, 399)).toBe("var(--waste)");
    expect(cpmBarColor(433, 124, 399)).toBe("var(--series-weak)");
    expect(cpmBarColor(900, 124, null)).toBe("var(--series-weak)");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd advisor && npx vitest run tests/dashboard/story.test.ts`
Expected: FAIL (`cpmBarColor` not exported).

- [ ] **Step 3: Implement the helper**

Append to `src/lib/dashboard/story.ts`:

```ts
export function cpmBarColor(cpm: number, best: number, avg: number | null): string {
  if (cpm === best) return "var(--booked)";
  if (avg !== null && cpm >= 2 * avg) return "var(--waste)";
  return "var(--series-weak)";
}
```

(The 2× rule matches the finding text "over twice your average" in `src/lib/domain/findings.ts:71`.)

- [ ] **Step 4: Run to verify pass**

Run: `cd advisor && npx vitest run tests/dashboard/story.test.ts`
Expected: PASS.

- [ ] **Step 5: Chart wiring**

`src/components/HBarChart.tsx`: add `width = 620` to the destructured props (typed `width?: number`) and change `const W = 620, valW = 64, …` to `const W = width, valW = 64, …`. A narrower viewBox keeps the 12px chart text near 12px when the chart sits in the half-width card.

`src/app/(dash)/page.tsx`: replace `const best = byList[0]?.value;` with

```ts
  const avgCpm = v.org?.costPerMeeting ?? null, bestCpm = byList[0]?.costPerMeeting ?? 0;
```

and replace the `HBarChart` element with:

```tsx
          {byList.length ? <HBarChart ariaLabel="Credits per meeting by list" unit="credits per meeting" width={440} labelW={110} avg={avgCpm ?? undefined}
            max={Math.max(avgCpm ?? 0, ...byList.map((s) => s.costPerMeeting!)) * 1.05}
            rows={byList.map((s) => ({ label: d.listNames.get(s.value) ?? `List ${s.value}`, value: s.costPerMeeting!, note: plural(s.meetings, "meeting"), color: cpmBarColor(s.costPerMeeting!, bestCpm, avgCpm) }))} />
            : <p className="small">No meetings in {PERIOD_LABEL[period]} yet.</p>}
```

Import `cpmBarColor` from `@/lib/dashboard/story`.

- [ ] **Step 6: Switch to graph8's palette**

In `src/app/globals.css`, replace everything from the first `:root{` down to the closing `}` of the `:root[data-theme="dark"]{…}` block (the three token blocks, lines 1–41) with this single block. Keep the font variables exactly as they are today.

```css
:root{
  color-scheme:dark;
  --bg:#0a0a0a; --panel:#101010; --panel-2:#181818; --ink:#fcfcfc; --ink-2:#a6abb2; --muted:#858a91;
  --line:#292929; --line-2:#1f1f1f;
  --accent:#7d2df3; --accent-ink:#ffffff; --accent-soft:#241539; --accent-fg:#b794f6;
  --series:#a6abb2; --series-soft:rgba(166,171,178,.10); --series-strong:#d4d7db; --series-weak:#5c6169;
  --good:#1faa76; --warn:#f0a431; --crit:#f25555;
  --booked:#1faa76; --nomeet:#80868f; --unused:#f0a431; --unknown:#4b4f56; --waste:#f25555; --flow:#6b7079; --maybe:#6ee7b7;
  --good-bg:#11281f; --warn-bg:#2c2210; --crit-bg:#321a1a;
  --good-ink:#6ee7b7; --bad-ink:#f87171;
  --hatch:rgba(166,171,178,.18);
  --shadow:0 1px 2px rgba(0,0,0,.5);
  --f-display:"Archivo","Helvetica Neue",Arial,sans-serif;
  --f-body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
```

(If Task 7 has already landed, keep its `--emailed:#6ee7b7;` in this block. `--maybe` is the planner's "maybe" fit colour; it shares graph8's green on purpose.)

Then change these rules (find them with `grep -n`; line numbers move after the block swap):
- `a{color:var(--accent)}` → `a{color:var(--accent-fg)}`
- `:focus-visible{outline:2px solid var(--accent);…}` → `outline:2px solid var(--accent-fg)`
- `.btn.ghost{background:var(--panel);color:var(--accent);border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}` → `.btn.ghost{background:var(--panel);color:var(--ink);border-color:var(--line)}` (graph8's secondary buttons are dark with a grey border and white text)
- `.seg button.on{background:var(--ink);color:var(--bg)}` → `.seg button.on{background:var(--accent-soft);color:var(--accent-fg);font-weight:600}`
- `.seg a.on{background:var(--ink);color:var(--bg)}` → `.seg a.on{background:var(--accent-soft);color:var(--accent-fg);font-weight:600}`
- `.bars .b{…background:var(--flow)…}` → `background:var(--series-weak)`
- `.b.est{background:var(--accent)}` → `.b.est{background:var(--ink-2)}`
- `.cohorts i{…background:var(--accent)…}` → `background:var(--series-weak)`
- `.cohorts .maturing i{background:repeating-linear-gradient(135deg,var(--accent) 0 4px,color-mix(in srgb,var(--accent) 35%,transparent) 4px 8px)}` → use `var(--series-weak)` in both places

Check:
- `grep -n "var(--accent)" advisor/src/app/globals.css` lists only `.btn.primary` (fill and border).
- `grep -n "var(--accent-soft)" advisor/src/app/globals.css` lists only the `.seg` on-states and `.avatar`.
- `grep -n "prefers-color-scheme\|data-theme" advisor/src/app/globals.css` prints nothing.
- `grep -rn "var(--accent" advisor/src --include=*.tsx` prints nothing.

- [ ] **Step 7: Typecheck, full suite, look at it**

Run: `cd advisor && npm run typecheck && npm test`, then `npm run dev` and in another shell `npm run shots`. Open the four `.shots/1440_*.png` next to `images/image1.png` (graph8's Marketing Intelligence screen) and check:
- Page, cards, borders and text match graph8's (near-black page, `#101010` cards, grey borders, white and grey text).
- Primary buttons are graph8 purple with white text; "Sync now" and other ghost buttons are dark with a grey border.
- Starter list bar is red, Sales VPs green, Founders grey; a dashed "average N" line is drawn; labels read at normal size.
- Flow diagram bands between the first two columns are grey, not blue or purple.
- Weekly bars on Recovery are grey with the red cap. Cohort bars on the Overview trend card are grey.
- The period switch's selected option is a purple tint with light purple text.
- The planner's "Advisor estimate" bar is light grey.
- The login page (`/login`) is dark too and its button is purple.

- [ ] **Step 8: Commit**

```bash
git add advisor/src/app/globals.css advisor/src/components/HBarChart.tsx advisor/src/lib/dashboard/story.ts "advisor/src/app/(dash)/page.tsx" advisor/tests/dashboard/story.test.ts
git commit -m "feat(advisor): adopt graph8's palette, keep purple for actions and flag the costly list"
```

---

### Task 6: Recovery leads with the refund

**Files:**
- Modify: `advisor/src/components/OwnerColumns.tsx:19`
- Modify: `advisor/src/components/ClaimTracker.tsx:7`
- Modify: `advisor/src/app/globals.css` (`.owners` line 265, `.tracker` lines 274–277)

No logic changes, so no new unit tests; verified by screenshot.

- [ ] **Step 1: Mark the refund column and completed claim steps**

`OwnerColumns.tsx` line 19: `<section className={`owner ${col.key}`} key={col.key} style={{ borderTopColor: col.tone }}>`

`ClaimTracker.tsx` line 7: `<li key={label as string} className={i < step ? "done" : undefined} aria-current={i === step ? "step" : undefined}>`

- [ ] **Step 2: Styles**

In `globals.css`, change `.owners{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}` to `.owners{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:14px}` (keep the existing `@media (max-width:760px)` line after it), and add:

```css
.owner.refund{background:color-mix(in srgb,var(--crit-bg) 55%,var(--panel))}
```

Replace the three `.tracker` rules (`.tracker`, `.tracker li`, `.tracker li[aria-current="step"]`) with:

```css
.tracker{list-style:none;margin:0 0 14px;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.tracker li{border-top:3px solid var(--line);padding:8px 12px 0 0}
.tracker li.done,.tracker li[aria-current="step"]{border-top-color:var(--ink)}
.tracker li[aria-current="step"] .small{color:var(--ink);font-weight:600}
```

Keep `.tracker b{…}`.

- [ ] **Step 3: Look at it**

Run: `cd advisor && npm run typecheck && npm run shots -- /recovery` (dev server running). In `.shots/1440_recovery.png`: the refund card is the widest and lightly red; Found / Requested / Refunded read as one line of three steps with Found emphasised; nothing looks like an input.

- [ ] **Step 4: Commit**

```bash
git add advisor/src/components/OwnerColumns.tsx advisor/src/components/ClaimTracker.tsx advisor/src/app/globals.css
git commit -m "feat(advisor): give the refund card the lead on Recovery and show the claim as steps"
```

---

### Task 7: Split "No meeting yet" into emailed and not

**Files:**
- Modify: `advisor/src/lib/domain/types.ts:67`
- Modify: `advisor/src/lib/domain/buckets.ts`
- Modify: `advisor/src/lib/dashboard/data.ts:41-42`
- Modify: `advisor/src/lib/domain/activities.ts:46`
- Modify: `advisor/src/components/ActivityTable.tsx:10`
- Modify: `advisor/src/app/globals.css` (three token blocks)
- Test: `advisor/tests/domain/buckets.test.ts`, `advisor/tests/domain/activities.test.ts`

**Interfaces:**
- Produces: `OutcomeBucket` gains `"emailed"`; `BUCKETS = ["booked", "emailed", "nomeet", "unused", "unknown", "waste"]`; `BucketContext.emailedByContact: Map<number, number[]>`; `emailsByContact(outcomes: Outcome[]): Map<number, number[]>`; CSS token `--emailed`.
- Consumed by: Task 8 (`emailsByContact`, `meetingsByContact`).

- [ ] **Step 1: Write the failing tests**

`tests/domain/buckets.test.ts`:
- Import `emailsByContact` from `@/lib/domain/buckets`.
- Line 14: `const ctx = { meetingsByContact: meetingsByContact([meeting(7, "2026-09-10T00:00:00Z")]), emailedByContact: new Map<number, number[]>(), onboardingUnused: true };`
- Line 37: `bucketTotals(charges, { meetingsByContact: new Map(), emailedByContact: new Map(), onboardingUnused: true })`
- Add:

```ts
describe("emailed, no meeting yet", () => {
  const sent = (contactId: number, at: string): Outcome => ({ extId: `e${contactId}${at}`, type: "email_sent", occurredAt: at, contactId, companyId: null, dealId: null,
    amount: null, listId: 2, sequenceId: null, step: 1, channel: "email", segmentKey: null, source: "sim", simulated: true });
  const ectx = { meetingsByContact: meetingsByContact([meeting(9, "2026-09-15T00:00:00Z")]), emailedByContact: emailsByContact([sent(8, "2026-09-12T00:00:00Z"), sent(9, "2026-09-12T00:00:00Z")]), onboardingUnused: false };
  it("marks a charge followed by an email as emailed", () => expect(outcomeBucket(charge({ contactId: 8, chargedAt: "2026-09-10T00:00:00Z" }), ectx)).toBe("emailed"));
  it("keeps a charge made after the last email in no meeting yet", () => expect(outcomeBucket(charge({ contactId: 8, chargedAt: "2026-09-20T00:00:00Z" }), ectx)).toBe("nomeet"));
  it("lets a later meeting win over an email", () => expect(outcomeBucket(charge({ contactId: 9, chargedAt: "2026-09-10T00:00:00Z" }), ectx)).toBe("booked"));
  it("orders the buckets from best to worst", () => expect(BUCKETS).toEqual(["booked", "emailed", "nomeet", "unused", "unknown", "waste"]));
});
```

`tests/domain/activities.test.ts` line 11: add `emailedByContact: new Map<number, number[]>(),` to `ctx`.

- [ ] **Step 2: Run to verify failure**

Run: `cd advisor && npx vitest run tests/domain/buckets.test.ts tests/domain/activities.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/domain/types.ts` line 67: `export type OutcomeBucket = "booked" | "emailed" | "nomeet" | "unused" | "unknown" | "waste";`

`src/lib/domain/buckets.ts`:

```ts
import type { AttributedCharge, Outcome, OutcomeBucket } from "./types";
import { toMs } from "./time";

export const BUCKETS: OutcomeBucket[] = ["booked", "emailed", "nomeet", "unused", "unknown", "waste"];
export const BUCKET_LABEL: Record<OutcomeBucket, string> = {
  booked: "Booked a meeting", emailed: "Emailed, no meeting yet", nomeet: "No meeting yet", unused: "Never used", unknown: "Can't tell yet", waste: "Wasted",
};

export interface BucketContext { meetingsByContact: Map<number, number[]>; emailedByContact: Map<number, number[]>; onboardingUnused: boolean }

function timesByContact(outcomes: Outcome[], types: Outcome["type"][]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const o of outcomes) {
    if (!types.includes(o.type) || o.contactId === null) continue;
    m.set(o.contactId, [...(m.get(o.contactId) ?? []), toMs(o.occurredAt)].sort((a, b) => a - b));
  }
  return m;
}
export const meetingsByContact = (outcomes: Outcome[]) => timesByContact(outcomes, ["meeting_booked"]);
export const emailsByContact = (outcomes: Outcome[]) => timesByContact(outcomes, ["email_sent", "email_replied"]);
```

Keep `isOnboardingResearch`. In `outcomeBucket`, inside `if (c.contactId !== null) { … }`, after the booked check add:

```ts
    if ((ctx.emailedByContact.get(c.contactId) ?? []).some((m) => m >= t)) return "emailed";
```

In `bucketTotals`, the initial object becomes `{ booked: 0, emailed: 0, nomeet: 0, unused: 0, unknown: 0, waste: 0 }`.

`src/lib/dashboard/data.ts`: import `emailsByContact`; the bucket context becomes `{ meetingsByContact: meetingsByContact(d.outcomes), emailedByContact: emailsByContact(d.outcomes), onboardingUnused: … }`.

`src/lib/domain/activities.ts` line 46: add `emailed: 0,` after `booked: 0,`.

`src/components/ActivityTable.tsx` line 10: add `emailed: "emailed, no meeting yet",` to `SHORT`.

`src/app/globals.css`: add `--emailed:#6ee7b7;` next to `--booked` in the single `:root` block from Task 5. (If Task 5 hasn't landed yet, add it to all three token blocks instead; Task 5 keeps it.)

- [ ] **Step 4: Run to verify pass**

Run: `cd advisor && npm run typecheck && npm test`
Expected: clean; all pass. Chips, flow diagram and Charges filters pick up the new bucket through `BUCKETS`, with no further changes.

- [ ] **Step 5: Commit**

```bash
git add advisor/src/lib/domain/types.ts advisor/src/lib/domain/buckets.ts advisor/src/lib/dashboard/data.ts advisor/src/lib/domain/activities.ts advisor/src/components/ActivityTable.tsx advisor/src/app/globals.css advisor/tests/domain/buckets.test.ts advisor/tests/domain/activities.test.ts
git commit -m "feat(advisor): split no meeting yet into emailed and not emailed"
```

---

### Task 8: Demo outreach emails ⏸ (live write, needs the user's OK)

The demo only sends `engagement.email_sent` for contacts who booked, so after Task 7 the "Emailed" bucket is empty. This task writes a file of extra demo events for ~60% of the other demo contacts, then (after approval) posts them to the live advisor's webhook. They land as `roi_outcome` records with `simulated: true`, cost 0 credits, and are covered by the "Includes demo data" pill.

**Files:**
- Create: `advisor/scripts/sim-outreach.ts`
- Modify: `advisor/scripts/sim-events.ts:7`
- Modify: `advisor/src/components/DemoDataPill.tsx:1`
- Modify: `advisor/.gitignore` (if `.sim-plan.json` is listed there, add `.sim-outreach.json` next to it)

**Interfaces:**
- Consumes: `loadDashboardData`, `meetingsByContact`, `emailsByContact` (Task 7), `WebhookEnvelope` from `src/lib/webhooks/verify`.

- [ ] **Step 1: Let sim-events.ts send any events file**

`scripts/sim-events.ts` line 7 becomes:

```ts
const file = process.argv[2] ?? ".sim-plan.json";
const { events } = JSON.parse(fs.readFileSync(file, "utf8")) as { events: WebhookEnvelope[] };
```

- [ ] **Step 2: Write the generator (read-only against graph8)**

`scripts/sim-outreach.ts`:

```ts
// Writes .sim-outreach.json. Send with: npm run script scripts/sim-events.ts .sim-outreach.json
import fs from "node:fs";
import { g8Caller as c } from "../src/lib/g8/client";
import { loadDashboardData } from "../src/lib/dashboard/data";
import { meetingsByContact, emailsByContact } from "../src/lib/domain/buckets";
import { toMs } from "../src/lib/domain/time";
import type { WebhookEnvelope } from "../src/lib/webhooks/verify";

const SHARE = 60, DAY = 86_400_000;
const d = await loadDashboardData(c);
const met = meetingsByContact(d.outcomes), emailed = emailsByContact(d.outcomes);
const first = new Map<number, { t: number; listId: number | null; credits: number }>();
for (const x of d.charges) {
  if (!x.simulated || x.contactId === null || x.service !== "waterfall_enrichment") continue;
  const t = toMs(x.chargedAt), f = first.get(x.contactId);
  first.set(x.contactId, { t: Math.min(t, f?.t ?? t), listId: f?.listId ?? x.listId, credits: (f?.credits ?? 0) + x.credits });
}
const open = [...first].filter(([id]) => !met.has(id) && !emailed.has(id));
const chosen = open.filter(([id]) => ((id * 2654435761) >>> 0) % 100 < SHARE);
const now = Date.now();
const events: WebhookEnvelope[] = chosen.map(([id, f]) => ({ id: `sim-outreach-${id}`, event: "engagement.email_sent", org_id: "sim",
  timestamp: new Date(Math.min(f.t + (2 + (id % 5)) * DAY, now - DAY)).toISOString(),
  data: { contact_id: id, list_id: f.listId, simulated: true, step: 1, channel: "email" } }));
fs.writeFileSync(".sim-outreach.json", JSON.stringify({ events }, null, 1));
console.log(JSON.stringify({ contactsWithoutOutreach: open.length, emailed: events.length, creditsMovingToEmailed: Math.round(chosen.reduce((s, [, f]) => s + f.credits, 0)) }));
```

Run: `cd advisor && npm run script scripts/sim-outreach.ts`
Expected: one JSON line, `emailed` about 60% of `contactsWithoutOutreach`. This step only reads.

- [ ] **Step 3: Update the demo note**

`src/components/DemoDataPill.tsx` line 1: start the sentence with `"Outreach emails, meetings, deals and the email-finding spend on …"` (rest unchanged).

- [ ] **Step 4: ⏸ Send the events (ask the user first)**

Show the user the JSON line from Step 2 and ask: "Post N demo outreach emails to the live advisor? They're marked simulated and cost 0 credits." Only after a yes:

Before sending, confirm the webhook route is still `src/app/api/webhooks/graph8/route.ts` (`ls advisor/src/app/api/webhooks`). If Tasks 14–15 of the v2 plan moved it to a per-workspace path, set `ADVISOR_URL` so the script's `${ADVISOR_URL}/api/webhooks/graph8` hits the right route, or stop and ask.

Run: `cd advisor && npm run script scripts/sim-events.ts .sim-outreach.json`
Expected: `{"sent":N,"failed":0}`. Re-running is safe: outcomes dedupe on `ext_id`.

- [ ] **Step 5: Commit**

```bash
git add advisor/scripts/sim-outreach.ts advisor/scripts/sim-events.ts advisor/src/components/DemoDataPill.tsx advisor/.gitignore
git commit -m "chore(advisor): demo outreach emails so the emailed bucket has data"
```

---

### Task 9: Verify and ship

- [ ] **Step 1: Full checks**

Run: `cd advisor && npm run typecheck && npm test && npm run build`
Expected: clean typecheck; all tests pass (≥ 237); build succeeds.

- [ ] **Step 2: Screenshots against production data**

With `npm run dev` running, `npm run shots`. Review the four `1440_*.png` files against this checklist:
- Overview headline ends "…and 9 won deals worth $…"; the strip shows "won per 1,000 credits" and a green "down …% in … weeks" note.
- Trend card title states the answer ("Cost per meeting fell …%").
- Do next small lines read "~2 more meetings a week if you move this spend", "Up to 50 more contacts like them, free", "Saves ~696 credits a month", "860 credits of research ready to use".
- Flow diagram has a light-green "Emailed, no meeting yet" node (after Task 8) and no blue or purple bands.
- Charges: "Match" column with Exact/Likely/Mixed; list chips show Starter list, Founders, Sales VPs, then "Other lists"; no "guardrail probe".
- Recovery: wide tinted refund card; claim steps.
- Optimize: first card titled "Stop paying twice for the same contacts"; confirm labels name the change; buttons disabled until ticked.
- Palette: put the shots next to `images/image.png` and `images/image1.png` (graph8). Background, cards, borders, text and buttons should look like the same product. The trend note, match dots and outcome colours stay legible on the dark cards.

- [ ] **Step 3: ⏸ Deploy (ask the user first)**

Deploying changes what the demo URL shows. Ask the user, then from `advisor/`: `npx vercel whoami` (must be `axcel342`) and `npx vercel --prod`. Re-run `BASE_URL=https://graph8-roi-advisor.vercel.app npm run shots` and spot-check the Overview.

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch (rebase on `main`, PR to `main`).
