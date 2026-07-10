import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess } from "@/lib/rbac/permissions";
import { z } from "zod";
import { validateQuery, evaluateQuery } from "@/lib/query/boolean-parser";

const RECENT_WINDOW_DAYS = 30;
const RECENT_SCAN_LIMIT = 1000;
const SAMPLE_SIZE = 20;

const bodySchema = z.object({ expression: z.string().min(1).max(4000) });

/**
 * Tests an arbitrary, not-yet-saved Boolean expression against recent
 * mentions for this project — used by the query builder before a query has
 * been persisted (and therefore has no queryId yet).
 */
export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const { expression } = bodySchema.parse(await req.json().catch(() => ({})));
    const brand = await prisma.brand.findFirst({ where: { projectId: params.projectId, isPrimary: true } });
    const validation = validateQuery(expression, { brandAliases: brand?.aliases });

    if (!validation.valid || !validation.ast) {
      return NextResponse.json({ valid: false, errors: validation.errors, warnings: validation.warnings });
    }

    const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentMentions = await prisma.mention.findMany({
      where: { projectId: params.projectId, publishedAt: { gte: since }, isDemo: false },
      orderBy: { publishedAt: "desc" },
      take: RECENT_SCAN_LIMIT,
      select: { id: true, headline: true, excerpt: true, bodyText: true, sourceDomain: true, publishedAt: true },
    });

    const matches = recentMentions.filter((m) =>
      evaluateQuery(validation.ast!, `${m.headline}\n${m.excerpt ?? ""}\n${m.bodyText ?? ""}`)
    );

    return NextResponse.json({
      valid: true,
      warnings: validation.warnings,
      scannedCount: recentMentions.length,
      matchCount: matches.length,
      note:
        recentMentions.length === 0
          ? `No mentions have been ingested for this project in the last ${RECENT_WINDOW_DAYS} days yet — this validates the query's syntax only. Connect a source to see live match volume.`
          : undefined,
      sample: matches.slice(0, SAMPLE_SIZE).map((m) => ({
        id: m.id,
        headline: m.headline,
        sourceDomain: m.sourceDomain,
        publishedAt: m.publishedAt,
      })),
    });
  });
}
