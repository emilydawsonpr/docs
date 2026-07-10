import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { renderReportHtml } from "@/lib/reports/render-html";
import { renderHtmlToPdf } from "@/lib/reports/export-pdf";

export async function GET(req: Request, { params }: { params: { projectId: string; reportId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const [report, project] = await Promise.all([
      prisma.report.findFirst({
        where: { id: params.reportId, projectId: params.projectId },
        include: { sections: { orderBy: { order: "asc" } } },
      }),
      prisma.project.findUnique({ where: { id: params.projectId } }),
    ]);
    if (!report || !project) throw new NotFoundError("Report not found");

    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "pdf";
    const html = renderReportHtml(report, { isDemo: project.isDemo });

    if (format === "html") {
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const pdf = await renderHtmlToPdf(html);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.title.replace(/[^a-z0-9]+/gi, "-")}.pdf"`,
      },
    });
  });
}
