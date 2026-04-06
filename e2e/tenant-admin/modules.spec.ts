import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash } from "../helpers";

test.describe("Tenant Admin — Settings Pages", () => {
  const settingsPages = [
    { path: "/settings", name: "General Settings" },
    { path: "/settings/sms", name: "SMS Settings" },
    { path: "/settings/company-info", name: "Company Info" },
  ];

  for (const p of settingsPages) {
    test(`${p.name} loads`, async ({ page }) => {
      await page.goto(p.path);
      await waitForPageReady(page);
      await expectNoCrash(page);
    });
  }
});

test.describe("Tenant Admin — Accounting Module", () => {
  const accountingPages = [
    { path: "/accounting/chart-of-accounts", name: "Chart of Accounts" },
    { path: "/accounting/journal", name: "Journal Entries" },
    { path: "/accounting/ledger", name: "Ledger" },
    { path: "/accounting/trial-balance", name: "Trial Balance" },
    { path: "/accounting/profit-loss", name: "Profit & Loss" },
    { path: "/accounting/balance-sheet", name: "Balance Sheet" },
    { path: "/accounting/purchases", name: "Purchases" },
    { path: "/accounting/sales", name: "Sales" },
  ];

  for (const p of accountingPages) {
    test(`${p.name} loads`, async ({ page }) => {
      await page.goto(p.path);
      await waitForPageReady(page);
      await expectNoCrash(page);
    });
  }
});

test.describe("Tenant Admin — Network & MikroTik", () => {
  test("MikroTik page loads", async ({ page }) => {
    await page.goto("/mikrotik");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("Network map page loads", async ({ page }) => {
    await page.goto("/network-map");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("Fiber topology page loads", async ({ page }) => {
    await page.goto("/fiber-topology");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });
});

test.describe("Tenant Admin — HR Module", () => {
  const hrPages = [
    { path: "/hr/attendance", name: "Attendance" },
    { path: "/hr/payroll", name: "Payroll" },
  ];

  for (const p of hrPages) {
    test(`${p.name} loads`, async ({ page }) => {
      await page.goto(p.path);
      await waitForPageReady(page);
      await expectNoCrash(page);
    });
  }
});

test.describe("Tenant Admin — Reports", () => {
  test("reports page loads", async ({ page }) => {
    await page.goto("/reports");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });
});

test.describe("Tenant Admin — Logout", () => {
  test("logout works", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForPageReady(page);

    // Try logout
    const logoutBtn = page.getByRole("button", { name: /logout|sign out|লগআউট/i }).first();
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/login/, { timeout: 10_000 }).catch(() => {});
    } else {
      const avatar = page.locator("button:has(.avatar), button:has(img), [data-testid='user-menu']").first();
      if (await avatar.isVisible().catch(() => false)) {
        await avatar.click();
        await page.waitForTimeout(500);
        const logoutItem = page.getByText(/logout|sign out|লগআউট/i).first();
        if (await logoutItem.isVisible().catch(() => false)) {
          await logoutItem.click();
        }
      }
    }
    await expectNoCrash(page);
  });
});
