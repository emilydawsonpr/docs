import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole } from "@/lib/rbac/permissions";
import { bulkActionSchema } from "@/lib/validation/mention";

const ACTION_TO_STATUS: Record<string, "APPROVED" | "REJECTED" | "EXCLUDED"> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  EXCLUDE: "EXCLUDED",
};

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const input = bulkActionSchema.parse(await req.json().catch(() => ({})));
    const scoped = await prisma.mention.findMany({
      where: { id: { in: input.mentionIds }, projectId: params.projectId },
      select: { id: true },
    });
    const ids = scoped.map((m) => m.id);

    if (input.action === "TAG") {
      if (!input.tag) return NextResponse.json({ error: "tag is required for TAG action" }, { status: 400 });
      const tag = await prisma.tag.upsert({
        where: { projectId_name: { projectId: params.projectId, name: input.tag } },
        create: { projectId: params.projectId, name: input.tag },
        update: {},
      });
      for (const mentionId of ids) {
        await prisma.mentionTag.upsert({
          where: { mentionId_tagId: { mentionId, tagId: tag.id } },
          create: { mentionId, tagId: tag.id },
          update: {},
        });
      }
    } else {
      await prisma.mention.updateMany({
        where: { id: { in: ids } },
        data: { reviewStatus: ACTION_TO_STATUS[input.action] },
      });
    }

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "Mention",
        entityId: `bulk:${ids.length}`,
        action: `BULK_${input.action}`,
        newValue: { mentionIds: ids, tag: input.tag },
      },
    });

    return NextResponse.json({ updated: ids.length });
  });
}
