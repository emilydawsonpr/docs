import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess } from "@/lib/rbac/permissions";
import { mentionsToCsv, type MentionCsvRow } from "@/lib/reports/export-csv";
import { mentionsToXlsx } from "@/lib/reports/export-xlsx";

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const url = new URL(req.url);
    const isDemo = url.searchParams.get("isDemo") === "1";
    const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

    const mentions = await prisma.mention.findMany({
      where: { projectId: params.projectId, isDemo },
      orderBy: { publishedAt: "desc" },
      take: 5000,
      include: { analysisResult: true },
    });

    const rows: MentionCsvRow[] = mentions.map((m) => ({
      headline: m.headline,
      sourceName: m.sourceName,
      sourceDomain: m.sourceDomain,
      originalUrl: m.originalUrl,
      publishedAt: m.publishedAt.toISOString(),
      language: m.language,
      sentiment: m.analysisResult?.sentiment,
      relevanceLabel: m.analysisResult?.relevanceLabel,
      riskScore: m.analysisResult?.riskScore,
      coverageType: m.coverageType ?? undefined,
      reviewStatus: m.reviewStatus,
      placementType: m.placementType,
      isDemo: m.isDemo,
    }));

    if (format === "xlsx") {
      const buffer = await mentionsToXlsx(rows);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="signalwatch-mentions-${params.projectId}.xlsx"`,
        },
      });
    }

    const csv = mentionsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="signalwatch-mentions-${params.projectId}.csv"`,
      },
    });
  });
}
