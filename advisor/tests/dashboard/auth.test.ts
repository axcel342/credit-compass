import { describe, it, expect } from "vitest";
import { sessionValue } from "@/lib/auth";
describe("sessionValue", () => {
  it("is stable, secret-dependent, and not the password", () => {
    expect(sessionValue("pw")).toBe(sessionValue("pw"));
    expect(sessionValue("pw")).not.toBe(sessionValue("pw2"));
    expect(sessionValue("pw")).not.toContain("pw");
  });
});
