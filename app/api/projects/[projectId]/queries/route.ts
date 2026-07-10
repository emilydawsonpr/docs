import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, getProjectAccess } from "@/lib/rbac/permissions";
import { createMonitoringQuerySchema } from "@/lib/validation/query";
import { compileVisualQuery } from "@/lib/query/compile-visual-query";
import { validateQuery } from "@/lib/query/boolean-parser";

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);
    const queries = await prisma.monitoringQuery.findMany({
      where: { projectId: params.projectId },
      include: { terms: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ queries });
  });
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const body = await req.json().catch(() => ({}));
    const input = createMonitoringQuerySchema.parse(body);

    const expression = input.mode === "VISUAL" ? compileVisualQuery(input.terms) : input.booleanExpression ?? "";
    const validation = validateQuery(expression || "");
    if (!validation.valid) {
      return NextResponse.json({ error: "Invalid Boolean query", details: validation.errors }, { status: 400 });
    }

    const query = await prisma.monitoringQuery.create({
      data: {
        projectId: params.projectId,
        name: input.name,
        mode: input.mode,
        booleanExpression: expression,
        createdById: user.id,
        terms: { create: input.terms },
      },
      include: { terms: true },
    });

    return NextResponse.json({ query, warnings: validation.warnings }, { status: 201 });
  });
}
