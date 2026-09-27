import { describe, it, expect } from "vitest";
import { parsePeriod, periodWindow, inWindow, PERIOD_LABEL } from "@/lib/domain/period";

describe("period", () => {
  it("defaults to 8 weeks and accepts 30d", () => {
    expect(parsePeriod(undefined)).toBe("8w");
    expect(parsePeriod("nonsense")).toBe("8w");
    expect(parsePeriod("30d")).toBe("30d");
  });
  it("builds a window that ends at now", () => {
    const w = periodWindow("8w", "2026-09-27T00:00:00Z");
    expect(w.to).toBe(Date.parse("2026-09-27T00:00:00Z"));
    expect(w.to - w.from).toBe(56 * 86_400_000);
    expect(inWindow("2026-08-02T00:00:00Z", w)).toBe(true);
    expect(inWindow("2026-08-01T23:59:59Z", w)).toBe(false);
  });
  it("labels periods in plain words", () => expect(PERIOD_LABEL["30d"]).toBe("the last 30 days"));
});
