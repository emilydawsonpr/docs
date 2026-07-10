import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { validateQuery } from "@/lib/query/boolean-parser";
import { z } from "zod";

const bodySchema = z.object({ isActive: z.boolean() });

export async function POST(req: Request, { params }: { params: { projectId: string; queryId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.monitoringQuery.findFirst({ where: { id: params.queryId, projectId: params.projectId } });
    if (!existing) throw new NotFoundError("Query not found");

    const { isActive } = bodySchema.parse(await req.json().catch(() => ({})));

    if (isActive) {
      const validation = validateQuery(existing.booleanExpression);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Cannot activate an invalid query", details: validation.errors },
          { status: 400 }
        );
      }
    }

    const query = await prisma.monitoringQuery.update({ where: { id: params.queryId }, data: { isActive } });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "MonitoringQuery",
        entityId: query.id,
        action: isActive ? "ACTIVATE" : "DEACTIVATE",
      },
    });

    return NextResponse.json({ query });
  });
}
