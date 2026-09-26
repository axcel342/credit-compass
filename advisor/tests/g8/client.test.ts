import { describe, it, expect } from "vitest";
import { G8Error } from "@graph8/sdk";
import { unwrap, isConflict, isNotFound } from "@/lib/g8/client";

describe("client helpers", () => {
  it("unwraps the {data, pagination} envelope and passes raw objects through", () => {
    expect(unwrap({ data: [1, 2], pagination: null })).toEqual([1, 2]);
    expect(unwrap({ executions: [] })).toEqual({ executions: [] });
  });
  it("recognises 409 and 404 errors", () => {
    const e409 = new G8Error({ message: "dup", status: 409, type: "conflict", code: "duplicate_active_value" });
    const e404 = new G8Error({ message: "nf", status: 404, type: "not_found", code: "404" });
    expect(isConflict(e409)).toBe(true);
    expect(isNotFound(e404)).toBe(true);
    expect(isConflict(new Error("x"))).toBe(false);
  });
});
