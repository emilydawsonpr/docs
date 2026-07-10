import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { storeNormalizedMentions } from "@/lib/ingestion/normalize-and-store";
import type { NormalizedMention } from "@/lib/adapters/types";

describe("ingestion: storeNormalizedMentions + dedup (integration, real local Postgres)", () => {
  let organizationId: string;
  let projectId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: "Test Org (ingestion.test.ts)", slug: `test-org-ingestion-${Date.now()}` },
    });
    organizationId = org.id;
    const project = await prisma.project.create({
      data: { organizationId, name: "Test Project (ingestion.test.ts)" },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  });

  const baseBody =
    "Northstar Coffee opens its newest cafe in downtown Toronto this week, the company announced Monday. " +
    "The Canadian-owned chain says the new location will create forty jobs and source beans exclusively " +
    "from fair-trade cooperatives in Latin America.";

  const items: NormalizedMention[] = [
    {
      canonicalUrl: "https://example-press.ca/northstar-toronto?utm_source=twitter",
      originalUrl: "https://example-press.ca/northstar-toronto?utm_source=twitter",
      sourceName: "Example Press",
      sourceDomain: "example-press.ca",
      headline: "Northstar Coffee opens its newest cafe in downtown Toronto",
      bodyText: baseBody,
      publishedAt: new Date(),
      language: "en",
    },
    {
      canonicalUrl: "https://example-wire.ca/syndicated/northstar-toronto",
      originalUrl: "https://example-wire.ca/syndicated/northstar-toronto",
      sourceName: "Example Wire",
      sourceDomain: "example-wire.ca",
      headline: "Northstar Coffee opens its newest cafe in downtown Toronto",
      bodyText: baseBody.replace("announced", "said").replace("in Latin America", "across Latin America"),
      publishedAt: new Date(),
      language: "en",
    },
    {
      canonicalUrl: "https://example-community.ca/unrelated-zoning-story",
      originalUrl: "https://example-community.ca/unrelated-zoning-story",
      sourceName: "Example Community News",
      sourceDomain: "example-community.ca",
      headline: "City council approves new zoning bylaw for suburban development",
      bodyText: "The city council voted Tuesday to approve a new zoning bylaw after months of public consultation.",
      publishedAt: new Date(),
      language: "en",
    },
  ];

  it("stores new normalized mentions and clusters the near-duplicate pair", async () => {
    const result = await storeNormalizedMentions({
      projectId,
      monitoringQueryId: null,
      sourceConnectionId: null,
      provider: "test-fixture",
      enqueueAnalysis: false,
      items,
    });

    expect(result.itemsFetched).toBe(3);
    expect(result.itemsNew).toBe(3);

    const mentions = await prisma.mention.findMany({ where: { projectId } });
    expect(mentions).toHaveLength(3);

    const clusterIds = new Set(mentions.map((m) => m.duplicateClusterId));
    expect(clusterIds.size).toBe(2); // the near-duplicate pair shares a cluster; the unrelated story gets its own

    const clusters = await prisma.duplicateCluster.findMany({ where: { projectId } });
    const pairCluster = clusters.find((c) => c.memberCount === 2);
    expect(pairCluster).toBeTruthy();
  });

  it("is idempotent: re-ingesting the same canonical URLs adds no new mentions", async () => {
    const result = await storeNormalizedMentions({
      projectId,
      monitoringQueryId: null,
      sourceConnectionId: null,
      provider: "test-fixture",
      enqueueAnalysis: false,
      items,
    });
    expect(result.itemsNew).toBe(0);

    const mentions = await prisma.mention.findMany({ where: { projectId } });
    expect(mentions).toHaveLength(3);
  });

  it("normalizes tracking params so the canonical URL matches a re-ingested variant", async () => {
    const variant: NormalizedMention = {
      ...items[0],
      canonicalUrl: "https://www.example-press.ca/northstar-toronto?utm_campaign=x&fbclid=abc",
      originalUrl: "https://www.example-press.ca/northstar-toronto?utm_campaign=x&fbclid=abc",
    };
    const result = await storeNormalizedMentions({
      projectId,
      monitoringQueryId: null,
      sourceConnectionId: null,
      provider: "test-fixture",
      enqueueAnalysis: false,
      items: [variant],
    });
    expect(result.itemsNew).toBe(0);
  });
});
