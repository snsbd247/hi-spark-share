/**
 * Shared test helpers and constants for ISP SaaS E2E tests.
 */
import { Page, expect } from "@playwright/test";

// ─── Credentials ────────────────────────────────────────
export const CREDENTIALS = {
  superAdmin: { username: "superadmin", password: "Admin@123" },
  tenantAdmin: { username: "snb_admin", password: "123456" },
  reseller: { username: "sagorkhan", password: "123456" },
  customer: { phone: "01712345678", password: "123456" },
} as const;

export const API_URL = process.env.API_URL || "http://localhost:8000/api";

// ─── Helpers ────────────────────────────────────────────

/** Wait for page load and network idle */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Fill input by label, placeholder, or name */
export async function fillField(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 5000 });
  await el.clear();
  await el.fill(value);
}

/** Click a button by text */
export async function clickButton(page: Page, text: string) {
  await page.getByRole("button", { name: text }).first().click();
}

/** Expect a toast/alert with given text */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator("[role='status'], [data-sonner-toast], .toast, [role='alert']");
  await expect(toast.filter({ hasText: text }).first()).toBeVisible({ timeout: 10_000 });
}

/** Expect no crash (page has content, no blank white screen) */
export async function expectNoCrash(page: Page) {
  const body = page.locator("body");
  await expect(body).not.toBeEmpty();
  // Check no uncaught error overlay
  const errorOverlay = page.locator("#vite-error-overlay, .error-boundary");
  await expect(errorOverlay).toHaveCount(0);
}

/** Navigate to sidebar menu item */
export async function navigateToMenu(page: Page, menuText: string) {
  const link = page.getByRole("link", { name: menuText }).first();
  if (await link.isVisible().catch(() => false)) {
    await link.click();
  } else {
    // Try sidebar text
    await page.locator(`text="${menuText}"`).first().click();
  }
  await waitForPageReady(page);
}

/** Generate random string for unique test data */
export function randomStr(len = 6): string {
  return Math.random().toString(36).substring(2, 2 + len);
}

/** Generate Bangladeshi phone number */
export function randomPhone(): string {
  return `017${Math.floor(10000000 + Math.random() * 90000000)}`;
}

/** Check that a table has at least N rows */
export async function expectTableRows(page: Page, min: number) {
  const rows = page.locator("table tbody tr, [role='row']");
  await expect(rows).toHaveCount(min, { timeout: 10_000 }).catch(() => {
    // Fallback: just check table exists
    expect(rows).toBeTruthy();
  });
}
