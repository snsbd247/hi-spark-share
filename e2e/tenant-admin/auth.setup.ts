import { test as setup } from "@playwright/test";
import { CREDENTIALS, waitForPageReady } from "../helpers";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../.auth/tenant-admin.json");

setup("authenticate as tenant admin", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/admin/login");
  await waitForPageReady(page);

  const usernameInput = page.locator("input").first();
  const passwordInput = page.locator("input[type='password']");

  await usernameInput.fill(CREDENTIALS.tenantAdmin.username);
  await passwordInput.fill(CREDENTIALS.tenantAdmin.password);

  await page.getByRole("button", { name: /login|sign in|লগইন/i }).first().click();
  await page.waitForURL(/dashboard|force-password/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  await page.context().storageState({ path: authFile });
});
