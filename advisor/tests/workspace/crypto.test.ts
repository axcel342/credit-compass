import { describe, it, expect } from "vitest";
import { encrypt, decrypt, keyHash } from "@/lib/workspace/crypto";
const S = "a".repeat(64);
describe("workspace crypto", () => {
  it("round-trips and never contains the plain text", () => {
    const blob = encrypt("g8_live_secret", S);
    expect(blob).not.toContain("g8_live_secret");
    expect(decrypt(blob, S)).toBe("g8_live_secret");
    expect(encrypt("g8_live_secret", S)).not.toBe(blob); // random IV
  });
  it("rejects a tampered blob or the wrong secret", () => {
    const blob = encrypt("x", S);
    expect(() => decrypt(blob.slice(0, -4) + "AAAA", S)).toThrow();
    expect(() => decrypt(blob, "b".repeat(64))).toThrow();
  });
  it("hashes keys stably without revealing them", () => { expect(keyHash("k")).toBe(keyHash("k")); expect(keyHash("k")).not.toContain("k"); expect(keyHash("k")).toHaveLength(64); });
});
