import { describe, it, expect } from "vitest";
import { FakeG8 } from "../helpers/fake-client";
import { ensureSchema } from "@/lib/store/schema";
import { RecordStore } from "@/lib/store/records";
import { handleEvent } from "@/lib/sync/handle-event";

describe("handleEvent", () => {
  it("stores an outcome once even when the same delivery arrives three times", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    const deps = { c, outcomes: new RecordStore(c, "roi_outcome"), runs: new RecordStore(c, "roi_run") };
    const e = { id: "evt_1", event: "meeting.booked", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: { contact_id: 81 } };
    for (let i = 0; i < 3; i++) expect(await handleEvent(e, deps)).toBe("outcome");
    expect(await deps.outcomes.list()).toHaveLength(1);
  });
  it("records a workflow run from workflow.execution_completed", async () => {
    const c = new FakeG8(); await ensureSchema(c);
    c.handlers.set("get_execution_workflows_executions__execution_id__get", () => ({ execution_id: "x1", action_id: "a", status: "completed", tokens_input: 10, tokens_output: 20, completed_at: "2026-09-26T10:00:00Z" }));
    const deps = { c, outcomes: new RecordStore(c, "roi_outcome"), runs: new RecordStore(c, "roi_run") };
    expect(await handleEvent({ id: "e2", event: "workflow.execution_completed", timestamp: "2026-09-26T10:00:00Z", org_id: "o", data: { execution_id: "x1" } }, deps)).toBe("run");
    expect((await deps.runs.list())[0].values.ext_id).toBe("x1");
  });
});
