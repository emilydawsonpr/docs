import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, requireProjectRole } from "@/lib/rbac/permissions";
import { createKeyMessageSchema } from "@/lib/validation/key-message";

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);

    const keyMessages = await prisma.keyMessage.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ keyMessages });
  });
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");

    const input = createKeyMessageSchema.parse(await req.json().catch(() => ({})));

    const keyMessage = await prisma.keyMessage.create({
      data: { projectId: params.projectId, text: input.text, aliases: input.aliases },
    });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "KeyMessage",
        entityId: keyMessage.id,
        action: "CREATE",
        newValue: { text: keyMessage.text },
      },
    });

    return NextResponse.json({ keyMessage }, { status: 201 });
  });
}
