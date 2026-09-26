import { describe, it, expect } from "vitest";
import { loadFixture } from "../fixtures";
import { recordConsistency, rootDomain, segmentKey } from "@/lib/domain/segments";

interface Sample { flagged: { email: string; crm_domain: string }[]; consistent: { email: string; crm_domain: string }[] }
const s = loadFixture<Sample>("idea-a/validation-sample-40.json");
const count = (xs: { email: string; crm_domain: string }[]) =>
  xs.reduce<Record<string, number>>((a, x) => { const k = recordConsistency(x.email, x.crm_domain); a[k] = (a[k] ?? 0) + 1; return a; }, {});

describe("record consistency on the Idea A validation sample", () => {
  it("flags 19 of the flagged group; 1 has no company domain", () => expect(count(s.flagged)).toEqual({ flagged: 19, unknown: 1 }));
  it("passes all 20 consistent contacts", () => expect(count(s.consistent)).toEqual({ ok: 20 }));
  it("accepts subdomains either way and ignores www", () => {
    expect(recordConsistency("a@mail.acme.com", "acme.com")).toBe("ok");
    expect(recordConsistency("a@acme.com", "www.acme.com/about")).toBe("ok");
    expect(recordConsistency(null, "acme.com")).toBe("unknown");
  });
  it("normalises domains", () => expect(rootDomain("https://www.Acme.com/x")).toBe("acme.com"));
  it("builds segment keys with explicit unknowns", () => {
    expect(segmentKey({ seniority: "Vice President", department: "Sales", industry: "Computer Software", employeeCount: "51-200" }))
      .toBe("Vice President|Sales|Computer Software|51-200");
    expect(segmentKey({})).toBe("Unknown|Unknown|Unknown|Unknown");
  });
});
