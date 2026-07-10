import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { seedDemoWorkspace } from "@/lib/demo/seed-demo-workspace";

/**
 * Idempotently ensures every existing organization has a demo workspace.
 * New organizations get one automatically at registration (see
 * app/api/register/route.ts) — this script exists for `pnpm db:seed` to
 * backfill demo data for orgs created before that, or in a fresh database
 * seeded outside the normal signup flow.
 */
async function main() {
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });
  if (organizations.length === 0) {
    console.log("No organizations exist yet — register an account first, then re-run `pnpm db:seed` if needed.");
    return;
  }

  for (const org of organizations) {
    const projectId = await seedDemoWorkspace(org.id);
    console.log(`Demo workspace ready for "${org.name}": project ${projectId}`);
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
