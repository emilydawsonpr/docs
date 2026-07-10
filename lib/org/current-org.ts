import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/rbac/permissions";

/** A user's first organization membership (their "home" org for this MVP). */
export async function getPrimaryMembership(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
  if (!membership) {
    throw new ForbiddenError("You do not belong to any organization yet.");
  }
  return membership;
}
