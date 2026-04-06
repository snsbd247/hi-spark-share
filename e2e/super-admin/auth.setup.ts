import { test as setup } from "@playwright/test";
import { CREDENTIALS, waitForPageReady } from "../helpers";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../.auth/super-admin.json");

setup("authenticate as super admin", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/super/login");
  await waitForPageReady(page);

  const usernameInput = page.locator("input").first();
  const passwordInput = page.locator("input[type='password']");

  await usernameInput.fill(CREDENTIALS.superAdmin.username);
  await passwordInput.fill(CREDENTIALS.superAdmin.password);

  await page.getByRole("button", { name: /login|sign in|লগইন/i }).first().click();
  await page.waitForURL(/super\/(dashboard|tenants)/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  await page.context().storageState({ path: authFile });
});
