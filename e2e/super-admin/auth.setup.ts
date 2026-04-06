import { test as setup } from "@playwright/test";
import { CREDENTIALS, waitForPageReady } from "../helpers";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "../.auth/super-admin.json");

setup("authenticate as super admin", async ({ page }) => {
  // Ensure auth dir exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/super/login");
  await waitForPageReady(page);

  // Fill login form
  const inputs = page.locator("input");
  const usernameInput = inputs.first();
  const passwordInput = page.locator("input[type='password']");

  await usernameInput.fill(CREDENTIALS.superAdmin.username);
  await passwordInput.fill(CREDENTIALS.superAdmin.password);

  await page.getByRole("button", { name: /login|sign in|লগইন/i }).first().click();

  // Wait for redirect to dashboard
  await page.waitForURL(/super\/(dashboard|tenants)/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  // Save auth state
  await page.context().storageState({ path: authFile });
});
