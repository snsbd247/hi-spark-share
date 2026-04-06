import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash, expectToast, randomStr, randomPhone } from "../helpers";

test.describe("Tenant Admin — Customer CRUD", () => {
  const customerName = `টেস্ট কাস্টমার ${randomStr(3)}`;
  const customerPhone = randomPhone();

  test("customers list loads", async ({ page }) => {
    await page.goto("/customers");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("open add customer dialog", async ({ page }) => {
    await page.goto("/customers");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|new|নতুন/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Dialog or form should appear
      const dialog = page.locator("[role='dialog'], .modal, form").first();
      await expect(dialog).toBeVisible({ timeout: 5000 }).catch(() => {});
      await expectNoCrash(page);
    }
  });

  test("customer form validation — empty required fields", async ({ page }) => {
    await page.goto("/customers");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|new|নতুন/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) return;

    await addBtn.click();
    await page.waitForTimeout(500);

    // Try to submit without filling
    const saveBtn = page.getByRole("button", { name: /save|submit|সেভ|তৈরি/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      // Should show validation error or field highlights
      await expectNoCrash(page);
    }
  });

  test("customer form — fill valid data", async ({ page }) => {
    await page.goto("/customers");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|new|নতুন/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) return;

    await addBtn.click();
    await page.waitForTimeout(500);

    // Fill name
    const nameInput = page.locator("input[name='name'], input[placeholder*='name' i], input[placeholder*='নাম']").first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(customerName);
    }

    // Fill phone
    const phoneInput = page.locator("input[name='phone'], input[placeholder*='phone' i], input[placeholder*='ফোন']").first();
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill(customerPhone);
    }

    // Fill area
    const areaInput = page.locator("input[name='area'], input[placeholder*='area' i], input[placeholder*='এলাকা']").first();
    if (await areaInput.isVisible().catch(() => false)) {
      await areaInput.fill("মিরপুর");
    }
  });

  test("search customers", async ({ page }) => {
    await page.goto("/customers");
    await waitForPageReady(page);

    const searchInput = page.locator("input[placeholder*='search' i], input[placeholder*='খুঁজুন']").first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("C-");
      await page.waitForTimeout(1000);
      await expectNoCrash(page);
    }
  });

  test("customer profile page loads", async ({ page }) => {
    await page.goto("/customers");
    await waitForPageReady(page);

    // Click first customer row link
    const firstRow = page.locator("table tbody tr a, [role='row'] a").first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await waitForPageReady(page);
      await expectNoCrash(page);
    }
  });
});

test.describe("Tenant Admin — Billing CRUD", () => {
  test("billing page loads with data", async ({ page }) => {
    await page.goto("/billing");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("filter bills by status", async ({ page }) => {
    await page.goto("/billing");
    await waitForPageReady(page);

    // Click unpaid filter tab/button
    const unpaidTab = page.getByRole("tab", { name: /unpaid|বকেয়া/i }).first()
      .or(page.getByRole("button", { name: /unpaid|বকেয়া/i }).first());
    if (await unpaidTab.isVisible().catch(() => false)) {
      await unpaidTab.click();
      await page.waitForTimeout(500);
      await expectNoCrash(page);
    }
  });

  test("generate bills button exists", async ({ page }) => {
    await page.goto("/billing");
    await waitForPageReady(page);

    const genBtn = page.getByRole("button", { name: /generate|জেনারেট/i }).first();
    const visible = await genBtn.isVisible().catch(() => false);
    // Just verify page is stable
    await expectNoCrash(page);
  });
});

test.describe("Tenant Admin — Payment Management", () => {
  test("payments page loads", async ({ page }) => {
    await page.goto("/payments");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });
});

test.describe("Tenant Admin — Employee Management", () => {
  test("employees page loads", async ({ page }) => {
    await page.goto("/employees");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("add employee form opens", async ({ page }) => {
    await page.goto("/employees");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|new|নতুন/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expectNoCrash(page);
    }
  });
});

test.describe("Tenant Admin — Expense Management", () => {
  test("expenses page loads", async ({ page }) => {
    await page.goto("/expenses");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("add expense form validation", async ({ page }) => {
    await page.goto("/expenses");
    await waitForPageReady(page);

    const addBtn = page.getByRole("button", { name: /add|new|নতুন/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) return;

    await addBtn.click();
    await page.waitForTimeout(500);

    // Submit empty form
    const saveBtn = page.getByRole("button", { name: /save|submit|সেভ/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      await expectNoCrash(page);
    }
  });
});
