// Usage: npm run shots -- / /charges?period=30d   (BASE_URL defaults to http://localhost:3000)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const exe = process.env.CHROME_PATH ?? `${homedir()}/.cache/ms-playwright/chromium-1243/chrome-linux-arm64/chrome`;
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/charges", "/recovery", "/optimize"];
mkdirSync(".shots", { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}/login`);
  await page.fill("input[type=password]", process.env.DASHBOARD_PASSWORD ?? "");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.keyboard.press("Enter")]);
  for (const p of paths) {
    const t0 = Date.now();
    await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 120000 });
    const file = `.shots/${w}${p === "/" ? "_root" : p.replace(/[/?=&]+/g, "_")}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${w}px ${p} ${Date.now() - t0}ms ${file}${overflow ? " HORIZONTAL-OVERFLOW" : ""}`);
  }
  if (errors.length) console.log(`${w}px console errors:`, errors);
  await page.close();
}
await browser.close();
