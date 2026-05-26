import { test, expect, request } from "@playwright/test";
import { BACKEND_URL, USE_CASES } from "./helpers";

test.describe("evals scenarios per use-case", () => {
  for (const useCase of USE_CASES) {
    test(`${useCase}: scenarios endpoint returns >= 1 scenario`, async () => {
      const api = await request.newContext();
      const resp = await api.get(
        `${BACKEND_URL}/api/use-cases/${useCase}/evals/scenarios`,
      );
      expect(resp.status(), `${useCase} scenarios status`).toBe(200);
      const body = await resp.json();
      expect(body, "scenarios body shape").toHaveProperty("scenarios");
      const scenarios = body.scenarios as unknown[];
      expect(scenarios.length, `${useCase}: should have >= 1 scenario`).toBeGreaterThan(0);

      const first = scenarios[0] as Record<string, unknown>;
      expect(first.name, `${useCase}: scenario.name`).toBeTruthy();
      expect(
        first.input_message,
        `${useCase}: scenario.input_message`,
      ).toBeTruthy();
    });
  }
});
