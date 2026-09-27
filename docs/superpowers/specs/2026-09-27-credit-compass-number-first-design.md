# Credit Compass v3: number first

- **Date:** 2026-09-27
- **Status:** Direction approved by the user ("Number first", no cuts kept). This document awaits review.
- **Branch:** `credit-compass-v3/number-first`, cut from `credit-compass-v3/restore-palette` @ `0ded5ba` (9 commits ahead of `main`, not merged yet).
- **UI reference:** `docs/design/credit-compass-ui-v3/index.html` (open it in a browser; the mocks under "Number first" are the target). Published copy: https://claude.ai/artifact/WQ5JtAw4GoJFAacywYbpLy (private to the owner).
- **Builds on:** `docs/superpowers/specs/2026-09-27-credit-compass-v2-design.md` and the value pass (`docs/superpowers/plans/2026-09-27-credit-compass-value-pass.md`). Where they differ, this document wins.

---

## 1. Intent

**What the user asked for:** less text, the important numbers stand out, only highly relevant information, and value the viewer finds instantly without interpreting a chart.

**Who it is for:** unchanged from v2. Hackathon judges watching a narrated demo first, and a graph8 customer opening it cold.

**Success looks like:**

1. Each screen answers its question with one large figure and a plain label, readable in about three seconds.
2. Words on screen at rest (measured like today: `main.innerText`, which already includes SVG text, plus visible textarea text) fall to at most: Overview 115 (today 237), Charges 150 (308), Recovery 60 (228), Optimize spend 200 (492).
3. No chart needs a legend or an explanation to read: every chart labels its own answer.
4. Nothing about the numbers, the data or what changes in graph8 is different.

**Decisions made with the user:**

- Direction: **Number first** (over "Trim in place" and "Value board").
- Keep none of the cuts: the flow diagram, Recovery's weekly chart and timeline, the trend toggle (and first-touch cohorts) and the unfolded small charges all go.
- Figures use the wider, heavier Archivo shown in the mocks (the user approved the direction as drawn and raised no objection).

**Assumptions stated to the user and not corrected:** keep the restored light and dark palette and the current fonts; no data, API, MCP or recap changes; every graph8 action keeps its confirmation and undo; the phone layout keeps working.

**Out of scope:** new data, new findings, the planner's forecast method (see §9), MCP tools, the weekly recap, the connect flow.

---

## 2. Visual system

### 2.1 Figures

One figure style for every number that matters:

```css
.fig { font-family: var(--f-display); font-stretch: 112%; font-weight: 780; letter-spacing: -.03em; line-height: 1; font-variant-numeric: lining-nums; }
.fig.tnum { font-variant-numeric: lining-nums tabular-nums; }
```

Sizes by role: hero `clamp(40px, 5.4vw, 66px)` (Overview chain), `clamp(60px, 7.4vw, 92px)` (Recovery claim), card lead 42px (Optimize), row lead 30px (Do next), planner 44px, quiet figures 24px in `--ink-2`.

`layout.tsx` loads Archivo with its width axis: `family=Archivo:wdth,wght@62..125,400..900`. IBM Plex Sans stays (400/500/600). IBM Plex Mono is loaded at 400 only and used only by `code` (the run condition). Every other number that used the mono face (`.num`, `.mono`, `.delta`, `.chart .val`, `#tip b`) switches to Archivo with tabular figures.

### 2.2 Colour means something

Tokens are unchanged (the restored light and dark blocks in `globals.css`). Rules:

- Green ink (`--good-ink`) marks value gained: the won figure, savings, a falling cost.
- Red (`--waste`, `--bad-ink`) marks waste and the costliest list.
- Amber (`--unused`) marks paid-for but unused.
- Blue (`--accent`) marks only what can be clicked.
- Everything else is ink, `--ink-2` or `--muted`.

### 2.3 Fewer boxes, shorter labels

- A screen's lead figure sits on the page background, not in a panel. Panels hold lists and charts only.
- Labels are six words or fewer. Anything longer moves into a `title` tooltip or a `<details>` fold.
- No lede paragraphs under headings on any screen.

### 2.4 Header

The sticky `.topbar` becomes translucent: `background: color-mix(in srgb, var(--bg) 80%, transparent); backdrop-filter: blur(14px) saturate(170%)`. Under `@media (prefers-reduced-transparency: reduce)` it is solid `var(--bg)`. Its contents do not change.

---

## 3. Overview

