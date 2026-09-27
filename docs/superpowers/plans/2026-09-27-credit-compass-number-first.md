# Credit Compass Number First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the four Credit Compass screens so each one leads with its value as one large figure, with far fewer words and no chart that needs interpreting.

**Architecture:** All work is in the Next.js app under `advisor/`. New numbers and wording come from small pure functions in `src/lib` (tested with vitest), pages in `src/app/(dash)` pass them to presentational components in `src/components`, and styling is plain CSS in `src/app/globals.css` using the existing colour tokens. New CSS uses new class names only, so nothing collides with the old rules; Task 13 then deletes the old components, functions, tests and CSS in one sweep.

**Tech Stack:** Next.js 16.3.6 (App Router, server components, server actions), React 19.2, TypeScript, vitest 5, plain CSS, Google Fonts (Archivo with its width axis, IBM Plex Sans, IBM Plex Mono).

**Spec:** `docs/superpowers/specs/2026-09-27-credit-compass-number-first-design.md`. Visual target: `docs/design/credit-compass-ui-v3/index.html` (open it in a browser; the "Number first" mocks). Read both before starting.

## Global Constraints

- Work in `advisor/`. Read `advisor/AGENTS.md`: this Next.js version differs from training data; check `node_modules/next/dist/docs/` before touching any Next API you have not seen used elsewhere in this repo. The patterns this plan uses (`searchParams` as a Promise, `next/link`, `"use client"` components with `useEffect`/`useActionState`, server actions passed to `<form action>`) are already used in the repo.
- Branch: `credit-compass-v3/number-first` (already created, spec committed at `2aa9590`). Do not rebase onto `main`.
- Baseline: `npm test` → 54 files, 255 tests passing; `npm run typecheck` clean. Both stay green after every task.
- Commands run from `advisor/`: `npm test`, `npx vitest run <file>`, `npm run typecheck`, `npm run dev` (background), `npm run shots -- <paths>` (writes `.shots/1440_*.png` and `.shots/390_*.png`; needs `DASHBOARD_PASSWORD` from `.env.local`, which `npm run shots` loads).
- Copy: sentence case, plain words, no em-dash asides, no colon-then-reveal phrasing, labels of six words or fewer. Numbers go through `n()`, `plural()` and `usd()` from `src/lib/dashboard/story.ts`.
- Colour meaning (spec §2.2): `--good-ink` for value gained, `--waste`/`--bad-ink` for waste and the costliest list, `--unused` for unused, `--accent` only for clickable things. Do not add or change colour tokens.
- Figures use the `.fig` class from Task 1. Do not use IBM Plex Mono for numbers.
- Phone layout is in scope: 390 px wide, no horizontal page scroll.
- No graph8 writes. When checking the Optimize and Recovery screens, open and close folds and look at disabled buttons only; never tick a confirmation and press apply, send, run or undo.
- One commit per task, message style `feat(advisor): …` / `fix(advisor): …` / `chore(advisor): …` / `docs: …`, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A refund already requested.** After "Request a refund" is sent, the Overview must stop showing "Claim refund" in Do next. Pinned in Task 5 Step 1 (`refundRequested: true`).
2. **A move-spend gain that rounds to zero.** When the costly list is exactly twice the best list, the card must not say "+0 meetings a week". Pinned in Task 4 Step 1 (falls back to credits a week).
3. **No org average.** With no org stat (for example a fresh workspace), the list chart must show no "× average" notes and no average marker. Pinned in Task 3 Step 1 (`avg: null`) and handled in `ListBars` (Task 6).
4. **Charges filtered down to waste or tiny rows.** Folding is relative to the rows on screen, and wasted rows never fold. Pinned in Task 7 Step 1.
5. **`/recovery#claim` when a claim is already open.** There is no form to open and nothing must break. Checked by hand in Task 10 Step 6 (`ClaimHash` is only rendered when no claim is open).

---

### Task 1: Figure style, fonts and translucent header

**Files:**
- Modify: `advisor/src/app/layout.tsx`
- Modify: `advisor/src/app/globals.css`

**Interfaces:**
- Produces: CSS classes `.fig`, `.fig.tnum`, `.good-ink`, `.bad-ink`, `.h-scr` used by every later task.

- [ ] **Step 1: Load Archivo with its width axis**

In `advisor/src/app/layout.tsx`, replace the stylesheet `href` with:

```tsx
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" />
```

- [ ] **Step 2: Stop using the mono face for numbers**

Run from `advisor/`:

```bash
sed -i '/^code,\.code{/!s/var(--f-mono)/var(--f-display)/g' src/app/globals.css
grep -n "f-mono" src/app/globals.css
```

Expected: only two lines still mention `--f-mono`, the `--f-mono:` token definition near the top and the `code,.code{` rule.

- [ ] **Step 3: Add the figure classes and the translucent header**

In `advisor/src/app/globals.css`, replace the existing `.topbar{…}` rule (starts `.topbar{position:sticky;top:0;z-index:10;background:var(--bg);`) with:

```css
.topbar{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 80%,transparent);-webkit-backdrop-filter:blur(14px) saturate(170%);backdrop-filter:blur(14px) saturate(170%);display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;border-bottom:1px solid var(--line);padding:12px 0}
@media (prefers-reduced-transparency: reduce){.topbar{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}
```

Then append at the end of the file:

```css
/* number first: shared */
.fig{font-family:var(--f-display);font-stretch:112%;font-weight:780;letter-spacing:-.03em;line-height:1;font-variant-numeric:lining-nums}
.fig.tnum{font-variant-numeric:lining-nums tabular-nums}
.good-ink{color:var(--good-ink)}
.bad-ink{color:var(--bad-ink)}
.h-scr{font:720 clamp(22px,2.6vw,28px)/1.15 var(--f-display);letter-spacing:-.02em;margin:0}
```

- [ ] **Step 4: Check nothing broke**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; 54 files, 255 tests pass.

Start the app in the background with `npm run dev`, then run `npm run shots -- /`. Open `.shots/1440_root.png`: numbers in the Charges-style tables and charts no longer use a monospaced face, and the header still reads normally.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(advisor): one figure style for numbers and a translucent header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Value chain and trend line logic

**Files:**
- Modify: `advisor/src/lib/dashboard/story.ts`
- Modify: `advisor/src/lib/domain/trend.ts`
- Test: `advisor/tests/dashboard/story.test.ts`, `advisor/tests/domain/trend.test.ts`

**Interfaces:**
- Produces (story.ts):
  - `interface ChainNode { figure: string; label: string; tone: "in" | "mid" | "out" }`
  - `type ValueChain = { nodes: ChainNode[]; links: string[]; aria: string } | { empty: string }`
  - `perCredit(x: number): string`
  - `valueChain(p: { total: number; meetings: number; won: number; wonValue: number; periodLabel: string }): ValueChain`
- Produces (trend.ts):
  - `interface TrendLineData { pct: number; direction: "down" | "up"; since: string; values: number[] }`
  - `trendLine(points: TrendPoint[]): TrendLineData | null`
  - The spec sketches a `text` field; instead `TrendLine` (Task 6) writes the sentence and `values` feeds its sparkline.

- [ ] **Step 1: Write the failing tests**

Append to `advisor/tests/dashboard/story.test.ts`:

```ts
import { valueChain, perCredit } from "@/lib/dashboard/story";
describe("valueChain", () => {
  const base = { total: 10674.35, meetings: 27, won: 9, wonValue: 108000, periodLabel: "the last 8 weeks" };
  it("links credits to meetings to won value, with the rates on the arrows", () =>
    expect(valueChain(base)).toEqual({
      nodes: [{ figure: "10,674", label: "credits spent", tone: "in" }, { figure: "27", label: "meetings booked", tone: "mid" }, { figure: "$108,000", label: "won, $10 per credit", tone: "out" }],
      links: ["395 per meeting", "9 deals won"],
      aria: "10,674 credits bought 27 meetings, 395 per meeting. 9 won deals worth $108,000, $10 per credit." }));
  it("stops at meetings when no deal was won or deals have no amounts", () => {
    expect(valueChain({ ...base, won: 0, wonValue: 0 })).toMatchObject({ links: ["395 per meeting"], nodes: [{ tone: "in" }, { tone: "mid" }] });
    expect(valueChain({ ...base, won: 3, wonValue: 0 })).toMatchObject({ links: ["395 per meeting"] });
  });
  it("shows only the spend when nothing was booked", () =>
    expect(valueChain({ ...base, meetings: 0, won: 0, wonValue: 0 })).toEqual({ nodes: [{ figure: "10,674", label: "credits spent", tone: "in" }], links: [],
      aria: "10,674 credits spent in the last 8 weeks, and no meetings booked yet." }));
  it("says so when nothing was spent", () => expect(valueChain({ ...base, total: 0 })).toEqual({ empty: "No credits spent in the last 8 weeks." }));
  it("uses the singular for one meeting and one deal", () =>
    expect(valueChain({ total: 500, meetings: 1, won: 1, wonValue: 2000, periodLabel: "the last 30 days" })).toMatchObject({
      nodes: [{ figure: "500" }, { figure: "1", label: "meeting booked" }, { figure: "$2,000", label: "won, $4.00 per credit" }], links: ["500 per meeting", "1 deal won"] }));
  it("shows whole dollars per credit from $10 and cents below", () => { expect(perCredit(10.118)).toBe("$10"); expect(perCredit(4.504)).toBe("$4.50"); });
});
```

