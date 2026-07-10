import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { testQuerySchema } from "@/lib/validation/query";
import { validateQuery, evaluateQuery } from "@/lib/query/boolean-parser";

const RECENT_WINDOW_DAYS = 30;
const RECENT_SCAN_LIMIT = 1000;
const SAMPLE_SIZE = 20;

export async function POST(req: Request, { params }: { params: { projectId: string; queryId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const existing = await prisma.monitoringQuery.findFirst({ where: { id: params.queryId, projectId: params.projectId } });
    if (!existing) throw new NotFoundError("Query not found");

    const body = await req.json().catch(() => ({}));
    const { expression: overrideExpression } = testQuerySchema.parse(body);
    const expression = overrideExpression ?? existing.booleanExpression;

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

    await prisma.monitoringQuery.update({
      where: { id: params.queryId },
      data: { lastTestedAt: new Date(), lastTestResultCount: matches.length },
    });

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
