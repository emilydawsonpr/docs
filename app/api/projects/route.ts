import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { createProjectSchema } from "@/lib/validation/project";
import { roleAtLeast } from "@/lib/rbac/permissions";

export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
    const orgIds = memberships.map((m) => m.organizationId);

    const projects = await prisma.project.findMany({
      where: {
        OR: [{ organizationId: { in: orgIds } }, { projectMemberships: { some: { userId: user.id } } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { mentions: true } },
      },
    });

    return NextResponse.json({ projects });
  });
}

export async function POST(req: Request) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const input = createProjectSchema.parse(body);

    const membership = await prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (!membership || !roleAtLeast(membership.role, "ANALYST")) {
      return NextResponse.json({ error: "You do not have permission to create a project." }, { status: 403 });
    }

    const project = await prisma.project.create({
      data: {
        organizationId: membership.organizationId,
        name: input.name,
        description: input.description,
        timezone: input.timezone,
        languages: input.languages,
        regions: input.regions,
        focusCities: input.focusCities,
        crisisTerms: input.crisisTerms,
        isDemo: input.isDemo,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: membership.organizationId,
        projectId: project.id,
        userId: user.id,
        entityType: "Project",
        entityId: project.id,
        action: "CREATE",
        newValue: { name: project.name },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  });
}
