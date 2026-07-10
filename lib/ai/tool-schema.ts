import {
  RELEVANCE_LABELS,
  SENTIMENT_LABELS,
  COVERAGE_TYPES,
  PROMINENCE_LEVELS,
  URGENCY_LEVELS,
  MESSAGE_MATCH_STRENGTHS,
} from "./schemas";

/**
 * JSON Schema for the Anthropic tool-use "record_analysis" tool, mirroring
 * lib/ai/schemas.ts's zod AnalysisSchema field-for-field. Hand-maintained
 * (small enough to keep in sync manually) rather than pulling in a
 * zod-to-json-schema dependency for one call site.
 */
export const RECORD_ANALYSIS_TOOL = {
  name: "record_analysis",
  description: "Records the structured analysis of one media mention.",
  input_schema: {
    type: "object" as const,
    properties: {
      relevance: {
        type: "object",
        properties: {
          label: { type: "string", enum: RELEVANCE_LABELS },
          score: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
        required: ["label", "score", "reason"],
      },
      sentiment: {
        type: "object",
        properties: {
          label: { type: "string", enum: SENTIMENT_LABELS },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string" },
          concernsMonitoredOrg: { type: "boolean" },
        },
        required: ["label", "confidence", "concernsMonitoredOrg"],
      },
      coverageType: { type: "string", enum: COVERAGE_TYPES },
      prominence: {
        type: "object",
        properties: {
          level: { type: "string", enum: PROMINENCE_LEVELS },
          explanation: { type: "string" },
        },
        required: ["level", "explanation"],
      },
      risk: {
        type: "object",
        properties: {
          score: { type: "number", minimum: 0, maximum: 100 },
          reasons: { type: "array", items: { type: "string" } },
          emergingNarrative: { type: "string" },
          recommendedUrgency: { type: "string", enum: URGENCY_LEVELS },
        },
        required: ["score", "reasons", "recommendedUrgency"],
      },
      messagePullThrough: {
        type: "array",
        items: {
          type: "object",
          properties: {
            keyMessageId: { type: ["string", "null"] },
            strength: { type: "string", enum: MESSAGE_MATCH_STRENGTHS },
            supportingExcerpt: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["keyMessageId", "strength", "confidence"],
        },
      },
      topics: { type: "array", items: { type: "string" }, maxItems: 5 },
      secondaryTopics: { type: "array", items: { type: "string" }, maxItems: 5 },
      executiveSummary: { type: "string" },
    },
    required: [
      "relevance",
      "sentiment",
      "coverageType",
      "prominence",
      "risk",
      "messagePullThrough",
      "topics",
      "secondaryTopics",
      "executiveSummary",
    ],
  },
};
