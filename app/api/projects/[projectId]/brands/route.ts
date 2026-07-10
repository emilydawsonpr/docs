import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, requireProjectRole } from "@/lib/rbac/permissions";
import { createCompetitorSchema } from "@/lib/validation/brand";

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const brands = await prisma.brand.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      include: { competitors: true },
    });
    return NextResponse.json({ brands });
  });
}

/** Adds a competitor: a non-primary Brand plus its Competitor row. */
export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const body = await req.json().catch(() => ({}));
    const input = createCompetitorSchema.parse(body);

    const existingCount = await prisma.competitor.count({ where: { projectId: params.projectId } });

    const { brand, competitor } = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({
        data: { projectId: params.projectId, name: input.name, aliases: input.aliases, isPrimary: false },
      });
      const competitor = await tx.competitor.create({
        data: { projectId: params.projectId, brandId: brand.id, displayOrder: existingCount },
      });
      return { brand, competitor };
    });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Brand",
        entityId: brand.id,
        action: "CREATE",
        newValue: { name: brand.name, aliases: brand.aliases, competitor: true },
      },
    });

    return NextResponse.json({ brand: { ...brand, competitors: [competitor] } }, { status: 201 });
  });
}
