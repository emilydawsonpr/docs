import { z } from "zod";

export const ADAPTER_TYPES = [
  "RSS",
  "GOOGLE_NEWS_RSS",
  "GDELT",
  "NEWSAPI",
  "CSV_UPLOAD",
  "MANUAL_URL",
  "MANUAL_CRAWL",
  "EMAIL_FORWARD",
  "GOOGLE_ALERTS_EMAIL",
  "REDDIT",
  "YOUTUBE",
  "BLUESKY",
  "MASTODON",
  "SLACK",
  "TEAMS",
  "GMAIL",
] as const;

export const createSourceConnectionSchema = z.object({
  name: z.string().min(1).max(200),
  adapterType: z.enum(ADAPTER_TYPES),
  config: z.record(z.any()).default({}),
  monitoringQueryId: z.string().optional(),
  pollingFrequencyMins: z.number().int().min(0).max(1440).default(60),
});

export const updateSourceConnectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: z.record(z.any()).optional(),
  monitoringQueryId: z.string().nullable().optional(),
  pollingFrequencyMins: z.number().int().min(0).max(1440).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "DISABLED", "ERROR"]).optional(),
});
