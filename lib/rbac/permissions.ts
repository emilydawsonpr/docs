import { prisma } from "@/lib/db/prisma";
import type { MembershipRole } from "@prisma/client";

export class ForbiddenError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

// Ordered weakest -> strongest for numeric comparisons. CLIENT_VIEWER is
// intentionally *not* on this ladder: it is a parallel, restricted role
// (read approved dashboards/reports only) rather than a weaker VIEWER.
const ROLE_RANK: Record<Exclude<MembershipRole, "CLIENT_VIEWER">, number> = {
  VIEWER: 0,
  ANALYST: 1,
  ADMINISTRATOR: 2,
  OWNER: 3,
};

export function roleAtLeast(role: MembershipRole, min: Exclude<MembershipRole, "CLIENT_VIEWER">): boolean {
  if (role === "CLIENT_VIEWER") return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Can this role edit monitoring logic (queries, sources, alert rules, brand config)? */
export function canEditMonitoringLogic(role: MembershipRole): boolean {
  return role !== "CLIENT_VIEWER" && roleAtLeast(role, "ANALYST");
}

/** Can this role manage org/project membership and settings? */
export function canManageOrg(role: MembershipRole): boolean {
  return role !== "CLIENT_VIEWER" && roleAtLeast(role, "ADMINISTRATOR");
}

/** Can this role review/correct AI classifications? */
export function canReviewMentions(role: MembershipRole): boolean {
  return role !== "CLIENT_VIEWER" && roleAtLeast(role, "ANALYST");
}

/** Client viewers and viewers can only read; everyone else can read too. */
export function canView(_role: MembershipRole): boolean {
  return true;
}

interface ProjectAccess {
  role: MembershipRole;
  organizationId: string;
}

/**
 * Resolves the effective role a user has on a project: a project-level
 * override (ProjectMembership.role) takes precedence over the org-level
 * Membership role. Throws ForbiddenError/NotFoundError as appropriate.
 */
export async function getProjectAccess(userId: string, projectId: string): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true },
  });
  if (!project) throw new NotFoundError("Project not found");

  const [membership, projectMembership] = await Promise.all([
    prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: project.organizationId } },
    }),
    prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId, projectId } },
    }),
  ]);

  if (!membership && !projectMembership) {
    throw new ForbiddenError("You do not have access to this project");
  }

  const role = projectMembership?.role ?? membership?.role ?? "VIEWER";
  return { role, organizationId: project.organizationId };
}

export async function requireProjectRole(
  userId: string,
  projectId: string,
  min: Exclude<MembershipRole, "CLIENT_VIEWER">
): Promise<ProjectAccess> {
  const access = await getProjectAccess(userId, projectId);
  if (!roleAtLeast(access.role, min)) {
    throw new ForbiddenError(`Requires role >= ${min}`);
  }
  return access;
}
