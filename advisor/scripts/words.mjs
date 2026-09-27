// Usage: npm run words   (BASE_URL defaults to http://localhost:3000)
// Counts words on each screen the way the redesign spec measures them: main.innerText (which includes SVG text) plus visible textarea text.
import { chromium } from "playwright-core";
import { homedir } from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const exe = process.env.CHROME_PATH ?? `${homedir()}/.cache/ms-playwright/chromium-1243/chrome-linux-arm64/chrome`;
const LIMIT = { "/": 115, "/charges": 150, "/recovery": 60, "/optimize": 200 };
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/login`);
await page.fill("input[type=password]", process.env.DASHBOARD_PASSWORD ?? "");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 }), page.keyboard.press("Enter")]);
let failed = false;
for (const [p, limit] of Object.entries(LIMIT)) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 180000 });
  const words = await page.evaluate(() => {
    const count = (s) => s.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const main = document.querySelector("main");
    const areas = [...main.querySelectorAll("textarea")].filter((t) => t.offsetParent !== null).map((t) => t.value).join(" ");
    return count(main.innerText) + count(areas);
  });
  if (words > limit) failed = true;
  console.log(`${p} ${words} words (limit ${limit})${words > limit ? " OVER" : ""}`);
}
await browser.close();
process.exit(failed ? 1 : 0);
