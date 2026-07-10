import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { AppShell } from "@/components/app-shell";
import { ProjectNav } from "@/components/project-nav";
import { SourceManager } from "@/components/sources/source-manager";
import { listAvailableAdapters } from "@/lib/adapters/registry";

export default async function SourcesPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const access = await getProjectAccess(user.id, params.projectId);
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new NotFoundError();

  const [sources, queries] = await Promise.all([
    prisma.sourceConnection.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { mentions: true } } },
    }),
    prisma.monitoringQuery.findMany({ where: { projectId: params.projectId }, select: { id: true, name: true } }),
  ]);

  return (
    <AppShell title={project.name}>
      <ProjectNav projectId={params.projectId} active="sources" />
      <SourceManager
        projectId={params.projectId}
        initialSources={JSON.parse(JSON.stringify(sources))}
        queries={queries}
        adapters={listAvailableAdapters()}
        canEdit={access.role !== "VIEWER" && access.role !== "CLIENT_VIEWER"}
      />
    </AppShell>
  );
}
