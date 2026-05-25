import { defineConfig, devices } from "@playwright/test";

const SKIP_BROWSER = process.env.SKIP_BROWSER === "1";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: SKIP_BROWSER
    ? [{ name: "api-only", testIgnore: /06-ui\.spec\.ts$/ }]
    : [
        { name: "api-only", testIgnore: /06-ui\.spec\.ts$/ },
        {
          name: "browser",
          testMatch: /06-ui\.spec\.ts$/,
          use: { ...devices["Desktop Chrome"] },
        },
      ],
});
