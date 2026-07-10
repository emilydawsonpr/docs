import { z } from "zod";

export const RELEVANCE_LABELS = ["RELEVANT", "POSSIBLY_RELEVANT", "IRRELEVANT"] as const;
export const SENTIMENT_LABELS = ["POSITIVE", "NEUTRAL", "MIXED", "NEGATIVE"] as const;
export const COVERAGE_TYPES = [
  "FEATURE",
  "NEWS_STORY",
  "INTERVIEW",
  "PRODUCT_REVIEW",
  "OPINION",
  "ROUNDUP",
  "LISTICLE",
  "EVENT_COVERAGE",
  "PRESS_RELEASE_REPRODUCTION",
  "PASSING_MENTION",
  "BROADCAST_TRANSCRIPT",
  "SOCIAL_POST",
  "OTHER",
] as const;
export const PROMINENCE_LEVELS = ["LEAD", "SIGNIFICANT", "PASSING", "BRIEF_MENTION"] as const;
export const URGENCY_LEVELS = ["NONE", "MONITOR", "REVIEW_SOON", "URGENT"] as const;
export const MESSAGE_MATCH_STRENGTHS = ["FULL", "PARTIAL", "ABSENT", "CONTRADICTORY"] as const;

/**
 * Single structured-output schema covering every analysis dimension for one
 * mention. Requested from Claude as strict JSON and validated with this
 * schema; the deterministic mock engine below also targets this exact shape
 * so both engines are interchangeable to every downstream consumer.
 */
export const AnalysisSchema = z.object({
  relevance: z.object({
    label: z.enum(RELEVANCE_LABELS),
    score: z.number().min(0).max(1),
    reason: z.string().min(1).max(500),
  }),
  sentiment: z.object({
    label: z.enum(SENTIMENT_LABELS),
    confidence: z.number().min(0).max(1),
    evidence: z.string().max(500).optional(),
    concernsMonitoredOrg: z.boolean(),
  }),
  coverageType: z.enum(COVERAGE_TYPES),
  prominence: z.object({
    level: z.enum(PROMINENCE_LEVELS),
    explanation: z.string().max(500),
  }),
  risk: z.object({
    score: z.number().min(0).max(100),
    reasons: z.array(z.string()).max(10),
    emergingNarrative: z.string().max(500).optional(),
    recommendedUrgency: z.enum(URGENCY_LEVELS),
  }),
  messagePullThrough: z
    .array(
      z.object({
        keyMessageId: z.string().nullable(),
        strength: z.enum(MESSAGE_MATCH_STRENGTHS),
        supportingExcerpt: z.string().max(500).optional(),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(20),
  topics: z.array(z.string().max(80)).max(5),
  secondaryTopics: z.array(z.string().max(80)).max(5),
  executiveSummary: z.string().min(1).max(800),
});

export type AnalysisOutput = z.infer<typeof AnalysisSchema>;

export function riskLevelFromScore(score: number): string {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}
