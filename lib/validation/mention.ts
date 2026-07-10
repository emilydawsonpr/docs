import { z } from "zod";

export const mentionFilterSchema = z.object({
  q: z.string().optional(),
  sentiment: z.array(z.enum(["POSITIVE", "NEUTRAL", "MIXED", "NEGATIVE"])).optional(),
  reviewStatus: z.array(z.enum(["UNREVIEWED", "APPROVED", "REJECTED", "EXCLUDED"])).optional(),
  minRisk: z.coerce.number().min(0).max(100).optional(),
  isDemo: z.coerce.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sourceDomain: z.string().optional(),
  language: z.string().optional(),
  sortBy: z.enum(["publishedAt", "riskScore", "relevanceScore"]).default("publishedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const mentionCorrectionSchema = z.object({
  reviewStatus: z.enum(["UNREVIEWED", "APPROVED", "REJECTED", "EXCLUDED"]).optional(),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "MIXED", "NEGATIVE"]).optional(),
  relevanceLabel: z.enum(["RELEVANT", "POSSIBLY_RELEVANT", "IRRELEVANT"]).optional(),
  placementType: z.enum(["OWNED", "EARNED", "PAID", "SYNDICATED"]).optional(),
  analystNotes: z.string().max(4000).optional(),
  aiErrorFlagged: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  reason: z.string().max(500).optional(),
});

export const bulkActionSchema = z.object({
  mentionIds: z.array(z.string()).min(1).max(500),
  action: z.enum(["APPROVE", "REJECT", "EXCLUDE", "TAG"]),
  tag: z.string().max(80).optional(),
});
