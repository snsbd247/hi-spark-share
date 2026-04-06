import { test as setup } from "@playwright/test";
import { CREDENTIALS, waitForPageReady } from "../helpers";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "../.auth/tenant-admin.json");

setup("authenticate as tenant admin", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/admin/login");
  await waitForPageReady(page);

  const inputs = page.locator("input");
  const usernameInput = inputs.first();
  const passwordInput = page.locator("input[type='password']");

  await usernameInput.fill(CREDENTIALS.tenantAdmin.username);
  await passwordInput.fill(CREDENTIALS.tenantAdmin.password);

  await page.getByRole("button", { name: /login|sign in|লগইন/i }).first().click();

  // Wait for dashboard or force-password-change
  await page.waitForURL(/dashboard|force-password/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  await page.context().storageState({ path: authFile });
});
