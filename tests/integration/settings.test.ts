import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("settings data model: brands, competitors, key messages (integration, real local Postgres)", () => {
  let organizationId: string;
  let projectId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Test Org (settings.test.ts)", slug: `test-org-settings-${Date.now()}` } });
    organizationId = org.id;
    const project = await prisma.project.create({ data: { organizationId, name: "Test Project (settings.test.ts)" } });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  });

  it("adding a competitor creates a Brand (isPrimary=false) plus a Competitor row atomically", async () => {
    const existingCount = await prisma.competitor.count({ where: { projectId } });
    const { brand, competitor } = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({ data: { projectId, name: "Second Cup", aliases: ["2nd Cup"], isPrimary: false } });
      const competitor = await tx.competitor.create({ data: { projectId, brandId: brand.id, displayOrder: existingCount } });
      return { brand, competitor };
    });

    expect(brand.isPrimary).toBe(false);
    expect(competitor.brandId).toBe(brand.id);
    expect(competitor.displayOrder).toBe(existingCount);
  });

  it("deleting a competitor's Brand row cascades to remove its Competitor row", async () => {
    const brand = await prisma.brand.create({ data: { projectId, name: "Temp Competitor", isPrimary: false } });
    await prisma.competitor.create({ data: { projectId, brandId: brand.id, displayOrder: 99 } });

    await prisma.brand.delete({ where: { id: brand.id } });

    const orphanedCompetitor = await prisma.competitor.findFirst({ where: { brandId: brand.id } });
    expect(orphanedCompetitor).toBeNull();
  });

  it("deleting a KeyMessage cascades to remove its MessageMatch rows", async () => {
    const brand = await prisma.brand.create({ data: { projectId, name: "Primary Brand", isPrimary: true } });
    const mention = await prisma.mention.create({
      data: {
        projectId,
        canonicalUrl: `https://example.ca/settings-test-${Date.now()}`,
        originalUrl: `https://example.ca/settings-test-${Date.now()}`,
        sourceName: "Example News",
        sourceDomain: "example.ca",
        headline: "Primary Brand launches new product",
        publishedAt: new Date(),
        language: "en",
        provider: "test-fixture",
      },
    });
    const keyMessage = await prisma.keyMessage.create({ data: { projectId, text: "We source 100% Canadian ingredients." } });
    await prisma.messageMatch.create({
      data: { mentionId: mention.id, keyMessageId: keyMessage.id, matchStrength: "FULL", confidence: 0.9 },
    });

    await prisma.keyMessage.delete({ where: { id: keyMessage.id } });

    const orphanedMatch = await prisma.messageMatch.findFirst({ where: { keyMessageId: keyMessage.id } });
    expect(orphanedMatch).toBeNull();
    // Cleanup for this test's own rows (brand/mention aren't touched by other tests here).
    await prisma.mention.delete({ where: { id: mention.id } }).catch(() => {});
    await prisma.brand.delete({ where: { id: brand.id } }).catch(() => {});
  });
});
