import { describe, it, expect } from "vitest";
import { serviceName, listLabel, listNamesFrom } from "@/lib/domain/names";

describe("names", () => {
  it("names ledger services in plain words", () => {
    expect(serviceName("waterfall_enrichment")).toBe("Email finding");
    expect(serviceName("studio_global")).toBe("Onboarding research");
    expect(serviceName("brand_new_thing")).toBe("Brand new thing");
  });
  it("drops the [sim] prefix and the setup suffix from list titles", () => {
    expect(listLabel("[sim] Sales VPs")).toBe("Sales VPs");
    expect(listLabel("Starter list (proactive setup)")).toBe("Starter list");
  });
  it("shows probe lists as test lists", () => {
    expect(listLabel("[sim] guardrail probe")).toBe("Test list");
    const m = listNamesFrom([{ id: 13, title: "[sim] guardrail probe" }, { id: 14, title: "[sim] lookalike probe" }]);
    expect([m.get("13"), m.get("14")]).toEqual(["Test list (13)", "Test list (14)"]);
  });
  it("adds the id when two lists share a name", () => {
    const m = listNamesFrom([{ id: 5, title: "Revenue-Leads" }, { id: 6, title: "Revenue-Leads" }, { id: 15, title: "[sim] Sales VPs" }]);
    expect(m.get("5")).toBe("Revenue-Leads (5)");
    expect(m.get("6")).toBe("Revenue-Leads (6)");
    expect(m.get("15")).toBe("Sales VPs");
  });
});
