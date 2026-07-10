import { chromium } from "playwright-core";

const CHROMIUM_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
].filter(Boolean) as string[];

/**
 * Renders a self-contained HTML report to a print-ready PDF using the
 * pre-installed headless Chromium (no external PDF service). Falls back
 * through a couple of known install paths for this environment.
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  let lastError: unknown;
  for (const executablePath of [...CHROMIUM_CANDIDATES, undefined]) {
    try {
      const browser = await chromium.launch(executablePath ? { executablePath } : {});
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle" });
        const pdf = await page.pdf({ format: "Letter", printBackground: true, margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" } });
        return pdf;
      } finally {
        await browser.close();
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Unable to launch headless Chromium for PDF export: ${lastError instanceof Error ? lastError.message : lastError}`);
}
