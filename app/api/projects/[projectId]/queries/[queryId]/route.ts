import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { updateMonitoringQuerySchema } from "@/lib/validation/query";
import { compileVisualQuery } from "@/lib/query/compile-visual-query";
import { validateQuery } from "@/lib/query/boolean-parser";

async function loadQuery(projectId: string, queryId: string) {
  const query = await prisma.monitoringQuery.findFirst({
    where: { id: queryId, projectId },
    include: { terms: { orderBy: { position: "asc" } } },
  });
  if (!query) throw new NotFoundError("Query not found");
  return query;
}

export async function GET(_req: Request, { params }: { params: { projectId: string; queryId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);
    const query = await loadQuery(params.projectId, params.queryId);
    return NextResponse.json({ query });
  });
}

export async function PATCH(req: Request, { params }: { params: { projectId: string; queryId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const existing = await loadQuery(params.projectId, params.queryId);

    const body = await req.json().catch(() => ({}));
    const input = updateMonitoringQuerySchema.parse(body);

    const mode = input.mode ?? existing.mode;
    let expression = existing.booleanExpression;
    if (input.terms) {
      expression = mode === "VISUAL" ? compileVisualQuery(input.terms) : input.booleanExpression ?? expression;
    } else if (input.booleanExpression !== undefined) {
      expression = input.booleanExpression;
    }

    const validation = validateQuery(expression || "");
    if (!validation.valid) {
      return NextResponse.json({ error: "Invalid Boolean query", details: validation.errors }, { status: 400 });
    }

    const query = await prisma.$transaction(async (tx) => {
      if (input.terms) {
        await tx.queryTerm.deleteMany({ where: { monitoringQueryId: params.queryId } });
      }
      return tx.monitoringQuery.update({
        where: { id: params.queryId },
        data: {
          name: input.name ?? existing.name,
          mode,
          booleanExpression: expression,
          ...(input.terms ? { terms: { create: input.terms } } : {}),
        },
        include: { terms: true },
      });
    });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "MonitoringQuery",
        entityId: query.id,
        action: "UPDATE",
        previousValue: { booleanExpression: existing.booleanExpression },
        newValue: { booleanExpression: query.booleanExpression },
      },
    });

    return NextResponse.json({ query, warnings: validation.warnings });
  });
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string; queryId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    await loadQuery(params.projectId, params.queryId);
    await prisma.monitoringQuery.delete({ where: { id: params.queryId } });
    return NextResponse.json({ ok: true });
  });
}
