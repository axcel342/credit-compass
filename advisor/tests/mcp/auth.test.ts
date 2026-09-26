import { describe, it, expect } from "vitest";
import { authorizeMcp } from "@/lib/mcp/auth";

describe("authorizeMcp", () => {
  const t = "tok";
  it("accepts a bearer token", () => expect(authorizeMcp(new Request("https://x/api/mcp", { headers: { authorization: "Bearer tok" } }), t)).toBe(true));
  it("accepts ?key= for graph8's SSE connection", () => expect(authorizeMcp(new Request("https://x/api/sse?key=tok"), t)).toBe(true));
  it("lets the SSE message leg through", () => expect(authorizeMcp(new Request("https://x/api/message?sessionId=abc", { method: "POST" }), t)).toBe(true));
  it("rejects missing or wrong tokens", () => {
    expect(authorizeMcp(new Request("https://x/api/mcp"), t)).toBe(false);
    expect(authorizeMcp(new Request("https://x/api/sse?key=nope"), t)).toBe(false);
  });
});
