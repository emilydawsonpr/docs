import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | undefined;

/** Lazily-created shared Redis connection for BullMQ (maxRetriesPerRequest must be null for BullMQ). */
export function getRedisConnection(): IORedis {
  if (!connection) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6380";
    connection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}

export const QUEUE_NAMES = {
  ingestion: "signalwatch-ingestion",
  analysis: "signalwatch-analysis",
  alerts: "signalwatch-alerts",
  digests: "signalwatch-digests",
  reports: "signalwatch-reports",
} as const;

export interface IngestionJobPayload {
  sourceConnectionId: string;
}

export interface AnalysisJobPayload {
  mentionId: string;
}

export interface AlertEvaluationJobPayload {
  mentionId: string;
}

export interface DigestJobPayload {
  digestId: string;
}

function makeQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: getRedisConnection() as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  });
}

let _ingestionQueue: Queue<IngestionJobPayload> | undefined;
let _analysisQueue: Queue<AnalysisJobPayload> | undefined;
let _alertQueue: Queue<AlertEvaluationJobPayload> | undefined;
let _digestQueue: Queue<DigestJobPayload> | undefined;

export function ingestionQueue() {
  return (_ingestionQueue ??= makeQueue<IngestionJobPayload>(QUEUE_NAMES.ingestion));
}
export function analysisQueue() {
  return (_analysisQueue ??= makeQueue<AnalysisJobPayload>(QUEUE_NAMES.analysis));
}
export function alertQueue() {
  return (_alertQueue ??= makeQueue<AlertEvaluationJobPayload>(QUEUE_NAMES.alerts));
}
export function digestQueue() {
  return (_digestQueue ??= makeQueue<DigestJobPayload>(QUEUE_NAMES.digests));
}
