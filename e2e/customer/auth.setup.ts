import { test as setup } from "@playwright/test";
import { CREDENTIALS, waitForPageReady } from "../helpers";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../.auth/customer.json");

setup("authenticate as customer", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/portal/login");
  await waitForPageReady(page);

  const phoneInput = page.locator("input[type='tel'], input[placeholder*='phone' i], input[placeholder*='ফোন'], input[name*='phone']").first()
    .or(page.locator("input").first());
  const passwordInput = page.locator("input[type='password']");

  await phoneInput.fill(CREDENTIALS.customer.phone);
  await passwordInput.fill(CREDENTIALS.customer.password);

  await page.getByRole("button", { name: /login|sign in|লগইন/i }).first().click();
  await page.waitForURL(/portal\/(dashboard|bills|home)/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  await page.context().storageState({ path: authFile });
});
