import { defineConfig } from "@playwright/test";

// The browser proof (03) drives the REAL frontend through an already-running
// Edge instance over CDP and needs an interactive/SSO MSAL session, so it only
// runs when OBO_BROWSER=1. The API/MCP-level proofs (01, 02) are headless and
// always run.
const BROWSER = process.env.OBO_BROWSER === "1";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: BROWSER
    ? [{ name: "all" }]
    : [{ name: "api", testIgnore: /03-browser-proof\.spec\.ts$/ }],
});
