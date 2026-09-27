import { describe, it, expect } from "vitest";
import { appliedSummary, splitApplied } from "@/components/AppliedChanges";
import type { ActionRecord, Run } from "@/lib/domain/types";

const action = (kind: ActionRecord["kind"], over: Partial<ActionRecord> = {}): ActionRecord => ({ extId: `${kind}:15`, kind, listId: 15, pipelineId: "p15",
  appliedAt: "2026-09-27T10:00:00Z", status: "applied", previous: null, detail: {}, simulated: false, ...over });
const run = (over: Partial<Run> = {}): Run => ({ extId: "r1", kind: "pipeline_run", actionName: "List pipeline", startedAt: "2026-09-27T11:00:00Z",
  completedAt: "2026-09-27T11:01:00Z", status: "completed", source: "advisor", listId: 15, recordsSkipped: 1, ...over });

describe("appliedSummary plurals", () => {
  it("uses singular copy for one manual run", () =>
    expect(appliedSummary(action("pause_list"), [run()], "Sales VPs")).toBe("Applied Sep 27 on Sales VPs. 1 manual run since."));
  it("uses singular copy for one skipped contact", () =>
    expect(appliedSummary(action("repeat_skip"), [run()], "Sales VPs")).toBe("Applied Sep 27 on Sales VPs. 1 contact skipped since, about 3 credits saved."));
  it("keeps the plural copy for several", () =>
    expect(appliedSummary(action("repeat_skip"), [run({ extId: "r1", recordsSkipped: 2 }), run({ extId: "r2", recordsSkipped: 1 })], "Sales VPs"))
      .toBe("Applied Sep 27 on Sales VPs. 3 contacts skipped since, about 9 credits saved."));
});

describe("splitApplied", () => {
  it("keeps live changes up front, folds undone ones and leaves out refund requests", () => {
    const xs = [action("repeat_skip", { extId: "a", status: "undone", appliedAt: "2026-09-27T09:00:00Z" }), action("guardrail", { extId: "b", appliedAt: "2026-09-27T10:00:00Z" }),
      action("pause_list", { extId: "c", appliedAt: "2026-09-27T11:00:00Z" }), action("refund_request", { extId: "d", status: "requested" })];
    const s = splitApplied(xs);
    expect(s.active.map((a) => a.extId)).toEqual(["c", "b"]);
    expect(s.undone.map((a) => a.extId)).toEqual(["a"]);
  });
});
