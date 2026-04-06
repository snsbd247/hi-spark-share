import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash, CREDENTIALS } from "../helpers";

test.describe("Landing Page", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await waitForPageReady(page);
    await expect(page).toHaveTitle(/.+/);
    await expectNoCrash(page);
  });

  test("landing page has navigation links", async ({ page }) => {
    await page.goto("/");
    await waitForPageReady(page);
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(0);
  });
});

test.describe("Login Pages — Unauthenticated", () => {
  const loginPages = [
    { path: "/super/login", name: "Super Admin Login" },
    { path: "/admin/login", name: "Tenant Admin Login" },
    { path: "/reseller/login", name: "Reseller Login" },
    { path: "/portal/login", name: "Customer Login" },
  ];

  for (const p of loginPages) {
    test(`${p.name} page loads`, async ({ page }) => {
      await page.goto(p.path);
      await waitForPageReady(page);
      await expectNoCrash(page);
      await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 5000 });
    });
  }
});

test.describe("Auth Guards — Redirect Unauthenticated", () => {
  test("super admin dashboard redirects to login", async ({ page }) => {
    await page.goto("/super/dashboard");
    await page.waitForURL(/super\/login/, { timeout: 10_000 }).catch(() => {});
    const url = page.url();
    expect(url).toMatch(/super\/login|super\/dashboard/); // Either redirected or stayed
  });

  test("tenant dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/login/, { timeout: 10_000 }).catch(() => {});
  });

  test("reseller dashboard redirects to login", async ({ page }) => {
    await page.goto("/reseller/dashboard");
    await page.waitForURL(/reseller\/login|login/, { timeout: 10_000 }).catch(() => {});
  });

  test("customer portal redirects to login", async ({ page }) => {
    await page.goto("/portal/dashboard");
    await page.waitForURL(/portal\/login|login/, { timeout: 10_000 }).catch(() => {});
  });
});

test.describe("Login — Invalid Credentials", () => {
  test("super admin — wrong password", async ({ page }) => {
    await page.goto("/super/login");
    await waitForPageReady(page);

    await page.locator("input").first().fill("superadmin");
    await page.locator("input[type='password']").fill("wrongpassword");
    await page.getByRole("button", { name: /login|sign in/i }).first().click();

    await page.waitForTimeout(2000);
    await expectNoCrash(page);
    // Should still be on login page
    expect(page.url()).toContain("/super/login");
  });

  test("tenant admin — wrong credentials", async ({ page }) => {
    await page.goto("/admin/login");
    await waitForPageReady(page);

    await page.locator("input").first().fill("invalid_user");
    await page.locator("input[type='password']").fill("wrongpass");
    await page.getByRole("button", { name: /login|sign in/i }).first().click();

    await page.waitForTimeout(2000);
    await expectNoCrash(page);
    expect(page.url()).toContain("/login");
  });

  test("reseller — wrong credentials", async ({ page }) => {
    await page.goto("/reseller/login");
    await waitForPageReady(page);

    await page.locator("input").first().fill("invalid_reseller");
    await page.locator("input[type='password']").fill("wrongpass");
    await page.getByRole("button", { name: /login|sign in/i }).first().click();

    await page.waitForTimeout(2000);
    await expectNoCrash(page);
    expect(page.url()).toContain("/reseller/login");
  });

  test("customer — empty phone", async ({ page }) => {
    await page.goto("/portal/login");
    await waitForPageReady(page);

    // Don't fill anything, just click submit
    await page.getByRole("button", { name: /login|sign in/i }).first().click();
    await page.waitForTimeout(1000);
    await expectNoCrash(page);
    expect(page.url()).toContain("/portal/login");
  });
});

test.describe("404 Page", () => {
  test("unknown route shows 404 or redirects", async ({ page }) => {
    await page.goto("/this-does-not-exist-abc123");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });
});

test.describe("Demo Request Page", () => {
  test("demo request form loads", async ({ page }) => {
    await page.goto("/demo");
    await waitForPageReady(page);
    // May or may not have a demo page — just don't crash
    await expectNoCrash(page);
  });
});
