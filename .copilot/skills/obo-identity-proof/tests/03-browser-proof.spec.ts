import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { FRONTEND_URL, decodeJwt, CHAT_TIMEOUT_MS } from "./helpers";

/**
 * PROOF 3 — Authentic full-stack proof through the real browser (gated by OBO_BROWSER=1).
 *
 * Connects to an already-running Edge over CDP (so the operator can complete any
 * interactive MSAL / MFA sign-in), drives the real frontend, and:
 *   1. Captures the POST /api/agent/chat body and reads the user token the SPA
 *      attached under mcpAccessTokens (proving the FRONTEND really sends a
 *      per-user delegated token, not a service credential).
 *   2. Asserts the rendered answer contains that token's Entra object id (oid)
 *      AND userPrincipalName — i.e. the agent reported THIS signed-in user via
 *      the OBO tool (identity binding end-to-end).
 *   3. Asserts the raw token never appears in the visible page text.
 *
 * CDP endpoint: OBO_CDP_URL (default http://localhost:9222).
 */
const CDP_URL = process.env.OBO_CDP_URL || "http://localhost:9222";
const DEMO_PROMPT =
  "Use your Microsoft Graph profile tool to look me up and report, for the signed-in user: " +
  "(1) displayName, (2) userPrincipalName, and (3) my Entra object id (the `id` field). " +
  "Answer ONLY from the tool result.";

test.describe("OBO browser proof (real sign-in)", () => {
  test.skip(process.env.OBO_BROWSER !== "1", "set OBO_BROWSER=1 to run the CDP browser proof");
  test.skip(!FRONTEND_URL, "set KRATOS_FRONTEND_URL to the deployed frontend");
  test.setTimeout(CHAT_TIMEOUT_MS + 180_000);

  let context: BrowserContext;

  test.afterAll(async () => {
    // Do not close the operator's Edge; just drop our connection.
    await context?.browser()?.close().catch(() => undefined);
  });

  test("signed-in user identity flows through chat -> OBO tool -> answer", async () => {
    const browser = await chromium.connectOverCDP(CDP_URL);
    context = browser.contexts()[0] ?? (await browser.newContext());

    // Capture the chat request body to extract the attached user token.
    let capturedToken: string | undefined;
    context.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/agent/chat")) {
        try {
          const data = JSON.parse(req.postData() || "{}");
          const tokens = data.mcpAccessTokens || {};
          capturedToken = tokens["graph-obo"] || (Object.values(tokens)[0] as string | undefined);
        } catch {
          /* ignore non-JSON */
        }
      }
    });

    const page: Page = context.pages().find((p) => p.url().startsWith(FRONTEND_URL)) ?? (await context.newPage());
    await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });

    // Ensure signed in. If the OBO sign-in button is present, click it and let the
    // operator finish MSAL in the popup/redirect. If already signed in, skip.
    const signInBtn = page.getByRole("button", { name: /sign in.*(on-behalf|obo)/i });
    if (await signInBtn.isVisible().catch(() => false)) {
      await signInBtn.click().catch(() => undefined);
    }
    // Wait until the UI shows a signed-in state ("Signed in: <name>").
    await page
      .getByText(/signed in:/i)
      .first()
      .waitFor({ timeout: 120_000 })
      .catch(() => undefined);

    // Send the demo prompt via the chat composer (role=textbox / textarea).
    const input = page
      .getByRole("textbox")
      .or(page.locator("textarea, [contenteditable='true']"))
      .first();
    await input.waitFor({ timeout: 30_000 });
    await input.click();
    await input.fill(DEMO_PROMPT);
    await input.press("Enter");

    // Wait for an answer to render (best-effort: the answer should mention a UPN).
    await page
      .getByText(/@/)
      .last()
      .waitFor({ timeout: CHAT_TIMEOUT_MS })
      .catch(() => undefined);

    const bodyText = (await page.locator("body").innerText()).toLowerCase();

    expect(capturedToken, "frontend must attach a per-user token under mcpAccessTokens").toBeTruthy();
    const claims = decodeJwt(capturedToken!);
    const oid: string = (claims.oid || claims.sub || "").toLowerCase();
    const upn: string = (claims.upn || claims.preferred_username || claims.unique_name || "").toLowerCase();

    expect(oid, "token must carry an oid").toBeTruthy();
    expect(
      bodyText.includes(oid),
      `rendered answer must contain the signed-in user's oid (${oid}) — proves the OBO tool ran as this user`,
    ).toBe(true);
    if (upn) {
      expect(bodyText.includes(upn), `rendered answer should contain the signed-in UPN (${upn})`).toBe(true);
    }
    // The raw bearer must never be visible on the page.
    expect(bodyText.includes(capturedToken!.toLowerCase()), "raw user token must NOT be visible in the page").toBe(false);
  });
});
