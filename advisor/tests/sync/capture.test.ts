import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { OPS } from "@/lib/g8/ops";
import { pollPipelineRuns } from "@/lib/sync/capture";

describe("pollPipelineRuns", () => {
  it("falls back to the list pipeline item's last_run.started_at when the run detail omits it", async () => {
    const c = new FakeG8();
    c.handlers.set(OPS.listListPipelines, () => ({ items: [{ id: "p1", name: "Email finder",
      last_run: { run_id: "run-1", status: "completed", started_at: "2026-09-26T15:35:40.898548+00:00", step_progress: [] } }] }));
    c.handlers.set(OPS.getPipelineRun, () => ({ run_id: "run-1", list_id: 13, status: "completed",
      step_progress: [{ successful: 1, processed_records: 3, skipped_by_reason: { skipped: 2 } }] }));
    const runs = await pollPipelineRuns(c, [13]);
    expect(runs[0]).toMatchObject({ extId: "run-1", listId: 13, startedAt: "2026-09-26T15:35:40.898548+00:00",
      completedAt: "2026-09-26T15:38:40.898Z", recordsOk: 1, recordsSkipped: 2 });
  });
});
