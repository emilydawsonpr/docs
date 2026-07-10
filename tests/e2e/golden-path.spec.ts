import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke test of the golden path: register -> create a project ->
 * save and test a Boolean query -> activate it -> view the dashboard.
 * Covers acceptance-criteria items: "the application runs locally",
 * "authentication works", "a project can be created", "a Boolean query can
 * be saved and tested".
 */
test("register, create a project, save/test/activate a Boolean query, view dashboard", async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.fill("#organizationName", "E2E Test Agency");
  await page.fill("#name", "E2E Tester");
  await page.fill("#email", uniqueEmail);
  await page.fill("#password", "e2e-test-password-123");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/onboarding", { waitUntil: "commit", timeout: 15000 });
  await expect(page.getByText("Organization")).toBeVisible();

  // Quick-create path instead of the full wizard, to keep the smoke test fast.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Quick-create blank project" }).click();
  await page.fill("#project-name", "E2E Test Project");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.waitForURL("**/query-builder", { waitUntil: "commit", timeout: 15000 });

  await page.getByRole("button", { name: "+ New query" }).click();
  const expertTab = page.getByRole("tab", { name: "Expert" });
  await expertTab.click();
  await page.locator("textarea").fill('"E2E Test Brand" AND Canada');
  await page.getByRole("button", { name: "Save query" }).click();
  await expect(page.getByText("Saved", { exact: false })).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Test against recent results" }).click();
  await expect(page.getByText(/recent mentions matched/)).toBeVisible({ timeout: 10000 });

  const activeSwitch = page.locator("#active-switch");
  await activeSwitch.click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible({ timeout: 10000 });

  const projectId = page.url().match(/projects\/([^/]+)\/query-builder/)?.[1];
  expect(projectId).toBeTruthy();
  await page.goto(`/projects/${projectId}/dashboard`);
  await expect(page.getByText("Total mentions")).toBeVisible();
});
