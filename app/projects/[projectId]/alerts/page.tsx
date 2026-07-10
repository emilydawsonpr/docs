import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { AppShell } from "@/components/app-shell";
import { ProjectNav } from "@/components/project-nav";
import { AlertsManager } from "@/components/alerts/alerts-manager";

export default async function AlertsPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const access = await getProjectAccess(user.id, params.projectId);
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new NotFoundError();

  const [rules, events] = await Promise.all([
    prisma.alertRule.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: "desc" } }),
    prisma.alertEvent.findMany({
      where: { alertRule: { projectId: params.projectId } },
      orderBy: { triggeredAt: "desc" },
      take: 50,
      include: { alertRule: { select: { name: true, triggerType: true } }, mention: { select: { headline: true, originalUrl: true } } },
    }),
  ]);

  return (
    <AppShell title={project.name}>
      <ProjectNav projectId={params.projectId} active="alerts" />
      <AlertsManager
        projectId={params.projectId}
        initialRules={JSON.parse(JSON.stringify(rules))}
        initialEvents={JSON.parse(JSON.stringify(events))}
        canEdit={access.role !== "VIEWER" && access.role !== "CLIENT_VIEWER"}
      />
    </AppShell>
  );
}
