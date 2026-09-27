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
