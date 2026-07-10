import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, requireProjectRole } from "@/lib/rbac/permissions";
import { generateDailyBrief } from "@/lib/reports/daily-brief";
import { generateMonthlyReport } from "@/lib/reports/monthly-report";

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);
    const reports = await prisma.report.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, templateType: true, dateRangeStart: true, dateRangeEnd: true, status: true, createdAt: true, shareToken: true },
    });
    return NextResponse.json({ reports });
  });
}

const generateSchema = z.object({
  templateType: z.enum(["DAILY_BRIEF", "MONTHLY_PR"]),
  date: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const { templateType, date } = generateSchema.parse(await req.json().catch(() => ({})));
    const forDate = date ? new Date(date) : new Date();

    const report =
      templateType === "DAILY_BRIEF"
        ? await generateDailyBrief(params.projectId, forDate, user.id)
        : await generateMonthlyReport(params.projectId, forDate, user.id);

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Report",
        entityId: report.id,
        action: "GENERATE",
        newValue: { templateType, title: report.title },
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  });
}
