import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { mentionCorrectionSchema } from "@/lib/validation/mention";

export async function GET(_req: Request, { params }: { params: { projectId: string; mentionId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const mention = await prisma.mention.findFirst({
      where: { id: params.mentionId, projectId: params.projectId },
      include: {
        analysisResult: true,
        mentionTags: { include: { tag: true } },
        messageMatches: { include: { keyMessage: true } },
        duplicateCluster: { include: { members: { select: { id: true, headline: true, sourceDomain: true, canonicalUrl: true } } } },
      },
    });
    if (!mention) throw new NotFoundError("Mention not found");

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: "Mention", entityId: mention.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    });

    return NextResponse.json({ mention, auditLogs });
  });
}

/**
 * Human review/correction: every change writes an AuditLog row with the
 * previous and new value, the acting user, and an optional reason.
 */
export async function PATCH(req: Request, { params }: { params: { projectId: string; mentionId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.mention.findFirst({
      where: { id: params.mentionId, projectId: params.projectId },
      include: { analysisResult: true },
    });
    if (!existing) throw new NotFoundError("Mention not found");

    const input = mentionCorrectionSchema.parse(await req.json().catch(() => ({})));

    const mentionUpdate: Record<string, unknown> = {};
    if (input.reviewStatus) mentionUpdate.reviewStatus = input.reviewStatus;
    if (input.placementType) mentionUpdate.placementType = input.placementType;
    if (input.analystNotes !== undefined) mentionUpdate.analystNotes = input.analystNotes;
    if (input.aiErrorFlagged !== undefined) mentionUpdate.aiErrorFlagged = input.aiErrorFlagged;

    const [mention] = await prisma.$transaction([
      prisma.mention.update({ where: { id: params.mentionId }, data: mentionUpdate }),
      ...(input.sentiment && existing.analysisResult
        ? [
            prisma.analysisResult.update({
              where: { mentionId: params.mentionId },
              data: { sentiment: input.sentiment, correctedByUserId: user.id, correctedAt: new Date() },
            }),
          ]
        : []),
      ...(input.relevanceLabel && existing.analysisResult
        ? [
            prisma.analysisResult.update({
              where: { mentionId: params.mentionId },
              data: { relevanceLabel: input.relevanceLabel, correctedByUserId: user.id, correctedAt: new Date() },
            }),
          ]
        : []),
    ]);

    if (input.tags) {
      await prisma.mentionTag.deleteMany({ where: { mentionId: params.mentionId } });
      for (const tagName of input.tags) {
        const tag = await prisma.tag.upsert({
          where: { projectId_name: { projectId: params.projectId, name: tagName } },
          create: { projectId: params.projectId, name: tagName },
          update: {},
        });
        await prisma.mentionTag.create({ data: { mentionId: params.mentionId, tagId: tag.id } });
      }
    }

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Mention",
        entityId: params.mentionId,
        action: "CORRECT",
        previousValue: {
          reviewStatus: existing.reviewStatus,
          sentiment: existing.analysisResult?.sentiment,
          relevanceLabel: existing.analysisResult?.relevanceLabel,
          placementType: existing.placementType,
        },
        newValue: input as any,
        reason: input.reason,
      },
    });

    return NextResponse.json({ mention });
  });
}
