import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProjectAccess, canEditMonitoringLogic, NotFoundError } from "@/lib/rbac/permissions";
import { AppShell } from "@/components/app-shell";
import { ProjectNav } from "@/components/project-nav";
import { SettingsManager } from "@/components/settings/settings-manager";

export default async function SettingsPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const access = await getProjectAccess(user.id, params.projectId);
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new NotFoundError();

  const [brands, keyMessages] = await Promise.all([
    prisma.brand.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    prisma.keyMessage.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <AppShell title={project.name}>
      <ProjectNav projectId={params.projectId} active="settings" />
      <SettingsManager
        projectId={params.projectId}
        initialProject={JSON.parse(JSON.stringify(project))}
        initialBrands={JSON.parse(JSON.stringify(brands))}
        initialKeyMessages={JSON.parse(JSON.stringify(keyMessages))}
        canEdit={canEditMonitoringLogic(access.role)}
      />
    </AppShell>
  );
}
