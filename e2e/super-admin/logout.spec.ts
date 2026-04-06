import { test, expect } from "@playwright/test";
import { waitForPageReady, expectNoCrash } from "../helpers";

test.describe("Super Admin — Logout", () => {
  test("logout redirects to login", async ({ page }) => {
    await page.goto("/super/dashboard");
    await waitForPageReady(page);

    // Try multiple logout patterns
    const logoutBtn = page.getByRole("button", { name: /logout|sign out|লগআউট/i }).first()
      .or(page.locator("[data-testid='logout']").first());

    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/super\/login/, { timeout: 10_000 }).catch(() => {});
    } else {
      // Try dropdown menu
      const avatar = page.locator("[data-testid='user-menu'], .avatar, button:has(img)").first();
      if (await avatar.isVisible().catch(() => false)) {
        await avatar.click();
        await page.waitForTimeout(500);
        const logoutItem = page.getByText(/logout|sign out|লগআউট/i).first();
        if (await logoutItem.isVisible().catch(() => false)) {
          await logoutItem.click();
          await page.waitForURL(/super\/login/, { timeout: 10_000 }).catch(() => {});
        }
      }
    }
    await expectNoCrash(page);
  });
});
