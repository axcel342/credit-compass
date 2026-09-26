import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/lib/g8/rate-limit";

describe("RateLimiter", () => {
  it("never lets more than perSecond calls through in any 1s window", async () => {
    let clock = 0;
    const starts: number[] = [];
    const rl = new RateLimiter({ perSecond: 40, perMinute: 900, now: () => clock, sleep: async (ms) => { clock += ms; } });
    for (let i = 0; i < 500; i++) { await rl.take(); starts.push(clock); }
    for (let i = 40; i < starts.length; i++) expect(starts[i] - starts[i - 40]).toBeGreaterThanOrEqual(1000);
  });

  it("respects the per-minute budget", async () => {
    let clock = 0;
    const rl = new RateLimiter({ perSecond: 1000, perMinute: 900, now: () => clock, sleep: async (ms) => { clock += ms; } });
    for (let i = 0; i < 901; i++) await rl.take();
    expect(clock).toBeGreaterThanOrEqual(60000);
  });
});
