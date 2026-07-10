import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";

const bodySchema = z.object({ intoMentionId: z.string() });

/** Merges this mention's duplicate cluster into another mention's cluster (analyst override). */
export async function POST(req: Request, { params }: { params: { projectId: string; mentionId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const { intoMentionId } = bodySchema.parse(await req.json().catch(() => ({})));

    const [mention, target] = await Promise.all([
      prisma.mention.findFirst({ where: { id: params.mentionId, projectId: params.projectId } }),
      prisma.mention.findFirst({ where: { id: intoMentionId, projectId: params.projectId } }),
    ]);
    if (!mention || !target) throw new NotFoundError("Mention not found");

    let targetClusterId = target.duplicateClusterId;
    if (!targetClusterId) {
      const newCluster = await prisma.duplicateCluster.create({
        data: { projectId: params.projectId, canonicalMentionId: target.id, fingerprint: "manual", memberCount: 1 },
      });
      targetClusterId = newCluster.id;
      await prisma.mention.update({ where: { id: target.id }, data: { duplicateClusterId: targetClusterId } });
    }

    const previousClusterId = mention.duplicateClusterId;
    await prisma.mention.update({ where: { id: mention.id }, data: { duplicateClusterId: targetClusterId } });
    await prisma.duplicateCluster.update({ where: { id: targetClusterId }, data: { memberCount: { increment: 1 } } });
    if (previousClusterId && previousClusterId !== targetClusterId) {
      await prisma.duplicateCluster.update({ where: { id: previousClusterId }, data: { memberCount: { decrement: 1 } } });
    }

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Mention",
        entityId: mention.id,
        action: "MERGE",
        previousValue: { duplicateClusterId: previousClusterId },
        newValue: { duplicateClusterId: targetClusterId },
      },
    });

    return NextResponse.json({ ok: true, duplicateClusterId: targetClusterId });
  });
}
