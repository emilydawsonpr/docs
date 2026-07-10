import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";

export async function GET(_req: Request, { params }: { params: { projectId: string; reportId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);
    const report = await prisma.report.findFirst({
      where: { id: params.reportId, projectId: params.projectId },
      include: { sections: { orderBy: { order: "asc" } } },
    });
    if (!report) throw new NotFoundError("Report not found");
    return NextResponse.json({ report });
  });
}
