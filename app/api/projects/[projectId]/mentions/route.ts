import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess } from "@/lib/rbac/permissions";
import { mentionFilterSchema } from "@/lib/validation/mention";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const url = new URL(req.url);
    const filters = mentionFilterSchema.parse(Object.fromEntries(url.searchParams));

    const where: Prisma.MentionWhereInput = {
      projectId: params.projectId,
      ...(filters.isDemo !== undefined ? { isDemo: filters.isDemo } : {}),
      ...(filters.sourceDomain ? { sourceDomain: filters.sourceDomain } : {}),
      ...(filters.language ? { language: filters.language } : {}),
      ...(filters.reviewStatus?.length ? { reviewStatus: { in: filters.reviewStatus } } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            publishedAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { headline: { contains: filters.q, mode: "insensitive" } },
              { excerpt: { contains: filters.q, mode: "insensitive" } },
              { bodyText: { contains: filters.q, mode: "insensitive" } },
              { sourceName: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.sentiment?.length ? { analysisResult: { sentiment: { in: filters.sentiment } } } : {}),
      ...(filters.minRisk !== undefined ? { analysisResult: { riskScore: { gte: filters.minRisk } } } : {}),
    };

    const orderBy: Prisma.MentionOrderByWithRelationInput =
      filters.sortBy === "publishedAt"
        ? { publishedAt: filters.sortDir }
        : filters.sortBy === "riskScore"
          ? { analysisResult: { riskScore: filters.sortDir } }
          : { analysisResult: { relevanceScore: filters.sortDir } };

    const [total, mentions] = await Promise.all([
      prisma.mention.count({ where }),
      prisma.mention.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          analysisResult: true,
          mentionTags: { include: { tag: true } },
          duplicateCluster: { select: { memberCount: true, isSyndicated: true, canonicalMentionId: true } },
        },
      }),
    ]);

    return NextResponse.json({ mentions, total, page: filters.page, pageSize: filters.pageSize });
  });
}
