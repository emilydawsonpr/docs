import { prisma } from "@/lib/db/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { computeDashboardMetrics } from "@/lib/analytics/dashboard-metrics";
import { computeShareOfVoice } from "@/lib/analytics/share-of-voice";
import { detectLatestSpike } from "@/lib/analytics/spike-detection";

/**
 * Builds a Daily Brief Report + ReportSections for one calendar day. Every
 * claim in the brief is grounded in stored mentionIds referenced from the
 * section content — nothing here is generated prose without a traceable
 * source row.
 */
export async function generateDailyBrief(projectId: string, forDate: Date = new Date(), generatedById?: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const dayStart = startOfDay(forDate);
  const dayEnd = endOfDay(forDate);

  const mentions = await prisma.mention.findMany({
    where: { projectId, isDemo: project.isDemo, publishedAt: { gte: dayStart, lte: dayEnd } },
    include: { analysisResult: true },
    orderBy: { publishedAt: "desc" },
  });

  const metrics = await computeDashboardMetrics(projectId, project.isDemo, 30);
  const spike = detectLatestSpike(metrics.mentionsOverTime);
  const sov = await computeShareOfVoice(projectId, project.isDemo, 30);

  const topCoverage = [...mentions]
    .filter((m) => m.analysisResult)
    .sort((a, b) => (b.analysisResult?.relevanceScore ?? 0) - (a.analysisResult?.relevanceScore ?? 0))
    .slice(0, 5);

  const risks = mentions.filter((m) => (m.analysisResult?.riskScore ?? 0) >= 50);

  const themeFreq = new Map<string, number>();
  for (const m of mentions) for (const t of m.topicLabels) themeFreq.set(t, (themeFreq.get(t) ?? 0) + 1);
  const emergingThemes = Array.from(themeFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  const recommendedReview = mentions.filter(
    (m) => m.reviewStatus === "UNREVIEWED" && ((m.analysisResult?.riskScore ?? 0) >= 25 || m.analysisResult?.relevanceLabel === "RELEVANT")
  );

  const messagePullThrough = await prisma.messageMatch.count({
    where: { mention: { projectId, isDemo: project.isDemo, publishedAt: { gte: dayStart, lte: dayEnd } }, matchStrength: { in: ["FULL", "PARTIAL"] } },
  });

  const report = await prisma.report.create({
    data: {
      projectId,
      templateType: "DAILY_BRIEF",
      title: `Daily Media Brief — ${dayStart.toISOString().slice(0, 10)}`,
      dateRangeStart: dayStart,
      dateRangeEnd: dayEnd,
      generatedById,
      status: "FINAL",
      sections: {
        create: [
          {
            sectionType: "volume_baseline",
            order: 0,
            content: {
              totalToday: mentions.length,
              expectedBaseline: spike?.expected ?? null,
              percentChange: spike?.percentChange ?? null,
              isSpike: spike?.isSpike ?? false,
              fact: `${mentions.length} mention(s) published today` + (spike ? `, vs. an expected ${spike.expected} (14-day rolling average)` : ""),
            },
          },
          {
            sectionType: "top_coverage",
            order: 1,
            content: {
              mentions: topCoverage.map((m) => ({
                mentionId: m.id,
                headline: m.headline,
                sourceName: m.sourceName,
                url: m.originalUrl,
                sentiment: m.analysisResult?.sentiment,
                relevanceLabel: m.analysisResult?.relevanceLabel,
              })),
            },
          },
          { sectionType: "emerging_themes", order: 2, content: { themes: emergingThemes } },
          {
            sectionType: "risks",
            order: 3,
            content: {
              mentions: risks.map((m) => ({
                mentionId: m.id,
                headline: m.headline,
                url: m.originalUrl,
                riskScore: m.analysisResult?.riskScore,
                riskReasons: m.analysisResult?.riskReasons,
              })),
            },
          },
          {
            sectionType: "competitor_activity",
            order: 4,
            content: { entries: sov.entries, methodology: sov.methodology },
          },
          {
            sectionType: "message_pull_through",
            order: 5,
            content: { matchedMentionsCount: messagePullThrough },
          },
          {
            sectionType: "recommended_review",
            order: 6,
            content: {
              mentions: recommendedReview.map((m) => ({ mentionId: m.id, headline: m.headline, url: m.originalUrl })),
            },
          },
        ] as any,
      },
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  return report;
}
