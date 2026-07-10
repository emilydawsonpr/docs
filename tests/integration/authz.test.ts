import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getProjectAccess, requireProjectRole, roleAtLeast, canEditMonitoringLogic, ForbiddenError, NotFoundError } from "@/lib/rbac/permissions";

describe("RBAC / project access (integration, real local Postgres)", () => {
  let organizationId: string;
  let projectId: string;
  let ownerUserId: string;
  let viewerUserId: string;
  let strangerUserId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Test Org (authz.test.ts)", slug: `test-org-authz-${Date.now()}` } });
    organizationId = org.id;
    const project = await prisma.project.create({ data: { organizationId, name: "Test Project (authz.test.ts)" } });
    projectId = project.id;

    const owner = await prisma.user.create({
      data: { email: `owner-${Date.now()}@test.local`, name: "Owner", passwordHash: "x", memberships: { create: { organizationId, role: "OWNER" } } },
    });
    ownerUserId = owner.id;

    const viewer = await prisma.user.create({
      data: { email: `viewer-${Date.now()}@test.local`, name: "Viewer", passwordHash: "x", memberships: { create: { organizationId, role: "VIEWER" } } },
    });
    viewerUserId = viewer.id;

    const stranger = await prisma.user.create({ data: { email: `stranger-${Date.now()}@test.local`, name: "Stranger", passwordHash: "x" } });
    strangerUserId = stranger.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, viewerUserId, strangerUserId] } } }).catch(() => {});
  });

  it("resolves the owner's role correctly", async () => {
    const access = await getProjectAccess(ownerUserId, projectId);
    expect(access.role).toBe("OWNER");
  });

  it("resolves the viewer's role correctly", async () => {
    const access = await getProjectAccess(viewerUserId, projectId);
    expect(access.role).toBe("VIEWER");
  });

  it("throws ForbiddenError for a user with no membership at all", async () => {
    await expect(getProjectAccess(strangerUserId, projectId)).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError for a nonexistent project", async () => {
    await expect(getProjectAccess(ownerUserId, "nonexistent-project-id")).rejects.toThrow(NotFoundError);
  });

  it("requireProjectRole allows the owner to meet an ANALYST-or-above requirement", async () => {
    await expect(requireProjectRole(ownerUserId, projectId, "ANALYST")).resolves.toBeTruthy();
  });

  it("requireProjectRole rejects a viewer from an ANALYST-or-above requirement", async () => {
    await expect(requireProjectRole(viewerUserId, projectId, "ANALYST")).rejects.toThrow(ForbiddenError);
  });

  it("roleAtLeast / canEditMonitoringLogic never grant CLIENT_VIEWER edit access", () => {
    expect(roleAtLeast("CLIENT_VIEWER", "VIEWER")).toBe(false);
    expect(canEditMonitoringLogic("CLIENT_VIEWER")).toBe(false);
    expect(canEditMonitoringLogic("OWNER")).toBe(true);
    expect(canEditMonitoringLogic("VIEWER")).toBe(false);
    expect(canEditMonitoringLogic("ANALYST")).toBe(true);
  });
});
