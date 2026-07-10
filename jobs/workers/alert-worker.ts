import { Worker, type ConnectionOptions } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, type AlertEvaluationJobPayload } from "@/jobs/queue";
import { evaluateAlertsForMention } from "@/lib/alerts/evaluate-and-deliver";

export function startAlertWorker(): Worker<AlertEvaluationJobPayload> {
  const worker = new Worker<AlertEvaluationJobPayload>(
    QUEUE_NAMES.alerts,
    async (job) => evaluateAlertsForMention(job.data.mentionId),
    { connection: getRedisConnection() as unknown as ConnectionOptions, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`Alert evaluation job ${job?.id} failed for mention ${job?.data.mentionId}:`, err.message);
  });

  return worker;
}
