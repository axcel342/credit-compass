import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
const k = (secret: string) => createHash("sha256").update(secret).digest();
export function encrypt(plain: string, secret: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", k(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
export function decrypt(blob: string, secret: string): string {
  const b = Buffer.from(blob, "base64url"), d = createDecipheriv("aes-256-gcm", k(secret), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
export function keyHash(apiKey: string): string { return createHash("sha256").update(`credit-compass-key:${apiKey}`).digest("hex"); }
