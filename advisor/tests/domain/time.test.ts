import { describe, it, expect } from "vitest";
import { toMs, toIso } from "@/lib/domain/time";

describe("toMs", () => {
  it("parses ledger timestamps with a space and 6-digit fractions", () =>
    expect(toMs("2026-09-26 15:40:42.883351+00:00")).toBe(Date.UTC(2026, 8, 26, 15, 40, 42, 883)));
  it("treats a missing zone as UTC", () =>
    expect(toMs("2026-09-26 09:47:26.365077")).toBe(Date.UTC(2026, 8, 26, 9, 47, 26, 365)));
  it("parses Z and offset forms", () => {
    expect(toMs("2026-09-26T13:38:00Z")).toBe(Date.UTC(2026, 8, 26, 13, 38, 0));
    expect(toMs("2026-09-26T15:40:38+0200")).toBe(Date.UTC(2026, 8, 26, 13, 40, 38));
  });
  it("throws on garbage", () => expect(() => toMs("yesterday")).toThrow(/Unparseable/));
  it("round-trips through toIso", () => expect(toIso(toMs("2026-09-26T13:38:00Z"))).toBe("2026-09-26T13:38:00.000Z"));
});
