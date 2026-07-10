import "dotenv/config";
import { startIngestionWorker } from "./workers/ingestion-worker";
import { startAnalysisWorker } from "./workers/analysis-worker";
import { startAlertWorker } from "./workers/alert-worker";
import { scheduleDueIngestionJobs } from "./scheduler";
import { evaluatePeriodicAlerts } from "@/lib/alerts/spike-alerts";
import { sendDueDigests } from "@/lib/reports/digest";

const SCHEDULER_TICK_MS = 60_000;

async function main() {
  // eslint-disable-next-line no-console
  console.log("SignalWatch background workers starting...");
  if (!process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.log("ANTHROPIC_API_KEY not set — AI analysis will run in deterministic MOCK mode.");
  }

  const ingestionWorker = startIngestionWorker();
  const analysisWorker = startAnalysisWorker();
  const alertWorker = startAlertWorker();

  const tick = async () => {
    try {
      const n = await scheduleDueIngestionJobs();
      if (n > 0) {
        // eslint-disable-next-line no-console
        console.log(`Scheduler: enqueued ${n} due ingestion job(s).`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Scheduler tick (ingestion) failed:", err instanceof Error ? err.message : err);
    }
    try {
      const fired = await evaluatePeriodicAlerts();
      if (fired > 0) {
        // eslint-disable-next-line no-console
        console.log(`Scheduler: fired ${fired} periodic alert(s).`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Scheduler tick (periodic alerts) failed:", err instanceof Error ? err.message : err);
    }
    try {
      const sent = await sendDueDigests();
      if (sent > 0) {
        // eslint-disable-next-line no-console
        console.log(`Scheduler: sent ${sent} digest(s).`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Scheduler tick (digests) failed:", err instanceof Error ? err.message : err);
    }
  };

  await tick();
  const interval = setInterval(tick, SCHEDULER_TICK_MS);

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log("Shutting down workers...");
    clearInterval(interval);
    await Promise.all([ingestionWorker.close(), analysisWorker.close(), alertWorker.close()]);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal worker error:", err);
  process.exit(1);
});
