import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getProjectAccess, requireProjectRole } from "@/lib/rbac/permissions";
import { alertRuleSchema } from "@/lib/validation/alert";

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await getProjectAccess(user.id, params.projectId);
    const rules = await prisma.alertRule.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ rules });
  });
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const input = alertRuleSchema.parse(await req.json().catch(() => ({})));

    const rule = await prisma.alertRule.create({
      data: {
        projectId: params.projectId,
        name: input.name,
        triggerType: input.triggerType,
        config: input.config,
        deliveryChannels: input.deliveryChannels,
        slackWebhookUrl: input.slackWebhookUrl || undefined,
        teamsWebhookUrl: input.teamsWebhookUrl || undefined,
        emailRecipients: input.emailRecipients,
        cadence: input.cadence,
        quietHoursStart: input.quietHoursStart ?? undefined,
        quietHoursEnd: input.quietHoursEnd ?? undefined,
        timezone: input.timezone,
        isActive: input.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: user.id,
        entityType: "AlertRule",
        entityId: rule.id,
        action: "CREATE",
        newValue: { name: rule.name, triggerType: rule.triggerType },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  });
}
