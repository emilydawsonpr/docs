import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { AppShell } from "@/components/app-shell";
import { ProjectNav } from "@/components/project-nav";
import { QueryBuilder } from "@/components/query-builder/query-builder";

export default async function QueryBuilderPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const access = await getProjectAccess(user.id, params.projectId);
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new NotFoundError();

  const [queries, brand] = await Promise.all([
    prisma.monitoringQuery.findMany({
      where: { projectId: params.projectId },
      include: { terms: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.brand.findFirst({ where: { projectId: params.projectId, isPrimary: true } }),
  ]);

  return (
    <AppShell title={project.name}>
      <ProjectNav projectId={params.projectId} active="query-builder" />
      <QueryBuilder
        projectId={params.projectId}
        initialQueries={JSON.parse(JSON.stringify(queries))}
        brandAliases={brand?.aliases ?? []}
        canEdit={access.role !== "VIEWER" && access.role !== "CLIENT_VIEWER"}
      />
    </AppShell>
  );
}
