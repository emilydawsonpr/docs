import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, getProjectAccess } from "@/lib/rbac/permissions";
import { updateProjectSchema } from "@/lib/validation/project";

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const access = await getProjectAccess(user.id, params.projectId);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
    return NextResponse.json({ project, role: access.role });
  });
}

export async function PATCH(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const body = await req.json().catch(() => ({}));
    const input = updateProjectSchema.parse(body);

    const before = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
    const project = await prisma.project.update({ where: { id: params.projectId }, data: input });

    await prisma.auditLog.create({
      data: {
        organizationId: before.organizationId,
        projectId: project.id,
        userId: user.id,
        entityType: "Project",
        entityId: project.id,
        action: "UPDATE",
        previousValue: before as any,
        newValue: project as any,
      },
    });

    return NextResponse.json({ project });
  });
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ADMINISTRATOR");
    const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });

    await prisma.auditLog.create({
      data: {
        organizationId: project.organizationId,
        projectId: null,
        userId: user.id,
        entityType: "Project",
        entityId: project.id,
        action: "DELETE",
        previousValue: { name: project.name },
      },
    });

    await prisma.project.delete({ where: { id: params.projectId } });
    return NextResponse.json({ ok: true });
  });
}
