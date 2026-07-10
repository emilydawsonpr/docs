import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { formatDateCA } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
  const orgIds = memberships.map((m) => m.organizationId);

  const projects = await prisma.project.findMany({
    where: { OR: [{ organizationId: { in: orgIds } }, { projectMemberships: { some: { userId: user.id } } }] },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { mentions: true } } },
  });

  const liveProjects = projects.filter((p) => !p.isDemo);
  const demoProject = projects.find((p) => p.isDemo);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your projects</h1>
          <p className="text-muted-foreground">Monitoring projects across your organization.</p>
        </div>
        <div className="flex gap-2">
          <CreateProjectDialog />
          <Button asChild>
            <Link href="/onboarding">Guided setup</Link>
          </Button>
        </div>
      </div>

      {demoProject && (
        <Card className="mt-6 border-warning/50 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="warning">Synthetic demo data</Badge>
              <CardTitle className="text-base">{demoProject.name}</CardTitle>
            </div>
            <CardDescription>
              A fictional Canadian brand workspace with synthetic coverage — never mixed with your live data. Explore
              it to see how SignalWatch presents dashboards, risk, and reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/projects/${demoProject.id}/dashboard`}>Open demo workspace</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liveProjects.length === 0 && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>
                Create your first monitoring project using the guided setup, which will propose an initial Boolean
                query based on your brand and competitors.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        {liveProjects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}/dashboard`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{project.name}</CardTitle>
                <CardDescription>
                  {project.regions.join(", ")} · {project.languages.join(", ").toUpperCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{project._count.mentions} mentions</span>
                <span>Created {formatDateCA(project.createdAt)}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
