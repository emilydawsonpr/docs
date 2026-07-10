import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { renderReportHtml } from "@/lib/reports/render-html";

// Public, read-only, no auth — deliberately outside /projects/[projectId] auth scope.
export default async function SharedReportPage({ params }: { params: { token: string } }) {
  const report = await prisma.report.findUnique({
    where: { shareToken: params.token },
    include: { sections: { orderBy: { order: "asc" } }, project: { select: { isDemo: true } } },
  });
  if (!report) notFound();

  const html = renderReportHtml(report, { isDemo: report.project.isDemo });
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  const styleMatch = html.match(/<style>([\s\S]*)<\/style>/);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {styleMatch && <style dangerouslySetInnerHTML={{ __html: styleMatch[1] }} />}
      <div dangerouslySetInnerHTML={{ __html: bodyMatch?.[1] ?? "" }} />
    </div>
  );
}
