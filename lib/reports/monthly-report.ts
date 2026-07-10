import { prisma } from "@/lib/db/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { computeDashboardMetrics } from "@/lib/analytics/dashboard-metrics";
import { computeShareOfVoice } from "@/lib/analytics/share-of-voice";

/** Monthly PR report: broader KPI rollup + top coverage + risks for a full calendar month. */
export async function generateMonthlyReport(projectId: string, forDate: Date = new Date(), generatedById?: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const monthStart = startOfMonth(forDate);
  const monthEnd = endOfMonth(forDate);
  const windowDays = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  const mentions = await prisma.mention.findMany({
    where: { projectId, isDemo: project.isDemo, publishedAt: { gte: monthStart, lte: monthEnd } },
    include: { analysisResult: true },
  });

  const metrics = await computeDashboardMetrics(projectId, project.isDemo, windowDays);
  const sov = await computeShareOfVoice(projectId, project.isDemo, windowDays);

  const topCoverage = [...mentions]
    .filter((m) => m.analysisResult)
    .sort((a, b) => (b.analysisResult?.relevanceScore ?? 0) - (a.analysisResult?.relevanceScore ?? 0))
    .slice(0, 10);

  const risks = mentions.filter((m) => (m.analysisResult?.riskScore ?? 0) >= 50);

  const themeFreq = new Map<string, number>();
  for (const m of mentions) for (const t of m.topicLabels) themeFreq.set(t, (themeFreq.get(t) ?? 0) + 1);
  const keyThemes = Array.from(themeFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  const report = await prisma.report.create({
    data: {
      projectId,
      templateType: "MONTHLY_PR",
      title: `Monthly PR Report — ${monthStart.toLocaleString("en-CA", { month: "long", year: "numeric" })}`,
      dateRangeStart: monthStart,
      dateRangeEnd: monthEnd,
      generatedById,
      status: "FINAL",
      sections: {
        create: [
          {
            sectionType: "kpi_summary",
            order: 0,
            content: {
              totalMentions: metrics.totalMentions,
              uniqueStories: metrics.uniqueStories,
              sentimentBreakdown: metrics.sentimentBreakdown,
              highRiskCount: metrics.highRiskCount,
              reviewedCount: metrics.reviewedCount,
            },
          },
          {
            sectionType: "share_of_voice",
            order: 1,
            content: { entries: sov.entries, methodology: sov.methodology },
          },
          { sectionType: "key_themes", order: 2, content: { themes: keyThemes } },
          {
            sectionType: "top_coverage",
            order: 3,
            content: {
              mentions: topCoverage.map((m) => ({
                mentionId: m.id,
                headline: m.headline,
                sourceName: m.sourceName,
                url: m.originalUrl,
                sentiment: m.analysisResult?.sentiment,
              })),
            },
          },
          {
            sectionType: "risks",
            order: 4,
            content: {
              mentions: risks.map((m) => ({ mentionId: m.id, headline: m.headline, url: m.originalUrl, riskScore: m.analysisResult?.riskScore })),
            },
          },
          {
            sectionType: "methodology_notes",
            order: 5,
            content: {
              note:
                "Sentiment, relevance, and risk are AI-assisted (mock or Claude engine, labelled per mention) and reviewable by an analyst. " +
                "Share of voice reflects stored mentions matched against configured brand/competitor names only. No reach or advertising-value " +
                "figures are included unless manually entered and explicitly labelled as estimated.",
            },
          },
        ] as any,
      },
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  return report;
}
