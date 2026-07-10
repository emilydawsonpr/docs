import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { fingerprintToHex, simhash64 } from "@/lib/dedup/fingerprint";

/** Removes this mention from its duplicate cluster, giving it its own solo cluster. */
export async function POST(_req: Request, { params }: { params: { projectId: string; mentionId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const mention = await prisma.mention.findFirst({ where: { id: params.mentionId, projectId: params.projectId } });
    if (!mention) throw new NotFoundError("Mention not found");
    if (!mention.duplicateClusterId) {
      return NextResponse.json({ ok: true, duplicateClusterId: null });
    }

    const previousClusterId = mention.duplicateClusterId;
    const fingerprint = fingerprintToHex(simhash64(`${mention.headline}\n${(mention.bodyText ?? "").slice(0, 500)}`));

    const newCluster = await prisma.duplicateCluster.create({
      data: { projectId: params.projectId, canonicalMentionId: mention.id, fingerprint, memberCount: 1 },
    });

    await prisma.$transaction([
      prisma.mention.update({ where: { id: mention.id }, data: { duplicateClusterId: newCluster.id } }),
      prisma.duplicateCluster.update({ where: { id: previousClusterId }, data: { memberCount: { decrement: 1 } } }),
    ]);

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Mention",
        entityId: mention.id,
        action: "UNMERGE",
        previousValue: { duplicateClusterId: previousClusterId },
        newValue: { duplicateClusterId: newCluster.id },
      },
    });

    return NextResponse.json({ ok: true, duplicateClusterId: newCluster.id });
  });
}
