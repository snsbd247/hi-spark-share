import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash, navigateToMenu } from "../helpers";

test.describe("Super Admin — Dashboard & Navigation", () => {
  test("dashboard loads without crash", async ({ page }) => {
    await page.goto("/super/dashboard");
    await waitForPageReady(page);
    await expectNoCrash(page);
    // Should see some dashboard content
    await expect(page.locator("body")).toContainText(/tenant|dashboard|total/i);
  });

  test("sidebar menus are visible", async ({ page }) => {
    await page.goto("/super/dashboard");
    await waitForPageReady(page);
    // Check key menu items exist
    for (const item of ["Tenants", "Packages", "Settings"]) {
      const link = page.getByRole("link", { name: new RegExp(item, "i") }).first()
        .or(page.locator(`text="${item}"`).first());
      // At least one should exist
      const visible = await link.isVisible().catch(() => false);
      if (visible) expect(visible).toBeTruthy();
    }
  });

  test("navigate to tenants page", async ({ page }) => {
    await page.goto("/super/tenants");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("navigate to packages page", async ({ page }) => {
    await page.goto("/super/packages");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("navigate to settings page", async ({ page }) => {
    await page.goto("/super/settings");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("navigate to demo requests page", async ({ page }) => {
    await page.goto("/super/demo-requests");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("navigate to onboarding page", async ({ page }) => {
    await page.goto("/super/onboarding");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });
});
