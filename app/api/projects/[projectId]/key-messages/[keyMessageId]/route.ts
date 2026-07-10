import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { updateKeyMessageSchema } from "@/lib/validation/key-message";

export async function PATCH(req: Request, { params }: { params: { projectId: string; keyMessageId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.keyMessage.findFirst({
      where: { id: params.keyMessageId, projectId: params.projectId },
    });
    if (!existing) throw new NotFoundError("Key message not found");

    const input = updateKeyMessageSchema.parse(await req.json().catch(() => ({})));

    const keyMessage = await prisma.keyMessage.update({
      where: { id: params.keyMessageId },
      data: {
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.aliases !== undefined ? { aliases: input.aliases } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "KeyMessage",
        entityId: keyMessage.id,
        action: "UPDATE",
        previousValue: existing as any,
        newValue: keyMessage as any,
      },
    });

    return NextResponse.json({ keyMessage });
  });
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string; keyMessageId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const existing = await prisma.keyMessage.findFirst({
      where: { id: params.keyMessageId, projectId: params.projectId },
    });
    if (!existing) throw new NotFoundError("Key message not found");

    await prisma.keyMessage.delete({ where: { id: params.keyMessageId } });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "KeyMessage",
        entityId: params.keyMessageId,
        action: "DELETE",
        previousValue: { text: existing.text },
      },
    });

    return NextResponse.json({ ok: true });
  });
}
