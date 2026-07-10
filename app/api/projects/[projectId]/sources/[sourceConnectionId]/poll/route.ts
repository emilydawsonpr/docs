import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { runSourceConnection } from "@/lib/ingestion/run-source-connection";

/**
 * "Poll now": runs the adapter synchronously and returns the result
 * immediately, for interactive testing. Scheduled/recurring polling goes
 * through the BullMQ ingestion queue + worker (jobs/run-workers.ts) instead.
 */
export async function POST(_req: Request, { params }: { params: { projectId: string; sourceConnectionId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.sourceConnection.findFirst({
      where: { id: params.sourceConnectionId, projectId: params.projectId },
    });
    if (!existing) throw new NotFoundError("Source connection not found");

    try {
      const { ingestionJobId } = await runSourceConnection(params.sourceConnectionId);
      const ingestionJob = await prisma.ingestionJob.findUnique({ where: { id: ingestionJobId } });
      return NextResponse.json({ ingestionJob });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}
