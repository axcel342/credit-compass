import fs from "node:fs";
import path from "node:path";
import { g8Caller } from "../src/lib/g8/client";
import { RecordStore } from "../src/lib/store/records";
import { runToValues } from "../src/lib/store/mappers";
import { runFromExecution, type ExecutionRecord } from "../src/lib/domain/runs";
import type { Run } from "../src/lib/domain/types";

const dir = path.resolve(process.cwd(), "../research/fixtures");
const a = JSON.parse(fs.readFileSync(path.join(dir, "advisor-runs-2026-09-26.json"), "utf8")) as { runs: Run[]; advisorPosts: string[]; actionNames: Record<string, string> };
const execs = fs.readdirSync(path.join(dir, "executions")).filter((f) => f.endsWith(".json"))
  .map((f) => runFromExecution(JSON.parse(fs.readFileSync(path.join(dir, "executions", f), "utf8")) as ExecutionRecord, a.actionNames))
  .filter((r): r is Run => r !== null);
const store = new RecordStore(g8Caller, "roi_run");
for (const r of [...execs, ...a.runs]) await store.upsert(runToValues(r));
for (const p of a.advisorPosts) await store.upsert(runToValues({ extId: `post:${p}`, kind: "advisor_post", actionName: "Recap post", startedAt: p, completedAt: p, status: "completed", source: "advisor" }));
console.log(`imported ${execs.length + a.runs.length} runs and ${a.advisorPosts.length} posts`);
