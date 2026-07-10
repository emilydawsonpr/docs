import { prisma } from "@/lib/db/prisma";
import { subDays, format } from "date-fns";

export interface DashboardMetrics {
  totalMentions: number;
  uniqueStories: number;
  sentimentBreakdown: Record<"POSITIVE" | "NEUTRAL" | "MIXED" | "NEGATIVE", number>;
  highRiskCount: number;
  topSources: { sourceDomain: string; sourceName: string; count: number }[];
  topAuthors: { author: string; count: number }[];
  languageDistribution: { language: string; count: number }[];
  countryDistribution: { country: string; count: number }[];
  mentionsOverTime: { date: string; count: number }[];
  sentimentOverTime: { date: string; positive: number; neutral: number; mixed: number; negative: number }[];
  riskOverTime: { date: string; avgRisk: number; maxRisk: number }[];
  sourceTypeDistribution: { sourceType: string; count: number }[];
  reviewedCount: number;
  unreviewedCount: number;
  mockAnalysisCount: number;
  claudeAnalysisCount: number;
}

/**
 * All figures here are computed from stored Mention/AnalysisResult rows for
 * this project only (isDemo scoping applied by the caller) — nothing is
 * fabricated or estimated beyond what's in the database.
 */
export async function computeDashboardMetrics(projectId: string, isDemo: boolean, windowDays = 30): Promise<DashboardMetrics> {
  const since = subDays(new Date(), windowDays);
  const baseWhere = { projectId, isDemo, publishedAt: { gte: since } };

  const [totalMentions, uniqueClusters, mentions, highRiskCount, reviewedCount, mockCount, claudeCount] = await Promise.all([
    prisma.mention.count({ where: baseWhere }),
    prisma.mention.findMany({ where: baseWhere, select: { duplicateClusterId: true }, distinct: ["duplicateClusterId"] }),
    prisma.mention.findMany({
      where: baseWhere,
      select: {
        publishedAt: true,
        sourceDomain: true,
        sourceName: true,
        author: true,
        language: true,
        country: true,
        sourceType: true,
        reviewStatus: true,
        analysisResult: { select: { sentiment: true, riskScore: true, engine: true } },
      },
    }),
    prisma.analysisResult.count({ where: { mention: baseWhere, riskScore: { gte: 50 } } }),
    prisma.mention.count({ where: { ...baseWhere, reviewStatus: { not: "UNREVIEWED" } } }),
    prisma.analysisResult.count({ where: { mention: baseWhere, engine: "MOCK" } }),
    prisma.analysisResult.count({ where: { mention: baseWhere, engine: "CLAUDE" } }),
  ]);

  const sentimentBreakdown = { POSITIVE: 0, NEUTRAL: 0, MIXED: 0, NEGATIVE: 0 };
  const sourceCounts = new Map<string, { sourceName: string; count: number }>();
  const authorCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const sourceTypeCounts = new Map<string, number>();
  const byDay = new Map<string, { count: number; positive: number; neutral: number; mixed: number; negative: number; riskSum: number; riskMax: number; riskN: number }>();

  for (const m of mentions) {
    if (m.analysisResult) sentimentBreakdown[m.analysisResult.sentiment] += 1;

    const src = sourceCounts.get(m.sourceDomain) ?? { sourceName: m.sourceName, count: 0 };
    src.count += 1;
    sourceCounts.set(m.sourceDomain, src);

    if (m.author) authorCounts.set(m.author, (authorCounts.get(m.author) ?? 0) + 1);
    languageCounts.set(m.language, (languageCounts.get(m.language) ?? 0) + 1);
    if (m.country) countryCounts.set(m.country, (countryCounts.get(m.country) ?? 0) + 1);
    sourceTypeCounts.set(m.sourceType, (sourceTypeCounts.get(m.sourceType) ?? 0) + 1);

    const day = format(m.publishedAt, "yyyy-MM-dd");
    const bucket = byDay.get(day) ?? { count: 0, positive: 0, neutral: 0, mixed: 0, negative: 0, riskSum: 0, riskMax: 0, riskN: 0 };
    bucket.count += 1;
    if (m.analysisResult) {
      const s = m.analysisResult.sentiment;
      if (s === "POSITIVE") bucket.positive += 1;
      else if (s === "NEUTRAL") bucket.neutral += 1;
      else if (s === "MIXED") bucket.mixed += 1;
      else if (s === "NEGATIVE") bucket.negative += 1;
      bucket.riskSum += m.analysisResult.riskScore;
      bucket.riskMax = Math.max(bucket.riskMax, m.analysisResult.riskScore);
      bucket.riskN += 1;
    }
    byDay.set(day, bucket);
  }

  const days: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) days.push(format(subDays(new Date(), i), "yyyy-MM-dd"));

  return {
    totalMentions,
    uniqueStories: uniqueClusters.length,
    sentimentBreakdown,
    highRiskCount,
    topSources: Array.from(sourceCounts.entries())
      .map(([sourceDomain, v]) => ({ sourceDomain, sourceName: v.sourceName, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topAuthors: Array.from(authorCounts.entries())
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    languageDistribution: Array.from(languageCounts.entries()).map(([language, count]) => ({ language, count })),
    countryDistribution: Array.from(countryCounts.entries()).map(([country, count]) => ({ country, count })),
    sourceTypeDistribution: Array.from(sourceTypeCounts.entries()).map(([sourceType, count]) => ({ sourceType, count })),
    mentionsOverTime: days.map((date) => ({ date, count: byDay.get(date)?.count ?? 0 })),
    sentimentOverTime: days.map((date) => {
      const b = byDay.get(date);
      return { date, positive: b?.positive ?? 0, neutral: b?.neutral ?? 0, mixed: b?.mixed ?? 0, negative: b?.negative ?? 0 };
    }),
    riskOverTime: days.map((date) => {
      const b = byDay.get(date);
      return { date, avgRisk: b && b.riskN > 0 ? Math.round(b.riskSum / b.riskN) : 0, maxRisk: b?.riskMax ?? 0 };
    }),
    reviewedCount,
    unreviewedCount: totalMentions - reviewedCount,
    mockAnalysisCount: mockCount,
    claudeAnalysisCount: claudeCount,
  };
}
