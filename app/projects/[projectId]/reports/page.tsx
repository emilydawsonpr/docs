import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { AppShell } from "@/components/app-shell";
import { ProjectNav } from "@/components/project-nav";
import { ReportsManager } from "@/components/reports/reports-manager";

export default async function ReportsPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const access = await getProjectAccess(user.id, params.projectId);
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new NotFoundError();

  const reports = await prisma.report.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, templateType: true, dateRangeStart: true, dateRangeEnd: true, status: true, createdAt: true, shareToken: true },
  });

  return (
    <AppShell title={project.name}>
      <ProjectNav projectId={params.projectId} active="reports" />
      <ReportsManager
        projectId={params.projectId}
        initialReports={JSON.parse(JSON.stringify(reports))}
        canEdit={access.role !== "VIEWER" && access.role !== "CLIENT_VIEWER"}
      />
    </AppShell>
  );
}
