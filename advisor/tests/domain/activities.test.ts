import { describe, it, expect } from "vitest";
import { groupActivities } from "@/lib/domain/activities";
import { outcomeBucket } from "@/lib/domain/buckets";
import type { AttributedCharge, Run } from "@/lib/domain/types";

const c = (id: string, p: Partial<AttributedCharge>): AttributedCharge => ({
  ledgerId: id, ledgerType: "usage", service: "waterfall_enrichment", credits: 10, chargedAt: "2026-09-26T14:34:00Z", llmTier: null,
  tokensIn: null, tokensOut: null, description: null, method: "advisor", runExtId: null, listId: null, contactId: null, segmentKey: null,
  explanation: "x", result: "success", isWaste: false, wasteReason: null, simulated: false, ...p });
const names = new Map([["15", "Sales VPs"], ["2", "Starter list"]]);
const ctx = { meetingsByContact: new Map([[1, [Date.parse("2026-10-01T00:00:00Z")]]]), emailedByContact: new Map<number, number[]>(), onboardingUnused: true };
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
    expect(sim).toMatchObject({ title: "Email finding", detail: "Sales VPs", charges: 2, credits: 20, from: "2026-08-02T00:00:00.000Z", match: "exact", matchNote: "Run ID", simulated: true, children: [] });
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
    expect(sk).toMatchObject({ title: "Skill runs", credits: 12, match: "mixed", matchNote: "Token count, Service only", result: "Can't tell yet" });
    expect(sk.detail).toBe("Meeting Prep Brief");
  });
  it("calls a time-window match Likely", () => {
    const [a] = groupActivities([c("t1", { service: "studio_global", method: "time_window", explanation: "Onboarding research" })], [], bucketOf, names);
    expect(a).toMatchObject({ match: "likely", matchNote: "Time of charge" });
  });
  it("sorts by credits, largest first", () => expect(acts.map((a) => a.credits)).toEqual([72, 20, 12]));
});

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