Append to `advisor/tests/domain/trend.test.ts`, inside the `describe("rollingCostPerMeeting", …)` block, after the existing `it(…)` lines (it reuses that block's `points`, which run 1000 → 200 from Aug 30):

```ts
  it("gives the trend line its direction, size and start", () =>
    expect(trendLine(points)).toMatchObject({ pct: 80, direction: "down", since: "Aug 30", values: [1000, 400, expect.any(Number), expect.any(Number), 200] }));
  it("says up when cost per meeting rose, and nothing when flat or too short", () => {
    expect(trendLine([{ label: "a", value: 300 }, { label: "b", value: 360 }])).toEqual({ pct: 20, direction: "up", since: "a", values: [300, 360] });
    expect(trendLine([{ label: "a", value: 300 }, { label: "b", value: 300 }])).toBeNull();
    expect(trendLine([{ label: "a", value: null }, { label: "b", value: 300 }])).toBeNull();
  });
  it("starts from the first week that has a value", () =>
    expect(trendLine([{ label: "a", value: null }, { label: "b", value: 500 }, { label: "c", value: 250 }])).toMatchObject({ since: "b", pct: 50 }));
```

Add `trendLine` to the existing import from `@/lib/domain/trend` at the top of that file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/dashboard/story.test.ts tests/domain/trend.test.ts`
Expected: FAIL, `valueChain`, `perCredit` and `trendLine` are not exported.

- [ ] **Step 3: Implement**

Append to `advisor/src/lib/dashboard/story.ts`:

```ts
export interface ChainNode { figure: string; label: string; tone: "in" | "mid" | "out" }
export type ValueChain = { nodes: ChainNode[]; links: string[]; aria: string } | { empty: string };

export const perCredit = (x: number) => (x >= 10 ? usd(x) : `$${x.toFixed(2)}`);

export function valueChain(p: { total: number; meetings: number; won: number; wonValue: number; periodLabel: string }): ValueChain {
  if (p.total <= 0) return { empty: `No credits spent in ${p.periodLabel}.` };
  const spent: ChainNode = { figure: n(p.total), label: "credits spent", tone: "in" };
  if (p.meetings <= 0) return { nodes: [spent], links: [], aria: `${n(p.total)} credits spent in ${p.periodLabel}, and no meetings booked yet.` };
  const cpm = `${n(p.total / p.meetings)} per meeting`;
  const booked: ChainNode = { figure: n(p.meetings), label: Math.round(p.meetings) === 1 ? "meeting booked" : "meetings booked", tone: "mid" };
  const bought = `${n(p.total)} credits bought ${plural(p.meetings, "meeting")}, ${cpm}.`;
  if (p.won <= 0 || p.wonValue <= 0) return { nodes: [spent, booked], links: [cpm], aria: bought };
  const each = perCredit(p.wonValue / p.total);
  return { nodes: [spent, booked, { figure: usd(p.wonValue), label: `won, ${each} per credit`, tone: "out" }],
    links: [cpm, plural(p.won, "deal won", "deals won")],
    aria: `${bought} ${plural(p.won, "won deal")} worth ${usd(p.wonValue)}, ${each} per credit.` };
}
```

Append to `advisor/src/lib/domain/trend.ts`:

```ts
export interface TrendLineData { pct: number; direction: "down" | "up"; since: string; values: number[] }

export function trendLine(points: TrendPoint[]): TrendLineData | null {
  const c = trendChange(points);
  if (!c || c.pct === 0) return null;
  const v = points.filter((p): p is { label: string; value: number } => p.value !== null);
  return { pct: Math.abs(c.pct), direction: c.pct < 0 ? "down" : "up", since: v[0].label, values: v.map((p) => p.value) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/dashboard/story.test.ts tests/domain/trend.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/story.ts src/lib/domain/trend.ts tests/dashboard/story.test.ts tests/domain/trend.test.ts
git commit -m "feat(advisor): value chain and trend line for the Overview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Annotated list rows

**Files:**
- Modify: `advisor/src/lib/dashboard/story.ts`
- Test: `advisor/tests/dashboard/story.test.ts`

**Interfaces:**
- Produces: `interface ListRow { label: string; value: number; color: string; note: string | null; tone: "good" | "bad" | null }` and `listRows(rows: { label: string; value: number }[], avg: number | null): ListRow[]` (sorted cheapest first).

- [ ] **Step 1: Write the failing tests**

Append to `advisor/tests/dashboard/story.test.ts`:

```ts
import { listRows } from "@/lib/dashboard/story";
describe("listRows", () => {
  const rows = [{ label: "Starter list", value: 1232.75 }, { label: "Sales VPs", value: 118.61 }, { label: "Founders", value: 433 }];
  it("sorts cheapest first and labels the cheapest and anything at twice the average", () =>
    expect(listRows(rows, 395.35)).toEqual([
      { label: "Sales VPs", value: 118.61, color: "var(--booked)", note: "cheapest", tone: "good" },
      { label: "Founders", value: 433, color: "var(--series-weak)", note: null, tone: null },
      { label: "Starter list", value: 1232.75, color: "var(--waste)", note: "3× average", tone: "bad" }]));
  it("adds no notes to a single list", () =>
    expect(listRows([{ label: "Sales VPs", value: 118 }], 118)).toEqual([{ label: "Sales VPs", value: 118, color: "var(--series-weak)", note: null, tone: null }]));
  it("skips the average note when there is no org average", () =>
    expect(listRows(rows, null).map((r) => r.note)).toEqual(["cheapest", null, null]));
  it("calls every tied lowest list cheapest, and none when all are equal", () => {
    expect(listRows([{ label: "A", value: 100 }, { label: "B", value: 100 }, { label: "C", value: 500 }], 150).map((r) => r.note)).toEqual(["cheapest", "cheapest", "3× average"]);
    expect(listRows([{ label: "A", value: 100 }, { label: "B", value: 100 }], 100).map((r) => r.note)).toEqual([null, null]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/dashboard/story.test.ts`
Expected: FAIL, `listRows` is not exported.

- [ ] **Step 3: Implement**

Append to `advisor/src/lib/dashboard/story.ts`:

```ts
export interface ListRow { label: string; value: number; color: string; note: string | null; tone: "good" | "bad" | null }

export function listRows(rows: { label: string; value: number }[], avg: number | null): ListRow[] {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const min = sorted[0]?.value;
  const compare = sorted.length >= 2 && sorted.some((r) => r.value !== min);
  return sorted.map((r) => {
    if (compare && r.value === min) return { ...r, color: "var(--booked)", note: "cheapest", tone: "good" };
    if (compare && avg !== null && avg > 0 && r.value >= 2 * avg) return { ...r, color: "var(--waste)", note: `${Math.floor(r.value / avg)}× average`, tone: "bad" };
    return { ...r, color: "var(--series-weak)", note: null, tone: null };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/dashboard/story.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/story.ts tests/dashboard/story.test.ts
git commit -m "feat(advisor): list rows that name the cheapest and costliest list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Payoff, short evidence and fit chart on each action

**Files:**
- Modify: `advisor/src/lib/domain/actions.ts`
- Modify: `advisor/src/components/ActionCard.tsx:25` (guard the now-nullable evidence)
- Modify: `advisor/tests/dashboard/donext.test.ts` (its `act()` helper builds `PlannedAction`)
- Test: `advisor/tests/domain/actions.test.ts`

**Interfaces:**
- Produces: `interface Payoff { figure: string; unit: string }` (exported from `actions.ts`); `PlannedAction.payoff: Payoff`; `PlannedAction.evidence: string | null`. For `skip-unlikely`, `chart` becomes the fit split of the chosen list: labels `"Likely"`, `"Maybe"`, `"Unlikely"`, `"Unknown"` with tones `var(--booked)`, `var(--maybe)`, `var(--waste)`, `var(--unknown)`; zero-valued entries other than `"Unlikely"` are left out. `impact`, `title`, `steps`, `button` and `inGraph8` are unchanged.

- [ ] **Step 1: Write the failing tests**

Append inside `describe("buildActions", …)` in `advisor/tests/domain/actions.test.ts`:

```ts
  it("gives each action a payoff figure and unit", () =>
    expect(acts.map((a) => [a.id, a.payoff])).toEqual([
      ["repeat", { figure: "48", unit: "credits a month" }], ["move-spend", { figure: "+2", unit: "meetings a week" }], ["skip-unlikely", { figure: "12", unit: "credits a run" }]]));
  it("keeps evidence to one line, and only where the chart can't say it", () => {
    expect(acts.map((a) => a.evidence)).toEqual([null, null, "Emails that don't match the company bounced 45% of the time, against 20% for the rest."]);
  });
  it("charts the fit of the list the rule would change", () => {
    const more = [...contacts, row(300, 2, "high"), row(301, 2, "medium"), row(302, 2, "unknown")];
    expect(buildActions({ ...input, contacts: more }).find((a) => a.id === "skip-unlikely")!.chart).toEqual([
      { label: "Likely", value: 1, tone: "var(--booked)" }, { label: "Maybe", value: 1, tone: "var(--maybe)" },
      { label: "Unlikely", value: 12, tone: "var(--waste)" }, { label: "Unknown", value: 1, tone: "var(--unknown)" }]);
    expect(acts.find((a) => a.id === "skip-unlikely")!.chart).toEqual([{ label: "Unlikely", value: 12, tone: "var(--waste)" }]);
  });
  it("shows a small gain with one decimal, and credits when the gain rounds to nothing", () => {
    const withWorst = (cpm: number) => buildActions({ ...input, stats: [stats[0], stats[1], stat("2", 1000, 4, cpm, "low")] }).find((a) => a.id === "move-spend")!.payoff;
    expect(withWorst(400)).toEqual({ figure: "+0.2", unit: "meetings a week" });
    expect(withWorst(248)).toEqual({ figure: "125", unit: "credits a week to move" });
  });
```

In `advisor/tests/dashboard/donext.test.ts`, change the `act` helper so it still type-checks (it gains `payoff` and `evidence: null`):

```ts
  const act = (id: PlannedAction["id"], p: Partial<PlannedAction> = {}): PlannedAction => ({ id, title: "", impact: "", evidence: null, confidence: "High confidence",
    inGraph8: "", chart: [], steps: [], button: null, applied: false, monthlyCredits: 0, payoff: { figure: "", unit: "" }, ...p });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/domain/actions.test.ts`
Expected: FAIL, `payoff` is undefined and evidence strings differ.

- [ ] **Step 3: Implement**

In `advisor/src/lib/domain/actions.ts`:

1. Replace the `PlannedAction` interface with:

```ts
export interface Payoff { figure: string; unit: string }
export interface PlannedAction {
  id: "repeat" | "move-spend" | "skip-unlikely"; title: string; impact: string; payoff: Payoff; evidence: string | null; confidence: "High confidence" | "Medium confidence";
  inGraph8: string; chart: { label: string; value: number; tone: string }[]; steps: { label: string; sub: string; done: boolean }[];
  button: { action: "repeat" | "lookalike" | "pause" | "guardrail"; label: string; listIds: number[]; confirm: string } | null; applied: boolean; monthlyCredits: number;
}
```

2. Add this helper under `isApplied`:

```ts
export function movePayoff(gain: number, weekly: number): Payoff {
  if (gain >= 1) return { figure: `+${n(gain)}`, unit: Math.round(gain) === 1 ? "meeting a week" : "meetings a week" };
  if (gain >= 0.1) return { figure: `+${gain.toFixed(1)}`, unit: "meetings a week" };
  return { figure: n(weekly), unit: "credits a week to move" };
}
```

3. In the `repeat` push, replace `evidence: …,` with `evidence: null,` and add `payoff: { figure: n((rep.credits * 30) / 56), unit: "credits a month" },`.

4. In the `move-spend` push, replace `evidence: …,` with `evidence: null,` and add `payoff: movePayoff(gain, weekly),`.

5. Replace the fit counting and the `skip-unlikely` push (from `const lowBy = new Map` to the end of that `if` block) with:

```ts
  const fitBy = new Map<number, { low: number; all: number; high: number; medium: number; unknown: number }>();
  for (const r of x.contacts) for (const l of r.listIds) {
    const e = fitBy.get(l) ?? { low: 0, all: 0, high: 0, medium: 0, unknown: 0 };
    e.all++;
    if (r.fit === "low") { if (r.hasEmail) e.low++; } else e[r.fit]++;
    fitBy.set(l, e);
  }
  const [gl, g] = [...fitBy].sort((a, b) => b[1].low - a[1].low)[0] ?? [];
  if (gl !== undefined && g && g.low >= 10) {
    const applied = isApplied(x.actions, "guardrail", gl);
    const chart = [{ label: "Likely", value: g.high, tone: "var(--booked)" }, { label: "Maybe", value: g.medium, tone: "var(--maybe)" },
      { label: "Unlikely", value: g.low, tone: "var(--waste)" }, { label: "Unknown", value: g.unknown, tone: "var(--unknown)" }].filter((c) => c.label === "Unlikely" || c.value > 0);
    out.push({ id: "skip-unlikely", title: "Skip contacts unlikely to book", impact: `saves ${n(g.low)} per run`, monthlyCredits: 0,
      payoff: { figure: n(g.low), unit: "credits a run" },
      evidence: "Emails that don't match the company bounced 45% of the time, against 20% for the rest.",
      confidence: "High confidence", chart, steps: [],
      inGraph8: "Writes a fit score to each contact and adds a run condition to the list pipeline, so graph8 skips anyone unlikely on every run.",
      button: applied ? null : { action: "guardrail", label: `Apply to ${the(name(gl))}`, listIds: [gl], confirm: `Yes, add the rule to ${the(name(gl))} in graph8` }, applied });
  }
```

In `advisor/src/components/ActionCard.tsx`, change `<p>{a.evidence}</p>` to `{a.evidence && <p>{a.evidence}</p>}` (the card is rebuilt in Task 12; this keeps it compiling now).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/domain/actions.test.ts tests/dashboard/donext.test.ts && npm run typecheck`
Expected: PASS, typecheck clean. The existing assertions on `impact` ("~2 more meetings a week", "saves 12 per run") still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/actions.ts src/components/ActionCard.tsx tests/domain/actions.test.ts tests/dashboard/donext.test.ts
git commit -m "feat(advisor): every Optimize change carries its payoff and one line of evidence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Do next merged by destination, figure first

**Files:**
- Modify: `advisor/src/lib/dashboard/donext.ts`
- Test: `advisor/tests/dashboard/donext.test.ts` (replace the file's tests)

**Interfaces:**
- Consumes: `Payoff`, `PlannedAction` (Task 4).
- Produces:
  - `interface DoNextItem { id: string; figure: string; unit: string; text: string; label: string; href: string }`
  - `interface DoNextImpact { repeat: Payoff | null; move: (Payoff & { title: string }) | null; refundRequested: boolean }`
  - `doNextImpact(actions: PlannedAction[], refundRequested?: boolean): DoNextImpact`
  - `doNextItems(findings: Finding[], max?: number, periodQuery?: string, impact?: DoNextImpact): DoNextItem[]`

- [ ] **Step 1: Write the failing tests**

Replace everything in `advisor/tests/dashboard/donext.test.ts` below the imports with:

```ts
const f = (kind: Finding["kind"], stake: number, body: string, confidence: Finding["confidence"] = "high", id = kind): Finding => ({ extId: `${id}|x|8w`, kind, title: kind, body,
  evidence: {}, creditsAtStake: stake, confidence, status: "open", snoozedUntil: null, dismissCount: 0, action: null, actionPayload: null,
  firstSeen: "2026-09-27T00:00:00Z", lastSeen: "2026-09-27T00:00:00Z", lastNotifiedStake: null, inRecap: false, simulated: false });
const act = (id: PlannedAction["id"], p: Partial<PlannedAction> = {}): PlannedAction => ({ id, title: "", impact: "", evidence: null, confidence: "High confidence",
  inGraph8: "", chart: [], steps: [], button: null, applied: false, monthlyCredits: 0, payoff: { figure: "", unit: "" }, ...p });
const moveTitle = "Move spend from the Starter list to people like your Sales VPs";
const impact = { repeat: { figure: "696", unit: "credits a month" }, move: { figure: "+2", unit: "meetings a week", title: moveTitle }, refundRequested: false };
const findings = [f("cut", 4931, "Starter list costs 1,233 credits per meeting, over twice your average.", "medium"), f("scale", 2016, "Sales VPs book cheaply."),
  f("repeat_enrichment", 1300, "R"), f("unused", 860, "D", "medium"), f("waste", 77, "A", "high", "waste-a"), f("waste", 14, "B", "high", "waste-b"), f("side_effect", 24, "S")];

describe("doNextItems", () => {
  it("merges cut and scale into one move row and the waste findings into one refund row, figure first", () =>
    expect(doNextItems(findings, 4, "", impact).map((x) => [x.figure, x.unit, x.text, x.label, x.href])).toEqual([
      ["+2", "meetings a week", moveTitle, "Move spend", "/optimize#move-spend"],
      ["696", "credits a month", "Stop paying twice for the same contacts", "Stop paying twice", "/optimize#repeat"],
      ["860", "credits unused", "Onboarding research nobody has opened", "See it", "/recovery"],
      ["91", "credits back", "graph8 owes you for work that produced nothing", "Claim refund", "/recovery#claim"]]));
  it("falls back to the credits at stake when the Optimize change is applied", () =>
    expect(doNextItems([f("cut", 4931, "Starter list costs 1,233 credits per meeting.", "medium"), f("repeat_enrichment", 1300, "R")]).map((x) => [x.figure, x.unit, x.text])).toEqual([
      ["4,931", "credits on a costly list", "Starter list costs 1,233 credits per meeting."], ["1,300", "credits paid twice", "Stop paying twice for the same contacts"]]));
  it("names the best list when only the scale finding is open", () =>
    expect(doNextItems([f("scale", 2016, "Sales VPs book cheaply.")])[0]).toMatchObject({ figure: "2,016", unit: "credits on your best list", text: "Sales VPs book cheaply." }));
  it("stops asking to claim a refund once one has been requested", () =>
    expect(doNextItems([f("waste", 77, "A")], 4, "", { ...impact, refundRequested: true })).toEqual([]));
  it("skips kinds that have nothing to do", () => expect(doNextItems([f("what_worked", 0, "x"), f("traceability", 50, "y")])).toEqual([]));
  it("carries the period query into every link", () =>
    expect(doNextItems(findings, 4, "period=30d", impact).map((x) => x.href)).toEqual(["/optimize?period=30d#move-spend", "/optimize?period=30d#repeat", "/recovery?period=30d", "/recovery?period=30d#claim"]));
  it("counts merged rows once against the limit", () => {
    expect(doNextItems(findings, 5, "", impact).map((x) => x.label)).toEqual(["Move spend", "Stop paying twice", "See it", "Claim refund", "See it"]);
    expect(doNextItems(findings, 2, "", impact)).toHaveLength(2);
  });
  it("gives each merged row a stable id from its findings", () =>
    expect(doNextItems(findings, 1, "", impact)[0].id).toBe("cut|x|8w+scale|x|8w"));
});

describe("doNextImpact", () => {
  it("takes payoffs only from changes not yet applied", () => {
    const open = [act("repeat", { payoff: { figure: "696", unit: "credits a month" } }), act("move-spend", { title: moveTitle, payoff: { figure: "+2", unit: "meetings a week" } })];
    expect(doNextImpact(open)).toEqual({ repeat: { figure: "696", unit: "credits a month" }, move: { figure: "+2", unit: "meetings a week", title: moveTitle }, refundRequested: false });
    expect(doNextImpact(open.map((a) => ({ ...a, applied: true })), true)).toEqual({ repeat: null, move: null, refundRequested: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/dashboard/donext.test.ts`
Expected: FAIL (items have no `figure`, rows are not merged).

- [ ] **Step 3: Implement**

Replace everything in `advisor/src/lib/dashboard/donext.ts` with:

```ts
import type { Finding } from "../domain/types";
import type { Payoff, PlannedAction } from "../domain/actions";
import { n } from "./story";

export interface DoNextItem { id: string; figure: string; unit: string; text: string; label: string; href: string }
export interface DoNextImpact { repeat: Payoff | null; move: (Payoff & { title: string }) | null; refundRequested: boolean }
const NO_IMPACT: DoNextImpact = { repeat: null, move: null, refundRequested: false };
const WEIGHT = { high: 1, medium: 0.6, low: 0.2 } as const;

type Group = "move" | "repeat" | "unused" | "refund" | "side_effect" | "fix";
const GROUP: Partial<Record<Finding["kind"], Group>> = {
  cut: "move", scale: "move", repeat_enrichment: "repeat", unused: "unused", waste: "refund", side_effect: "side_effect", fix: "fix",
};
const BUTTON: Record<Group, [string, string]> = {
  move: ["Move spend", "/optimize#move-spend"], repeat: ["Stop paying twice", "/optimize#repeat"], unused: ["See it", "/recovery"],
  refund: ["Claim refund", "/recovery#claim"], side_effect: ["See it", "/recovery"], fix: ["Plan it", "/optimize#plan"],
};

export function doNextImpact(actions: PlannedAction[], refundRequested = false): DoNextImpact {
  const open = (id: PlannedAction["id"]) => actions.find((a) => a.id === id && !a.applied);
  const move = open("move-spend"), repeat = open("repeat");
  return { repeat: repeat ? repeat.payoff : null, move: move ? { ...move.payoff, title: move.title } : null, refundRequested };
}

function content(g: Group, fs: Finding[], impact: DoNextImpact): Pick<DoNextItem, "figure" | "unit" | "text"> {
  const stake = n(fs.reduce((s, f) => s + f.creditsAtStake, 0));
  switch (g) {
    case "move": {
      if (impact.move) return { figure: impact.move.figure, unit: impact.move.unit, text: impact.move.title };
      const lead = fs.find((f) => f.kind === "cut") ?? fs[0];
      return { figure: n(lead.creditsAtStake), unit: lead.kind === "cut" ? "credits on a costly list" : "credits on your best list", text: lead.body };
    }
    case "repeat": return { ...(impact.repeat ?? { figure: stake, unit: "credits paid twice" }), text: "Stop paying twice for the same contacts" };
    case "unused": return { figure: stake, unit: "credits unused", text: "Onboarding research nobody has opened" };
    case "refund": return { figure: stake, unit: "credits back", text: "graph8 owes you for work that produced nothing" };
    case "side_effect": return { figure: stake, unit: "credits of agent charges", text: "Automated posts woke graph8's agent" };
    case "fix": return { figure: stake, unit: "credits over quotes", text: fs[0].body };
  }
}

function withPeriod(href: string, periodQuery: string): string {
  if (!periodQuery) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}${periodQuery}${hash ? `#${hash}` : ""}`;
}

export function doNextItems(findings: Finding[], max = 4, periodQuery = "", impact: DoNextImpact = NO_IMPACT): DoNextItem[] {
  const groups = new Map<Group, Finding[]>();
  for (const f of findings) {
    const g = GROUP[f.kind];
    if (!g || (g === "refund" && impact.refundRequested)) continue;
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  const score = (fs: Finding[]) => Math.max(...fs.map((f) => f.creditsAtStake * WEIGHT[f.confidence]));
  return [...groups].sort((a, b) => score(b[1]) - score(a[1])).slice(0, max)
    .map(([g, fs]) => ({ id: fs.map((f) => f.extId).join("+"), ...content(g, fs, impact), label: BUTTON[g][0], href: withPeriod(BUTTON[g][1], periodQuery) }));
}
```

In `advisor/src/components/DoNext.tsx`, replace `{x.sub}` with `{x.figure} {x.unit}` so it compiles against the new `DoNextItem` (Task 6 rewrites the component). The Overview page's one-argument `doNextImpact(...)` call still type-checks until Task 6 replaces it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/dashboard/donext.test.ts && npm run typecheck && npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/donext.ts src/components/DoNext.tsx tests/dashboard/donext.test.ts
git commit -m "feat(advisor): Do next leads with the payoff and merges rows that lead to the same change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Overview screen

**Files:**
- Create: `advisor/src/components/ValueChain.tsx`, `advisor/src/components/TrendLine.tsx`, `advisor/src/components/OutcomeBar.tsx`, `advisor/src/components/ListBars.tsx`
- Modify: `advisor/src/components/DoNext.tsx`, `advisor/src/app/(dash)/page.tsx`, `advisor/src/app/globals.css`

**Interfaces:**
- Consumes: `valueChain`, `ValueChain`, `listRows`, `ListRow`, `n` (story.ts); `trendLine`, `TrendLineData`, `rollingCostPerMeeting` (trend.ts); `doNextItems`, `doNextImpact`, `DoNextItem` (donext.ts); `claimState` (recovery.ts); `BUCKETS`, `BUCKET_LABEL` (buckets.ts).
- Produces: `OutcomeBar({ totals: Record<OutcomeBucket, number>; hrefFor?: (b: OutcomeBucket) => string; big?: boolean })`, reused by Task 8.

- [ ] **Step 1: Create the components**

`advisor/src/components/ValueChain.tsx`:

```tsx
import { Fragment } from "react";
import type { ValueChain as Chain } from "@/lib/dashboard/story";

export function ValueChain({ chain }: { chain: Chain }) {
  if ("empty" in chain) return <h1 className="chain-empty">{chain.empty}</h1>;
  return (
    <>
      <h1 className="sr-only">{chain.aria}</h1>
      <div className="chain" aria-hidden="true">
        {chain.nodes.map((x, i) => (
          <Fragment key={x.label}>
            {i > 0 && <div className="cl"><span>{chain.links[i - 1]}</span></div>}
            <div className="cn"><span className={`fig tnum ${x.tone}`}>{x.figure}</span><span className="lab">{x.label}</span></div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
```

`advisor/src/components/TrendLine.tsx`:

```tsx
import type { TrendLineData } from "@/lib/domain/trend";

export function TrendLine({ t }: { t: TrendLineData | null }) {
  if (!t) return null;
  const W = 120, H = 32, P = 4;
  const min = Math.min(...t.values), span = Math.max(...t.values) - min || 1;
  const pts = t.values.map((v, i) => [P + (i * (W - 2 * P)) / (t.values.length - 1), P + ((Math.max(...t.values) - v) / span) * (H - 2 * P)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts.at(-1)!;
  const good = t.direction === "down";
  return (
    <p className="trendline">
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={`${line} L${lx.toFixed(1)},${H} L${P},${H} Z`} fill={good ? "var(--good-bg)" : "var(--crit-bg)"} />
        <path d={line} fill="none" stroke={good ? "var(--booked)" : "var(--waste)"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r={3} fill={good ? "var(--booked)" : "var(--waste)"} />
      </svg>
      <span>Cost per meeting is <b className={good ? "good-ink" : "bad-ink"}>{t.direction} {t.pct}%</b> since {t.since}</span>
    </p>
  );
}
```

`advisor/src/components/OutcomeBar.tsx`:

```tsx
import Link from "next/link";
import type { OutcomeBucket } from "@/lib/domain/types";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { n } from "@/lib/dashboard/story";

export function OutcomeBar({ totals, hrefFor, big = false }: { totals: Record<OutcomeBucket, number>; hrefFor?: (b: OutcomeBucket) => string; big?: boolean }) {
  const shown = BUCKETS.filter((b) => totals[b] > 0);
  return (
    <>
      <div className={big ? "obar big" : "obar"} aria-hidden="true">
        {shown.map((b) => <span key={b} style={{ flex: totals[b], background: `var(--${b})` }} />)}
      </div>
      {hrefFor && (
        <ul className="okey">
          {shown.map((b) => (
            <li key={b} className={b === "booked" ? "lead" : b === "waste" ? "bad" : undefined}>
              <Link href={hrefFor(b)}><i style={{ background: `var(--${b})` }} />{BUCKET_LABEL[b]}<b>{n(totals[b])}</b></Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

`advisor/src/components/ListBars.tsx`:

```tsx
import { n, type ListRow } from "@/lib/dashboard/story";

export function ListBars({ rows, avg }: { rows: ListRow[]; avg: number | null }) {
  const max = Math.max(...rows.map((r) => r.value), avg ?? 0) || 1;
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="lbars" role="list">
      {rows.map((r) => (
        <div className="lb" role="listitem" key={r.label}>
          <span className="nm">{r.label}</span>
          <span className="tr" aria-hidden="true">
            <i style={{ width: pct(r.value), background: r.color }} />
            {avg !== null && <span className="avg" style={{ left: pct(avg) }} />}
          </span>
          <b>{n(r.value)}</b>
          <span className={r.tone ? `note ${r.tone}-ink` : "note"}>{r.note}</span>
        </div>
      ))}
      {avg !== null && (
        <div className="lb foot" aria-hidden="true"><span /><span className="tr"><span className="avg-l" style={{ left: pct(avg) }}>average {n(avg)}</span></span></div>
      )}
    </div>
  );
}
```

Replace `advisor/src/components/DoNext.tsx` with:

```tsx
import Link from "next/link";
import type { DoNextItem } from "@/lib/dashboard/donext";

export function DoNext({ items }: { items: DoNextItem[] }) {
  return (
    <section className="panel dn-list" aria-labelledby="donext-h">
      <div className="ph"><h2 id="donext-h">Do next</h2></div>
      {items.length === 0 && <p className="small">Nothing needs doing right now.</p>}
      {items.map((x) => (
        <div className="dn" key={x.id}>
          <div className="dn-fig"><span className="fig tnum">{x.figure}</span><span className="u">{x.unit}</span></div>
          <p>{x.text}</p>
          <Link className="btn ghost" href={x.href}>{x.label}</Link>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Rewrite the Overview page**

Replace `advisor/src/app/(dash)/page.tsx` with:

```tsx
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { dashboardBuckets } from "@/lib/domain/gate";
import { rollingCostPerMeeting, trendLine } from "@/lib/domain/trend";
import { valueChain, listRows } from "@/lib/dashboard/story";
import { doNextItems, doNextImpact } from "@/lib/dashboard/donext";
import { claimState } from "@/lib/dashboard/recovery";
import { buildActions } from "@/lib/domain/actions";
import { ValueChain } from "@/components/ValueChain";
import { TrendLine } from "@/components/TrendLine";
import { DoNext } from "@/components/DoNext";
import { OutcomeBar } from "@/components/OutcomeBar";
import { ListBars } from "@/components/ListBars";

export default async function Overview({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const periodQuery = period === "30d" ? "period=30d" : "";
  const byList = v.stats.filter((s) => s.dimension === "list" && s.costPerMeeting !== null)
    .map((s) => ({ label: d.listNames.get(s.value) ?? `List ${s.value}`, value: s.costPerMeeting! }));
  const avg = v.org?.costPerMeeting ?? null;
  const v8 = period === "8w" ? v : periodView(d, "8w");
  const impact = doNextImpact(buildActions({ charges: v8.charges, stats: v8.stats, listNames: d.listNames, contacts: [], actions: d.actions }),
    claimState(d.actions, 0).open !== null);
  return (
    <>
      <ValueChain chain={valueChain({ total: v.coverage.total, meetings: v.meetings, won: v.won, wonValue: v.wonValue, periodLabel: PERIOD_LABEL[period] })} />
      <TrendLine t={trendLine(rollingCostPerMeeting(d.charges, d.outcomes, d.now))} />
      <DoNext items={doNextItems(dashboardBuckets(d.findings, d.now).open, 4, periodQuery, impact)} />
      <div className="duo">
        <section className="panel" aria-labelledby="bought-h">
          <div className="ph"><h2 id="bought-h">What the credits bought</h2></div>
          {v.coverage.total > 0
            ? <OutcomeBar totals={v.buckets} hrefFor={(b) => `/charges?outcome=${b}${periodQuery ? `&${periodQuery}` : ""}`} />
            : <p className="small">No charges in {PERIOD_LABEL[period]}.</p>}
        </section>
        <section className="panel" aria-labelledby="cpm-h">
          <div className="ph"><h2 id="cpm-h">Credits per meeting</h2></div>
          {byList.length ? <ListBars rows={listRows(byList, avg)} avg={avg} /> : <p className="small">No meetings in {PERIOD_LABEL[period]} yet.</p>}
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Add the Overview CSS**

Append to `advisor/src/app/globals.css`:

```css
/* number first: overview */
.chain{--fs:clamp(40px,5.4vw,66px);display:flex;align-items:flex-start;gap:0 18px;margin:30px 0 4px}
.chain-empty{font:700 clamp(26px,3.4vw,34px)/1.12 var(--f-display);letter-spacing:-.02em;margin:30px 0 4px}
.cn{display:grid;gap:10px;flex:none}
.cn .fig{font-size:var(--fs)}
.cn .fig.in{color:var(--ink-2)}
.cn .fig.out{color:var(--good-ink)}
.cn .lab{font-size:14px;color:var(--muted)}
.cl{flex:1 1 48px;min-width:48px;max-width:200px;margin-top:calc(var(--fs) * .5);position:relative;border-top:1.5px solid var(--nomeet)}
.cl::after{content:"";position:absolute;right:-2px;top:-6px;border-style:solid;border-width:5px 0 5px 8px;border-color:transparent transparent transparent var(--nomeet)}
.cl span{position:absolute;left:0;right:8px;bottom:8px;text-align:center;font-size:12.5px;color:var(--ink-2);white-space:nowrap}
.trendline{display:flex;align-items:center;gap:12px;font-size:15px;color:var(--ink-2)}
.trendline b{font-weight:600}
.spark{width:120px;height:32px;flex:none;display:block}
.dn-list{padding-block:6px}
.dn-list .ph{margin:10px 0 2px}
.dn{display:grid;grid-template-columns:minmax(118px,160px) minmax(0,1fr) auto;gap:6px 18px;align-items:center;padding:13px 0;border-top:1px solid var(--line-2)}
.ph + .dn{border-top:0}
.dn-fig{display:grid;gap:5px}
.dn-fig .fig{font-size:30px}
.dn-fig .u{font-size:12.5px;color:var(--muted)}
.dn p{font-size:15px}
.duo{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start}
.obar{display:flex;gap:2px;height:26px;margin:2px 0 14px}
.obar span{min-width:3px}
.obar span:first-child{border-radius:5px 0 0 5px}
.obar span:last-child{border-radius:0 5px 5px 0}
.obar.big{height:40px;margin:0}
.okey{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 22px;font-size:14px}
.okey a{display:flex;align-items:center;gap:8px;padding:3px 0;color:var(--ink-2);text-decoration:none}
.okey a:hover{color:var(--ink)}
.okey i{width:10px;height:10px;border-radius:3px;flex:none}
.okey b{margin-left:auto;font:700 14.5px var(--f-display);color:var(--ink);font-variant-numeric:tabular-nums}
.okey .lead a{color:var(--ink);font-weight:600}
.okey .bad a,.okey .bad b{color:var(--bad-ink)}
.lbars{display:grid;gap:12px}
.lb{display:grid;grid-template-columns:84px minmax(0,1fr) 50px 84px;align-items:center;gap:10px;font-size:14px}
.lb .nm{color:var(--ink-2);text-align:right}
.lb .tr{position:relative;height:14px}
.lb .tr i{display:block;height:100%;border-radius:0 4px 4px 0}
.lb .avg{position:absolute;top:-6px;bottom:-6px;width:0;border-left:1.5px dashed var(--ink-2)}
.lb b{font:700 15px var(--f-display);font-variant-numeric:tabular-nums;text-align:right}
.lb .note{font-size:12.5px;font-weight:600}
.lb.foot .tr{height:16px}
.lb .avg-l{position:absolute;top:0;transform:translateX(-50%);font-size:12px;color:var(--ink-2);white-space:nowrap}
@media (max-width:900px){.duo{grid-template-columns:1fr}}
@media (max-width:700px){
  .chain{flex-direction:column;gap:0}
  .cl{flex:none;max-width:none;min-width:0;height:36px;margin:8px 0 8px 14px;border-top:0;border-left:1.5px solid var(--nomeet)}
  .cl::after{right:auto;left:-6px;top:auto;bottom:-3px;border-width:8px 5px 0 5px;border-color:var(--nomeet) transparent transparent transparent}
  .cl span{left:16px;right:auto;bottom:auto;top:50%;transform:translateY(-50%);text-align:left}
}
@media (max-width:620px){
  .dn{grid-template-columns:minmax(0,1fr) auto}
  .dn p{grid-column:1/-1;grid-row:2}
  .dn .btn{grid-column:2;grid-row:1}
  .okey{grid-template-columns:1fr}
  .lb{grid-template-columns:72px minmax(0,1fr) 44px}
  .lb .note{grid-column:2/-1;margin-top:-8px}
}
```

- [ ] **Step 4: Check it on the running app**

Run: `npm run typecheck && npm test` (expected green), then with `npm run dev` running: `npm run shots -- / "/?period=30d"`.

Open `.shots/1440_root.png`, `.shots/390_root.png` and `.shots/1440__period_30d.png` and compare with the "Number first" Overview mock in `docs/design/credit-compass-ui-v3/index.html`. Check:
- the chain reads 10,674 → 27 → $108,000 (8 weeks) and 5,979 → 17 → $72,000 (30 days), with "per meeting" and "deals won" on the arrows;
- on 390 px the chain stacks with downward arrows and the script prints no `HORIZONTAL-OVERFLOW`;
- Do next shows four rows led by +2, 696, 860, 91;
- the list chart says "cheapest" beside Sales VPs and "3× average" beside the Starter list.

- [ ] **Step 5: Commit**

```bash
git add src/components/ValueChain.tsx src/components/TrendLine.tsx src/components/OutcomeBar.tsx src/components/ListBars.tsx src/components/DoNext.tsx "src/app/(dash)/page.tsx" src/app/globals.css
git commit -m "feat(advisor): number-first Overview with the value chain, one bar and annotated lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Charges logic: what each row bought, folding small rows, the small filter

**Files:**
- Modify: `advisor/src/lib/domain/activities.ts`
- Modify: `advisor/src/lib/dashboard/filters.ts`
- Test: `advisor/tests/domain/activities.test.ts`, `advisor/tests/dashboard/filters.test.ts`

**Interfaces:**
- Produces (activities.ts):
  - `type Bought = ({ kind: "result"; text: string; bucket: OutcomeBucket } | { kind: "split"; share: number; buckets: Record<OutcomeBucket, number> } | { kind: "single"; bucket: OutcomeBucket }) & { title: string }`
  - `boughtCell(a: Activity): Bought`
  - `foldSmall(rows: Activity[], share?: number): { shown: Activity[]; small: Activity[]; smallCredits: number }`
- Produces (filters.ts): `ChargeFilter` gains `small?: boolean`; `parseChargeFilter` sets `small` from `?small=1`; `filterHref` keeps `small` only when the patch sets it.

- [ ] **Step 1: Write the failing tests**

Append to `advisor/tests/domain/activities.test.ts`:

```ts
import { boughtCell, foldSmall, type Activity } from "@/lib/domain/activities";
const act = (p: Partial<Activity>): Activity => ({ key: "k", title: "Email finding", detail: "", service: "waterfall_enrichment", listId: null,
  from: "2026-09-26T00:00:00.000Z", to: "2026-09-26T00:00:00.000Z", credits: 100, charges: 1,
  buckets: { booked: 0, emailed: 0, nomeet: 100, unused: 0, unknown: 0, waste: 0 }, match: "exact", matchNote: "Run ID", result: null,
  simulated: false, ledgerIds: [], children: [], ...p });
const split = (booked: number, emailed: number, nomeet: number) => ({ booked, emailed, nomeet, unused: 0, unknown: 0, waste: 0 });

describe("boughtCell", () => {
  it("shows the share that booked when a row bought several things", () =>
    expect(boughtCell(act({ credits: 4800, buckets: split(548.56, 2331.48, 1919.96) }))).toEqual({ kind: "split", share: 11, buckets: split(548.56, 2331.48, 1919.96),
      title: "549 booked, 2,331 emailed, no meeting yet, 1,920 no meeting yet" }));
  it("says 0% booked rather than hiding it", () => expect(boughtCell(act({ buckets: split(0, 50, 50) }))).toMatchObject({ kind: "split", share: 0 }));
  it("uses the row's result when it has one", () =>
    expect(boughtCell(act({ credits: 55, result: "Wasted: failed on 11 of 11", buckets: { ...split(0, 0, 0), waste: 55 } })))
      .toEqual({ kind: "result", text: "Wasted: failed on 11 of 11", bucket: "waste", title: "55 wasted" }));
  it("names the single outcome otherwise", () => expect(boughtCell(act({ credits: 40, buckets: split(0, 0, 40) }))).toEqual({ kind: "single", bucket: "nomeet", title: "40 no meeting yet" }));
});

describe("foldSmall", () => {
  const w = (credits: number) => act({ key: `w${credits}`, credits, buckets: { ...split(0, 0, 0), waste: credits }, result: "Wasted: the job failed" });
  const r = (credits: number) => act({ key: `r${credits}`, credits, buckets: split(0, 0, credits) });
  const today = [r(4800), r(2598), r(2016), r(860), r(100), r(93), w(55), r(40), r(25), w(24), r(24.5), w(22), w(14), r(3)];
  it("folds rows under 1% of spend and never folds waste", () => {
    const f = foldSmall(today);
    expect(f.small.map((x) => x.credits)).toEqual([100, 93, 40, 25, 24.5, 3]);
    expect(f.smallCredits).toBe(285.5);
    expect(f.shown.map((x) => x.credits)).toEqual([4800, 2598, 2016, 860, 55, 24, 22, 14]);
  });
  it("leaves a single small row in place", () => expect(foldSmall([r(10000), r(5)])).toEqual({ shown: [r(10000), r(5)], small: [], smallCredits: 0 }));
  it("measures against the rows on screen, so a waste-only view folds nothing", () => {
    expect(foldSmall([w(55), w(24), w(22), w(14)]).small).toEqual([]);
    expect(foldSmall([r(10000), r(5), r(5)]).smallCredits).toBe(10);
  });
});
```

In `advisor/tests/dashboard/filters.test.ts`, change the two `parseChargeFilter` expectations to include `small: false`:

```ts
    expect(parseChargeFilter({ outcome: "waste", list: "2", service: "ai_enrichment" })).toEqual({ outcome: "waste", list: "2", service: "ai_enrichment", small: false });
    expect(parseChargeFilter({ outcome: "bogus", list: "2; drop", service: "x y" })).toEqual({ outcome: null, list: null, service: null, small: false });
```

and append inside its `describe`:

```ts
  it("reads the small-charges switch and keeps it only when a link sets it", () => {
    expect(parseChargeFilter({ small: "1" }).small).toBe(true);
    const f = { outcome: null, list: "2", service: null, small: true };
    expect(filterHref(f, { outcome: "waste" }, "")).toBe("/charges?outcome=waste&list=2");
    expect(filterHref({ ...f, small: false }, { small: true }, "period=30d")).toBe("/charges?list=2&small=1&period=30d");
    expect(filterHref(f, { small: false }, "")).toBe("/charges?list=2");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/domain/activities.test.ts tests/dashboard/filters.test.ts`
Expected: FAIL (`boughtCell`, `foldSmall` missing; `small` missing from parsed filters).

- [ ] **Step 3: Implement**

In `advisor/src/lib/domain/activities.ts`, add `import { BUCKETS } from "./buckets";` to the imports and append:

```ts
const SHORT: Record<OutcomeBucket, string> = { booked: "booked", emailed: "emailed, no meeting yet", nomeet: "no meeting yet", unused: "never used", unknown: "can't tell yet", waste: "wasted" };

export type Bought = ({ kind: "result"; text: string; bucket: OutcomeBucket } | { kind: "split"; share: number; buckets: Record<OutcomeBucket, number> }
  | { kind: "single"; bucket: OutcomeBucket }) & { title: string };

export function boughtCell(a: Activity): Bought {
  const parts = BUCKETS.filter((b) => a.buckets[b] > 0);
  const title = parts.map((b) => `${Math.round(a.buckets[b]).toLocaleString("en-US")} ${SHORT[b]}`).join(", ");
  if (a.result) return { kind: "result", text: a.result, bucket: parts[0] ?? "unknown", title };
  if (parts.length > 1) return { kind: "split", share: Math.round((a.buckets.booked / a.credits) * 100), buckets: a.buckets, title };
  return { kind: "single", bucket: parts[0] ?? "unknown", title };
}

export function foldSmall(rows: Activity[], share = 0.01): { shown: Activity[]; small: Activity[]; smallCredits: number } {
  const total = rows.reduce((s, a) => s + a.credits, 0);
  const isSmall = (a: Activity) => a.credits < share * total && a.buckets.waste === 0;
  const small = rows.filter(isSmall);
  if (small.length < 2) return { shown: rows, small: [], smallCredits: 0 };
  return { shown: rows.filter((a) => !isSmall(a)), small, smallCredits: small.reduce((s, a) => s + a.credits, 0) };
}
```

In `advisor/src/lib/dashboard/filters.ts`:

```ts
export interface ChargeFilter { outcome: OutcomeBucket | null; list: string | null; service: string | null; small?: boolean }
```

In `parseChargeFilter`, add `small: one("small") === "1",` to the returned object (after `service`). Replace `filterHref` with:

```ts
export function filterHref(f: ChargeFilter, patch: Partial<ChargeFilter>, periodQuery: string): string {
  const m = { ...f, ...patch, small: "small" in patch ? patch.small : false };
  const q = new URLSearchParams();
  if (m.outcome) q.set("outcome", m.outcome);
  if (m.list) q.set("list", m.list);
  if (m.service) q.set("service", m.service);
  if (m.small) q.set("small", "1");
  const s = [q.toString(), periodQuery].filter(Boolean).join("&");
  return s ? `/charges?${s}` : "/charges";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/domain/activities.test.ts tests/dashboard/filters.test.ts && npm run typecheck && npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/activities.ts src/lib/dashboard/filters.ts tests/domain/activities.test.ts tests/dashboard/filters.test.ts
git commit -m "feat(advisor): say what each charge row bought in one figure and fold the small ones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Charges screen

**Files:**
- Modify: `advisor/src/app/(dash)/charges/page.tsx`, `advisor/src/components/ActivityTable.tsx`, `advisor/src/app/globals.css`

**Interfaces:**
- Consumes: `OutcomeBar` (Task 6), `boughtCell`, `foldSmall`, `Activity`, `MATCH_LABEL` (Task 7), `filterHref`, `parseChargeFilter` (Task 7), `BUCKETS`, `BUCKET_LABEL`, `n`.
- Produces: `ActivityTable({ rows: Activity[]; fold: { count: number; credits: number; open: boolean; href: string } | null })`.

- [ ] **Step 1: Rewrite the table**

Replace `advisor/src/components/ActivityTable.tsx` with:

```tsx
import Link from "next/link";
import { boughtCell, MATCH_LABEL, type Activity } from "@/lib/domain/activities";
import { BUCKETS, BUCKET_LABEL } from "@/lib/domain/buckets";
import { n } from "@/lib/dashboard/story";

export interface Fold { count: number; credits: number; open: boolean; href: string }
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const when = (a: Activity) => (a.from.slice(0, 10) === a.to.slice(0, 10) ? day(a.from) : `${day(a.from)} to ${day(a.to)}`);
const MATCH_TIP = "Exact: a run, job or token count matched. Likely: only the timing matched.";

function Bought({ a }: { a: Activity }) {
  const b = boughtCell(a);
  if (b.kind === "split") return (
    <span className="bought" title={b.title}>
      <span className="bmini" aria-hidden="true">{BUCKETS.filter((k) => b.buckets[k] > 0).map((k) => <i key={k} style={{ flex: b.buckets[k], background: `var(--${k})` }} />)}</span>
      <span><span className={b.share >= 50 ? "share good-ink" : "share"}>{b.share}%</span> booked</span>
      <span className="sr-only">. {b.title}</span>
    </span>);
  return (
    <span className={b.bucket === "waste" ? "res bad-ink" : "res"} title={b.title}>
      <i className="dot" style={{ background: `var(--${b.bucket})` }} />{b.kind === "result" ? b.text : BUCKET_LABEL[b.bucket]}
    </span>);
}

export function ActivityTable({ rows, fold }: { rows: Activity[]; fold: Fold | null }) {
  if (!rows.length) return <p className="small">No charges match this filter.</p>;
  return (
    <div className="table-wrap"><table className="acts-table">
      <thead><tr><th>When</th><th>What it paid for</th><th className="num">Credits</th><th>What it bought</th><th title={MATCH_TIP}>Match</th></tr></thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.key}>
            <td className="when">{when(a)}</td>
            <td className="what"><b>{a.title}</b>{a.detail ? `, ${a.detail}` : ""}
              {a.children.length > 0 && (
                <details><summary>{a.children.length} jobs</summary>
                  <ul>{a.children.map((k) => <li key={k.key}><span>{k.label}</span><b>{n(k.credits)}</b><span className="small">{k.result}</span></li>)}</ul>
                </details>)}
            </td>
            <td className="num">{n(a.credits)}</td>
            <td><Bought a={a} /></td>
            <td><span className={`match ${a.match}`} title={a.matchNote}>{MATCH_LABEL[a.match]}</span></td>
          </tr>
        ))}
        {fold && (
          <tr className="fold"><td /><td><Link href={fold.href}>{fold.open ? "Hide" : "Show"} {fold.count} smaller charges</Link></td>
            <td className="num">{n(fold.credits)}</td><td className="small">Each under 1% of spend</td><td /></tr>)}
      </tbody>
    </table></div>
  );
}
```

- [ ] **Step 2: Rewrite the page**

Replace `advisor/src/app/(dash)/charges/page.tsx` with:

```tsx
import Link from "next/link";
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { foldSmall, groupActivities } from "@/lib/domain/activities";
import { bucketTotals } from "@/lib/domain/buckets";
import { serviceName } from "@/lib/domain/names";
import { applyChargeFilter, filterHref, listChips, parseChargeFilter } from "@/lib/dashboard/filters";
import { n } from "@/lib/dashboard/story";
import { OutcomeBar } from "@/components/OutcomeBar";
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
  const all = scoped.reduce((s, c) => s + c.credits, 0);
  const rows = groupActivities(applyChargeFilter(v.charges, f, v.bucketOf), d.runs, v.bucketOf, d.listNames);
  const fold = foldSmall(rows);
  const chips = listChips(v.charges);
  const matched = v.coverage.total > 0 ? Math.round((v.coverage.exact / v.coverage.total) * 100) : 0;
  const label = [f.list ? (f.list === "none" ? "Not tied to a list" : f.list === "other" ? "Other lists" : d.listNames.get(f.list) ?? `List ${f.list}`) : null,
    f.service ? serviceName(f.service) : null].filter(Boolean).join(", ");
  return (
    <>
      <div className="c-head">
        <h1 className="h-scr">{all > 0 ? `What ${n(all)} credits bought` : `No charges in ${PERIOD_LABEL[period]}.`}</h1>
        {v.coverage.total > 0 && <span className="small">{matched}% matched to a contact, list or run</span>}
      </div>
      {all > 0 && <OutcomeBar totals={bucketTotals(scoped, v.bucketCtx)} big />}
      <div className="filters">
        <OutcomeChips f={f} totals={bucketTotals(scoped, v.bucketCtx)} all={all} periodQuery={pq} />
        <nav className="list-filter" aria-label="Filter by list">
          <Link href={filterHref(f, { list: null }, pq)} aria-current={!f.list ? "true" : undefined}>All lists</Link>
          {chips.ids.map((id) => <Link key={id} href={filterHref(f, { list: String(id) }, pq)} aria-current={f.list === String(id) ? "true" : undefined}>{d.listNames.get(String(id)) ?? `List ${id}`}</Link>)}
          {chips.hasOther && <Link href={filterHref(f, { list: "other" }, pq)} aria-current={f.list === "other" ? "true" : undefined}>Other lists</Link>}
        </nav>
        {label && <p className="small">Showing {label}. <Link href={filterHref({ outcome: f.outcome, list: null, service: null }, {}, pq)}>Clear</Link></p>}
      </div>
      <section className="panel">
        <ActivityTable rows={f.small ? rows : fold.shown}
          fold={fold.small.length ? { count: fold.small.length, credits: fold.smallCredits, open: !!f.small, href: filterHref(f, { small: !f.small }, pq) } : null} />
      </section>
    </>
  );
}
```

- [ ] **Step 3: Add the Charges CSS and stop a stray style leaking into the table**

In `advisor/src/app/globals.css`, delete this rule from the `/* actions */` section (it styles the Optimize "In graph8" box, and because it is also named `.what` it paints a grey block behind "What it paid for" in the Charges table):

```css
.what{font-size:13.5px;background:var(--panel-2);border-radius:6px;padding:8px 10px}
```

Then append:

```css
/* number first: charges */
.c-head{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap;margin-top:30px}
.filters{margin-top:4px}
.acts-table td{vertical-align:middle}
.acts-table .when{color:var(--muted);white-space:nowrap}
.acts-table td.num{font:650 14.5px var(--f-display);font-variant-numeric:tabular-nums}
.bought{display:flex;align-items:center;gap:10px}
.bmini{display:flex;width:92px;height:8px;border-radius:3px;overflow:hidden;flex:none}
.share{font:700 15px var(--f-display);font-variant-numeric:tabular-nums}
.res{display:inline-flex;align-items:center;gap:8px}
.res .dot{width:8px;height:8px}
.acts-table .match{color:var(--muted);font-size:13px}
.acts-table .fold td{background:var(--panel-2)}
.acts-table .fold a{font-weight:600;text-decoration:none}
.acts-table .fold a:hover{text-decoration:underline}
```

- [ ] **Step 4: Check it on the running app**

Run: `npm run typecheck && npm test` (green), then `npm run shots -- /charges "/charges?small=1" "/charges?list=2&outcome=waste"`.

Compare `.shots/1440_charges.png` with the Charges mock. Check:
- the heading reads "What 10,674 credits bought", with "90% matched to a contact, list or run" beside it;
- the three Email finding rows show 11%, 30% and 73% booked;
- all four wasted rows are visible, and the last row reads "Show 6 smaller charges" with 285 in the Credits column;
- with `small=1` every row shows and the last row reads "Hide 6 smaller charges";
- the "What it paid for" cells have no grey background;
- the filtered view `list=2&outcome=waste` shows only wasted rows and no fold row;
- `.shots/390_charges.png` has no page-level horizontal scroll (the table scrolls inside its box).

- [ ] **Step 5: Commit**

```bash
git add src/components/ActivityTable.tsx "src/app/(dash)/charges/page.tsx" src/app/globals.css
git commit -m "feat(advisor): Charges leads with what the credits bought and folds small rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Recovery logic: the quiet rows

**Files:**
- Modify: `advisor/src/lib/dashboard/recovery.ts`
- Test: `advisor/tests/dashboard/recovery.test.ts`

**Interfaces:**
- Produces: `interface AlsoRow { id: string; credits: number; lead: string; text: string }` and `alsoRows(items: RecoveryItem[]): AlsoRow[]` (every item whose owner is not `refund`, in the items' order).

- [ ] **Step 1: Write the failing tests**

Append inside `describe("recoveryItems", …)` in `advisor/tests/dashboard/recovery.test.ts` (it reuses that block's `items`, `charges`, `runs` and `ctx`), and add `alsoRows` to the import from `@/lib/dashboard/recovery`:

```ts
  it("turns everything that isn't refundable into one quiet line each", () => {
    expect(alsoRows(items)).toEqual([
      { id: "unused", credits: 860, lead: "Still yours to use.", text: "23 onboarding documents nobody has used." },
      { id: "side_effect", credits: 24, lead: "Already stopped.", text: "Automated posts woke graph8's agent. No charges since." }]);
    expect(alsoRows(recoveryItems(charges, runs, { ...ctx, advisorPosts: [] })).find((x) => x.id === "side_effect"))
      .toEqual({ id: "side_effect", credits: 24, lead: "You can stop this.", text: "Automated posts woke graph8's agent. Post recaps only to #roi-advisor." });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/dashboard/recovery.test.ts`
Expected: FAIL, `alsoRows` is not exported.

- [ ] **Step 3: Implement**

Append to `advisor/src/lib/dashboard/recovery.ts`:

```ts
export interface AlsoRow { id: string; credits: number; lead: string; text: string }

export function alsoRows(items: RecoveryItem[]): AlsoRow[] {
  return items.filter((x) => x.owner !== "refund").map((x) => ({
    id: x.id, credits: x.credits,
    lead: x.owner === "stopped" ? "Already stopped." : x.owner === "stoppable" ? "You can stop this." : "Still yours to use.",
    text: x.owner === "stopped" ? `${x.title}. No charges since.` : x.owner === "stoppable" ? `${x.title}. Post recaps only to #roi-advisor.` : `${x.title}.`,
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/dashboard/recovery.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/recovery.ts tests/dashboard/recovery.test.ts
git commit -m "feat(advisor): one quiet line for each Recovery item that needs no claim

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Recovery screen

**Files:**
- Create: `advisor/src/components/RecoveryClaim.tsx`, `advisor/src/components/ClaimHash.tsx`
- Modify: `advisor/src/app/(dash)/recovery/page.tsx`, `advisor/src/app/globals.css`

**Interfaces:**
- Consumes: `recoveryItems`, `claimState`, `refundDraftFor`, `shortDate`, `alsoRows`, `RecoveryItem` (recovery.ts); `RefundForm` (`src/app/(dash)/recovery/RefundForm.tsx`, unchanged); `markRefunded` (`src/app/(dash)/recovery/actions.ts`, unchanged); `n`.
- Produces: `RecoveryClaim({ items: RecoveryItem[]; claim: ReturnType<typeof claimState>; orgId: string; periodLabel: string })`; `ClaimHash()` opens `<details id="claim-form">` when the URL hash is `#claim`.

- [ ] **Step 1: Create the components**

`advisor/src/components/ClaimHash.tsx`:

```tsx
"use client";
import { useEffect } from "react";

// Do next links to /recovery#claim; open the refund form when that is where the reader landed.
export function ClaimHash() {
  useEffect(() => {
    const open = () => { if (window.location.hash === "#claim") document.getElementById("claim-form")?.setAttribute("open", ""); };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
```

`advisor/src/components/RecoveryClaim.tsx`:

```tsx
import { claimState, refundDraftFor, shortDate, type RecoveryItem } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";
import { RefundForm } from "@/app/(dash)/recovery/RefundForm";
import { markRefunded } from "@/app/(dash)/recovery/actions";
import { ClaimHash } from "./ClaimHash";

export function RecoveryClaim({ items, claim, orgId, periodLabel }: { items: RecoveryItem[]; claim: ReturnType<typeof claimState>; orgId: string; periodLabel: string }) {
  const refund = items.filter((x) => x.owner === "refund");
  if (claim.found <= 0) return <h1 className="h-scr claim-none">Nothing to claim back in {periodLabel}.</h1>;
  const step = claim.refunded > 0 ? 2 : claim.requested > 0 ? 1 : 0;
  const steps = [`Found ${n(claim.found)}`, claim.requested ? `Requested ${n(claim.requested)}` : "Requested", claim.refunded ? `Refunded ${n(claim.refunded)}` : "Refunded"];
  return (
    <section className="claim-lead" id="claim" aria-labelledby="claim-h">
      <div>
        <h1 id="claim-h" className="r-fig"><span className="fig tnum">{n(claim.found)}</span><span className="u">credits</span><span className="sr-only"> graph8 owes you</span></h1>
        <p className="r-lab">graph8 owes you for work that produced nothing</p>
        <ul className="r-items">{refund.map((x) => <li key={x.id}><span>{x.title}</span><b>{n(x.credits)}</b></li>)}</ul>
        <ol className="r-steps" aria-label="Refund claim">
          {steps.map((t, i) => <li key={t} className={i <= step ? "done" : undefined} aria-current={i === step ? "step" : undefined}>{t}</li>)}
        </ol>
      </div>
      <div className="claim-act">
        {!claim.open && refund.length > 0 && (
          <>
            <ClaimHash />
            <details className="claim" id="claim-form">
              <summary className="btn primary">Request a refund of {n(claim.found)}</summary>
              <RefundForm orgId={orgId} draftFor={refund.map((x) => x.id).join(",")}
                items={refund.map((x) => ({ id: x.id, title: x.title, credits: Math.round(x.credits), line: refundDraftFor([x], "").split("\n")[3] }))} />
            </details>
          </>
        )}
        {claim.open?.status === "requested" && (
          <>
            <p className="small">Requested {shortDate(claim.open.appliedAt)}</p>
            <form action={markRefunded}><input type="hidden" name="extId" value={claim.open.extId} /><button className="btn ghost" type="submit">Mark as refunded</button></form>
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Rewrite the page**

Replace `advisor/src/app/(dash)/recovery/page.tsx` with:

```tsx
import { loadDashboardData, periodView } from "@/lib/dashboard/data";
import { currentCaller, currentWorkspace } from "@/lib/workspace/current";
import { parsePeriod, PERIOD_LABEL } from "@/lib/domain/period";
import { alsoRows, claimState, recoveryItems } from "@/lib/dashboard/recovery";
import { n } from "@/lib/dashboard/story";
import { RecoveryClaim } from "@/components/RecoveryClaim";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const d = await loadDashboardData(await currentCaller());
  const v = periodView(d, period);
  const unused = d.findings.find((f) => f.kind === "unused" && f.status !== "applied");
  const items = recoveryItems(v.charges, d.runs, { onboardingUnused: v.bucketCtx.onboardingUnused, unusedDocs: Number(unused?.evidence.documents ?? 0),
    advisorPosts: d.runs.filter((r) => r.kind === "advisor_post" && r.startedAt).map((r) => r.startedAt!) });
  const claim = claimState(d.actions, items.filter((x) => x.owner === "refund").reduce((s, x) => s + x.credits, 0));
  const also = alsoRows(items);
  return (
    <>
      <RecoveryClaim items={items} claim={claim} orgId={(await currentWorkspace()).orgId} periodLabel={PERIOD_LABEL[period]} />
      {also.length > 0 && (
        <div className="also">
          {also.map((x) => <div className="also-row" key={x.id}><span className="fig tnum">{n(x.credits)}</span><span><b>{x.lead}</b> <span className="small">{x.text}</span></span></div>)}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Add the Recovery CSS**

Append to `advisor/src/app/globals.css`:

```css
/* number first: recovery */
.claim-none{margin-top:30px}
.claim-lead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px 40px;align-items:start;margin-top:30px;scroll-margin-top:80px}
.r-fig{display:flex;align-items:baseline;gap:12px;margin:0}
.r-fig .fig{font-size:clamp(60px,7.4vw,92px)}
.r-fig .u{font:700 clamp(18px,2vw,24px) var(--f-display);color:var(--ink-2)}
.r-lab{font-size:18px;margin-top:8px}
.r-items{list-style:none;margin:18px 0 0;padding:0;display:grid;max-width:580px}
.r-items li{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-top:1px solid var(--line);font-size:14.5px}
.r-items b{font:700 15.5px var(--f-display);font-variant-numeric:tabular-nums}
.r-steps{list-style:none;margin:20px 0 0;padding:0;display:flex;align-items:center;max-width:580px;font-size:13px;color:var(--muted)}
.r-steps li{display:flex;align-items:center;gap:8px;flex:1;white-space:nowrap}
.r-steps li:last-child{flex:none}
.r-steps li::before{content:"";width:12px;height:12px;border-radius:50%;border:1.5px solid var(--nomeet);flex:none;background:var(--bg)}
.r-steps li.done{color:var(--ink);font-weight:600}
.r-steps li.done::before{background:var(--ink);border-color:var(--ink)}
.r-steps li:not(:last-child)::after{content:"";flex:1;height:1.5px;background:var(--line);margin-right:8px}
.claim-act{display:grid;justify-items:end;gap:10px;max-width:420px}
.claim{display:grid;justify-items:end;gap:12px}
.claim > summary{list-style:none;cursor:pointer;padding:11px 16px;font-size:14px}
.claim > summary::-webkit-details-marker{display:none}
.claim .refund{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;justify-items:start;text-align:left}
.also{display:grid;border-top:1px solid var(--line);margin-top:12px}
.also-row{display:grid;grid-template-columns:90px minmax(0,1fr);gap:18px;align-items:baseline;padding:13px 0;border-bottom:1px solid var(--line-2);font-size:14.5px}
.also-row .fig{font-size:24px;color:var(--ink-2)}
@media (max-width:760px){.claim-lead{grid-template-columns:1fr}.claim-act,.claim{justify-items:start}}
@media (max-width:620px){.also-row{grid-template-columns:64px minmax(0,1fr)}}
```

- [ ] **Step 4: Run the checks**

Run: `npm run typecheck && npm test`
Expected: green.

- [ ] **Step 5: Check it on the running app**

Run: `npm run shots -- /recovery "/recovery?period=30d"`. Compare `.shots/1440_recovery.png` with the Recovery mock. Check:
- "91 credits" leads, with its two items (77 and 14) and the three steps (Found 91 filled);
- the primary button "Request a refund of 91" sits top right;
- the two quiet lines are 24 "Already stopped." and 860 "Still yours to use.";
- there is no weekly chart, no three cards and no timeline;
- the 390 px shot stacks with no horizontal overflow.

Then in a browser (`npm run dev`, sign in with the dashboard password), open `/recovery` and press "Request a refund of 91": the item checkboxes, message, Copy text and confirmation appear. **Do not tick the confirmation or press Send.** Press the summary again to close it.

- [ ] **Step 6: Check the Do next link and an open claim by hand**

1. From the Overview, press "Claim refund" in Do next. The page lands on Recovery with the refund form already open.
2. In the browser devtools console on `/recovery`, run `location.hash = "#claim"` after closing the form. The form opens again.
3. Review Focus 5: in `src/app/(dash)/recovery/page.tsx`, temporarily change `claimState(d.actions, …)` to `claimState([{ extId: "t", kind: "refund_request", listId: null, pipelineId: null, appliedAt: "2026-09-27T12:00:00Z", status: "requested", previous: null, detail: { credits: 91 }, simulated: false }], …)`. Load `/recovery#claim`: it shows "Requested Sep 27" and "Mark as refunded" (do not press it), with no form, no console error, and the steps "Found 91" and "Requested 91" filled. **Revert the temporary change**, then run `git diff --stat` to confirm the page matches Step 2.

- [ ] **Step 7: Commit**

```bash
git add src/components/RecoveryClaim.tsx src/components/ClaimHash.tsx "src/app/(dash)/recovery/page.tsx" src/app/globals.css
git commit -m "feat(advisor): Recovery leads with what graph8 owes and opens the claim from its button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Optimize logic: title, planner figures and the undone split

**Files:**
- Modify: `advisor/src/lib/dashboard/story.ts`, `advisor/src/lib/domain/planner.ts`, `advisor/src/components/AppliedChanges.tsx`
- Test: `advisor/tests/dashboard/story.test.ts`, `advisor/tests/domain/planner.test.ts`, `advisor/tests/actions/applied-summary.test.ts`

**Interfaces:**
- Produces (story.ts):
  - `optimizeTitle(open: number): { title: string; sub: string | null }`
  - `plannerUnit(p: { estimate: number; every: number; graph8Quote: number | null }): string`
  - `forecastFigure(f: { expected: number; lo: number; hi: number; lowConfidence: boolean }): { figure: string; unit: string; note: string | null }`
- Produces (planner.ts): `TypeDef.shortNotTarget: string` ("Already have an email", "No email to verify", "Already have a phone").
- Produces (AppliedChanges.tsx): `splitApplied(actions: ActionRecord[]): { active: ActionRecord[]; undone: ActionRecord[] }` (refund requests left out, newest first).

- [ ] **Step 1: Write the failing tests**

Append to `advisor/tests/dashboard/story.test.ts`:

```ts
import { optimizeTitle, plannerUnit, forecastFigure } from "@/lib/dashboard/story";
describe("Optimize wording", () => {
  it("counts the changes left to make", () => {
    expect(optimizeTitle(3)).toEqual({ title: "3 changes you can make", sub: "Each costs 0 credits and can be undone" });
    expect(optimizeTitle(1).title).toBe("1 change you can make");
    expect(optimizeTitle(0)).toEqual({ title: "Your spend looks efficient right now.", sub: null });
  });
  it("says what the planner estimate compares with", () => {
    expect(plannerUnit({ estimate: 36, every: 750, graph8Quote: 498 })).toBe("credits, graph8 quotes 498");
    expect(plannerUnit({ estimate: 117, every: 250, graph8Quote: null })).toBe("credits, instead of 250 for every contact");
    expect(plannerUnit({ estimate: 250, every: 250, graph8Quote: 200 })).toBe("credits");
    expect(plannerUnit({ estimate: 0, every: 250, graph8Quote: null })).toBe("credits. Every contact is done or skipped");
  });
  it("turns the forecast into one figure", () => {
    expect(forecastFigure({ expected: 18.7, lo: 14, hi: 25, lowConfidence: true })).toEqual({ figure: "~19", unit: "meetings, likely 14 to 25", note: "Low confidence, fewer than 5 meetings so far" });
    expect(forecastFigure({ expected: 0.4, lo: 0, hi: 1, lowConfidence: false })).toEqual({ figure: "<1", unit: "meetings, likely 0 to 1", note: null });
  });
});
```

Append to `advisor/tests/domain/planner.test.ts`:

```ts
describe("short labels for the cost walk", () => {
  it("names who each enrichment leaves out", () =>
    expect(ENRICHMENT_TYPES.map((t) => t.shortNotTarget)).toEqual(["Already have an email", "No email to verify", "Already have a phone"]));
});
```

Append to `advisor/tests/actions/applied-summary.test.ts` (and change its import to `import { appliedSummary, splitApplied } from "@/components/AppliedChanges";`):

```ts
describe("splitApplied", () => {
  it("keeps live changes up front, folds undone ones and leaves out refund requests", () => {
    const xs = [action("repeat_skip", { extId: "a", status: "undone", appliedAt: "2026-09-27T09:00:00Z" }), action("guardrail", { extId: "b", appliedAt: "2026-09-27T10:00:00Z" }),
      action("pause_list", { extId: "c", appliedAt: "2026-09-27T11:00:00Z" }), action("refund_request", { extId: "d", status: "requested" })];
    const s = splitApplied(xs);
    expect(s.active.map((a) => a.extId)).toEqual(["c", "b"]);
    expect(s.undone.map((a) => a.extId)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/dashboard/story.test.ts tests/domain/planner.test.ts tests/actions/applied-summary.test.ts`
Expected: FAIL, the new functions and field are missing.

- [ ] **Step 3: Implement**

Append to `advisor/src/lib/dashboard/story.ts`:

```ts
export function optimizeTitle(open: number): { title: string; sub: string | null } {
  if (open <= 0) return { title: "Your spend looks efficient right now.", sub: null };
  return { title: `${plural(open, "change")} you can make`, sub: "Each costs 0 credits and can be undone" };
}

export function plannerUnit(p: { estimate: number; every: number; graph8Quote: number | null }): string {
  if (p.estimate <= 0) return "credits. Every contact is done or skipped";
  if (p.graph8Quote !== null && p.graph8Quote > p.estimate) return `credits, graph8 quotes ${n(p.graph8Quote)}`;
  if (p.every > p.estimate) return `credits, instead of ${n(p.every)} for every contact`;
  return "credits";
}

export function forecastFigure(f: { expected: number; lo: number; hi: number; lowConfidence: boolean }): { figure: string; unit: string; note: string | null } {
  return { figure: f.expected < 1 ? "<1" : `~${n(f.expected)}`, unit: `meetings, likely ${f.lo} to ${f.hi}`,
    note: f.lowConfidence ? "Low confidence, fewer than 5 meetings so far" : null };
}
```

In `advisor/src/lib/domain/planner.ts`, add `shortNotTarget: string;` to the `TypeDef` interface (after `notTargetLabel: string;`), and add the field to each entry of `ENRICHMENT_TYPES`: `shortNotTarget: "Already have an email",` on `find`, `shortNotTarget: "No email to verify",` on `verify`, `shortNotTarget: "Already have a phone",` on `phones`.

In `advisor/src/components/AppliedChanges.tsx`, add below `appliedSummary`:

```ts
export function splitApplied(actions: ActionRecord[]): { active: ActionRecord[]; undone: ActionRecord[] } {
  const xs = actions.filter((a) => a.kind !== "refund_request").sort((a, b) => toMs(b.appliedAt) - toMs(a.appliedAt));
  return { active: xs.filter((a) => a.status !== "undone"), undone: xs.filter((a) => a.status === "undone") };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/dashboard/story.test.ts tests/domain/planner.test.ts tests/actions/applied-summary.test.ts && npm run typecheck && npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/story.ts src/lib/domain/planner.ts src/components/AppliedChanges.tsx tests/dashboard/story.test.ts tests/domain/planner.test.ts tests/actions/applied-summary.test.ts
git commit -m "feat(advisor): Optimize title, planner figures and a fold for undone changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Optimize screen

**Files:**
- Modify: `advisor/src/components/ActionCard.tsx`, `advisor/src/components/AppliedChanges.tsx`, `advisor/src/components/Planner.tsx`, `advisor/src/components/CostWalk.tsx`, `advisor/src/app/(dash)/optimize/page.tsx`, `advisor/src/app/globals.css`

**Interfaces:**
- Consumes: `PlannedAction` with `payoff`, `evidence`, fit `chart` (Task 4); `optimizeTitle`, `plannerUnit`, `forecastFigure`, `n`, `plural` (Task 11 and story.ts); `TypeDef.shortNotTarget` (Task 11); `splitApplied`, `appliedSummary` (AppliedChanges.tsx); `applyAction`, `undo` (`src/app/(dash)/optimize/apply.ts`, unchanged); `RunPlan` (unchanged).

- [ ] **Step 1: Rewrite the action card**

Replace `advisor/src/components/ActionCard.tsx` with:

```tsx
"use client";
import { useActionState, useState } from "react";
import type { PlannedAction } from "@/lib/domain/actions";
import { applyAction } from "@/app/(dash)/optimize/apply";

type Button = NonNullable<PlannedAction["button"]>;
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

function ApplyForm({ button, act, pending }: { button: Button; act: (f: FormData) => void; pending: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <form action={act}>
      <input type="hidden" name="action" value={button.action} /><input type="hidden" name="listIds" value={button.listIds.join(",")} />
      <label className="small confirm"><input type="checkbox" name="confirm" value="yes" checked={ok} onChange={(e) => setOk(e.target.checked)} /> {button.confirm}</label>
      <button className="btn primary" type="submit" disabled={pending || !ok}>{pending ? "Working…" : button.label}</button>
    </form>);
}

function Chart({ a }: { a: PlannedAction }) {
  if (a.id === "repeat" && a.chart.length === 2) return (
    <>
      <div className="oc-bar" aria-hidden="true">{a.chart.map((x) => <span key={x.label} style={{ flex: x.value, background: x.tone }} />)}</div>
      <div className="oc-key"><span>First time {fmt(a.chart[0].value)}</span><span className="bad-ink">Again within 30 days {fmt(a.chart[1].value)}</span></div>
    </>);
  if (a.id === "move-spend") {
    const max = Math.max(1, ...a.chart.map((x) => x.value));
    return (
      <>
        <div className="oc-cmp">{a.chart.map((x) => <div key={x.label}><span>{x.label}</span><i style={{ width: `${(x.value / max) * 100}%`, background: x.tone }} /><b>{x.value.toFixed(1)}</b></div>)}</div>
        <p className="small">Meetings per 1,000 credits</p>
      </>);
  }
  if (a.id === "skip-unlikely") return (
    <>
      <div className="oc-bar" aria-hidden="true">{a.chart.map((x) => <span key={x.label} style={{ flex: x.value, background: x.tone }} />)}</div>
      <div className="oc-key">{a.chart.map((x) => <span key={x.label} className={x.label === "Unlikely" ? "bad-ink" : undefined}>{x.label} {fmt(x.value)}{x.label === "Unlikely" ? ", skipped" : ""}</span>)}</div>
    </>);
  return null;
}

export function ActionCard({ a }: { a: PlannedAction }) {
  const [state, act, pending] = useActionState(applyAction, undefined);
  return (
    <article className={a.applied ? "oc applied" : "oc"} id={a.id}>
      <div className="oc-fig"><span className="fig tnum">{a.payoff.figure}</span><span className="u">{a.payoff.unit}</span></div>
      <div className="oc-main">
        <h2>{a.title}</h2>
        <Chart a={a} />
        {a.steps.length > 0 && (
          <ol className="oc-steps">{a.steps.map((s, i) => <li key={s.label} className={s.done ? "done" : undefined} title={s.sub}><span className="n" aria-hidden="true">{s.done ? "✓" : i + 1}</span>{s.label}</li>)}</ol>)}
        {a.evidence && <p className="oc-ev">{a.evidence}</p>}
        {a.confidence !== "High confidence" && <p className="small">{a.confidence}</p>}
        <details className="more"><summary>What changes in graph8</summary><p>{a.inGraph8}</p></details>
      </div>
      <div className="oc-side">
        {a.button ? <ApplyForm key={a.button.action} button={a.button} act={act} pending={pending} /> : <span className="done-tag">Done</span>}
        {state && <span className="toast" role="status">{state.ok ? state.message : `Not changed: ${state.message}`}</span>}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Rewrite changes-you've-made, the planner and the cost walk**

Replace the `AppliedChanges` function (keep `appliedSummary`, `splitApplied`, `LABEL` and `listNamesGet`) in `advisor/src/components/AppliedChanges.tsx` with:

```tsx
function AppliedRow({ a, runs, listNames }: { a: ActionRecord; runs: Run[]; listNames: Map<string, string> }) {
  return (
    <div className="applied">
      <i className="dot" style={{ background: a.status === "applied" ? "var(--booked)" : "var(--unknown)" }} />
      <div><b>{LABEL[a.kind]}</b><br /><span className="small">{appliedSummary(a, runs, listNamesGet(listNames, a.listId))}</span></div>
      {a.status === "applied" && a.kind !== "lookalike" && <form action={undo}><input type="hidden" name="extId" value={a.extId} /><button className="btn ghost" type="submit">Undo</button></form>}
    </div>);
}

export function AppliedChanges({ actions, runs, listNames }: { actions: ActionRecord[]; runs: Run[]; listNames: Map<string, string> }) {
  const { active, undone } = splitApplied(actions);
  if (!active.length && !undone.length) return null;
  return (
    <section className="panel" aria-labelledby="applied-h">
      <div className="ph"><h2 id="applied-h">Changes you&apos;ve made</h2></div>
      {active.map((a) => <AppliedRow key={a.extId} a={a} runs={runs} listNames={listNames} />)}
      {undone.length > 0 && (
        <details className="more"><summary>{undone.length} undone</summary>{undone.map((a) => <AppliedRow key={a.extId} a={a} runs={runs} listNames={listNames} />)}</details>)}
    </section>
  );
}
```

Replace `advisor/src/components/CostWalk.tsx` with:

```tsx
import type { CostWalk as Walk, TypeDef } from "@/lib/domain/planner";
import { n, plural } from "@/lib/dashboard/story";

export function CostWalk({ walk, def }: { walk: Walk; def: TypeDef }) {
  const w = (v: number) => `${walk.every ? (v / walk.every) * 100 : 0}%`;
  const after1 = walk.every - walk.done.credits;
  return (
    <div className="walk" role="table" aria-label="How the estimate is built">
      <div role="row"><span role="cell">Every contact</span><div className="track"><span className="b every" style={{ width: "100%" }} /></div><b role="cell">{n(walk.every)}</b></div>
      <div role="row" title={plural(walk.done.count, "contact")}><span role="cell">{def.shortNotTarget}</span><div className="track"><span style={{ width: w(after1) }} /><span className="b cut" style={{ width: w(walk.done.credits) }} /></div><b role="cell" className="muted">{walk.done.credits ? `−${n(walk.done.credits)}` : "0"}</b></div>
      <div role="row" title={plural(walk.skipped.count, "contact")}><span role="cell">Unlikely to book, skipped</span><div className="track"><span style={{ width: w(after1 - walk.skipped.credits) }} /><span className="b skip" style={{ width: w(walk.skipped.credits) }} /></div><b role="cell" className="muted">{walk.skipped.credits ? `−${n(walk.skipped.credits)}` : "0"}</b></div>
      <div role="row" title={plural(walk.records, "contact")}><span role="cell"><b>Estimate</b></span><div className="track"><span className="b est" style={{ width: w(walk.records * walk.perRecord) }} /></div><b role="cell">~{n(walk.estimate)}</b></div>
    </div>
  );
}
```

Replace `advisor/src/components/Planner.tsx` with:

```tsx
import Link from "next/link";
import type { Plan } from "@/lib/dashboard/planner-data";
import { forecastFigure, n, plannerUnit } from "@/lib/dashboard/story";
import { CostWalk } from "./CostWalk";
import { RunPlan } from "@/app/(dash)/optimize/RunPlan";

export function Planner({ plan, choices, rule, hrefFor }: { plan: Plan; choices: { id: number; label: string; total: number }[]; rule: string; hrefFor: (p: { list?: number; type?: string }) => string }) {
  const fc = forecastFigure(plan.forecast);
  const synced = plan.syncedAt ? `Fit from the last sync, ${new Date(plan.syncedAt).toUTCString().slice(5, 22)} UTC` : "Run Sync now to score contacts";
  return (
    <section className="panel" id="plan" aria-labelledby="plan-h">
      <div className="pl-head">
        <h2 id="plan-h">Plan your next enrichment</h2>
        <form method="get" action="/optimize#plan" className="planner-sel">
          <label htmlFor="list" className="sr-only">List</label>
          <select id="list" name="list" defaultValue={plan.listId} title={synced}>{choices.map((l) => <option key={l.id} value={l.id}>{l.label}, {l.total} contacts</option>)}</select>
          <input type="hidden" name="type" value={plan.def.key} />
          <button className="btn ghost" type="submit">Check this list</button>
          <span className="seg" role="group" aria-label="Enrichment">
            {plan.types.map((t) => t.def.key === "phones" && !t.runnable
              ? <button key={t.def.key} type="button" disabled title={t.reason ?? undefined}>{t.def.label}</button>
              : <Link key={t.def.key} href={hrefFor({ list: plan.listId, type: t.def.key })} className={t.def.key === plan.def.key ? "on" : undefined} aria-current={t.def.key === plan.def.key ? "true" : undefined}>{t.def.label}</Link>)}
          </span>
        </form>
      </div>
      <div className="pl-figs">
        <div><span className="fig tnum">{plan.walk.estimate > 0 ? `~${n(plan.walk.estimate)}` : "0"}</span>
          <span className="u">{plannerUnit({ estimate: plan.walk.estimate, every: plan.walk.every, graph8Quote: plan.graph8Quote })}</span></div>
        {plan.walk.records > 0 && (
          <div><span className="fig tnum">{fc.figure}</span><span className="u">{fc.unit}</span>{fc.note && <span className="u muted">{fc.note}</span>}</div>)}
      </div>
      <CostWalk walk={plan.walk} def={plan.def} />
      <details className="more"><summary>The rule graph8 will run</summary><p className="small">Written to the list pipeline&apos;s run condition, so graph8 enforces it on every run: <code>{rule}</code></p></details>
      {plan.runnable ? <RunPlan listId={plan.listId} estimate={plan.walk.estimate} records={plan.walk.records} verb={plan.def.verb} /> : <p className="small">{plan.reason ?? "graph8 has no pipeline for this list yet."}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Rewrite the page**

In `advisor/src/app/(dash)/optimize/page.tsx`:
- change the story import to `import { optimizeTitle } from "@/lib/dashboard/story";` and delete the `Headline` import;
- replace the no-lists early return with:

```tsx
  if (listId === undefined) return (<><h1 className="h-scr no-lists">No lists with contacts yet.</h1><p className="small">Create a list in graph8, then run Sync now.</p></>);
```

- replace the returned JSX (from `return (` to the end of the function) with:

```tsx
  const t = optimizeTitle(open.length);
  return (
    <>
      <div className="o-top"><h1 className="h-scr">{t.title}</h1>{t.sub && <span className="small">{t.sub}</span>}</div>
      <div className="ocs">{actions.map((a) => <ActionCard key={a.id} a={a} />)}</div>
      <Planner plan={plan} choices={choices} rule={runCondition(ws.fitFieldName)} hrefFor={hrefFor} />
      <AppliedChanges actions={d.actions} runs={d.runs} listNames={d.listNames} />
    </>
  );
```

- [ ] **Step 4: Add the Optimize CSS**

Append to `advisor/src/app/globals.css`:

```css
/* number first: optimize */
.o-top,.no-lists{margin-top:30px}
.o-top{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap}
.ocs{display:grid;gap:14px}
.oc{display:grid;grid-template-columns:140px minmax(0,1fr) 210px;gap:18px 26px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px 22px;scroll-margin-top:80px}
.oc-fig{display:grid;gap:6px;align-content:start}
.oc-fig .fig{font-size:42px;color:var(--good-ink)}
.oc.applied .oc-fig .fig{color:var(--muted)}
.oc-fig .u{font-size:12.5px;color:var(--muted)}
.oc-main{display:grid;gap:10px;align-content:start;min-width:0}
.oc-main h2{font:650 16px/1.3 var(--f-display)}
.oc-bar{display:flex;height:14px;border-radius:4px;overflow:hidden;gap:2px;max-width:560px}
.oc-key{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;font-size:12.5px;color:var(--ink-2);max-width:560px;margin-top:-4px}
.oc-key .bad-ink{font-weight:600}
.oc-cmp{display:grid;gap:6px;max-width:560px}
.oc-cmp div{display:grid;grid-template-columns:80px minmax(0,1fr) 30px;gap:10px;align-items:center;font-size:13.5px}
.oc-cmp span{color:var(--ink-2);text-align:right}
.oc-cmp i{height:12px;border-radius:0 3px 3px 0;display:block}
.oc-cmp b{font:700 14px var(--f-display);font-variant-numeric:tabular-nums}
.oc-steps{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px 24px;font-size:13.5px}
.oc-steps li{display:flex;align-items:center;gap:8px}
.oc-steps .n{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--ink-2);display:grid;place-items:center;font:600 11px var(--f-display);color:var(--ink-2)}
.oc-steps li.done{color:var(--muted);text-decoration:line-through}
.oc-steps li.done .n{background:var(--booked);border-color:var(--booked);color:#fff}
.oc-ev{font-size:13.5px;color:var(--ink-2)}
.more{font-size:13px}
.more summary{cursor:pointer;color:var(--accent);font-weight:500;width:max-content;max-width:100%}
.more p{margin-top:6px;color:var(--ink-2);max-width:62ch}
.oc-side{display:grid;gap:10px;align-content:center;border-left:1px solid var(--line-2);padding-left:22px}
.oc-side form{display:grid;gap:10px}
.oc-side .btn{justify-self:start}
.pl-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px}
.pl-head h2{font:600 15px var(--f-display)}
.pl-head .planner-sel{margin:0}
.pl-figs{display:flex;flex-wrap:wrap;gap:16px 56px;margin:22px 0 8px}
.pl-figs .fig{font-size:44px}
.pl-figs .u{display:block;font-size:13.5px;color:var(--muted);margin-top:8px}
#plan .more{margin-top:12px}
@media (max-width:980px){
  .oc{grid-template-columns:120px minmax(0,1fr)}
  .oc-side{grid-column:1/-1;border-left:0;padding-left:0;border-top:1px solid var(--line-2);padding-top:14px}
}
@media (max-width:620px){.oc{grid-template-columns:1fr}}
```

- [ ] **Step 5: Run the checks**

Run: `npm run typecheck && npm test`
Expected: green.

- [ ] **Step 6: Check it on the running app**

Run: `npm run shots -- /optimize "/optimize?type=find#plan"`. Compare `.shots/1440_optimize.png` with the Optimize mock. Check:
- the title reads "3 changes you can make";
- the cards lead with 696 (credits a month), +2 (meetings a week) and 121 (credits a run) in green;
- the repeat card shows "First time 8,129" and "Again within 30 days 1,300";
- the skip card shows "Likely 29", "Maybe 100" and "Unlikely 121, skipped";
- each card has a closed "What changes in graph8" fold and no "High confidence" label;
- the planner shows about 117 credits ("instead of 250 for every contact") and about 19 meetings with the low-confidence line;
- "Changes you've made" sits last, with "2 undone" folded;
- the 390 px shot has no horizontal overflow.

**Do not tick any confirmation or press any apply, run or undo button.**

- [ ] **Step 7: Commit**

```bash
git add src/components/ActionCard.tsx src/components/AppliedChanges.tsx src/components/Planner.tsx src/components/CostWalk.tsx "src/app/(dash)/optimize/page.tsx" src/app/globals.css
git commit -m "feat(advisor): Optimize cards lead with the payoff and the planner with two figures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Remove what the screens no longer use

**Files:**
- Delete: `advisor/src/components/FlowDiagram.tsx`, `WeeklyBars.tsx`, `Timeline.tsx`, `OwnerColumns.tsx`, `TrendChart.tsx`, `LineChart.tsx`, `HBarChart.tsx`, `StatStrip.tsx`, `ForecastBar.tsx`, `ClaimTracker.tsx`, `Headline.tsx`; `advisor/src/lib/dashboard/flow.ts`, `advisor/src/lib/dashboard/scale.ts`; `advisor/tests/dashboard/flow.test.ts`, `advisor/tests/dashboard/scale.test.ts`
- Modify: `advisor/src/lib/dashboard/story.ts`, `advisor/src/lib/domain/trend.ts`, `advisor/src/lib/dashboard/recovery.ts`, `advisor/tests/dashboard/story.test.ts`, `advisor/tests/domain/trend.test.ts`, `advisor/tests/dashboard/recovery.test.ts`, `advisor/src/app/globals.css`

**Interfaces:**
- Consumes: nothing new. Removes `overviewHeadline`, `overviewLede`, `statStrip`, `StatItem`, `chargesHeadline`, `recoveryHeadline`, `recoveryLede`, `optimizeHeadline`, `plannerHeadline`, `cpmBarColor` (story.ts); `firstTouchCohorts`, `Cohort`, `trendSentence`, `trendTitle` (trend.ts); `weeklySpend`, `WeekBar` (recovery.ts).

- [ ] **Step 1: Confirm nothing still imports them**

Run from `advisor/`:

```bash
for f in FlowDiagram WeeklyBars Timeline OwnerColumns TrendChart LineChart HBarChart StatStrip ForecastBar ClaimTracker Headline; do grep -rln "components/$f\"" src || true; done
grep -rn "overviewHeadline\|overviewLede\|statStrip\|StatItem\|chargesHeadline\|recoveryHeadline\|recoveryLede\|optimizeHeadline\|plannerHeadline\|cpmBarColor\|firstTouchCohorts\|trendSentence\|trendTitle\|weeklySpend\|WeekBar\|dashboard/flow\"\|dashboard/scale\"" src | grep -v "^src/lib/dashboard/story.ts\|^src/lib/domain/trend.ts\|^src/lib/dashboard/recovery.ts\|^src/lib/dashboard/flow.ts\|^src/components/"
```

Expected: no output from either command except lines inside the files being deleted. If anything else shows up, stop and report it; do not delete a function that is still used.

- [ ] **Step 2: Delete the files and functions**

```bash
git rm src/components/FlowDiagram.tsx src/components/WeeklyBars.tsx src/components/Timeline.tsx src/components/OwnerColumns.tsx src/components/TrendChart.tsx src/components/LineChart.tsx src/components/HBarChart.tsx src/components/StatStrip.tsx src/components/ForecastBar.tsx src/components/ClaimTracker.tsx src/components/Headline.tsx src/lib/dashboard/flow.ts src/lib/dashboard/scale.ts tests/dashboard/flow.test.ts tests/dashboard/scale.test.ts
```

Then edit by hand:
- `src/lib/dashboard/story.ts`: delete `StatItem`, `overviewHeadline`, `overviewLede`, `statStrip`, `chargesHeadline`, `recoveryHeadline`, `recoveryLede`, `plannerHeadline`, `optimizeHeadline`, `cpmBarColor`, and the now-unused imports of `TypeDef` and `TrendChange` at the top.
- `src/lib/domain/trend.ts`: delete `Cohort`, `firstTouchCohorts`, `trendSentence`, `trendTitle`, and the `n` helper if nothing else in the file uses it.
- `src/lib/dashboard/recovery.ts`: delete `WeekBar` and `weeklySpend` (keep `DAY`/`WEEK` only if still used; typecheck will tell you).
- `tests/dashboard/story.test.ts`: delete the describes "Overview sentences" (keep its `pluralises` test by moving it into its own `describe("plural", …)`), "Charges sentence", "Planner sentence", "Optimize sentence" and "cost per meeting bar colour", and their imports (`overviewHeadline`, `overviewLede`, `statStrip`, `plannerHeadline`, `cpmBarColor`, `chargesHeadline`, `optimizeHeadline`, `ENRICHMENT_TYPES`).
- `tests/domain/trend.test.ts`: delete the `trendSentence`/`trendTitle` tests ("describes the direction in plain words", "titles the chart with the answer", "has no sentence without two points"), the whole `describe("firstTouchCohorts", …)`, and those names from the import.
- `tests/dashboard/recovery.test.ts`: delete `describe("weeklySpend", …)` and `describe("Recovery sentences", …)`, and `weeklySpend`, `recoveryHeadline`, `recoveryLede` from the imports.

- [ ] **Step 3: Run the checks**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all remaining tests pass (fewer files and tests than the baseline, since flow and scale tests are gone).

- [ ] **Step 4: Remove CSS nothing uses**

List candidate classes that no source file mentions:

```bash
node -e '
const fs=require("fs"),path=require("path");const css=fs.readFileSync("src/app/globals.css","utf8");const src=[];
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);fs.statSync(p).isDirectory()?walk(p):/\.tsx?$/.test(f)&&src.push(fs.readFileSync(p,"utf8"))}})("src");
const all=src.join("\n");const cls=[...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m=>m[1]))];
console.log(cls.filter(c=>!new RegExp("(^|[^\\w-])"+c.replace(/-/g,"\\-")+"([^\\w-]|$)").test(all)).join("\n"))'
```

For every class printed, delete the CSS rules whose selectors only reference printed classes. Keep any rule whose selector also names a class that is still used, keep `@media` wrappers that still hold live rules (delete a wrapper once it is empty), and keep the token blocks at the top.

The command is conservative: a class whose name also appears as an ordinary word in code (for example `act`, `open`, `done`, `trend`) counts as used. So also delete these retired rules by hand, skipping any that are already gone: every rule in the old `/* recovery */` section; `.forecast`, `.forecast h3,.sub`, `.fc`, `.fc .rg`, `.fc .pt`, `.fcx`, `.fcx b` and both `.fitbar` rules; in the old `/* actions */` section `.acts`, `.act`, `.act p`, `.act-head`, `.act-head h2`, `.impact`, `.act-side`, `.act-side form`, `.evbar`, `.evbar span`, the `.cmp …` rules, the `.steps2 …` rules and the `@media (max-width:760px){.act{…}…}` wrapper; `.trend`, the `.cohorts …` rules and `.grid2`, `.grid2>*` and its `@media (max-width:900px)` wrapper. Keep `.done-tag`, `.applied`, `.applied:first-of-type`, `.walk …`, `.track …`, `.b.every`, `.b.cut`, `.b.skip`, `.b.est`, `.seg a`, `.planner-sel …`, `#plan .foot`, `.refund …`, `.chip …`, `.chips`, `.list-filter …`, `.filters`, `.acts-table …` and `.match …`, which the new screens still use. Run the command again; it should print nothing.

- [ ] **Step 5: Check the screens did not change**

With `npm run dev` running: `npm run shots`. Compare all four 1440 and 390 shots with the ones from Tasks 6, 8, 10 and 12. They should look identical. If anything lost its styling, restore the rule you removed for it.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "chore(advisor): remove the charts, sentences and styles the redesign retired

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Measure, check both themes and update the demo notes

**Files:**
- Create: `advisor/scripts/words.mjs`
- Modify: `advisor/scripts/shots.mjs`, `advisor/package.json`, `docs/DEMO.md`

**Interfaces:**
- Produces: `npm run words` prints the word count per screen (spec §1); `COLOR_SCHEME=dark npm run shots` captures dark mode.

- [ ] **Step 1: Add the word probe**

Create `advisor/scripts/words.mjs`:

```js
// Usage: npm run words   (BASE_URL defaults to http://localhost:3000)
// Counts words on each screen the way the redesign spec measures them: main.innerText (which includes SVG text) plus visible textarea text.
import { chromium } from "playwright-core";
import { homedir } from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const exe = process.env.CHROME_PATH ?? `${homedir()}/.cache/ms-playwright/chromium-1243/chrome-linux-arm64/chrome`;
const LIMIT = { "/": 115, "/charges": 150, "/recovery": 60, "/optimize": 200 };
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/login`);
await page.fill("input[type=password]", process.env.DASHBOARD_PASSWORD ?? "");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 }), page.keyboard.press("Enter")]);
let failed = false;
for (const [p, limit] of Object.entries(LIMIT)) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 180000 });
  const words = await page.evaluate(() => {
    const count = (s) => s.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const main = document.querySelector("main");
    const areas = [...main.querySelectorAll("textarea")].filter((t) => t.offsetParent !== null).map((t) => t.value).join(" ");
    return count(main.innerText) + count(areas);
  });
  if (words > limit) failed = true;
  console.log(`${p} ${words} words (limit ${limit})${words > limit ? " OVER" : ""}`);
}
await browser.close();
process.exit(failed ? 1 : 0);
```

In `advisor/package.json` `scripts`, add `"words": "node --env-file=.env.local scripts/words.mjs"`.

In `advisor/scripts/shots.mjs`, make the colour scheme selectable: replace `const page = await browser.newPage({ viewport: { width: w, height: h } });` with

```js
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: process.env.COLOR_SCHEME === "dark" ? "dark" : "light" });
```

and replace ``const file = `.shots/${w}${p === "/" ? "_root" : p.replace(/[/?=&]+/g, "_")}.png`;`` with

```js
    const file = `.shots/${w}${process.env.COLOR_SCHEME === "dark" ? "_dark" : ""}${p === "/" ? "_root" : p.replace(/[/?=&]+/g, "_")}.png`;
```

- [ ] **Step 2: Measure**

With `npm run dev` running: `npm run words`
Expected: every screen at or under its limit, exit code 0. If a screen is over, find the longest text on it and shorten or fold it per spec §2.3, then measure again.

- [ ] **Step 3: Check every screen in both themes and both periods**

```bash
npm run shots -- / /charges /recovery /optimize "/?period=30d" "/charges?period=30d" "/recovery?period=30d" "/optimize?period=30d"
COLOR_SCHEME=dark npm run shots -- / /charges /recovery /optimize
```

Expected: no `HORIZONTAL-OVERFLOW` and no console errors in the output. Open the dark shots: figures, bars and the green won figure are readable on the dark background. Open the 30-day Overview: the chain reads 5,979 → 17 → $72,000 (numbers move as time passes; check they match the 30-day Charges heading).

Keyboard check in a browser: Tab through the Overview. Every Do next link, key row and header control shows a focus ring, and Enter on "Claim refund" lands on Recovery with the form open.

- [ ] **Step 4: Update the demo notes**

In `docs/DEMO.md`, replace this sentence in step 1:

```
Read the headline aloud; say once that meetings, deals and the email-finding spend are simulated (the pill says so). Hover a flow band, then click "Booked a meeting".
```

with:

```
Read the chain left to right (credits spent, meetings booked, won value); say once that meetings, deals and the email-finding spend are simulated (the pill says so). Point at the first Do next row, then click "Booked a meeting" in the bar.
```

Search the rest of `docs/DEMO.md` for "flow", "weekly", "timeline", "cohort" and "By week" and reword any step that points at something this redesign removed so it points at the replacement (the bar, the claim figure, the trend line).

- [ ] **Step 5: Run everything once more and commit**

Run: `npm run typecheck && npm test && npm run words`
Expected: all green.

```bash
git add scripts/words.mjs scripts/shots.mjs package.json ../docs/DEMO.md
git commit -m "chore(advisor): word-count probe, dark screenshots and demo notes for the number-first screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
