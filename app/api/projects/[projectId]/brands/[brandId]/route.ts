import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { updateBrandSchema } from "@/lib/validation/brand";

export async function PATCH(req: Request, { params }: { params: { projectId: string; brandId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.brand.findFirst({ where: { id: params.brandId, projectId: params.projectId } });
    if (!existing) throw new NotFoundError("Brand not found");

    const input = updateBrandSchema.parse(await req.json().catch(() => ({})));

    const brand = await prisma.brand.update({
      where: { id: params.brandId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.aliases !== undefined ? { aliases: input.aliases } : {}),
        ...(input.websites !== undefined ? { websites: input.websites } : {}),
        ...(input.handles !== undefined ? { handles: { handles: input.handles } } : {}),
        ...(input.executives !== undefined ? { executives: { executives: input.executives } } : {}),
        ...(input.products !== undefined ? { products: input.products } : {}),
        ...(input.campaigns !== undefined ? { campaigns: input.campaigns } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Brand",
        entityId: brand.id,
        action: "UPDATE",
        previousValue: existing as any,
        newValue: brand as any,
      },
    });

    return NextResponse.json({ brand });
  });
}

/** Removes a competitor brand. The primary brand cannot be deleted here. */
export async function DELETE(_req: Request, { params }: { params: { projectId: string; brandId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.brand.findFirst({ where: { id: params.brandId, projectId: params.projectId } });
    if (!existing) throw new NotFoundError("Brand not found");
    if (existing.isPrimary) {
      return NextResponse.json({ error: "The primary brand cannot be removed." }, { status: 400 });
    }

    await prisma.brand.delete({ where: { id: params.brandId } });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Brand",
        entityId: params.brandId,
        action: "DELETE",
        previousValue: { name: existing.name },
      },
    });

    return NextResponse.json({ ok: true });
  });
}