Order: value chain, trend line, Do next, then two panels side by side (what the credits bought, credits per meeting). Below 900 px the panels stack.

### 3.1 Value chain (new)

Three figures joined by arrows that carry the rates:

`10,674` credits spent → *395 per meeting* → `27` meetings booked → *9 deals won* → `$108,000` won, $10 per credit

- The first figure is `--ink-2`, the middle one ink, the last `--good-ink`.
- Arrows are CSS lines with a small head, label centred above. Below 700 px the chain stacks vertically and the arrows point down with the label beside them (as in the mock).
- The whole chain is one `role="img"` with an `aria-label` sentence built from the same numbers.

Pure function `valueChain(p: { total; meetings; won; wonValue; periodLabel })` in `lib/dashboard/story.ts` returns `{ nodes: { figure; label; tone: "in" | "mid" | "out" }[]; links: string[]; aria: string } | { empty: string }`:

| Case | Result |
|---|---|
| `total <= 0` | `{ empty: "No credits spent in {period}." }` |
| `meetings <= 0` | one node (credits spent) and no links; the Do next list and the bar carry the rest |
| `won <= 0` or `wonValue <= 0` | two nodes (credits, meetings) and one link "{cpm} per meeting" |
| otherwise | three nodes; links "{cpm} per meeting" and "{won} deals won" ("1 deal won" when singular); last label "won, {perCredit} per credit" |

`perCredit = wonValue / total`, shown as whole dollars at $10 or more and with cents below $10 ("$4.50").

### 3.2 Trend line (replaces the trend chart and its toggle)

One line: a 120×32 sparkline of the rolling cost per meeting, then "Cost per meeting is **down 35%** since Aug 30". The bold part is `--good-ink` when down and `--bad-ink` when up. Pure function `trendLine(points)` in `lib/domain/trend.ts` returns `{ text; pct; direction: "down" | "up"; since } | null`, and is `null` (line hidden) when `trendChange` is null or 0%. `since` is the label of the first point with a value.

### 3.3 Do next (merged, figure first)

Each row: figure with its unit underneath, a short sentence, one ghost button. At most four rows.

`DoNextItem` becomes `{ id; figure; unit; text; label; href }`. `doNextItems(findings, max, periodQuery, impact)` changes:

1. **Merge by destination.** `cut` and `scale` findings become one **move** item. All `waste` findings become one **refund** item whose stake is their sum (91 = 77 + 14 today).
2. **Rank** groups by the largest `creditsAtStake × confidence weight` in the group (weights unchanged).
3. **Figures, units, text and buttons:**

