import { Worker, type ConnectionOptions } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, alertQueue, type AnalysisJobPayload } from "@/jobs/queue";
import { analyzeMention } from "@/lib/ai/pipeline";

export function startAnalysisWorker(): Worker<AnalysisJobPayload> {
  const worker = new Worker<AnalysisJobPayload>(
    QUEUE_NAMES.analysis,
    async (job) => {
      const { mentionId } = job.data;
      const result = await analyzeMention(mentionId);
      if (result) {
        await alertQueue().add("evaluate", { mentionId }, { attempts: 1, jobId: `alert-eval-${mentionId}-${Date.now()}` });
      }
      return result;
    },
    { connection: getRedisConnection() as unknown as ConnectionOptions, concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`Analysis job ${job?.id} failed for mention ${job?.data.mentionId}:`, err.message);
  });

  return worker;
}
