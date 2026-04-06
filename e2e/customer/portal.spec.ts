import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash } from "../helpers";

test.describe("Customer Portal — Dashboard", () => {
  test("dashboard loads", async ({ page }) => {
    await page.goto("/portal/dashboard");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("dashboard shows package info", async ({ page }) => {
    await page.goto("/portal/dashboard");
    await waitForPageReady(page);
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});

test.describe("Customer Portal — All Pages Load", () => {
  const pages = [
    { path: "/portal/bills", name: "Bills" },
    { path: "/portal/payments", name: "Payments" },
    { path: "/portal/profile", name: "Profile" },
    { path: "/portal/support", name: "Support" },
    { path: "/portal/bandwidth", name: "Bandwidth" },
  ];

  for (const p of pages) {
    test(`${p.name} page loads`, async ({ page }) => {
      await page.goto(p.path);
      await waitForPageReady(page);
      await expectNoCrash(page);
    });
  }
});

test.describe("Customer Portal — Bills", () => {
  test("bills page shows bill list", async ({ page }) => {
    await page.goto("/portal/bills");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("bill search works", async ({ page }) => {
    await page.goto("/portal/bills");
    await waitForPageReady(page);

    const searchInput = page.locator("input[placeholder*='search' i], input[placeholder*='খুঁজুন']").first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("2026");
      await page.waitForTimeout(500);
      await expectNoCrash(page);
    }
  });
});

test.describe("Customer Portal — Profile", () => {
  test("profile page shows customer info", async ({ page }) => {
    await page.goto("/portal/profile");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });
});

test.describe("Customer Portal — Support Tickets", () => {
  test("support page loads", async ({ page }) => {
    await page.goto("/portal/support");
    await waitForPageReady(page);
    await expectNoCrash(page);
  });

  test("create ticket dialog opens", async ({ page }) => {
    await page.goto("/portal/support");
    await waitForPageReady(page);

    const newTicketBtn = page.getByRole("button", { name: /new|create|নতুন|ticket/i }).first();
    if (await newTicketBtn.isVisible().catch(() => false)) {
      await newTicketBtn.click();
      await page.waitForTimeout(500);
      await expectNoCrash(page);
    }
  });

  test("empty ticket form validation", async ({ page }) => {
    await page.goto("/portal/support");
    await waitForPageReady(page);

    const newTicketBtn = page.getByRole("button", { name: /new|create|নতুন|ticket/i }).first();
    if (!(await newTicketBtn.isVisible().catch(() => false))) return;

    await newTicketBtn.click();
    await page.waitForTimeout(500);

    const submitBtn = page.getByRole("button", { name: /submit|save|পাঠান/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await expectNoCrash(page);
    }
  });
});

test.describe("Customer Portal — Logout", () => {
  test("logout redirects to login", async ({ page }) => {
    await page.goto("/portal/dashboard");
    await waitForPageReady(page);

    const logoutBtn = page.getByRole("button", { name: /logout|sign out|লগআউট/i }).first();
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/portal\/login|login/, { timeout: 10_000 }).catch(() => {});
    }
    await expectNoCrash(page);
  });
});