| Group | Figure / unit (action open) | Fallback when its action is applied or missing | Text | Button → href |
|---|---|---|---|---|
| move | `+2` / meetings a week (from the move-spend action's payoff) | the cut finding's stake / credits on a costly list | the move-spend action's title, else the cut finding's body | Move spend → `/optimize#move-spend` |
| repeat | `696` / credits a month | stake / credits paid twice | Stop paying twice for the same contacts | Stop paying twice → `/optimize#repeat` |
| unused | stake / credits unused | same | Onboarding research nobody has opened | See it → `/recovery` |
| refund | summed stake / credits back | same | graph8 owes you for work that produced nothing | Claim refund → `/recovery#claim` |
| side_effect | stake / credits of agent charges | same | Automated posts woke graph8's agent | See it → `/recovery` |
| fix | stake / credits over quotes | same | the finding's body | Plan it → `/optimize#plan` |

`DoNextImpact` becomes `{ repeat: Payoff | null; move: (Payoff & { title: string }) | null }`, taken from open actions only (as today). Period query handling is unchanged.

### 3.4 What the credits bought (replaces the flow diagram)

`OutcomeBar` component: one stacked bar of the six buckets (`bucketTotals`, same colours), then a two-column key of label and credits. The booked row is ink and semibold; the wasted row is `--bad-ink`; the others are `--ink-2`. Each key row is a link to `/charges?outcome={bucket}` (plus the period). The bar itself is `aria-hidden`. Buckets with 0 credits are left out of both. The key is one column below 620 px.

### 3.5 Credits per meeting (annotated)

`ListBars` replaces `HBarChart` on the Overview. Rows sorted cheapest first; bars on one scale (max = largest value); a dashed average marker through every row with "average {n}" under the last.

Pure function `listRows(stats, listNames, avg)` in `story.ts` returns `{ label; value; color; note }[]`:

- With two or more lists: the cheapest gets `--booked` and the note "cheapest" (green). Any list at 2× the average or more gets `--waste` and the note "{k}× average" with `k = Math.floor(value / avg)` (red). Others get `--series-weak` and no note.
- With one list: `--series-weak`, no notes.
- No lists with meetings: the panel says "No meetings in {period} yet."

### 3.6 Removed from the Overview

The headline sentence and lede, the five-number strip, the flow diagram, the trend chart, its "Rolling 4 weeks / By week spent" toggle, the cohort chart, "Click a band to see its charges", "Biggest first", "Lower is better". The `?trend=` query parameter is dropped.

---

## 4. Charges

Order: heading row, outcome bar, outcome chips, list filter, "Showing … Clear" line (only when filtered), table.

- **Heading:** "What {n} credits bought", where `n` is the scoped total (the same number as the "All" chip). Beside it in small muted type: "{p}% matched to a contact, list or run" from `coverage.exact / coverage.total` of the period.
- **Bar:** the same `OutcomeBar` (bar only, no key, `height: 40px`), from the scoped bucket totals. The chips below it act as its key and filter.
- **Chips and list filter:** unchanged.
- **Lede removed.** The Match column header gets `title="Exact: a run, job or token count matched. Likely: only the timing matched."`.

### 4.1 Table

Columns stay: When, What it paid for, Credits, What it bought, Match.

- **When:** date only. A single day reads "Sep 26"; a span reads "Aug 4 to Sep 25". The time of day goes.
- **What it paid for:** bold title and detail as today. The "{n} charges" line goes. The jobs `<details>` stays, labelled "{n} jobs".
- **Credits:** Archivo, tabular.
- **What it bought:** pure function `boughtCell(activity)` in `lib/domain/activities.ts` returns one of:
  - `{ kind: "result"; text; bucket }` when the activity has a result (text unchanged, e.g. "Wasted: failed on 11 of 11"); rendered as a dot plus text, in `--bad-ink` when the bucket is `waste`;
  - `{ kind: "split"; share; buckets }` when more than one bucket has credits; rendered as a 92 px mini bar plus "**{share}%** booked" (`share = round(booked / credits × 100)`; the figure is `--good-ink` at 50% or more);
  - `{ kind: "single"; bucket }` otherwise; rendered as a dot plus the bucket's short label.
  - The cell's `title` lists the full split ("549 booked, 2,331 emailed, no meeting yet, 1,920 no meeting yet").
- **Match:** as today, in `--muted`.

### 4.2 Folding small charges

Pure function `foldSmall(rows, share = 0.01)` in `activities.ts` returns `{ shown; small; smallCredits }`:

- A row is small when its credits are under `share` of the sum of all rows passed in and it has no wasted credits. Rows with any waste always stay shown.
- Fold only when there are two or more small rows; otherwise everything is shown.
- The table ends with a row: "Show {n} smaller charges" (a link), `smallCredits` in the Credits column, "Each under 1% of spend" in muted type.
- The link sets `?small=1`, keeping the current filter and period. With `small=1` every row shows and the fold row reads "Hide {n} smaller charges" (a link that removes it). `parseChargeFilter`/`filterHref` carry `small`; changing any other filter drops it.

---

## 5. Recovery

Order: claim (lead), then "also" rows.

### 5.1 Claim

- **Figure:** refundable total (`claim.found`, the sum of `owner: "refund"` items) with the unit "credits", then "graph8 owes you for work that produced nothing".
- **Items:** each refund item as a row: title and credits (the "2 ledger lines" style details are not shown; `refundDraftFor` still uses the run ids).
- **Steps:** Found {n} → Requested → Refunded as one horizontal line of three dots under the items (the existing claim state drives which dots are filled; "Requested {n}" and "Refunded {n}" show their numbers once reached).
- **Action, top right:**
  - No open claim: a `<details>` whose `<summary>` is the primary button "Request a refund of {n}". Opening it shows the existing `RefundForm` (item checkboxes, message, Copy text, the "I've read this" confirmation, Send). The anchor `#claim` points at this block, and `/recovery#claim` opens it (a small client effect sets `open` when the hash is `#claim`).
  - Open claim with status `requested`: the text "Requested {date}" and the existing "Mark as refunded" button.
  - Refunded: nothing but the filled steps.
- **Nothing refundable:** the figure area reads "Nothing to claim back in {period}." (no figure), and the "also" rows still show.

### 5.2 Also rows

Below the claim, one row per non-refund item, figure first (24 px, `--ink-2`), then a bold lead and the item's title:

| Owner | Lead | Text |
|---|---|---|
| `stopped` | Already stopped. | "{title}. No charges since." |
| `stoppable` | You can stop this. | "{title}. Post recaps only to #roi-advisor." |
| `usable` | Still yours to use. | "{title}." |

### 5.3 Removed from Recovery

The headline and lede, the weekly chart and its `?week=` filter, the three owner cards, the "What happened" timeline, the separate "Your refund claim" panel.

---

## 6. Optimize spend

Order: heading row, action cards, planner, changes you've made.

### 6.1 Heading

"{n} changes you can make" (singular for 1), with "Each costs 0 credits and can be undone" beside it in muted type. `n` counts actions not yet applied. With none open: "Your spend looks efficient right now." and no subline.

### 6.2 Action cards

Three columns (figure, main, side); below 980 px the side drops under the main; below 620 px one column.

`PlannedAction` gains `payoff: { figure: string; unit: string }` and its `evidence` becomes an optional one-line string. Values from `buildActions`:

| Action | Payoff | Chart | Evidence line |
|---|---|---|---|
| repeat | `696` / credits a month | two-segment bar, labels under it: "First time 8,129" and "Again within 30 days 1,300" (red) | none |
| move-spend | `+2` / meetings a week (`+{round(gain)}`; below 1: `+{gain.toFixed(1)}`) | the two comparison bars, then "Meetings per 1,000 credits" | none; the two numbered steps follow the chart |
| skip-unlikely | `121` / credits a run | new: fit bar for that list, labels "Likely {high}", "Maybe {medium}", "Unlikely {low}, skipped" (red), plus "Unknown {n}" when above 0 | "Emails that don't match the company bounced 45% of the time, against 20% for the rest." |

- The figure is `--good-ink`.
- The confidence label shows only when it is "Medium confidence".
- "In graph8: …" moves into `<details><summary>What changes in graph8</summary>…</details>`, text unchanged.
- The side keeps the confirm checkbox (its label already names the change), the button and the result toast. "Costs 0 credits" moves to the page heading.
- An applied action shows its payoff figure in `--muted` and "Done" in place of the side.
- `impact` stays on `PlannedAction` for the MCP tools and the recap; the dashboard no longer renders it.

### 6.3 Planner

- **Header row:** "Plan your next enrichment", the list picker form and the enrichment-type switch (unchanged controls). The sync time moves to the picker's `title`.
- **Two figures:**
  - `~{estimate}` with the unit from `plannerUnit(plan)`: "credits, graph8 quotes {quote}" when a quote exists and is higher; else "credits, instead of {every} for every contact" when `every > estimate`; else "credits". An estimate of 0 reads "0" with "credits. Every contact is done or skipped".
  - `~{expected}` (or "<1") with "meetings, likely {lo} to {hi}"; when `lowConfidence`, a muted line "Low confidence, fewer than 5 meetings so far".
- **Cost walk:** as today, with shorter labels: "Every contact", the type's short not-target label ("No email to verify", "Already have an email"), "Unlikely to book, skipped", "Estimate".
- **Removed:** the headline sentence, the forecast bar and its basis sentence, "Who gets skipped" (its bar and paragraph).
- **Kept:** "The rule graph8 will run" `<details>`, the run form with its confirmation, the not-runnable reason as one muted line.

### 6.4 Changes you've made

- Hidden when there are no `roi_action` rows other than refund requests.
- Applied rows show as today, with Undo.
- Undone rows collapse into `<details><summary>{n} undone</summary>` listing them.

---

## 7. Components and code

| Change | Files |
|---|---|
| New | `components/ValueChain.tsx`, `components/TrendLine.tsx` (with `Sparkline`), `components/OutcomeBar.tsx`, `components/ListBars.tsx`, `components/RecoveryClaim.tsx` (server, wraps `RefundForm` and the steps), `components/ClaimHash.tsx` (client, opens the claim on `#claim`) |
| Rewritten | `app/(dash)/page.tsx`, `charges/page.tsx`, `recovery/page.tsx`, `optimize/page.tsx`, `components/DoNext.tsx`, `ActivityTable.tsx`, `ActionCard.tsx`, `AppliedChanges.tsx`, `Planner.tsx`, `CostWalk.tsx`, `Header.tsx` (class only), `app/layout.tsx` (font URL), `globals.css` |
| Logic | `lib/dashboard/story.ts` (`valueChain`, `listRows`, `plannerUnit`, `optimizeTitle`), `lib/dashboard/donext.ts` (merge, figures), `lib/domain/trend.ts` (`trendLine`), `lib/domain/activities.ts` (`boughtCell`, `foldSmall`), `lib/domain/actions.ts` (`payoff`, short evidence, fit chart), `lib/dashboard/filters.ts` (`small`), `lib/dashboard/recovery.ts` (`alsoRows`) |
| Deleted (with their tests) | `components/FlowDiagram.tsx`, `WeeklyBars.tsx`, `Timeline.tsx`, `OwnerColumns.tsx`, `TrendChart.tsx`, `LineChart.tsx`, `HBarChart.tsx`, `StatStrip.tsx`, `ForecastBar.tsx`, `ClaimTracker.tsx`, `Headline.tsx`; `lib/dashboard/flow.ts`; `lib/dashboard/scale.ts` (only the deleted charts import it); from `story.ts`: `overviewHeadline`, `overviewLede`, `statStrip`, `chargesHeadline`, `recoveryHeadline`, `recoveryLede`, `optimizeHeadline`, `plannerHeadline`, `cpmBarColor`; from `trend.ts`: `firstTouchCohorts`, `trendSentence`, `trendTitle`; from `recovery.ts`: `weeklySpend` |

Before deleting any export, grep `src/` and `tests/` for other importers (today none outside the dashboard pages; the MCP tools and recap import none of them). CSS rules whose class names no longer appear anywhere in `src/` are removed from `globals.css`.

`/optimize` with no lists keeps its message as a plain `<h1>` and a muted line.

---

## 8. Testing

**Unit tests (vitest), written before each change:**

- `valueChain`: full chain; no won deals; won deals with no amounts; no meetings; zero spend; one deal ("1 deal won"); per-credit formatting at $10.12 → "$10" and $4.504 → "$4.50".
- `trendLine`: down, up, flat (null), fewer than two points (null), `since` from the first valued point.
- `listRows`: cheapest note; "3× average" at 1,233 against 395; one list gets no notes; ties.
- `doNextItems`: cut and scale merge into one move row using the action payoff; waste findings sum into one refund row (77 + 14 → 91); ranking by the group's best score; fallbacks when actions are applied; period query on every href; `max` respected after merging.
- `buildActions`: payoff for each action (including a move gain under 1); skip-unlikely fit counts for the chosen list; evidence strings as in §6.2; `impact` unchanged.
- `boughtCell`: result, split (share rounding, 0% booked), single bucket, `title` text.
- `foldSmall`: 1% boundary, waste never folded, fewer than two small rows means no fold, `smallCredits` sum.
- `filters`: `small` parsed, kept by `filterHref` only when not changing another filter.
- `alsoRows`: stopped, stoppable and usable leads and text.
- `plannerUnit`: quote higher, every higher, equal, zero estimate.
- Deleted functions lose their tests; everything else stays green. Baseline today: 54 files, 255 tests, typecheck clean.

**By hand, on the running app (`npm run dev`, then `npm run shots`):**

- 1440 px and 390 px, light and dark: no horizontal page scroll, nothing clipped, the chain stacks on the phone.
- Word counts with the probe in §1 meet the targets.
- 30-day period: the chain, bar and Do next still read correctly (today: 5,979 credits, 17 meetings, 6 won, $72,000).
- Keyboard: every link, fold and button reachable with a visible focus ring; `/recovery#claim` from Do next opens the claim.
- Optimize: tick and apply nothing live. Only open and close the folds and check the disabled buttons. Applying stays behind the existing confirmation and is out of scope for verification here.
- `prefers-reduced-motion` and `prefers-reduced-transparency`: no motion depends on either, and the header turns solid.

No graph8 writes are needed to build or verify this change.

---

## 9. Found during the review (not in this change)

- The planner forecasts about 19 meetings from verifying 117 Starter list contacts (about 6 credits a meeting) while the same page calls the Starter list the costliest at 1,233 a meeting. The forecast uses a per-contact rate from the simulated contacts. Worth a decision before the demo; it is not a presentation problem.
- The trend percentage changes during the day because its weeks count back from the current time (−32% at 13:26, −35% at 14:31 UTC on Sep 27). Quote it from the screen, not the pitch script.
