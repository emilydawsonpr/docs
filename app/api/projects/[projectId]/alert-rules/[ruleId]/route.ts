import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { requireProjectRole, NotFoundError } from "@/lib/rbac/permissions";
import { updateAlertRuleSchema } from "@/lib/validation/alert";

export async function PATCH(req: Request, { params }: { params: { projectId: string; ruleId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const existing = await prisma.alertRule.findFirst({ where: { id: params.ruleId, projectId: params.projectId } });
    if (!existing) throw new NotFoundError("Alert rule not found");

    const input = updateAlertRuleSchema.parse(await req.json().catch(() => ({})));
    const rule = await prisma.alertRule.update({
      where: { id: params.ruleId },
      data: {
        ...input,
        slackWebhookUrl: input.slackWebhookUrl === "" ? null : input.slackWebhookUrl,
        teamsWebhookUrl: input.teamsWebhookUrl === "" ? null : input.teamsWebhookUrl,
      },
    });
    return NextResponse.json({ rule });
  });
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string; ruleId: string } }) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await requireProjectRole(user.id, params.projectId, "ANALYST");
    const existing = await prisma.alertRule.findFirst({ where: { id: params.ruleId, projectId: params.projectId } });
    if (!existing) throw new NotFoundError("Alert rule not found");
    await prisma.alertRule.delete({ where: { id: params.ruleId } });
    return NextResponse.json({ ok: true });
  });
}
