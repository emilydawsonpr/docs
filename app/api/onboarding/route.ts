import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getPrimaryMembership } from "@/lib/org/current-org";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { generateInitialQuery } from "@/lib/query/generate-initial-query";
import { roleAtLeast } from "@/lib/rbac/permissions";

/**
 * Onboarding creates a project, its primary brand, competitor brand records,
 * key messages, and a DRAFT (isActive=false) proposed Boolean query. The
 * query is never activated automatically — the user must review it on the
 * query-builder page and explicitly activate it (per spec: "require user
 * review before activation").
 */
export async function POST(req: Request) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const membership = await getPrimaryMembership(user.id);
    if (!roleAtLeast(membership.role, "ANALYST")) {
      return NextResponse.json({ error: "You do not have permission to create a project." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const input = onboardingSchema.parse(body);

    const proposedExpression = generateInitialQuery({
      brandName: input.brandName,
      aliases: input.aliases,
      handles: input.socialHandles,
      geography: input.geography,
      excludedMeanings: input.excludedMeanings,
    });

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: membership.organizationId,
          name: input.projectName,
          timezone: input.timezone,
          languages: input.languages,
          regions: input.geography,
          focusCities: input.focusCities,
          crisisTerms: input.crisisTerms,
        },
      });

      const brand = await tx.brand.create({
        data: {
          projectId: project.id,
          name: input.brandName,
          aliases: input.aliases,
          websites: input.website ? [input.website] : [],
          handles: input.socialHandles.length ? { handles: input.socialHandles } : undefined,
          executives: input.executives.length ? { executives: input.executives } : undefined,
          products: input.products,
          campaigns: input.campaigns,
          isPrimary: true,
        },
      });

      for (const [i, name] of input.competitors.entries()) {
        if (!name.trim()) continue;
        const competitorBrand = await tx.brand.create({
          data: { projectId: project.id, name: name.trim(), isPrimary: false },
        });
        await tx.competitor.create({
          data: { projectId: project.id, brandId: competitorBrand.id, displayOrder: i },
        });
      }

      for (const text of input.keyMessages) {
        if (!text.trim()) continue;
        await tx.keyMessage.create({ data: { projectId: project.id, text: text.trim() } });
      }

      const monitoringQuery = await tx.monitoringQuery.create({
        data: {
          projectId: project.id,
          name: "Proposed onboarding query",
          mode: "EXPERT",
          booleanExpression: proposedExpression,
          isActive: false,
          createdById: user.id,
        },
      });

      if (input.priorityPublications.length > 0) {
        for (const domain of input.priorityPublications) {
          if (!domain.trim()) continue;
          await tx.source.upsert({
            where: { domain_projectId: { domain: domain.trim(), projectId: project.id } },
            create: { projectId: project.id, domain: domain.trim(), name: domain.trim(), isCanadian: true },
            update: {},
          });
        }
      }

      if (input.alertRecipients.length > 0) {
        await tx.digest.create({
          data: {
            projectId: project.id,
            cadence: "DAILY",
            recipients: input.alertRecipients,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: membership.organizationId,
          projectId: project.id,
          userId: user.id,
          entityType: "Project",
          entityId: project.id,
          action: "ONBOARD",
          newValue: { proposedExpression },
        },
      });

      return { project, brand, monitoringQuery };
    });

    return NextResponse.json(result, { status: 201 });
  });
}
