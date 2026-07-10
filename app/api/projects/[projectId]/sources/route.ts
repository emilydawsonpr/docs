import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, getProjectAccess } from "@/lib/rbac/permissions";
import { createSourceConnectionSchema } from "@/lib/validation/source";
import { getAdapter, listAvailableAdapters } from "@/lib/adapters/registry";

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const url = new URL(req.url);
    if (url.searchParams.get("catalog") === "1") {
      return NextResponse.json({ adapters: listAvailableAdapters() });
    }

    const sources = await prisma.sourceConnection.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { mentions: true, ingestionJobs: true } } },
    });
    return NextResponse.json({ sources });
  });
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const body = await req.json().catch(() => ({}));
    const input = createSourceConnectionSchema.parse(body);

    const adapter = getAdapter(input.adapterType);
    const status = adapter.authRequired && adapter.authStatus(input.config) !== "configured" ? "DISABLED" : "ACTIVE";

    const source = await prisma.sourceConnection.create({
      data: {
        projectId: params.projectId,
        name: input.name,
        adapterType: input.adapterType,
        config: input.config,
        monitoringQueryId: input.monitoringQueryId,
        pollingFrequencyMins: input.pollingFrequencyMins,
        status,
      },
    });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "SourceConnection",
        entityId: source.id,
        action: "CREATE",
        newValue: { adapterType: source.adapterType, name: source.name },
      },
    });

    return NextResponse.json({ source }, { status: 201 });
  });
}
