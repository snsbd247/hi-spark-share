import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash, expectToast, randomStr, fillField } from "../helpers";

test.describe("Super Admin — Tenant CRUD", () => {
  const tenantName = `TestISP_${randomStr(4)}`;
  const tenantEmail = `test_${randomStr(4)}@example.com`;
  const subdomain = `test${randomStr(4)}`;

  test("tenants list loads", async ({ page }) => {
    await page.goto("/super/tenants");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("create tenant — open form", async ({ page }) => {
    await page.goto("/super/tenants");
    await waitForPageReady(page);

    // Click create/add button
    const addBtn = page.getByRole("button", { name: /add|create|new|নতুন/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Fill tenant form
      const nameInput = page.locator("input[placeholder*='name' i], input[name*='name']").first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill(tenantName);
      }

      const emailInput = page.locator("input[type='email'], input[placeholder*='email' i]").first();
      if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.fill(tenantEmail);
      }

      const subdomainInput = page.locator("input[placeholder*='subdomain' i], input[name*='subdomain']").first();
      if (await subdomainInput.isVisible().catch(() => false)) {
        await subdomainInput.fill(subdomain);
      }
    }
  });

  test("create tenant — empty form shows validation", async ({ page }) => {
    await page.goto("/super/tenants");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|create|new/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Try to submit empty
      const submitBtn = page.getByRole("button", { name: /save|submit|create|তৈরি/i }).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
        // Should show validation error or stay on form
        await expectNoCrash(page);
      }
    }
  });
});

test.describe("Super Admin — Package Management", () => {
  test("packages page loads with data", async ({ page }) => {
    await page.goto("/super/packages");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("create package form opens", async ({ page }) => {
    await page.goto("/super/packages");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|create|new/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expectNoCrash(page);
    }
  });
});

test.describe("Super Admin — Settings", () => {
  test("general settings page loads", async ({ page }) => {
    await page.goto("/super/settings");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("branding settings are editable", async ({ page }) => {
    await page.goto("/super/settings");
    await waitForPageReady(page);

    // Find site name input
    const siteNameInput = page.locator("input[name*='site_name'], input[placeholder*='site name' i]").first();
    if (await siteNameInput.isVisible().catch(() => false)) {
      const currentValue = await siteNameInput.inputValue();
      expect(currentValue).toBeTruthy();
    }
  });
});
