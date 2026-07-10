import { prisma } from "@/lib/db/prisma";
import { canonicalizeUrl } from "@/lib/dedup/canonicalize";
import { clusterMention } from "@/lib/dedup/cluster";
import { analysisQueue } from "@/jobs/queue";
import type { NormalizedMention } from "@/lib/adapters/types";
import type { SourceType } from "@prisma/client";

export interface StoreResult {
  itemsFetched: number;
  itemsNew: number;
  newMentionIds: string[];
}

/**
 * Idempotently stores normalized adapter output as Mention rows: skips items
 * whose canonical URL was already ingested for this project (so polling the
 * same feed repeatedly does not duplicate mentions), then runs the dedup
 * clustering pipeline on each genuinely new mention.
 */
export async function storeNormalizedMentions(params: {
  projectId: string;
  monitoringQueryId: string | null;
  sourceConnectionId: string | null;
  provider: string;
  sourceType?: SourceType;
  items: NormalizedMention[];
  matchedQuery?: string;
  /** Set false in tests to avoid enqueuing real background jobs for rows the test will delete. */
  enqueueAnalysis?: boolean;
}): Promise<StoreResult> {
  const { projectId, monitoringQueryId, sourceConnectionId, provider, items, matchedQuery, enqueueAnalysis = true } = params;
  const newMentionIds: string[] = [];

  const canonicalUrls = items.map((item) => canonicalizeUrl(item.canonicalUrl));
  const existingRows = await prisma.mention.findMany({
    where: { projectId, canonicalUrl: { in: canonicalUrls } },
    select: { canonicalUrl: true },
  });
  // Seeded with already-stored URLs, then grown as we go so duplicates
  // *within* the same incoming batch are also skipped, not just ones
  // already in the database.
  const seenCanonicalUrls = new Set(existingRows.map((r) => r.canonicalUrl));

  for (const [index, item] of items.entries()) {
    const canonicalUrl = canonicalUrls[index];
    if (seenCanonicalUrls.has(canonicalUrl)) continue;
    seenCanonicalUrls.add(canonicalUrl);

    const mentionId = await prisma.$transaction(async (tx) => {
      const mention = await tx.mention.create({
        data: {
          projectId,
          monitoringQueryId: monitoringQueryId ?? undefined,
          sourceConnectionId: sourceConnectionId ?? undefined,
          provider,
          providerRecordId: item.providerRecordId,
          canonicalUrl,
          originalUrl: item.originalUrl,
          sourceName: item.sourceName,
          sourceDomain: item.sourceDomain,
          sourceType: params.sourceType ?? "UNKNOWN",
          headline: item.headline,
          excerpt: item.excerpt,
          bodyText: item.bodyText,
          author: item.author,
          publishedAt: item.publishedAt,
          language: item.language,
          country: item.country,
          imageUrl: item.imageUrl,
          matchedQuery,
          rawProviderMetadata: item.rawProviderMetadata as any,
        },
      });

      const decision = await clusterMention(tx, {
        id: mention.id,
        projectId,
        canonicalUrl: mention.canonicalUrl,
        headline: mention.headline,
        bodyText: mention.bodyText,
        publishedAt: mention.publishedAt,
        coverageType: mention.coverageType,
      });

      await tx.mention.update({
        where: { id: mention.id },
        data: { duplicateClusterId: decision.duplicateClusterId },
      });

      return mention.id;
    });

    newMentionIds.push(mentionId);
  }

  if (newMentionIds.length > 0 && enqueueAnalysis) {
    try {
      await analysisQueue().addBulk(
        newMentionIds.map((mentionId) => ({
          name: "analyze",
          data: { mentionId },
          opts: { attempts: 1, jobId: `analyze-${mentionId}` },
        }))
      );
    } catch (err) {
      // Ingestion must not fail because the job queue/Redis is unreachable —
      // analysis can be triggered later (e.g. manually, or on next worker start).
      // eslint-disable-next-line no-console
      console.error("Failed to enqueue AI analysis jobs (mentions were still stored):", err instanceof Error ? err.message : err);
    }
  }

  return { itemsFetched: items.length, itemsNew: newMentionIds.length, newMentionIds };
}
