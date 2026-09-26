import { describe, it, expect } from "vitest";
import { linearScale, niceTicks } from "@/lib/dashboard/scale";
describe("chart scales", () => {
  it("maps domain to range", () => { const s = linearScale([0, 900], [170, 556]); expect(s(0)).toBe(170); expect(s(900)).toBe(556); expect(s(450)).toBe(363); });
  it("makes readable ticks that cover the data", () => expect(niceTicks(326, 410, 4)).toEqual([300, 350, 400, 450]));
});
