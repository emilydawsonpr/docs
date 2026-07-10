import { prisma } from "@/lib/db/prisma";
import { subDays } from "date-fns";

export interface ShareOfVoiceEntry {
  brandId: string;
  brandName: string;
  isPrimary: boolean;
  totalPlacements: number;
  uniqueStories: number;
  positivePlacements: number;
  totalPlacementSharePct: number;
  uniqueStoryPlacementSharePct: number;
  positiveSharePct: number;
}

export interface ShareOfVoiceResult {
  windowDays: number;
  entries: ShareOfVoiceEntry[];
  methodology: string;
}

/**
 * Share of voice = brand mentions ÷ total mentions across the competitive
 * set × 100. A mention is attributed to a brand when Mention.brandsMentioned
 * (set by AI analysis, or matched via alias text search as a fallback)
 * includes that brand's name — so this reflects stored analysis, not a
 * separate estimate.
 */
export async function computeShareOfVoice(projectId: string, isDemo: boolean, windowDays = 30): Promise<ShareOfVoiceResult> {
  const since = subDays(new Date(), windowDays);
  const brands = await prisma.brand.findMany({ where: { projectId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });

  if (brands.length === 0) {
    return { windowDays, entries: [], methodology: "No brands/competitors configured for this project yet." };
  }

  const mentions = await prisma.mention.findMany({
    where: { projectId, isDemo, publishedAt: { gte: since } },
    select: { id: true, headline: true, excerpt: true, bodyText: true, duplicateClusterId: true, analysisResult: { select: { sentiment: true } } },
  });

  const entries: ShareOfVoiceEntry[] = brands.map((brand) => {
    const names = [brand.name, ...brand.aliases].map((n) => n.toLowerCase()).filter(Boolean);
    const matched = mentions.filter((m) => {
      const text = `${m.headline}\n${m.excerpt ?? ""}\n${m.bodyText ?? ""}`.toLowerCase();
      return names.some((n) => text.includes(n));
    });
    const uniqueStories = new Set(matched.map((m) => m.duplicateClusterId ?? m.id)).size;
    const positivePlacements = matched.filter((m) => m.analysisResult?.sentiment === "POSITIVE").length;

    return {
      brandId: brand.id,
      brandName: brand.name,
      isPrimary: brand.isPrimary,
      totalPlacements: matched.length,
      uniqueStories,
      positivePlacements,
      totalPlacementSharePct: 0,
      uniqueStoryPlacementSharePct: 0,
      positiveSharePct: 0,
    };
  });

  const totalPlacementsAcrossSet = entries.reduce((sum, e) => sum + e.totalPlacements, 0);
  const totalUniqueAcrossSet = entries.reduce((sum, e) => sum + e.uniqueStories, 0);
  const totalPositiveAcrossSet = entries.reduce((sum, e) => sum + e.positivePlacements, 0);

  for (const e of entries) {
    e.totalPlacementSharePct = totalPlacementsAcrossSet > 0 ? (e.totalPlacements / totalPlacementsAcrossSet) * 100 : 0;
    e.uniqueStoryPlacementSharePct = totalUniqueAcrossSet > 0 ? (e.uniqueStories / totalUniqueAcrossSet) * 100 : 0;
    e.positiveSharePct = totalPositiveAcrossSet > 0 ? (e.positivePlacements / totalPositiveAcrossSet) * 100 : 0;
  }

  return {
    windowDays,
    entries,
    methodology:
      "Share of voice = this brand's placements ÷ total placements across your brand and configured competitors, " +
      "for mentions published in the selected window. Total-placement share counts every matching mention; " +
      "unique-story share counts distinct duplicate/syndication clusters once. Positive share restricts both the " +
      "numerator and denominator to mentions with AI- or analyst-confirmed positive sentiment.",
  };
}
