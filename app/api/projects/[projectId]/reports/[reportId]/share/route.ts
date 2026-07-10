import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";

export async function POST(_req: Request, { params }: { params: { projectId: string; reportId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const existing = await prisma.report.findFirst({ where: { id: params.reportId, projectId: params.projectId } });
    if (!existing) throw new NotFoundError("Report not found");

    const shareToken = existing.shareToken ?? crypto.randomBytes(24).toString("hex");
    const report = await prisma.report.update({ where: { id: params.reportId }, data: { shareToken } });

    return NextResponse.json({ shareToken: report.shareToken });
  });
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string; reportId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    await prisma.report.update({ where: { id: params.reportId }, data: { shareToken: null } });
    return NextResponse.json({ ok: true });
  });
}
