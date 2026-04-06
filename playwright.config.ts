import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "reports/e2e-results.xml" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "super-admin",
      testDir: "./e2e/super-admin",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/super-admin.json" },
      dependencies: ["super-admin-setup"],
    },
    {
      name: "super-admin-setup",
      testDir: "./e2e/super-admin",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "tenant-admin",
      testDir: "./e2e/tenant-admin",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/tenant-admin.json" },
      dependencies: ["tenant-admin-setup"],
    },
    {
      name: "tenant-admin-setup",
      testDir: "./e2e/tenant-admin",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "reseller",
      testDir: "./e2e/reseller",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/reseller.json" },
      dependencies: ["reseller-setup"],
    },
    {
      name: "reseller-setup",
      testDir: "./e2e/reseller",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "customer",
      testDir: "./e2e/customer",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/customer.json" },
      dependencies: ["customer-setup"],
    },
    {
      name: "customer-setup",
      testDir: "./e2e/customer",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "no-auth",
      testDir: "./e2e/general",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run preview",
        port: 4173,
        reuseExistingServer: true,
      },
});
