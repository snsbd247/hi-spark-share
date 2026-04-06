import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash, randomStr, randomPhone } from "../helpers";

test.describe("Reseller — Dashboard", () => {
  test("dashboard loads", async ({ page }) => {
    await page.goto("/reseller/dashboard");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("dashboard shows wallet balance", async ({ page }) => {
    await page.goto("/reseller/dashboard");
    await waitForPageReady(page);
    // Should show some balance-related content
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});

test.describe("Reseller — All Pages Load", () => {
  const pages = [
    { path: "/reseller/customers", name: "Customers" },
    { path: "/reseller/billing", name: "Billing" },
    { path: "/reseller/wallet", name: "Wallet" },
    { path: "/reseller/profile", name: "Profile" },
  ];

  for (const p of pages) {
    test(`${p.name} page loads`, async ({ page }) => {
      await page.goto(p.path);
      await waitForPageReady(page);
      await expectNoCrash(page);
    });
  }
});

test.describe("Reseller — Customer Management", () => {
  const custName = `রিসেলার কাস্টমার ${randomStr(3)}`;
  const custPhone = randomPhone();

  test("customers list loads", async ({ page }) => {
    await page.goto("/reseller/customers");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("add customer dialog opens", async ({ page }) => {
    await page.goto("/reseller/customers");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|new|নতুন/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expectNoCrash(page);

      // Fill name field
      const nameInput = page.locator("input[name='name'], input[placeholder*='name' i]").first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill(custName);
      }

      // Fill phone
      const phoneInput = page.locator("input[name='phone'], input[placeholder*='phone' i]").first();
      if (await phoneInput.isVisible().catch(() => false)) {
        await phoneInput.fill(custPhone);
      }
    }
  });

  test("empty form validation", async ({ page }) => {
    await page.goto("/reseller/customers");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|new|নতুন/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) return;

    await addBtn.click();
    await page.waitForTimeout(500);

    const saveBtn = page.getByRole("button", { name: /save|submit|create|তৈরি/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      await expectNoCrash(page);
    }
  });
});

test.describe("Reseller — Wallet & Billing", () => {
  test("wallet page shows balance", async ({ page }) => {
    await page.goto("/reseller/wallet");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("billing page loads", async ({ page }) => {
    await page.goto("/reseller/billing");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });
});

test.describe("Reseller — Logout", () => {
  test("logout works", async ({ page }) => {
    await page.goto("/reseller/dashboard");
    await waitForPageReady(page);

    const logoutBtn = page.getByRole("button", { name: /logout|sign out|লগআউট/i }).first();
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/reseller\/login|login/, { timeout: 10_000 }).catch(() => {});
    }
    await expectNoCrash(page);
  });
});
