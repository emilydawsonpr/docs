import { prisma } from "@/lib/db/prisma";
import { subDays, subHours } from "date-fns";
import { storeNormalizedMentions } from "@/lib/ingestion/normalize-and-store";
import { analyzeMention } from "@/lib/ai/pipeline";
import type { NormalizedMention } from "@/lib/adapters/types";

/**
 * Seeds a fully self-contained, clearly-labelled (Project.isDemo = true)
 * demonstration workspace for a fictional Canadian consumer brand, "Aurora
 * Botanicals." Uses the real ingestion (storeNormalizedMentions) and AI
 * analysis (analyzeMention, run inline/synchronously rather than via the
 * job queue so seeding is deterministic and doesn't depend on a running
 * worker process) pipelines — this is not special-cased fake data, it is
 * synthetic *input* run through the same code paths real coverage uses.
 */
export async function seedDemoWorkspace(organizationId: string): Promise<string> {
  const existing = await prisma.project.findFirst({ where: { organizationId, isDemo: true } });
  if (existing) return existing.id;

  const now = new Date();

  const project = await prisma.project.create({
    data: {
      organizationId,
      name: "Aurora Botanicals — Demo Workspace",
      description: "Synthetic demonstration data for a fictional Canadian skincare brand. Never mixed with live projects.",
      isDemo: true,
      timezone: "America/Toronto",
      languages: ["en", "fr"],
      regions: ["Toronto", "Vancouver", "Montréal", "Canada"],
      focusCities: ["Toronto", "Vancouver", "Montréal"],
      crisisTerms: ["recall", "lawsuit", "contamination", "allergic reaction"],
    },
  });

  const brand = await prisma.brand.create({
    data: {
      projectId: project.id,
      name: "Aurora Botanicals",
      aliases: ["Aurora Botanicals Inc.", "Aurora Skincare"],
      websites: ["https://aurorabotanicals.example"],
      handles: { handles: ["@aurorabotanicals"] },
      executives: { executives: ["Priya Chandran, CEO"] },
      products: ["Aurora Renewal Serum", "Aurora Botanical Cleanser"],
      isPrimary: true,
    },
  });

  const competitorNames = ["Boreal Beauty", "Glacier & Co."];
  for (const [i, name] of competitorNames.entries()) {
    const competitorBrand = await prisma.brand.create({ data: { projectId: project.id, name, isPrimary: false } });
    await prisma.competitor.create({ data: { projectId: project.id, brandId: competitorBrand.id, displayOrder: i } });
  }

  const keyMessages = await Promise.all([
    prisma.keyMessage.create({
      data: { projectId: project.id, text: "Aurora Botanicals sources 100% of its botanical ingredients from Canadian growers." },
    }),
    prisma.keyMessage.create({
      data: { projectId: project.id, text: "Aurora Botanicals is committed to cruelty-free, carbon-neutral production by 2027." },
    }),
  ]);

  const monitoringQuery = await prisma.monitoringQuery.create({
    data: {
      projectId: project.id,
      name: "Aurora Botanicals — brand monitoring",
      mode: "EXPERT",
      booleanExpression: '("Aurora Botanicals" OR "Aurora Skincare") AND (Canada OR Toronto OR Vancouver OR Montréal)',
      isActive: true,
    },
  });

  const mention = (over: Partial<NormalizedMention> & { headline: string; canonicalUrl: string; sourceDomain: string; sourceName: string; publishedAt: Date }): NormalizedMention => ({
    originalUrl: over.canonicalUrl,
    language: "en",
    ...over,
  });

  const items: NormalizedMention[] = [
    mention({
      headline: "Aurora Botanicals wins Canadian Beauty Excellence Award",
      canonicalUrl: "https://dailynewswire.example.ca/aurora-beauty-award",
      sourceDomain: "dailynewswire.example.ca",
      sourceName: "Daily Newswire",
      bodyText:
        "Aurora Botanicals took home top honours at this year's Canadian Beauty Excellence Awards, recognized for its Renewal Serum and commitment to Canadian-grown botanical ingredients. The award recognizes strong growth and innovative formulation.",
      publishedAt: subDays(now, 18),
    }),
    mention({
      headline: "Aurora Botanicals remporte un prix d'excellence en beauté canadienne",
      canonicalUrl: "https://lepresseaffaires.example.ca/aurora-prix",
      sourceDomain: "lepresseaffaires.example.ca",
      sourceName: "La Presse Affaires",
      bodyText:
        "Aurora Botanicals a reçu le prix d'excellence en beauté canadienne pour son sérum Renewal, soulignant son succès et sa croissance dans le secteur des cosmétiques durables.",
      publishedAt: subDays(now, 17),
      language: "fr",
      country: "CA",
    }),
    mention({
      headline: "Aurora Botanicals opens new Vancouver flagship store",
      canonicalUrl: "https://westcoastretail.example.ca/aurora-vancouver",
      sourceDomain: "westcoastretail.example.ca",
      sourceName: "West Coast Retail",
      bodyText: "The Toronto-based skincare company Aurora Botanicals has opened its first Vancouver retail location, part of a national expansion plan.",
      publishedAt: subDays(now, 15),
      country: "CA",
    }),
    mention({
      headline: "Aurora Botanicals ouvre une boutique à Montréal",
      canonicalUrl: "https://montrealcommerce.example.ca/aurora-montreal",
      sourceDomain: "montrealcommerce.example.ca",
      sourceName: "Montréal Commerce",
      bodyText: "La marque de soins de la peau Aurora Botanicals a ouvert une nouvelle boutique à Montréal cette semaine.",
      publishedAt: subDays(now, 14),
      language: "fr",
      country: "CA",
    }),
    // Syndicated duplicate pair — same underlying story, two outlets.
    mention({
      headline: "Aurora Botanicals launches carbon-neutral packaging initiative",
      canonicalUrl: "https://greenbiz.example.ca/aurora-carbon-neutral",
      sourceDomain: "greenbiz.example.ca",
      sourceName: "GreenBiz Canada",
      bodyText:
        "Aurora Botanicals announced Tuesday it will transition to fully carbon-neutral packaging by 2027, part of its broader sustainability commitment across its Canadian supply chain.",
      publishedAt: subDays(now, 12),
    }),
    mention({
      headline: "Aurora Botanicals launches carbon-neutral packaging initiative",
      canonicalUrl: "https://canadabusinesswire.example.ca/syndicated/aurora-carbon-neutral",
      sourceDomain: "canadabusinesswire.example.ca",
      sourceName: "Canada Business Wire",
      bodyText:
        "Aurora Botanicals announced Tuesday it will transition to fully carbon-neutral packaging by 2027, part of its broader sustainability commitment across its Canadian supply chain. (Syndicated wire pickup.)",
      publishedAt: subHours(subDays(now, 12), 2),
    }),
    mention({
      headline: "Roundup: five Canadian beauty brands to watch this year",
      canonicalUrl: "https://beautyinsider.example.ca/roundup-canadian-brands",
      sourceDomain: "beautyinsider.example.ca",
      sourceName: "Beauty Insider",
      bodyText: "Among the brands featured in this roundup is Aurora Botanicals, alongside Boreal Beauty and several international names.",
      publishedAt: subDays(now, 10),
    }),
    mention({
      headline: "Boreal Beauty announces new eco-packaging line",
      canonicalUrl: "https://greenbiz.example.ca/boreal-eco-packaging",
      sourceDomain: "greenbiz.example.ca",
      sourceName: "GreenBiz Canada",
      bodyText: "Competitor Boreal Beauty unveiled its own eco-friendly packaging line this week, intensifying competition in the sustainable beauty space.",
      publishedAt: subDays(now, 9),
    }),
    mention({
      headline: "Glacier & Co. expands into the Canadian market",
      canonicalUrl: "https://retaildivecanada.example.ca/glacier-expansion",
      sourceDomain: "retaildivecanada.example.ca",
      sourceName: "Retail Dive Canada",
      bodyText: "Glacier & Co., a Nordic skincare brand, announced its entry into the Canadian market this week with a Toronto pop-up shop.",
      publishedAt: subDays(now, 8),
    }),
    mention({
      headline: "Some customers report mild irritation from a new Aurora Botanicals formula",
      canonicalUrl: "https://consumerwatch.example.ca/aurora-mixed-reviews",
      sourceDomain: "consumerwatch.example.ca",
      sourceName: "Consumer Watch",
      bodyText:
        "While many reviewers praised the new Aurora Renewal Serum formula, a handful of customers reported mild skin irritation. The company says it takes all feedback seriously and is monitoring the situation.",
      publishedAt: subDays(now, 6),
    }),
    mention({
      headline: "Opinion: why Canadian beauty brands need more transparency",
      canonicalUrl: "https://industryopinion.example.ca/beauty-transparency",
      sourceDomain: "industryopinion.example.ca",
      sourceName: "Industry Opinion",
      bodyText: "This opinion piece briefly cites Aurora Botanicals as one example of a brand publishing detailed ingredient sourcing information, among several other Canadian companies mentioned in passing.",
      publishedAt: subDays(now, 5),
    }),
    // High-risk mention.
    mention({
      headline: "Aurora Botanicals faces allergic reaction complaints, recall under review",
      canonicalUrl: "https://healthwatchcanada.example.ca/aurora-recall-review",
      sourceDomain: "healthwatchcanada.example.ca",
      sourceName: "Health Watch Canada",
      bodyText:
        "Health Watch Canada has learned that Aurora Botanicals is reviewing a possible recall of its Renewal Serum after several consumers reported allergic reaction symptoms. The company said it is cooperating with health authorities and has not yet confirmed a recall.",
      publishedAt: subDays(now, 3),
    }),
  ];

  // Volume spike: a cluster of same-day coverage on the most recent day,
  // against a low daily baseline in the preceding data above, so the
  // dashboard's rolling-average/z-score spike detector flags it live.
  const spikeHeadlines = [
    "Aurora Botanicals recall confirmed for Renewal Serum batch",
    "Health Canada opens inquiry into Aurora Botanicals recall",
    "Aurora Botanicals stock drops on recall news",
    "What the Aurora Botanicals recall means for consumers",
    "Aurora Botanicals CEO addresses recall in statement",
    "Retailers pull Aurora Botanicals Renewal Serum from shelves",
  ];
  for (const [i, headline] of spikeHeadlines.entries()) {
    items.push(
      mention({
        headline,
        canonicalUrl: `https://newswire.example.ca/aurora-recall-followup-${i}`,
        sourceDomain: "newswire.example.ca",
        sourceName: "Canada Newswire",
        bodyText: `${headline}. Aurora Botanicals confirmed a recall of a single production batch of its Renewal Serum after allergic reaction reports, and said affected customers will receive a full refund.`,
        publishedAt: subHours(now, i + 1),
      })
    );
  }

  const result = await storeNormalizedMentions({
    projectId: project.id,
    monitoringQueryId: monitoringQuery.id,
    sourceConnectionId: null,
    provider: "demo-seed",
    items,
    matchedQuery: monitoringQuery.booleanExpression,
    enqueueAnalysis: false,
  });

  for (const mentionId of result.newMentionIds) {
    await analyzeMention(mentionId);
  }
  await prisma.mention.updateMany({ where: { projectId: project.id }, data: { isDemo: true } });

  // One corrected AI classification, with an audit trail entry.
  const correctedTarget = await prisma.mention.findFirst({
    where: { projectId: project.id, headline: { contains: "carbon-neutral packaging initiative" }, canonicalUrl: { contains: "greenbiz" } },
    include: { analysisResult: true },
  });
  if (correctedTarget?.analysisResult) {
    const previousSentiment = correctedTarget.analysisResult.sentiment;
    await prisma.analysisResult.update({
      where: { mentionId: correctedTarget.id },
      data: { sentiment: "POSITIVE", correctedAt: new Date() },
    });
    await prisma.mention.update({ where: { id: correctedTarget.id }, data: { reviewStatus: "APPROVED", analystNotes: "Sustainability commitments are a clear positive for the brand narrative — corrected from neutral." } });
    await prisma.auditLog.create({
      data: {
        projectId: project.id,
        entityType: "Mention",
        entityId: correctedTarget.id,
        action: "CORRECT",
        previousValue: { sentiment: previousSentiment },
        newValue: { sentiment: "POSITIVE" },
        reason: "Demo: analyst correction example — sustainability news under-scored as neutral by AI.",
      },
    });
  }

  return project.id;
}
