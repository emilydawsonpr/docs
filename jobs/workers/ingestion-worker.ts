import { Worker, type ConnectionOptions } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, type IngestionJobPayload } from "@/jobs/queue";
import { runSourceConnection } from "@/lib/ingestion/run-source-connection";

/**
 * Processes ingestion jobs: fetch -> normalize -> dedup -> store. Retry/
 * backoff across adapter fetch attempts is handled inside
 * runSourceConnection itself (idempotent per source connection), so this
 * queue's jobs are enqueued with attempts:1 to avoid compounding retries.
 */
export function startIngestionWorker(): Worker<IngestionJobPayload> {
  const worker = new Worker<IngestionJobPayload>(
    QUEUE_NAMES.ingestion,
    async (job) => {
      const { sourceConnectionId } = job.data;
      return runSourceConnection(sourceConnectionId);
    },
    { connection: getRedisConnection() as unknown as ConnectionOptions, concurrency: 4 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`Ingestion job ${job?.id} failed for sourceConnection ${job?.data.sourceConnectionId}:`, err.message);
  });

  return worker;
}
