import { test, expect } from "@playwright/test";
import { FRONTEND_URL } from "./helpers";

test.describe("UI smoke (browser)", () => {
  test("home page renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/.+/);

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(
      bodyText.length,
      "body should have visible text after hydration",
    ).toBeGreaterThan(50);

    const cspNoise = errors.filter(
      (e) => !/csp|content security policy|favicon|hydration/i.test(e),
    );
    expect(cspNoise, `unexpected JS errors: ${cspNoise.join(" | ")}`).toEqual([]);
  });
});
