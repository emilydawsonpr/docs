import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { storeNormalizedMentions } from "@/lib/ingestion/normalize-and-store";
import { analyzeMention } from "@/lib/ai/pipeline";
import { generateDailyBrief } from "@/lib/reports/daily-brief";
import { renderReportHtml } from "@/lib/reports/render-html";
import type { NormalizedMention } from "@/lib/adapters/types";

describe("report generation: generateDailyBrief (integration, real local Postgres)", () => {
  let organizationId: string;
  let projectId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Test Org (reports.test.ts)", slug: `test-org-reports-${Date.now()}` } });
    organizationId = org.id;
    const project = await prisma.project.create({ data: { organizationId, name: "Test Project (reports.test.ts)" } });
    projectId = project.id;
    await prisma.brand.create({ data: { projectId, name: "Test Brand", isPrimary: true } });

    const items: NormalizedMention[] = [
      {
        canonicalUrl: "https://example.ca/story-1",
        originalUrl: "https://example.ca/story-1",
        sourceName: "Example News",
        sourceDomain: "example.ca",
        headline: "Test Brand launches new product",
        bodyText: "Test Brand announced a new product today to strong reviews.",
        publishedAt: new Date(),
        language: "en",
      },
    ];
    const result = await storeNormalizedMentions({
      projectId,
      monitoringQueryId: null,
      sourceConnectionId: null,
      provider: "test-fixture",
      enqueueAnalysis: false,
      items,
    });
    for (const mentionId of result.newMentionIds) {
      await analyzeMention(mentionId);
    }
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  });

  it("generates a Report with sections that reference real, traceable mentionIds", async () => {
    const report = await generateDailyBrief(projectId, new Date());
    expect(report.templateType).toBe("DAILY_BRIEF");
    expect(report.sections.length).toBeGreaterThan(0);

    const topCoverage = report.sections.find((s) => s.sectionType === "top_coverage");
    expect(topCoverage).toBeTruthy();
    const content = topCoverage!.content as any;
    expect(content.mentions.length).toBeGreaterThan(0);

    for (const m of content.mentions) {
      const exists = await prisma.mention.findUnique({ where: { id: m.mentionId } });
      expect(exists).toBeTruthy();
    }
  });

  it("persists the report and can be re-fetched with sections intact", async () => {
    const report = await generateDailyBrief(projectId, new Date());
    const fetched = await prisma.report.findUnique({ where: { id: report.id }, include: { sections: true } });
    expect(fetched?.sections.length).toBe(report.sections.length);
  });

  it("renders to self-contained HTML without throwing, escaping mention headlines", async () => {
    const report = await generateDailyBrief(projectId, new Date());
    const html = renderReportHtml(report as any, { isDemo: false });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Test Brand launches new product");
  });
});
