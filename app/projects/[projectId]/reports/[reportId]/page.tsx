import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { AppShell } from "@/components/app-shell";
import { ProjectNav } from "@/components/project-nav";
import { renderReportHtml } from "@/lib/reports/render-html";
import { ReportViewerActions } from "@/components/reports/report-viewer-actions";

export default async function ReportViewerPage({ params }: { params: { projectId: string; reportId: string } }) {
  const user = await requireUser();
  const access = await getProjectAccess(user.id, params.projectId);
  const [project, report] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.report.findFirst({ where: { id: params.reportId, projectId: params.projectId }, include: { sections: { orderBy: { order: "asc" } } } }),
  ]);
  if (!project || !report) throw new NotFoundError();

  const html = renderReportHtml(report, { isDemo: project.isDemo });
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  const styleMatch = html.match(/<style>([\s\S]*)<\/style>/);

  return (
    <AppShell title={project.name}>
      <ProjectNav projectId={params.projectId} active="reports" />
      <ReportViewerActions
        projectId={params.projectId}
        reportId={params.reportId}
        canEdit={access.role !== "VIEWER" && access.role !== "CLIENT_VIEWER"}
        initialShareToken={report.shareToken}
      />
      <div className="mt-4 rounded-lg border bg-card p-6">
        {styleMatch && <style dangerouslySetInnerHTML={{ __html: styleMatch[1] }} />}
        <div dangerouslySetInnerHTML={{ __html: bodyMatch?.[1] ?? "" }} />
      </div>
    </AppShell>
  );
}
