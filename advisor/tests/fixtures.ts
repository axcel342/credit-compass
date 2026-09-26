import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = path.resolve(here, "../../research/fixtures");

export function loadFixture<T>(relPath: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, relPath), "utf8")) as T;
}

export function listFixtures(relDir: string): string[] {
  return fs.readdirSync(path.join(FIXTURES_DIR, relDir)).filter((f) => f.endsWith(".json")).map((f) => path.join(relDir, f));
}
