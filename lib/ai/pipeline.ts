import { prisma } from "@/lib/db/prisma";
import { evaluateQuery, parseQuery } from "@/lib/query/boolean-parser";
import { runMockAnalysis } from "./mock-engine";
import { analyzeWithClaude, isClaudeConfigured, AiAnalysisError } from "./client";
import { riskLevelFromScore, type AnalysisOutput } from "./schemas";
import type { AnalysisEngine } from "@prisma/client";

export interface AnalyzeMentionResult {
  analysisResultId: string;
  engine: AnalysisEngine;
  derivedFromMentionId?: string;
}

/**
 * Analyzes one mention end-to-end: deterministic pre-checks first (duplicate
 * short-circuit, relevance gate), then Claude if configured, falling back to
 * the deterministic mock engine on missing credentials or repeated schema
 * validation failure. Always stores a labelled AnalysisResult — never
 * presents mock output as if it came from Claude.
 */
export async function analyzeMention(mentionId: string): Promise<AnalyzeMentionResult | null> {
  const mention = await prisma.mention.findUnique({
    where: { id: mentionId },
    include: { project: { include: { brands: true, keyMessages: true } }, duplicateCluster: true },
  });
  if (!mention) {
    // The mention was deleted (e.g. project cleanup, dedup merge) between
    // being enqueued and this job running — nothing to analyze, not an error.
    // eslint-disable-next-line no-console
    console.warn(`AI analysis: mention ${mentionId} no longer exists, skipping.`);
    return null;
  }

  // --- Pre-check 1: duplicate-of-already-analyzed short circuit ---
  if (mention.duplicateCluster && mention.duplicateCluster.canonicalMentionId !== mention.id) {
    const canonical = await prisma.analysisResult.findUnique({
      where: { mentionId: mention.duplicateCluster.canonicalMentionId ?? "" },
    });
    if (canonical) {
      const result = await prisma.analysisResult.upsert({
        where: { mentionId: mention.id },
        create: {
          mentionId: mention.id,
          engine: canonical.engine,
          modelName: canonical.modelName,
          relevanceLabel: canonical.relevanceLabel,
          relevanceScore: canonical.relevanceScore,
          relevanceReason: `${canonical.relevanceReason} (derived from duplicate cluster canonical mention)`,
          sentiment: canonical.sentiment,
          sentimentConfidence: canonical.sentimentConfidence,
          sentimentEvidence: canonical.sentimentEvidence,
          sentimentSubjectIsBrand: canonical.sentimentSubjectIsBrand,
          coverageType: canonical.coverageType,
          prominence: canonical.prominence,
          prominenceExplanation: canonical.prominenceExplanation,
          riskScore: canonical.riskScore,
          riskLevel: canonical.riskLevel,
          riskReasons: canonical.riskReasons,
          emergingNarrative: canonical.emergingNarrative,
          recommendedUrgency: canonical.recommendedUrgency,
          topics: canonical.topics,
          secondaryTopics: canonical.secondaryTopics,
          executiveSummary: canonical.executiveSummary,
          rawModelResponse: { derivedFromMentionId: mention.duplicateCluster.canonicalMentionId } as any,
        },
        update: {},
      });
      await prisma.mention.update({
        where: { id: mention.id },
        data: { coverageType: canonical.coverageType, topicLabels: canonical.topics },
      });
      return { analysisResultId: result.id, engine: result.engine, derivedFromMentionId: mention.duplicateCluster.canonicalMentionId ?? undefined };
    }
  }

  const brand = mention.project.brands.find((b) => b.isPrimary) ?? mention.project.brands[0];
  const brandName = brand?.name ?? mention.project.name;
  const brandAliases = brand?.aliases ?? [];
  const competitorBrands = mention.project.brands.filter((b) => !b.isPrimary).map((b) => b.name);

  // --- Pre-check 2: relevance gate via the mention's matched query text ---
  let matchedTermHit = true;
  if (mention.matchedQuery) {
    try {
      const ast = parseQuery(mention.matchedQuery);
      matchedTermHit = evaluateQuery(ast, `${mention.headline}\n${mention.excerpt ?? ""}\n${mention.bodyText ?? ""}`);
    } catch {
      matchedTermHit = true; // if the stored expression fails to parse, don't block analysis on it
    }
  }

  const mockInput = {
    headline: mention.headline,
    excerpt: mention.excerpt,
    bodyText: mention.bodyText,
    brandName,
    brandAliases,
    keyMessages: mention.project.keyMessages.map((k) => ({ id: k.id, text: k.text, aliases: k.aliases })),
    crisisTerms: mention.project.crisisTerms,
    matchedTermHit,
  };

  let output: AnalysisOutput;
  let engine: AnalysisEngine = "MOCK";
  let modelName: string | null = null;
  let rawModelResponse: unknown = null;

  if (isClaudeConfigured()) {
    try {
      const activeQuery = await prisma.monitoringQuery.findFirst({
        where: { projectId: mention.projectId, isActive: true },
      });
      const claudeResult = await analyzeWithClaude({
        headline: mention.headline,
        excerpt: mention.excerpt,
        bodyText: mention.bodyText,
        sourceName: mention.sourceName,
        sourceDomain: mention.sourceDomain,
        publishedAt: mention.publishedAt,
        brandName,
        brandAliases,
        competitors: competitorBrands,
        keyMessages: mention.project.keyMessages.map((k) => ({ id: k.id, text: k.text })),
        crisisTerms: mention.project.crisisTerms,
        monitoringBrief: activeQuery?.booleanExpression ?? mention.matchedQuery ?? "",
      });
      output = claudeResult.output;
      engine = "CLAUDE";
      modelName = claudeResult.modelName;
      rawModelResponse = claudeResult.rawResponse;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `AI analysis: Claude call failed for mention ${mentionId}, falling back to mock engine:`,
        err instanceof AiAnalysisError ? err.message : err
      );
      output = runMockAnalysis(mockInput);
      engine = "MOCK";
    }
  } else {
    output = runMockAnalysis(mockInput);
    engine = "MOCK";
  }

  const result = await prisma.analysisResult.upsert({
    where: { mentionId: mention.id },
    create: {
      mentionId: mention.id,
      engine,
      modelName,
      relevanceLabel: output.relevance.label,
      relevanceScore: output.relevance.score,
      relevanceReason: output.relevance.reason,
      sentiment: output.sentiment.label,
      sentimentConfidence: output.sentiment.confidence,
      sentimentEvidence: output.sentiment.evidence,
      sentimentSubjectIsBrand: output.sentiment.concernsMonitoredOrg,
      coverageType: output.coverageType,
      prominence: output.prominence.level,
      prominenceExplanation: output.prominence.explanation,
      riskScore: Math.round(output.risk.score),
      riskLevel: riskLevelFromScore(output.risk.score),
      riskReasons: output.risk.reasons,
      emergingNarrative: output.risk.emergingNarrative,
      recommendedUrgency: output.risk.recommendedUrgency,
      topics: output.topics,
      secondaryTopics: output.secondaryTopics,
      executiveSummary: output.executiveSummary,
      rawModelResponse: rawModelResponse as any,
    },
    update: {
      engine,
      modelName,
      relevanceLabel: output.relevance.label,
      relevanceScore: output.relevance.score,
      relevanceReason: output.relevance.reason,
      sentiment: output.sentiment.label,
      sentimentConfidence: output.sentiment.confidence,
      sentimentEvidence: output.sentiment.evidence,
      sentimentSubjectIsBrand: output.sentiment.concernsMonitoredOrg,
      coverageType: output.coverageType,
      prominence: output.prominence.level,
      prominenceExplanation: output.prominence.explanation,
      riskScore: Math.round(output.risk.score),
      riskLevel: riskLevelFromScore(output.risk.score),
      riskReasons: output.risk.reasons,
      emergingNarrative: output.risk.emergingNarrative,
      recommendedUrgency: output.risk.recommendedUrgency,
      topics: output.topics,
      secondaryTopics: output.secondaryTopics,
      executiveSummary: output.executiveSummary,
      rawModelResponse: rawModelResponse as any,
    },
  });

  await prisma.mention.update({
    where: { id: mention.id },
    data: {
      coverageType: output.coverageType,
      topicLabels: output.topics,
      brandsMentioned: output.sentiment.concernsMonitoredOrg ? [brandName] : [],
    },
  });

  for (const match of output.messagePullThrough) {
    if (!match.keyMessageId || match.strength === "ABSENT") continue;
    await prisma.messageMatch.upsert({
      where: { mentionId_keyMessageId: { mentionId: mention.id, keyMessageId: match.keyMessageId } },
      create: {
        mentionId: mention.id,
        keyMessageId: match.keyMessageId,
        matchStrength: match.strength,
        confidence: match.confidence,
        supportingExcerpt: match.supportingExcerpt,
      },
      update: {
        matchStrength: match.strength,
        confidence: match.confidence,
        supportingExcerpt: match.supportingExcerpt,
      },
    });
  }

  return { analysisResultId: result.id, engine };
}
