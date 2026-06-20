import { test, expect } from "@playwright/test";
import {
  BACKEND_URL,
  USER_TOKEN,
  decodeJwt,
  chatWithToken,
  CHAT_TIMEOUT_MS,
} from "./helpers";

/**
 * PROOF 1 — Identity binding (the clincher).
 *
 * Given a real user access token (SPA-issued, aud = the OBO MCP server), we ask
 * the agent "who am I" and assert that the profile it returns was fetched for
 * EXACTLY the principal inside that token:
 *
 *   token.oid (Entra object id)  ==  Graph /me `id` surfaced by the tool
 *
 * The agent's own managed identity could never produce this — Graph `/me` only
 * resolves in a delegated user context. So a matching oid is dispositive proof
 * the `graph-obo` tool ran On-Behalf-Of the signed-in user.
 *
 * Headless mode: set OBO_USER_TOKEN to a freshly-acquired user token. Without it
 * the test self-skips (use 03-browser-proof for the full interactive flow).
 */
test.describe("OBO identity binding", () => {
  test.skip(!BACKEND_URL, "set KRATOS_BACKEND_URL to the deployed backend");
  test.skip(
    !USER_TOKEN,
    "set OBO_USER_TOKEN to a real SPA-issued user token (aud=api://<mcp-server>/...). " +
      "Acquire it from the signed-in frontend, or run 03-browser-proof.",
  );
  test.setTimeout(CHAT_TIMEOUT_MS * 2 + 30_000);

  const DEMO_PROMPT =
    "Use your Microsoft Graph profile tool to look me up and report, for the " +
    "signed-in user: (1) displayName, (2) userPrincipalName, and (3) my Entra " +
    "object id (the `id` field). Answer ONLY from the tool result.";

  test("agent returns the profile of the exact principal in the user token", async () => {
    const claims = decodeJwt(USER_TOKEN);
    const oid: string | undefined = claims.oid;
    const upn: string | undefined = claims.preferred_username || claims.upn || claims.unique_name;
    expect(oid, "token must carry an oid claim").toBeTruthy();

    // Warm up (tolerate Foundry cold-start) then run the real prompt.
    await chatWithToken("ping", USER_TOKEN, undefined, 30_000).catch(() => undefined);
    const { text, rawTranscript, ok, status } = await chatWithToken(DEMO_PROMPT, USER_TOKEN);

    expect(ok, `chat should succeed (status=${status}, snippet="${text.slice(0, 200)}")`).toBe(true);

    // BINDING: the oid from the token must appear in the answer (it is the
    // Graph /me `id`). This is the proof the tool ran as THIS user.
    expect(
      text.includes(oid!),
      `answer must contain the token's oid (${oid}) — proves Graph /me ran as the signed-in user.\nGot: ${text.slice(0, 600)}`,
    ).toBe(true);

    if (upn) {
      expect(
        text.toLowerCase().includes(upn.toLowerCase()),
        `answer should also surface the UPN (${upn})`,
      ).toBe(true);
    }

    // NON-LEAK: the raw bearer token must never appear in the model/user-visible stream.
    expect(
      rawTranscript.includes(USER_TOKEN),
      "raw user token must NEVER appear in the chat transcript",
    ).toBe(false);
  });
});
