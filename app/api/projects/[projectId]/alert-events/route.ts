import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess } from "@/lib/rbac/permissions";

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const url = new URL(req.url);
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));

    const events = await prisma.alertEvent.findMany({
      where: { alertRule: { projectId: params.projectId } },
      orderBy: { triggeredAt: "desc" },
      take: limit,
      include: { alertRule: { select: { name: true, triggerType: true } }, mention: { select: { headline: true, originalUrl: true } } },
    });

    return NextResponse.json({ events });
  });
}
