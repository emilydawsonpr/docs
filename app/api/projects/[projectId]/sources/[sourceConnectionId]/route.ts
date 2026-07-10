import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { updateSourceConnectionSchema } from "@/lib/validation/source";

export async function PATCH(req: Request, { params }: { params: { projectId: string; sourceConnectionId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.sourceConnection.findFirst({
      where: { id: params.sourceConnectionId, projectId: params.projectId },
    });
    if (!existing) throw new NotFoundError("Source connection not found");

    const input = updateSourceConnectionSchema.parse(await req.json().catch(() => ({})));
    const source = await prisma.sourceConnection.update({
      where: { id: params.sourceConnectionId },
      data: input,
    });
    return NextResponse.json({ source });
  });
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string; sourceConnectionId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const existing = await prisma.sourceConnection.findFirst({
      where: { id: params.sourceConnectionId, projectId: params.projectId },
    });
    if (!existing) throw new NotFoundError("Source connection not found");
    await prisma.sourceConnection.delete({ where: { id: params.sourceConnectionId } });
    return NextResponse.json({ ok: true });
  });
}
