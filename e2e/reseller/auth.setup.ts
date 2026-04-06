import { test as setup } from "@playwright/test";
import { CREDENTIALS, waitForPageReady } from "../helpers";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "../.auth/reseller.json");

setup("authenticate as reseller", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/reseller/login");
  await waitForPageReady(page);

  const usernameInput = page.locator("input").first();
  const passwordInput = page.locator("input[type='password']");

  await usernameInput.fill(CREDENTIALS.reseller.username);
  await passwordInput.fill(CREDENTIALS.reseller.password);

  await page.getByRole("button", { name: /login|sign in|লগইন/i }).first().click();

  await page.waitForURL(/reseller\/(dashboard|customers)/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  await page.context().storageState({ path: authFile });
});
