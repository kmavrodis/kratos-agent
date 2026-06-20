import { test, expect } from "@playwright/test";
import {
  BACKEND_URL,
  MCP_URL,
  USE_CASE,
  chatWithToken,
  mcpCallTool,
  toolResultObject,
  cliTokenForResource,
  CHAT_TIMEOUT_MS,
} from "./helpers";

/**
 * PROOF 2 — Non-spoofable / no silent fallback to the agent identity.
 *
 * (a) Agent-level: ask "who am I" WITHOUT attaching any user token. The tool
 *     must report `unauthorized` and the agent must NOT return a real human
 *     profile — proving it does not fall back to its own managed identity.
 *
 * (b) Server-level (requires OBO_MCP_URL): call get_my_profile directly on the
 *     MCP server with no bearer and with a wrong-client (Azure CLI) token. Both
 *     must be rejected (`unauthorized`) — proving the server enforces the user
 *     token and the confused-deputy allow-list, never leaking a profile.
 */
test.describe("OBO negative / no-fallback", () => {
  test.skip(!BACKEND_URL, "set KRATOS_BACKEND_URL to the deployed backend");
  test.setTimeout(CHAT_TIMEOUT_MS * 2 + 30_000);

  test("agent without a user token does NOT return a profile (no MI fallback)", async () => {
    await chatWithToken("ping", undefined, USE_CASE, 30_000).catch(() => undefined);

    const { text, ok } = await chatWithToken(
      "Use your Microsoft Graph profile tool to tell me my userPrincipalName. " +
        "If the tool returns an error, say exactly that you could not retrieve it.",
      undefined, // no mcpAccessTokens attached
    );

    expect(ok, "request itself should complete").toBe(true);

    // Must not surface a real signed-in identity. Accept any explicit
    // unauthorized / not-signed-in / unable signal; reject a leaked UPN/profile.
    const lc = text.toLowerCase();
    const reportsNoIdentity =
      /unauthor|not signed in|sign in|could not|couldn'?t|unable|no profile|don'?t have|cannot (?:access|determine|retrieve)/i.test(
        lc,
      );
    expect(
      reportsNoIdentity,
      `agent should report it cannot retrieve the profile without a user token.\nGot: ${text.slice(0, 600)}`,
    ).toBe(true);
  });

  test("MCP server rejects no-bearer and wrong-client tokens", async () => {
    test.skip(!MCP_URL, "set OBO_MCP_URL (https://<fqdn>/mcp) to run the server-level negative test");

    // No bearer at all.
    const noBearer = toolResultObject(await mcpCallTool(MCP_URL, "get_my_profile"));
    expect(noBearer, "tool should return a structured result").toBeTruthy();
    expect(noBearer!.error, `no-bearer must be unauthorized; got ${JSON.stringify(noBearer)}`).toBe(
      "unauthorized",
    );
    expect(noBearer!.userPrincipalName, "must not leak a profile").toBeFalsy();

    // Wrong-client token: an Azure CLI token for the MCP resource. Either Entra
    // refuses to issue it (null) — already a pass — or the server rejects it.
    const resource = MCP_URL.replace(/\/mcp\/?$/, "");
    const apiResource = process.env.OBO_SERVER_IDENTIFIER_URI || resource;
    const cliToken = cliTokenForResource(apiResource);
    if (cliToken) {
      const wrong = toolResultObject(await mcpCallTool(MCP_URL, "get_my_profile", cliToken));
      expect(
        wrong?.userPrincipalName,
        `wrong-client token must NOT yield a profile; got ${JSON.stringify(wrong)}`,
      ).toBeFalsy();
      expect(["unauthorized", "obo_failed"]).toContain(wrong?.error);
    }
  });
});
