import { test, expect } from "@playwright/test";

test.describe("DB Simplifier smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("app loads and shows title", async ({ page }) => {
    await expect(page.locator(".topbar__title")).toContainText("DB Simplifier");
  });

  test("environment switcher is visible", async ({ page }) => {
    await expect(page.locator(".env-select")).toBeVisible();
  });

  test("query editor is present with run button", async ({ page }) => {
    await expect(page.locator(".query-editor")).toBeVisible();
    await expect(page.locator(".run-button")).toBeVisible();
  });

  test("python cell is collapsed by default", async ({ page }) => {
    const toggle = page.locator(".python-cell__toggle");
    await expect(toggle).toBeVisible();
    await expect(page.locator(".python-cell__body")).not.toBeVisible();
  });

  test("results placeholder shown before any query", async ({ page }) => {
    await expect(page.locator(".results-placeholder")).toContainText("Run a query");
  });
});
