import type { Prisma, PrismaClient } from "@prisma/client";
import { canonicalizeUrl, normalizeTitle } from "./canonicalize";
import { simhash64, hammingDistance, fingerprintToHex, hexToFingerprint } from "./fingerprint";

const CLUSTER_WINDOW_HOURS = 72;
// Empirically calibrated (see tests/unit/dedup.test.ts): near-duplicate wire
// copy with light rewording lands around 8-12 bits apart out of 64;
// unrelated articles land 25-35+ bits apart. 12 gives clear separation.
const SIMHASH_HAMMING_THRESHOLD = 12;
const CANDIDATE_SCAN_LIMIT = 300;

export interface MentionForClustering {
  id: string;
  projectId: string;
  canonicalUrl: string;
  headline: string;
  bodyText: string | null;
  publishedAt: Date;
  coverageType: string | null;
}

export interface ClusterDecision {
  duplicateClusterId: string;
  isNewCluster: boolean;
  matchedOn: "canonical_url" | "title" | "simhash" | "none";
  fingerprintHex: string;
}

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Decides which DuplicateCluster a newly-ingested mention belongs to (or
 * creates a new one), and updates cluster bookkeeping (member count,
 * syndication flag). Must run inside the same transaction the Mention row
 * was created in, after the mention already has an id.
 */
export async function clusterMention(tx: Tx, mention: MentionForClustering): Promise<ClusterDecision> {
  const canonicalUrl = canonicalizeUrl(mention.canonicalUrl);
  const normalizedTitle = normalizeTitle(mention.headline);
  const fingerprint = simhash64(`${mention.headline}\n${(mention.bodyText ?? "").slice(0, 500)}`);
  const fingerprintHex = fingerprintToHex(fingerprint);

  const windowStart = new Date(mention.publishedAt.getTime() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(mention.publishedAt.getTime() + CLUSTER_WINDOW_HOURS * 60 * 60 * 1000);

  const candidates = await tx.mention.findMany({
    where: {
      projectId: mention.projectId,
      id: { not: mention.id },
      publishedAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { publishedAt: "desc" },
    take: CANDIDATE_SCAN_LIMIT,
    select: { id: true, canonicalUrl: true, headline: true, duplicateClusterId: true, coverageType: true },
  });

  let matchedMention: (typeof candidates)[number] | undefined;
  let matchedOn: ClusterDecision["matchedOn"] = "none";

  matchedMention = candidates.find((c) => canonicalizeUrl(c.canonicalUrl) === canonicalUrl);
  if (matchedMention) matchedOn = "canonical_url";

  if (!matchedMention) {
    matchedMention = candidates.find((c) => normalizeTitle(c.headline) === normalizedTitle && normalizedTitle.length > 0);
    if (matchedMention) matchedOn = "title";
  }

  if (!matchedMention) {
    for (const candidate of candidates) {
      if (!candidate.duplicateClusterId) continue;
      const cluster = await tx.duplicateCluster.findUnique({ where: { id: candidate.duplicateClusterId } });
      if (!cluster) continue;
      const distance = hammingDistance(fingerprint, hexToFingerprint(cluster.fingerprint));
      if (distance <= SIMHASH_HAMMING_THRESHOLD) {
        matchedMention = candidate;
        matchedOn = "simhash";
        break;
      }
    }
  }

  if (matchedMention?.duplicateClusterId) {
    const cluster = await tx.duplicateCluster.findUniqueOrThrow({ where: { id: matchedMention.duplicateClusterId } });
    const isSyndicated = cluster.isSyndicated || (mention.coverageType ?? null) !== (matchedMention.coverageType ?? null);
    await tx.duplicateCluster.update({
      where: { id: cluster.id },
      data: { memberCount: { increment: 1 }, isSyndicated },
    });
    return { duplicateClusterId: cluster.id, isNewCluster: false, matchedOn, fingerprintHex };
  }

  const newCluster = await tx.duplicateCluster.create({
    data: {
      projectId: mention.projectId,
      canonicalMentionId: mention.id,
      fingerprint: fingerprintHex,
      memberCount: 1,
    },
  });

  return { duplicateClusterId: newCluster.id, isNewCluster: true, matchedOn: "none", fingerprintHex };
}
