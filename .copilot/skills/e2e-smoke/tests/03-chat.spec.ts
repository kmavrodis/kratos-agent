import { test, expect } from "@playwright/test";
import { chatOnce, CHAT_TIMEOUT_MS } from "./helpers";

test.describe("chat round-trip", () => {
  test.setTimeout(CHAT_TIMEOUT_MS * 2 + 30_000);

  test("agent responds to a tiny prompt for the 'generic' use-case", async () => {
    // Best-effort warmup; tolerate cold-start.
    await chatOnce("ping", "generic", 30_000).catch(() => undefined);

    const { text, ok, status } = await chatOnce(
      "Reply with exactly one short sentence confirming you are online.",
      "generic",
    );

    expect(
      ok,
      `chat should succeed (status=${status}, text snippet="${text.slice(0, 200)}")`,
    ).toBe(true);
    expect(
      text.trim().length,
      "assistant response should be non-empty",
    ).toBeGreaterThan(0);
  });
});
