// Dev helper: logs in and screenshots a project page, using the pre-installed
// Chromium so it works without downloading a browser.
//
// Usage: E2E_EMAIL=you@example.com E2E_PASSWORD=yourpassword \
//   node scripts/screenshot-dashboard.mjs <projectId> [outPath] [route]
import { chromium } from "playwright-core";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const projectId = process.argv[2];
const outPath = process.argv[3] ?? "/tmp/dashboard.png";
const route = process.argv[4] ?? "dashboard";

if (!email || !password || !projectId) {
  console.error("Usage: E2E_EMAIL=... E2E_PASSWORD=... node scripts/screenshot-dashboard.mjs <projectId> [outPath] [route]");
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
const page = await context.newPage();

await page.goto(`${baseUrl}/login`);
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 10000, waitUntil: "commit" });

await page.goto(`${baseUrl}/projects/${projectId}/${route}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: outPath, fullPage: true });

await browser.close();
console.log(`Saved ${outPath}`);
