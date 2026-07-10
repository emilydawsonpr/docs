import type { Mention, AnalysisResult, AlertRule } from "@prisma/client";

export interface RuleMatch {
  matched: boolean;
  reason: string;
  payload: Record<string, unknown>;
}

const JOURNALIST_INQUIRY_PHRASES = [
  "request for comment",
  "reaching out for a story",
  "on deadline",
  "working on a story about",
  "for an upcoming piece",
  "media inquiry",
];
const REGULATORY_PHRASES = [
  "regulatory investigation",
  "compliance violation",
  "sec filing",
  "investigation by",
  "regulator",
  "cease and desist",
  "class action",
];
const MISINFORMATION_PHRASES = ["debunked", "false claim", "unverified reports", "conspiracy theory", "fact-check"];

function textOf(mention: Mention): string {
  return `${mention.headline}\n${mention.excerpt ?? ""}\n${mention.bodyText ?? ""}`.toLowerCase();
}

function containsAny(text: string, phrases: string[]): string[] {
  return phrases.filter((p) => text.includes(p.toLowerCase()));
}

/**
 * Evaluates the mention-scoped alert trigger types (everything except the
 * periodic VOLUME_SPIKE/COMPETITOR_SPIKE/SENTIMENT_DETERIORATION triggers,
 * which run on a schedule against aggregate data — see lib/alerts/spike-alerts.ts).
 */
export function evaluateMentionRule(mention: Mention, analysis: AnalysisResult | null, rule: AlertRule): RuleMatch {
  const config = (rule.config ?? {}) as Record<string, unknown>;
  const text = textOf(mention);

  switch (rule.triggerType) {
    case "HIGH_RELEVANCE": {
      const min = typeof config.minScore === "number" ? config.minScore : 0.75;
      const matched = !!analysis && analysis.relevanceScore >= min && analysis.relevanceLabel === "RELEVANT";
      return { matched, reason: `Relevance score ${analysis?.relevanceScore ?? 0} >= ${min}`, payload: { minScore: min } };
    }
    case "HIGH_RISK": {
      const min = typeof config.minRiskScore === "number" ? config.minRiskScore : 50;
      const matched = !!analysis && analysis.riskScore >= min;
      return { matched, reason: `Risk score ${analysis?.riskScore ?? 0} >= ${min}`, payload: { minRiskScore: min } };
    }
    case "NEGATIVE_SENTIMENT": {
      const matched = !!analysis && analysis.sentiment === "NEGATIVE" && analysis.sentimentSubjectIsBrand;
      return { matched, reason: "Negative sentiment concerning the monitored organization", payload: {} };
    }
    case "MAJOR_PUBLICATION": {
      const domains = Array.isArray(config.domains) ? (config.domains as string[]) : [];
      const matched = domains.some((d) => mention.sourceDomain.toLowerCase() === d.toLowerCase());
      return { matched, reason: `Source domain ${mention.sourceDomain} is on the major-publication list`, payload: { domains } };
    }
    case "EXEC_MENTION": {
      const names = Array.isArray(config.names) ? (config.names as string[]) : [];
      const hit = names.filter((n) => text.includes(n.toLowerCase()));
      return { matched: hit.length > 0, reason: `Executive/spokesperson name(s) found: ${hit.join(", ")}`, payload: { matched: hit } };
    }
    case "TOPIC_PHRASE": {
      const phrases = Array.isArray(config.phrases) ? (config.phrases as string[]) : [];
      const hit = containsAny(text, phrases);
      return { matched: hit.length > 0, reason: `Configured phrase(s) found: ${hit.join(", ")}`, payload: { matched: hit } };
    }
    case "JOURNALIST_INQUIRY": {
      const hit = containsAny(text, JOURNALIST_INQUIRY_PHRASES);
      return { matched: hit.length > 0, reason: `Journalist-inquiry language found: ${hit.join(", ")}`, payload: { matched: hit } };
    }
    case "REGULATORY_LANGUAGE": {
      const hit = containsAny(text, REGULATORY_PHRASES);
      return { matched: hit.length > 0, reason: `Regulatory/legal language found: ${hit.join(", ")}`, payload: { matched: hit } };
    }
    case "MISINFORMATION_INDICATOR": {
      const hit = containsAny(text, MISINFORMATION_PHRASES);
      return { matched: hit.length > 0, reason: `Misinformation indicator language found: ${hit.join(", ")}`, payload: { matched: hit } };
    }
    default:
      return { matched: false, reason: "Not a mention-scoped trigger", payload: {} };
  }
}

export const MENTION_SCOPED_TRIGGERS = [
  "HIGH_RELEVANCE",
  "HIGH_RISK",
  "NEGATIVE_SENTIMENT",
  "MAJOR_PUBLICATION",
  "EXEC_MENTION",
  "TOPIC_PHRASE",
  "JOURNALIST_INQUIRY",
  "REGULATORY_LANGUAGE",
  "MISINFORMATION_INDICATOR",
] as const;

export const PERIODIC_TRIGGERS = ["VOLUME_SPIKE", "COMPETITOR_SPIKE", "SENTIMENT_DETERIORATION"] as const;
