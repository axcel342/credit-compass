const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class RateLimiter {
  private sec: number[] = [];
  private min: number[] = [];
  constructor(private opts: { perSecond: number; perMinute: number; now?: () => number; sleep?: (ms: number) => Promise<void> }) {}

  async take(): Promise<void> {
    const now = this.opts.now ?? Date.now;
    const sleep = this.opts.sleep ?? defaultSleep;
    for (;;) {
      const t = now();
      this.sec = this.sec.filter((x) => t - x < 1000);
      this.min = this.min.filter((x) => t - x < 60000);
      if (this.sec.length < this.opts.perSecond && this.min.length < this.opts.perMinute) {
        this.sec.push(t);
        this.min.push(t);
        return;
      }
      const waitSec = this.sec.length >= this.opts.perSecond ? 1000 - (t - this.sec[0]) : 0;
      const waitMin = this.min.length >= this.opts.perMinute ? 60000 - (t - this.min[0]) : 0;
      await sleep(Math.max(waitSec, waitMin, 1));
    }
  }
}
